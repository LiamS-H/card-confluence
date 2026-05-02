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
import { CardConfluenceTooltips } from "./tooltip";
// import { completeCardConfluence } from "./autocomplete";

import { cardconfluenceSettingsFacet } from "./settings";
import { predicateFromView } from "./utils/tag-from-view";
export {
    argTypeFromString,
    argTypeFromArg,
    detailFromArg,
    isArgument,
} from "./autocomplete/completion";

export const cardconfluenceLanguage = LRLanguage.define({
    parser: parser.configure({
        props: [
            indentNodeProp.add({
                Application: delimitedIndent({ closing: ")", align: false }),
            }),
            foldNodeProp.add({
                Application: foldInside,
            }),
            styleTags({
                FieldName: tags.propertyName,
                Operator: tags.operator,
                QuotedString: tags.string,
                UnquotedValue: tags.literal,
                BareWord: tags.literal,
                "Or And Not": tags.logicOperator,
                NotOp: tags.logicOperator,
                "( )": tags.paren,
            }),
        ],
    }),
});

export function cardconfluence() {
    return new LanguageSupport(cardconfluenceLanguage, [
        CardConfluenceTooltips,
        // cardconfluenceLanguage.data.of({ autocomplete: completeCardConfluence }),
    ]);
}

// export { completeCardConfluence, CardConfluenceTooltips };

export { cardconfluenceSettingsFacet };
export { predicateFromView };
