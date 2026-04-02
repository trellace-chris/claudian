import { Setting } from 'obsidian';

import type { EnvSnippet } from '../../../core/types';
import type ClaudianPlugin from '../../../main';

export interface ProviderSelectorCallbacks {
  onProviderChange: (snippet: EnvSnippet | null) => Promise<void>;
}

export class ProviderSelector {
  private container: HTMLElement;
  private dropdown: HTMLSelectElement;
  private plugin: ClaudianPlugin;
  private callbacks: ProviderSelectorCallbacks;

  constructor(
    parentEl: HTMLElement,
    plugin: ClaudianPlugin,
    callbacks: ProviderSelectorCallbacks
  ) {
    this.container = parentEl.createDiv({ cls: 'claudian-provider-selector' });
    this.plugin = plugin;
    this.callbacks = callbacks;
    this.render();
  }

  private render(): void {
    this.container.empty();

    new Setting(this.container)
      .setName('Provider')
      .setDesc('Select AI provider for this conversation')
      .addDropdown(dropdown => {
        // Default option (no custom env vars)
        dropdown.addOption('', 'Default (Anthropic)');

        // Add all saved env snippets
        for (const snippet of this.plugin.settings.envSnippets) {
          dropdown.addOption(snippet.id, snippet.name);
        }

        dropdown.onChange(async (snippetId) => {
          const snippet = this.plugin.settings.envSnippets.find(s => s.id === snippetId);
          await this.callbacks.onProviderChange(snippet || null);
        });

        this.dropdown = dropdown.selectEl;
      });
  }

  refresh(): void {
    this.render();
  }
}
