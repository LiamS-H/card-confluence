import typescript from "@rollup/plugin-typescript";
import dts from "rollup-plugin-dts";
import { lezer } from "@lezer/generator/rollup";

const external = [
    "@lezer/lr",
    "@lezer/highlight",
    "@codemirror/autocomplete",
    "@codemirror/view",
    "@codemirror/state",
    "@codemirror/language",
    "tslib"
];

export default [
    {
        input: "src/index.ts",
        output: [
            { file: "dist/index.js", format: "es" },
            { file: "dist/index.cjs", format: "cjs" },
        ],
        plugins: [lezer(), typescript()],
        external,
    },
    {
        input: "src/index.ts",
        output: [{ file: "dist/index.d.ts", format: "es" }],
        plugins: [lezer(), dts()],
        external,
    },
];
