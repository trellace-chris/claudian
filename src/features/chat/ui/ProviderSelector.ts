/**
 * Provider selector dropdown - lists saved env snippets as providers
 */

import { Setting } from 'obsidian';
import type ClaudianPlugin from '../../../main';
import type { AIProvider } from '../../../core/types';
import { getProviderNamesFromSnippets } from '../../../utils/provider-detector';

export class ProviderSelector {
  private dropdownEl: HTMLSelectElement;
  private containerEl: HTMLElement;
  private plugin: ClaudianPlugin;

  constructor(
    plugin: ClaudianPlugin,
    private onProviderChange: (providerName: string) => void
  ) {
    this.plugin = plugin;
  }

  /**
   * Creates the provider selector UI
   */
  create(containerEl: HTMLElement): void {
    this.containerEl = containerEl;

    new Setting(containerEl)
      .setName('Provider')
      .addDropdown(dropdown => {
        // Add default option
        dropdown.addOption('anthropic-default', 'Anthropic (Default)');

        // Add all saved providers from snippets
        const providerNames = getProviderNamesFromSnippets(this.plugin.settings.envSnippets);
        for (const name of providerNames) {
          dropdown.addOption(name, name);
        }

        // Set current value from settings
        const currentProvider = this.getCurrentProviderName();
        dropdown.setValue(currentProvider);

        this.dropdownEl = dropdown.selectEl;
        this.dropdownEl.addClass('claudian-provider-selector');

        dropdown.onChange(async (value: string) => {
          await this.onProviderChange(value);
        });
      });
  }

  /**
   * Gets the currently selected provider name
   */
  getCurrentProviderName(): string {
    if (this.plugin.settings.lastAppliedSnippetId) {
      const snippet = this.plugin.settings.envSnippets.find(s => s.id === this.plugin.settings.lastAppliedSnippetId);
      if (snippet) return snippet.name;
    }
    return 'anthropic-default';
  }

  /**
   * Updates the dropdown when snippets change
   */
  refresh(): void {
    // Clear existing options
    this.dropdownEl.empty();

    // Re-add all options
    this.create(this.containerEl);
  }

  /**
   * Destroys the component
   */
  destroy(): void {
    this.containerEl.empty();
  }
}
