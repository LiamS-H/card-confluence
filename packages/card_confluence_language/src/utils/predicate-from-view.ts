import { EditorView } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";

interface Predicate {
    keyword: string;
    kw_start: number;
    operator: string;
    op_start: number;
    value: string;
    val_start: number;
    predicate_end: number;
}

export function predicateFromView(
    view: EditorView,
    pos: number,
): Predicate | null {
    const cursor = syntaxTree(view.state).cursorAt(pos, -1);

    while (cursor.name !== "Predicate" && cursor.parent()) {}

    if (cursor.name !== "Predicate") {
        return null;
    }
    const predicate_end = cursor.node.to;
    cursor.firstChild();
    const argument = view.state.sliceDoc(cursor.node.from, cursor.node.to);
    const arg_start = cursor.from;
    cursor.nextSibling();
    const operator = view.state.sliceDoc(cursor.node.from, cursor.node.to);
    const op_start = cursor.from;
    cursor.nextSibling();
    const value = view.state.sliceDoc(cursor.node.from, cursor.node.to);
    const val_start = cursor.from;
    return {
        keyword: argument,
        kw_start: arg_start,
        operator,
        op_start,
        value,
        val_start,
        predicate_end,
    };
}
