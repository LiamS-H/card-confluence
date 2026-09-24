import * as Y from 'yjs';
import { defaultConfig } from './config.default';

export const CONFIG_ROOT_KEY = 'config';

export interface TemplateSerialized {
	title: string;
	template: string;
}

export type ConfigSerialized = {
	templates: Record<
		string,
		{
			title: string;
			template: string;
		}
	>;
};

export interface TemplateStruct extends Y.Map<any> {
	get(key: 'title'): Y.Text;
	set(key: 'title', value: Y.Text): this;
	get(key: 'template'): Y.Text;
	set(key: 'template', value: Y.Text): this;
}

// @ts-ignore; for the this declaration
export interface ConfigStruct extends Y.Map<any> {
	get(key: 'templates'): Y.Map<TemplateStruct>;
	set(key: 'templates', value: Y.Map<TemplateStruct>): this;
	toJSON(): ConfigSerialized;
}

export function getConfigRoot(doc: Y.Doc): ConfigStruct {
	return doc.getMap<any>(CONFIG_ROOT_KEY) as ConfigStruct;
}

export function initializeConfig(config: ConfigStruct) {
	if (config.has('templates')) {
		// already initialized
		return;
	}
	const templatesMap = new Y.Map<any>() as Y.Map<TemplateStruct>;
	config.set('templates', templatesMap);

	for (const [id, tpl] of Object.entries(defaultConfig.templates)) {
		const templateStruct = new Y.Map<any>() as TemplateStruct;
		templateStruct.set('title', new Y.Text(tpl.title));
		templateStruct.set('template', new Y.Text(tpl.template));
		templatesMap.set(id, templateStruct);
	}
}

export function createTemplate(
	config: ConfigStruct,
	id: string,
	title: string,
	template: string
): TemplateStruct {
	let templatesMap = config.get('templates');
	if (!templatesMap) {
		templatesMap = new Y.Map<any>() as Y.Map<TemplateStruct>;
		config.set('templates', templatesMap);
	}

	const templateStruct = new Y.Map<any>() as TemplateStruct;
	templateStruct.set('title', new Y.Text(title));
	templateStruct.set('template', new Y.Text(template));

	templatesMap.set(id, templateStruct);
	return templateStruct;
}

export function deleteTemplate(config: ConfigStruct, id: string) {
	const templatesMap = config.get('templates');
	if (templatesMap && templatesMap.has(id)) {
		templatesMap.delete(id);
	}
}

export function replaceYText(yText: Y.Text, newContent: string) {
	const currentLength = yText.length;
	yText.delete(0, currentLength);
	yText.insert(0, newContent);
}

export function updateTemplate(
	config: ConfigStruct,
	id: string,
	updates: { title?: string; template?: string }
) {
	const templatesMap = config.get('templates');
	if (!templatesMap) return;

	const templateStruct = templatesMap.get(id);
	if (!templateStruct) return;

	if (updates.title !== undefined) {
		replaceYText(templateStruct.get('title'), updates.title);
	}
	if (updates.template !== undefined) {
		replaceYText(templateStruct.get('template'), updates.template);
	}
}
