import { Facet } from "@codemirror/state";
import type { Completion } from "@card-confluence/wasm-browser";

export interface IQueryContext {
    complete: (pos: number) => Promise<Completion>;
}

export const queryContextFacet = Facet.define<IQueryContext, IQueryContext>({
    combine: (values) => {
        if (values.length === 0) {
            return {
                complete: async (pos) => ({
                    from: pos,
                    to: pos,
                    options: [],
                }),
            };
        }
        return values[values.length - 1];
    },
});
