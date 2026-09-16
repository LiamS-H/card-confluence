import { describe, test, expect } from 'bun:test';
import { cardconfluenceLanguage } from '../dist/index.js';
import { fileTests } from '@lezer/generator/dist/test';

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
let caseDir = path.dirname(fileURLToPath(import.meta.url));

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
			test(name, () => run(cardconfluenceLanguage.parser));
	});
}
