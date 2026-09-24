import { sync_client } from '$lib/sync/client';
import { initializeConfig, type ConfigStruct, type ConfigSerialized } from '@repo/schema-sync';
import { browser } from '$app/environment';

class ConfigState {
	private configRoot: ConfigStruct;

	// Svelte state to represent the config reactively
	configData = $state<ConfigSerialized>() as ConfigSerialized;

	constructor() {
		this.configRoot = sync_client.config_root;

		if (browser) {
			// Initialize if not already
			initializeConfig(this.configRoot);

			// Listen to changes
			this.configRoot.observeDeep(() => {
				this.configData = this.configRoot.toJSON();
			});

			// Initial value
			this.configData = this.configRoot.toJSON();
		}
	}

	public get root() {
		return this.configRoot;
	}
}

let configState: ConfigState | null = null;

export function use_config() {
	if (!configState) {
		configState = new ConfigState();
	}
	return configState;
}
