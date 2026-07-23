import { syntaxTree } from "@codemirror/language";

export type TreeCursor = ReturnType<ReturnType<typeof syntaxTree>["cursor"]>;
