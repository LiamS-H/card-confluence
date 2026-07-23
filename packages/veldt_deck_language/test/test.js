import {
    veldtDeckLanguage,
    veldtDeck,
    extractveldtDeck,
    addTag,
    addView,
} from "../dist/index.js";
import { fileTests } from "@lezer/generator/dist/test";
import { EditorState } from "@codemirror/state";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import assert from "assert";

let caseDir = path.dirname(fileURLToPath(import.meta.url));

describe("Grammar cases", () => {
    for (let file of fs.readdirSync(caseDir)) {
        if (!/\.txt$/.test(file)) continue;

        let name = /^[^\.]*/.exec(file)[0];
        describe(name, () => {
            for (let { name, run } of fileTests(
                fs.readFileSync(path.join(caseDir, file), "utf8"),
                file,
            ))
                it(name, () => run(veldtDeckLanguage.parser));
        });
    }
});

describe("veldt Deck Extraction", () => {
    it("should extract tags and views correctly", () => {
        const doc = `
tag mytag [ o:draw ]
tag other [ cmc>3 ]

view myview {
  tag local [ c:white ],
  match draw*
}
`;
        const state = EditorState.create({
            doc,
            extensions: [veldtDeck()],
        });

        const { tags, views } = extractveldtDeck(state);

        assert.strictEqual(tags.length, 2);
        assert.strictEqual(tags[0].name, "mytag");
        assert.strictEqual(tags[0].query, "o:draw");
        assert.strictEqual(tags[1].name, "other");
        assert.strictEqual(tags[1].query, "cmc>3");

        assert.strictEqual(views.length, 1);
        assert.strictEqual(views[0].name, "myview");
        assert.strictEqual(views[0].items.length, 2);
        assert.strictEqual(views[0].items[0].name, "local");
        assert.strictEqual(views[0].items[0].query, "c:white");
        assert.strictEqual(views[0].items[1].blob, "draw*");
    });

    it("should add tags and views", () => {
        let state = EditorState.create({
            doc: "",
            extensions: [veldtDeck()],
        });

        const tagSpec = addTag(state, "newtag", "o:scry");
        state = state.update(tagSpec).state;

        const viewSpec = addView(state, "newview");
        state = state.update(viewSpec).state;

        const { tags, views } = extractveldtDeck(state);
        assert.strictEqual(tags.length, 1);
        assert.strictEqual(tags[0].name, "newtag");
        assert.strictEqual(views.length, 1);
        assert.strictEqual(views[0].name, "newview");
    });
});
