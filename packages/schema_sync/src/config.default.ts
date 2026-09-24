import type { ConfigSerialized } from './config';

export const defaultConfig: ConfigSerialized = {
	templates: {
		commander: {
			title: 'commander',
			template: `
domain [game:paper legal:commander -t:stickers -t:attraction]

view main {
    tag instant-sorcery [t:instant or t:sorcery],
    tag artifact [t:artifact],
    tag enchantment [t:enchantment],
    tag creature [t:instant],
    tag permanent [-t:enchantment -t:creature -t:artifact is:permanent],
}

tag removal
`
		}
	}
};
