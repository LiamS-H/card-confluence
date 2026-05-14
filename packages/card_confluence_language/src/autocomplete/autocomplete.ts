import {
    type Completion,
    type CompletionResult,
    type CompletionSection,
    type CompletionSource,
} from "@codemirror/autocomplete";

import { predicateFromView } from "../utils/predicate-from-view";
import { syntaxTree } from "@codemirror/language";
import { EditorSelection } from "@codemirror/state";

import { queryContextFacet } from "../query-context";
import {
    detailFromKeyword,
    isKeyword,
    KEYWORDS,
    nodeFromKeyword,
    predicateTypeFromKeyword,
} from "./completion";

const BEGIN_OPERATORS = [":", "<", ">", "=", "!"] as const;

const OPERATORS = [":", "=", "<", ">", "<=", ">=", "!="] as const;
const ASSERT_OPERATORS = [":", "="] as const;

// function argRec(argument: string, commit: boolean, from: number, to?: number) {}

export const completeCardConfluence: CompletionSource = async (context) => {
    if (!context.view) return null;

    const view = context.view;

    const pos = context.pos;

    const pred = predicateFromView(view, pos);

    const query_context = context.state.facet(queryContextFacet);

    if (!pred) {
        const cursor = syntaxTree(view.state).cursorAt(pos, -1);

        if (cursor.name === "BareWord") {
            const word = view.state.sliceDoc(cursor.node.from, cursor.node.to);
            const matches = KEYWORDS.filter((kw) => kw.includes(word));
            if (matches.length == 0) {
                return query_context.complete(pos);
            }

            const result: CompletionResult = {
                from: cursor.node.from,
                to: cursor.node.to,
                options: KEYWORDS.map((kw): Completion => {
                    const boost = kw.startsWith(word) ? 1 : -1;
                    const { detail, info } = detailFromKeyword(kw);
                    return {
                        label: kw,
                        boost,
                        detail,
                        info,
                    };
                }),
                commitCharacters: BEGIN_OPERATORS,
            };

            if (isKeyword(word)) {
                const node = nodeFromKeyword(word);
                const operators =
                    node.operator === "assign"
                        ? [":"]
                        : node.operator === "assert"
                          ? ASSERT_OPERATORS
                          : OPERATORS;
                result.options = result.options.concat(
                    operators.map(
                        (tag: string): Completion => ({
                            label: word + tag,
                            displayLabel: tag,
                            // boost: results === 1 ? 2 : 0,
                        }),
                    ),
                );
            }
            return result;
        }
        return null;
    }

    const { kw_start, keyword, op_start, val_start, value, predicate_end } =
        pred;

    const cursor_keyword = keyword;

    if (pos <= op_start) {
        const result: CompletionResult = {
            from: kw_start,
            to: op_start,
            options: KEYWORDS.map((kw) => {
                const boost = kw.startsWith(kw) ? 1 : -1;
                const { detail, info } = detailFromKeyword(kw);
                return {
                    label: kw,
                    boost,
                    detail,
                    info,
                };
            }),
        };
        if (isKeyword(cursor_keyword)) {
            const apply: Completion["apply"] = (view, completion) => {
                view.dispatch(
                    view.state.update({
                        changes: {
                            from: op_start,
                            to: val_start,
                            insert: completion.displayLabel,
                        },
                        selection: EditorSelection.cursor(
                            op_start + (completion.displayLabel?.length ?? 0),
                        ),
                        userEvent: "completion.apply",
                    }),
                );
            };
            const node = nodeFromKeyword(cursor_keyword);
            const operators =
                node.operator === "assign"
                    ? [":"]
                    : node.operator === "assert"
                      ? ASSERT_OPERATORS
                      : OPERATORS;
            result.options = result.options.concat(
                operators.map(
                    (op: string): Completion => ({
                        label: cursor_keyword + op,
                        displayLabel: op,
                        apply,
                    }),
                ),
            );
        }
        return result;
    }
    if (pos < val_start) {
        return {
            from: op_start,
            to: val_start,
            options: OPERATORS.map((op) => ({
                label: op,
            })),
            filter: false,
        };
    }

    if (value.at(1) === "/" && value.at(-1) === "/") {
        return null;
    }

    if (!isKeyword(cursor_keyword)) {
        return null;
    }

    const pred_typ = predicateTypeFromKeyword(cursor_keyword);
    const context_completion = await query_context.complete(pos);

    const sections = new Map<string, CompletionSection>();
    const options = context_completion.options.map((option) => {
        const { label, detail, info, group } = option;
        if (!group)
            return {
                label,
                detail,
                info,
            };
        return {
            label,
            detail,
            info,
            section: sections.getOrInsert(group, { name: group }),
        };
    });

    if (!options) return null;

    let val;
    let to: number;
    let from: number;
    let commitCharacters: string[] = [];
    let apply: Completion["apply"];
    if (value.length > 1 && value.at(0) === '"' && value.at(-1) === '"') {
        val = value.substring(1, value.length - 1);
        from = val_start + 1;
        to = predicate_end - 1;
    } else {
        val = value;
        from = val_start;
        to = predicate_end;
        commitCharacters = [" "];
        apply = (view, completion) => {
            if (completion.label.includes(" ")) {
                completion.label = `"${completion.label}"`;
            }
            view.dispatch(
                view.state.update({
                    changes: {
                        from,
                        to,
                        insert: completion.label,
                    },
                    selection: EditorSelection.cursor(
                        from + completion.label.length,
                    ),
                    userEvent: "completion.apply",
                }),
            );
        };
    }

    const result: CompletionResult = {
        from,
        to,
        options,
        commitCharacters,
    };

    switch (pred_typ) {
        case "name":
            result.commitCharacters = undefined;
            result.options.forEach((n) => (n.apply = apply));
            break;
        case "keyword":
            result.options.forEach((k) => (k.apply = apply));
            break;
        case "format":
            result.options.forEach((f) => (f.apply = apply));
            break;
        case "artist":
            result.options.forEach((a) => (a.apply = apply));
            break;
        case "lang":
            result.options.forEach((a) => (a.apply = apply));
            break;
        case "set":
            result.options.forEach((a) => (a.apply = apply));
            break;
    }

    return result;

    // return {
    //     form: val_start,
    //     to: tag_end,
    //     options: [],
    // };
};
