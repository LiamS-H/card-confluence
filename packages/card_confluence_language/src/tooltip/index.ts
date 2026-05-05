import { hoverTooltip } from "@codemirror/view";

import { syntaxTree } from "@codemirror/language";
import { predicateFromView } from "../utils/predicate-from-view";
import { detailFromKeyword, isKeyword } from "../autocomplete/completion";

export const CardConfluenceTooltips = hoverTooltip((view, pos, side) => {
    const predicate = predicateFromView(view, pos + 1);

    if (!predicate) {
        const cursor = syntaxTree(view.state).cursorAt(pos + 1, -1);
        return {
            end: pos,
            pos,
            above: true,
            create(view) {
                let dom = document.createElement("div");
                dom.textContent = cursor.name;
                return { dom };
            },
        };
    }

    return {
        pos: predicate.arg_start,
        above: true,
        create(view) {
            let node = document.createElement("p");
            node.style =
                "white-space:pre-wrap; max-width:400px; max-height:800px; overflow-y:auto;";
            const arg = predicate.argument;
            if (!isKeyword(arg)) {
                node.textContent = `"${arg}" not recognized.`;
                return { dom: node };
            }
            const { info, detail } = detailFromKeyword(arg);
            node.textContent = `${arg} - ${detail}\n${info}`;
            return { dom: node };
        },
    };
});
