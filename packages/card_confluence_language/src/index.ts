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

import {
    cardconfluenceSettingsFacet,
    type IEditorSettings,
    type IEditorSettingsInput,
} from "./settings";
import { predicateFromView } from "./utils/predicate-from-view";
import { completeCardConfluence } from "./autocomplete/autocomplete";
import { queryContextFacet, type IQueryContext } from "./query-context";
export {
    predicateTypeFromString,
    predicateTypeFromKeyword as predicateTypeFromArg,
    detailFromKeyword,
    isKeyword,
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
                FieldName: tags.literal,
                Operator: tags.operator,
                QuotedString: tags.string,
                Value: tags.string,
                BareWord: tags.string,
                GlobalField: tags.controlKeyword,
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
        cardconfluenceLanguage.data.of({
            autocomplete: completeCardConfluence,
        }),
    ]);
}
export function cardconfluenceWithContext(
    context: IQueryContext,
    settings: IEditorSettingsInput,
) {
    return new LanguageSupport(cardconfluenceLanguage, [
        CardConfluenceTooltips,
        cardconfluenceLanguage.data.of({
            autocomplete: completeCardConfluence,
        }),
        queryContextFacet.of(context),
        cardconfluenceSettingsFacet.of(settings),
    ]);
}

export type { IQueryContext };

export { predicateFromView };
