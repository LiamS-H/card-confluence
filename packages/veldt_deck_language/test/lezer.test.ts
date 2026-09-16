import { describe, test, expect } from 'bun:test';

import { veldtDeckLanguage, veldtDeck, parseVeldtDeck, addTag, addView } from '../src/index.ts';
import { fileTests } from '@lezer/generator/dist/test';
import { EditorState } from '@codemirror/state';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

let caseDir = path.dirname(fileURLToPath(import.meta.url));

describe('Grammar cases', () => {
	for (let file of fs.readdirSync(caseDir)) {
		if (!/\.txt$/.test(file)) continue;

		const matches = /^[^\.]*/.exec(file);
		expect(matches).not.toBeNull();
		if (matches === null) {
			throw Error('no test files found.');
		}
		let name = matches[0];
		describe(name, () => {
			for (let { name, run } of fileTests(fs.readFileSync(path.join(caseDir, file), 'utf8'), file))
				test(name, () => run(veldtDeckLanguage.parser));
		});
	}
});
