// import {
//     snippetCompletion,
//     type Completion,
//     type CompletionResult,
//     type CompletionSection,
//     type CompletionSource,
// } from "@codemirror/autocomplete";

// import { predicateFromView } from "./utils/tag-from-view";
// import { syntaxTree } from "@codemirror/language";
// import { EditorSelection } from "@codemirror/state";

// import {
//     argTypeFromArg,
//     ARGUMENTS,
//     detailFromArg,
//     isArgument,
//     nodeFromArg,
// } from "./autocomplete/completion";
// import { cardconfluenceSettingsFacet } from "./settings";

// const BEGIN_OPERATORS = [":", "<", ">", "=", "!"] as const;

// const OPERATORS = [":", "=", "<", ">", "<=", ">=", "!="] as const;
// const ASSERT_OPERATORS = [":", "="] as const;

// // function argRec(argument: string, commit: boolean, from: number, to?: number) {}

// export const completeCardConfluence: CompletionSource = (context) => {
//     if (!context.view) return null;

//     const view = context.view;

//     const pos = context.pos;

//     const tag = predicateFromView(view, pos);

//     const catalog = context.state.facet(cardconfluenceCatalogFacet);
//     const settings = context.state.facet(cardconfluenceSettingsFacet);

//     if (!tag) {
//         const cursor = syntaxTree(view.state).cursorAt(pos, -1);

//         if (cursor.name === "StringLiteral") {
//             return {
//                 from: cursor.from + 1,
//                 to: cursor.to - 1,
//                 options: catalog["card-names"].map((name) => ({
//                     label: name,
//                     apply: (view, completion) => {
//                         completion.label = `!"${completion.label}"`;
//                         view.dispatch(
//                             view.state.update({
//                                 changes: {
//                                     from,
//                                     to,
//                                     insert: completion.label,
//                                 },
//                                 selection: EditorSelection.cursor(
//                                     from + completion.label.length,
//                                 ),
//                                 userEvent: "completion.apply",
//                             }),
//                         );
//                     },
//                 })),
//             };
//         }

//         if (cursor.name !== "Argument") {
//             return {
//                 from: cursor.from,
//                 options: [
//                     snippetCompletion("@query ${name}\n${}", {
//                         label: "@query",
//                         info: "Write a new query.",
//                     }),
//                 ],
//             };

//             return {
//                 from: cursor.from,
//                 options: ARGUMENTS.map((tag): Completion => {
//                     const { detail, info } = detailFromArg(tag);
//                     return {
//                         label: tag,
//                         detail: settings.autoDetail ? detail : undefined,
//                         info: settings.autoInfo ? info : undefined,
//                     };
//                 }),
//                 commitCharacters: BEGIN_OPERATORS,
//             };
//         }

//         const argument = view.state.sliceDoc(cursor.node.from, cursor.node.to);
//         const lower_arg = argument.toLowerCase();

//         // arguments don't match so the argument is a name
//         if (ARGUMENTS.every((a) => !a.includes(lower_arg))) {
//             while (cursor.prevSibling() && cursor.name === "Argument") {}
//             if (cursor.name !== "Argument") cursor.nextSibling();
//             const from = cursor.node.from;
//             while (cursor.nextSibling() && cursor.name === "Argument") {}
//             if (cursor.name !== "Argument") cursor.prevSibling();
//             const to = cursor.node.to;
//             // const card_name = view.state.sliceDoc(from, to);

//             return {
//                 from,
//                 to,
//                 options: catalog["card-names"].map((name) => ({
//                     label: name,
//                     apply: (view, completion) => {
//                         completion.label = `!"${completion.label}"`;
//                         view.dispatch(
//                             view.state.update({
//                                 changes: {
//                                     from,
//                                     to,
//                                     insert: completion.label,
//                                 },
//                                 selection: EditorSelection.cursor(
//                                     from + completion.label.length,
//                                 ),
//                                 userEvent: "completion.apply",
//                             }),
//                         );
//                     },
//                 })),
//             };
//         }

//         const result: CompletionResult = {
//             from: cursor.node.from,
//             to: cursor.node.to,
//             options: ARGUMENTS.map((tag): Completion => {
//                 const boost = tag.startsWith(lower_arg) ? 1 : -1;
//                 const { detail, info } = detailFromArg(tag);
//                 return {
//                     label: tag,
//                     boost,
//                     detail: settings.autoDetail ? detail : undefined,
//                     info: settings.autoInfo ? info : undefined,
//                 };
//             }),
//             commitCharacters: BEGIN_OPERATORS,
//         };
//         // const results = result.options.length;
//         if (isArgument(lower_arg)) {
//             const node = nodeFromArg(lower_arg);
//             const operators =
//                 node.operator === "assign"
//                     ? [":"]
//                     : node.operator === "assert"
//                       ? ASSERT_OPERATORS
//                       : OPERATORS;
//             result.options = result.options.concat(
//                 operators.map(
//                     (tag: string): Completion => ({
//                         label: argument + tag,
//                         displayLabel: tag,
//                         // boost: results === 1 ? 2 : 0,
//                     }),
//                 ),
//             );
//         }
//         return result;
//     }

//     const {
//         arg_start,
//         argument,
//         op_start,
//         operator,
//         val_start,
//         value,
//         predicate_end: tag_end,
//     } = tag;

//     const lower_arg = argument.toLowerCase();

//     if (pos <= op_start) {
//         const result: CompletionResult = {
//             from: arg_start,
//             to: op_start,
//             options: ARGUMENTS.map((tag) => {
//                 const boost = tag.startsWith(lower_arg) ? 1 : -1;
//                 const { detail, info } = detailFromArg(tag);
//                 return {
//                     label: tag,
//                     boost,
//                     detail: settings.autoDetail ? detail : undefined,
//                     info: settings.autoInfo ? info : undefined,
//                 };
//             }),
//         };
//         if (isArgument(lower_arg)) {
//             const apply: Completion["apply"] = (view, completion) => {
//                 view.dispatch(
//                     view.state.update({
//                         changes: {
//                             from: op_start,
//                             to: val_start,
//                             insert: completion.displayLabel,
//                         },
//                         selection: EditorSelection.cursor(
//                             op_start + (completion.displayLabel?.length ?? 0),
//                         ),
//                         userEvent: "completion.apply",
//                     }),
//                 );
//             };
//             const node = nodeFromArg(lower_arg);
//             const operators =
//                 node.operator === "assign"
//                     ? [":"]
//                     : node.operator === "assert"
//                       ? ASSERT_OPERATORS
//                       : OPERATORS;
//             result.options = result.options.concat(
//                 operators.map(
//                     (tag: string): Completion => ({
//                         label: argument + tag,
//                         displayLabel: tag,
//                         apply,
//                     }),
//                 ),
//             );
//         }
//         return result;
//     }
//     if (pos < val_start) {
//         return {
//             from: op_start,
//             to: val_start,
//             options: OPERATORS.map((tag) => ({
//                 label: tag,
//             })),
//             filter: false,
//         };
//     }

//     if (value.at(1) === "/" && value.at(-1) === "/") {
//         return null;
//     }

//     if (!isArgument(lower_arg)) {
//         return null;
//     }

//     const arg_type = argTypeFromArg(lower_arg);
//     const options = completionInfoFromArg(arg_type, catalog, settings);
//     if (!options) return null;

//     let val;
//     let to: number;
//     let from: number;
//     let commitCharacters: string[] = [];
//     let apply: Completion["apply"];
//     if (value.length > 1 && value.at(0) === '"' && value.at(-1) === '"') {
//         val = value.substring(1, value.length - 1);
//         from = val_start + 1;
//         to = tag_end - 1;
//     } else {
//         val = value;
//         from = val_start;
//         to = tag_end;
//         commitCharacters = [" "];
//         apply = (view, completion) => {
//             if (completion.label.includes(" ")) {
//                 completion.label = `"${completion.label}"`;
//             }
//             view.dispatch(
//                 view.state.update({
//                     changes: {
//                         from,
//                         to,
//                         insert: completion.label,
//                     },
//                     selection: EditorSelection.cursor(
//                         from + completion.label.length,
//                     ),
//                     userEvent: "completion.apply",
//                 }),
//             );
//         };
//     }

//     const result: CompletionResult = {
//         from,
//         to,
//         options,
//         commitCharacters,
//     };

//     switch (arg_type) {
//         case "name":
//             result.commitCharacters = undefined;
//             result.options.forEach((n) => (n.apply = apply));
//             break;
//         case "keyword":
//             result.options.forEach((k) => (k.apply = apply));
//             break;
//         case "format":
//             result.options.forEach((f) => (f.apply = apply));
//             break;
//         case "artist":
//             result.options.forEach((a) => (a.apply = apply));
//             break;
//         case "lang":
//             result.options.forEach((a) => (a.apply = apply));
//             break;
//         case "set":
//             result.options.forEach((a) => (a.apply = apply));
//             break;
//     }

//     return result;

//     // return {
//     //     form: val_start,
//     //     to: tag_end,
//     //     options: [],
//     // };
// };
