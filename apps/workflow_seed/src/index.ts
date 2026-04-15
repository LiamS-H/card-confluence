import {
    WorkflowEntrypoint,
    type WorkflowEvent,
    WorkflowStep,
} from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import type { ISearchSettings, ScryfallBulkData } from "scryfall-ts-bindings";
import {
    fetchAllTags,
    fetchBulk,
    fetchSearch,
    fetchSets,
} from "scryfall-ts-bindings";
import { init, parquets_from_json } from "wasm-workflow-seed";

interface Env {
    cc_parquet_latest: R2Bucket;
    cc_parquet_history: R2Bucket;
    workflow_seed: Workflow;
}
type Params = {};

const SCRYFALL_DELAY = 500;
const MAX_STEP_RUNTIME = 5 * 60 * 1000; // 5 minutes

export class WorkflowSeed extends WorkflowEntrypoint<Env, Params> {
    runId = "null";
    private async bulk_fetch(
        step: WorkflowStep,
        type: ScryfallBulkData["type"],
    ): Promise<string> {
        const bulkMetadata = await step.do(`${type}_fetch`, async () => {
            console.log(`[${this.runId}]${type}_fetching...`);

            const response = await fetchBulk(type);
            if (response.object === "error") {
                throw new Error(
                    `Scryfall error for ${type}: ${JSON.stringify(response)}`,
                );
            }
            return response;
        });

        return await step.do(`${type}_write`, async () => {
            console.log(`[${this.runId}]${type}_writing...`);
            const response = await fetch(bulkMetadata.download_uri);
            if (!response.ok || !response.body) {
                await response.body?.cancel();
                throw new Error(
                    `Failed to stream ${type}: ${response.statusText}`,
                );
            }
            try {
                const fileName = `.scryfall/${type}/${bulkMetadata.updated_at}.json`;
                await this.env.cc_parquet_history.put(fileName, response.body, {
                    httpMetadata: { contentType: "application/json" },
                });
                return fileName;
            } catch (error) {
                await response.body.cancel();
                throw error;
            }
        });
    }

    override async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
        this.runId = event.instanceId.split("-")[0] as string;
        const timestamp = await step.do("get_timestamp", async () =>
            new Date().toISOString(),
        );

        const oracle_path = await this.bulk_fetch(step, "oracle_cards");
        const prints_path = await this.bulk_fetch(step, "default_cards");
        const rulings_path = await this.bulk_fetch(step, "rulings");

        const sets_path = await step.do("sets_fetch_write", async () => {
            console.log(`[${this.runId}]sets_fetching...`);
            const response = await fetchSets();
            if (response.object === "error") {
                throw new Error(
                    `Scryfall error for sets: ${JSON.stringify(response)}`,
                );
            }
            const filename = `.scryfall/sets/${timestamp}.json`;
            console.log(`[${this.runId}]sets_writing...`);
            await this.env.cc_parquet_history.put(
                filename,
                JSON.stringify(response),
            );
            return filename;
        });

        const _tags = await step.do("tags_fetch", async () => {
            console.log(`[${this.runId}]tags_fetching...`);
            const response = await fetchAllTags();
            if (response.atags.length === 0 || response.otags.length === 0) {
                throw new NonRetryableError("failed to fetch tags");
            }
            return response;
        });
        const tags = { otags: _tags.otags.slice(0, 10) };

        await step.do("tags_write", async () => {
            console.log(`[${this.runId}]tags_writing...`);
            const filename = `.scryfall/tags/${timestamp}.json`;
            await this.env.cc_parquet_history.put(
                filename,
                JSON.stringify(tags),
            );
        });

        const settings: ISearchSettings = { unique: "cards" };
        const totalTags = tags.otags.length;
        let tagIndex = 0;
        let pageIndex = 1;

        while (tagIndex < totalTags) {
            const result = await step.do(
                `process_otags_from_${tagIndex}_page_${pageIndex}`,
                async () => {
                    const startTime = Date.now();
                    // Accumulate oracle_id -> otag[] for this chunk
                    const chunkMap: Record<string, string[]> = {};

                    let ti = tagIndex;
                    let pi = pageIndex;

                    while (ti < totalTags) {
                        if (Date.now() - startTime > MAX_STEP_RUNTIME) {
                            break;
                        }

                        const otag = tags.otags[ti];
                        if (!otag) {
                            throw new NonRetryableError(
                                `missing otag at index ${ti}`,
                            );
                        }

                        const query = `otag:"${otag}"`;
                        let hasMore = true;
                        let rateLimited = false;

                        while (hasMore) {
                            console.log(
                                `[${this.runId}]otags_fetching... "${query}" (${pi}) [${tagIndex},${totalTags}]`,
                            );
                            const response = await fetchSearch(query, {
                                ...settings,
                                page: pi,
                            });

                            if (response.object !== "error") {
                                for (const card of response.data) {
                                    const id =
                                        "oracle_id" in card
                                            ? card.oracle_id
                                            : card.card_faces[0]?.oracle_id;
                                    if (!id) continue;
                                    (chunkMap[id] ??= []).push(otag);
                                }
                                hasMore = response.has_more;
                                pi++;
                                await new Promise((r) =>
                                    setTimeout(r, SCRYFALL_DELAY),
                                );
                                continue;
                            }

                            if (
                                response.status === 404 &&
                                response.code === "not_found"
                            ) {
                                hasMore = false;
                                break;
                            }
                            if (response.status === 429) {
                                console.error("rate limited...");
                                rateLimited = true;
                                break;
                            }
                            throw new Error(
                                `Scryfall error for otag "${otag}": ${JSON.stringify(response)}`,
                            );
                        }

                        if (rateLimited) {
                            return {
                                tagIndex: ti,
                                pageIndex: pi,
                                rateLimited: true,
                                chunkMap,
                            };
                        }

                        ti++;
                        pi = 1;
                    }

                    return {
                        tagIndex: ti,
                        pageIndex: pi,
                        rateLimited: false,
                        chunkMap,
                    };
                },
            );

            // Persist whatever we collected in this chunk
            if (Object.keys(result.chunkMap).length > 0) {
                const chunkFile = `.scryfall/keywords/otags/${timestamp}/chunks/${result.tagIndex}${result.pageIndex}.json`;
                await step.do(
                    `write_chunk_${result.tagIndex}_${result.pageIndex}`,
                    async () => {
                        console.log(
                            `[${this.runId}]writing_chunk_${result.tagIndex}...`,
                        );
                        await this.env.cc_parquet_history.put(
                            chunkFile,
                            JSON.stringify(result.chunkMap),
                            {
                                httpMetadata: {
                                    contentType: "application/json",
                                },
                            },
                        );
                    },
                );
            }

            if (result.rateLimited) {
                await step.sleep(
                    `rate_limit_sleep_${result.tagIndex}`,
                    "61 seconds",
                );
            }

            tagIndex = result.tagIndex;
            pageIndex = result.pageIndex;
        }

        const otags_path = await step.do("merge_otags", async () => {
            const prefix = `.scryfall/keywords/otags/${timestamp}/chunks/`;
            const listed = await this.env.cc_parquet_history.list({ prefix });

            const merged: Record<string, string[]> = {};

            let i = 0;
            for (const obj of listed.objects) {
                i++;
                console.log(
                    `[${this.runId}]otags_merged_merging [${i}/${listed.objects.length}]`,
                );
                const r2obj = await this.env.cc_parquet_history.get(obj.key);
                if (!r2obj) continue;
                const chunk: Record<string, string[]> = await r2obj.json();
                for (const [oracleId, otags] of Object.entries(chunk)) {
                    if (merged[oracleId]) {
                        merged[oracleId].push(...otags);
                    } else {
                        merged[oracleId] = [...otags];
                    }
                }
            }

            console.log(`[${this.runId}]otags_merged_writing...`);
            const path = `.scryfall/keywords/otags/${timestamp}.json`;
            await this.env.cc_parquet_history.put(
                path,
                JSON.stringify(merged),
                { httpMetadata: { contentType: "application/json" } },
            );
            return path;
        });

        const parquet_paths = await step.do("write_parquet", async () => {
            console.log(`[${this.runId}]parquet_files_writing...`);
            init();
            return await parquets_from_json(this.env, {
                cards_path: oracle_path,
                prints_path,
                rulings_path,
                sets_path: sets_path,
                otags_path: otags_path,
            });
        });

        await step.do("copy_cards_latest", async () => {
            console.log(`[${this.runId}]parquet_cards_copying...`);
            const response = await this.env.cc_parquet_history.get(
                parquet_paths.cards_path,
            );
            if (!response || !response.body) {
                await response?.body?.cancel();
                throw new NonRetryableError(
                    `failed to get valid latest cards at ${parquet_paths.cards_path}`,
                );
            }
            await this.env.cc_parquet_latest.put(
                "cards.parquet",
                response.body,
            );
        });

        await step.do("copy_sets_latest", async () => {
            console.log(`[${this.runId}]parquet_cards_copying...`);
            const response = await this.env.cc_parquet_history.get(
                parquet_paths.cards_path,
            );
            if (!response || !response.body) {
                await response?.body?.cancel();
                throw new NonRetryableError(
                    `failed to get valid latest sets at ${parquet_paths.cards_path}`,
                );
            }
            await this.env.cc_parquet_latest.put("sets.parquet", response.body);
        });

        await step.do("copy_rulings_latest", async () => {
            console.log(`[${this.runId}]parquet_cards_copying...`);
            const response = await this.env.cc_parquet_history.get(
                parquet_paths.cards_path,
            );
            if (!response || !response.body) {
                await response?.body?.cancel();
                throw new NonRetryableError(
                    `failed to get valid latest rulings at ${parquet_paths.cards_path}`,
                );
            }
            await this.env.cc_parquet_latest.put(
                "rulings.parquet",
                response.body,
            );
            console.log(`[${this.runId}]seed complete!`);
        });
    }
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        const instanceId = url.searchParams.get("instanceId");

        if (instanceId) {
            const instance = await env.workflow_seed.get(instanceId);
            return Response.json(await instance.status());
        }

        const instance = await env.workflow_seed.create();
        return Response.json({ instanceId: instance.id });
    },
} satisfies ExportedHandler<Env>;
