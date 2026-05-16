import { DurableObject } from "cloudflare:workers";
import * as Y from "yjs";
import * as sync from "y-protocols/sync";
import * as awareness from "y-protocols/awareness";
import { createDecksDoc } from "@repo/schema-sync";
import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";

interface Env {
    DECK_DOCS: DurableObjectNamespace<DeckDocDO>;
}

export class DeckDocDO extends DurableObject {
    doc: Y.Doc;
    sessions: Map<WebSocket, { awareness: awareness.Awareness }> = new Map();

    constructor(state: DurableObjectState, env: Env) {
        super(state, env);
        this.doc = createDecksDoc();

        // Load state from storage
        this.ctx.blockConcurrencyWhile(async () => {
            const saved = await this.ctx.storage.get<Uint8Array>("doc");
            if (saved) {
                Y.applyUpdate(this.doc, saved);
            }
        });

        // Listen for updates and save to storage
        this.doc.on("update", (update) => {
            this.ctx.storage.put("doc", Y.encodeStateAsUpdate(this.doc));

            // Broadcast to all connected clients
            for (const [ws, _] of this.sessions) {
                const encoder = encoding.createEncoder();
                encoding.writeUint8(encoder, 0); // messageSync
                sync.writeUpdate(encoder, update);
                ws.send(encoding.toUint8Array(encoder));
            }
        });
    }

    override async fetch(request: Request) {
        const upgradeHeader = request.headers.get("Upgrade");
        if (!upgradeHeader || upgradeHeader !== "websocket") {
            return new Response("Expected Upgrade: websocket", { status: 426 });
        }

        const pair = new WebSocketPair();
        const client = pair[0];
        const server = pair[1];

        await this.handleSession(server);

        return new Response(null, {
            status: 101,
            webSocket: client,
        });
    }

    async handleSession(ws: WebSocket) {
        ws.accept();

        const sessionAwareness = new awareness.Awareness(this.doc);
        this.sessions.set(ws, { awareness: sessionAwareness });

        ws.addEventListener("message", (event) => {
            const message = new Uint8Array(event.data as ArrayBuffer);
            const encoder = encoding.createEncoder();
            const decoder = decoding.createDecoder(message);
            const messageType = decoding.readUint8(decoder);

            switch (messageType) {
                case 0: // messageSync
                    encoding.writeUint8(encoder, 0);
                    sync.readSyncMessage(decoder, encoder, this.doc, null);
                    if (encoding.length(encoder) > 1) {
                        ws.send(encoding.toUint8Array(encoder));
                    }
                    break;
                case 1: // messageAwareness
                    awareness.applyAwarenessUpdate(
                        sessionAwareness,
                        decoding.readVarUint8Array(decoder),
                        ws,
                    );
                    break;
            }
        });

        ws.addEventListener("close", () => {
            this.sessions.delete(ws);
        });
    }
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        const deckId = url.pathname.split("/")[2];

        if (!deckId) {
            return new Response("Missing deck ID", { status: 400 });
        }

        const id = env.DECK_DOCS.idFromName(deckId);
        const obj = env.DECK_DOCS.get(id);

        return obj.fetch(request);
    },
};
