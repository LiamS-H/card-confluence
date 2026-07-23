import { parser } from "./syntax.grammar";
import {
    LRLanguage,
    LanguageSupport,
    indentNodeProp,
    foldNodeProp,
    foldInside,
    delimitedIndent,
} from "@codemirror/language";
import { styleTags, tags } from "@lezer/highlight";
import { parseMixed } from "@lezer/common";
import {
    cardconfluenceLanguage,
    cardconfluence,
} from "codemirror-lang-cardconfluence";
import type { EditorState, TransactionSpec } from "@codemirror/state";
import { snippetCompletion } from "@codemirror/autocomplete";

export const veldtDeckLanguage = LRLanguage.define({
    parser: parser.configure({
        props: [
            indentNodeProp.add({
                ViewDefinition: delimitedIndent({ closing: "}", align: false }),
                TagDefinition: delimitedIndent({ closing: "]", align: false }),
            }),
            foldNodeProp.add({
                ViewDefinition: foldInside,
            }),
            styleTags({
                TagKeyword: tags.keyword,
                ViewKeyword: tags.keyword,
                MatchKeyword: tags.keyword,
                Identifier: tags.name,
                TagBlob: tags.string,
                "[ ]": tags.squareBracket,
                "{ }": tags.brace,
                ",": tags.separator,
            }),
        ],
        wrap: parseMixed((node) => {
            if (node.name === "Query") {
                return { parser: cardconfluenceLanguage.parser };
            }
            return null;
        }),
    }),
});

export function veldtDeck() {
    return new LanguageSupport(veldtDeckLanguage, [
        veldtDeckLanguage.data.of({
            autocomplete: [
                snippetCompletion("tag ${name} [ ${query} ]", {
                    label: "tag",
                    detail: "Define a new tag",
                    type: "keyword",
                }),
                snippetCompletion(
                    "view ${name} {\n\ttag ${local_name} [ ${query} ],\n\tmatch ${blob}\n}",
                    {
                        label: "view",
                        detail: "Define a new view",
                        type: "keyword",
                    },
                ),
            ],
        }),
        cardconfluence().support,
    ]);
}

export interface Tag {
    name: string;
    query: string;
}

export interface Match {
    blob: string;
}

export interface View {
    name: string;
    items: (Tag | Match)[];
}

export interface CursorTag extends Tag {
    queryPos: number | null;
}

export function tagAtCursor(state: EditorState, pos: number): CursorTag | null {
    const tree = veldtDeckLanguage.parser.parse(state.doc.toString());

    let found: CursorTag | null = null;
    tree.iterate({
        enter: (node) => {
            if (
                node.name === "TagDefinition" &&
                node.from <= pos &&
                pos <= node.to
            ) {
                const nameNode = node.node.getChild("Identifier");
                const queryNode = node.node.getChild("Query");
                if (nameNode && queryNode) {
                    const position = pos - queryNode.from;
                    found = {
                        name: state.doc.sliceString(nameNode.from, nameNode.to),
                        query: state.doc.sliceString(
                            queryNode.from,
                            queryNode.to,
                        ),
                        queryPos: position >= 0 ? position : null,
                    };
                }
                return false;
            }
        },
    });

    return found;
}

export function extractveldtDeck(state: EditorState) {
    const tags: Tag[] = [];
    const views: View[] = [];

    const tree = veldtDeckLanguage.parser.parse(state.doc.toString());
    tree.iterate({
        enter: (node) => {
            if (
                node.name === "TagDefinition" &&
                node.node.parent?.name === "Statement" &&
                node.node.parent?.parent?.name === "Program"
            ) {
                const nameNode = node.node.getChild("Identifier");
                const queryNode = node.node.getChild("Query");
                if (nameNode && queryNode) {
                    tags.push({
                        name: state.doc.sliceString(nameNode.from, nameNode.to),
                        query: state.doc.sliceString(
                            queryNode.from,
                            queryNode.to,
                        ),
                    });
                }
                return false;
            } else if (node.name === "ViewDefinition") {
                const nameNode = node.node.getChild("Identifier");
                if (nameNode) {
                    const view: View = {
                        name: state.doc.sliceString(nameNode.from, nameNode.to),
                        items: [],
                    };

                    // Iterate over ViewItem nodes
                    let cursor = node.node.cursor();
                    if (cursor.firstChild()) {
                        // Move to first child (ViewKeyword)
                        do {
                            if (cursor.name === "ViewItem") {
                                let itemNode = cursor.node.firstChild;
                                if (itemNode) {
                                    if (itemNode.name === "TagDefinition") {
                                        const tName =
                                            itemNode.getChild("Identifier");
                                        const tQuery =
                                            itemNode.getChild("Query");
                                        if (tName && tQuery) {
                                            view.items.push({
                                                name: state.doc.sliceString(
                                                    tName.from,
                                                    tName.to,
                                                ),
                                                query: state.doc
                                                    .sliceString(
                                                        tQuery.from,
                                                        tQuery.to,
                                                    )
                                                    .trim(),
                                            } as Tag);
                                        }
                                    } else if (
                                        itemNode.name === "MatchDefinition"
                                    ) {
                                        const blobNode =
                                            itemNode.getChild("TagBlob");
                                        if (blobNode) {
                                            view.items.push({
                                                blob: state.doc.sliceString(
                                                    blobNode.from,
                                                    blobNode.to,
                                                ),
                                            } as Match);
                                        }
                                    }
                                }
                            }
                        } while (cursor.nextSibling());
                    }
                    views.push(view);
                }
                return false;
            }
        },
    });

    return { tags, views };
}

export function addTag(
    state: EditorState,
    name: string,
    query: string,
): TransactionSpec {
    const text = `\ntag ${name} [ ${query} ]\n`;
    return {
        changes: { from: state.doc.length, insert: text },
    };
}

export function addView(state: EditorState, name: string): TransactionSpec {
    const text = `\nview ${name} {\n\n}\n`;
    return {
        changes: { from: state.doc.length, insert: text },
    };
}
