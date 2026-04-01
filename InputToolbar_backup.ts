import { Notice, setIcon } from 'obsidian';
import * as path from 'path';

import type { McpServerManager } from '../../../core/mcp';
import type {
  ClaudeModel,
  ClaudianMcpServer,
  PermissionMode,
  ThinkingBudget,
  UsageInfo
} from '../../../core/types';
import {
  DEFAULT_CLAUDE_MODELS,
  THINKING_BUDGETS
} from '../../../core/types';
import { CHECK_ICON_SVG, MCP_ICON_SVG } from '../../../shared/icons';
import { getModelsFromEnvironment, parseEnvironmentVariables } from '../../../utils/env';
import { filterValidPaths, findConflictingPath, isDuplicatePath, isValidDirectoryPath, validateDirectoryPath } from '../../../utils/externalContext';
import { expandHomePath, normalizePathForFilesystem } from '../../../utils/path';

export interface ToolbarSettings {
  model: ClaudeModel;
  thinkingBudget: ThinkingBudget;
  permissionMode: PermissionMode;
  show1MModel?: boolean;
}

export interface ToolbarCallbacks {
  onModelChange: (model: ClaudeModel) => Promise<void>;
  onThinkingBudgetChange: (budget: ThinkingBudget) => Promise<void>;
  onPermissionModeChange: (mode: PermissionMode) => Promise<void>;
  getSettings: () => ToolbarSettings;
  getEnvironmentVariables?: () => string;
}

export class ModelSelector {
  private container: HTMLElement;
  private buttonEl: HTMLElement | null = null;
  private dropdownEl: HTMLElement | null = null;
  private callbacks: ToolbarCallbacks;
  private isReady = false;

  constructor(parentEl: HTMLElement, callbacks: ToolbarCallbacks) {
    this.callbacks = callbacks;
    this.container = parentEl.createDiv({ cls: 'claudian-model-selector' });
    this.render();
  }

  private getAvailableModels() {
    let models: { value: string; label: string; description: string }[] = [];

    if (this.callbacks.getEnvironmentVariables) {
      const envVarsStr = this.callbacks.getEnvironmentVariables();
      const envVars = parseEnvironmentVariables(envVarsStr);
      const customModels = getModelsFromEnvironment(envVars);

      if (customModels.length > 0) {
        models = customModels;
      } else {
        models = [...DEFAULT_CLAUDE_MODELS];
      }
    } else {
      models = [...DEFAULT_CLAUDE_MODELS];
    }

    // When 1M context is enabled, update sonnet label to show "(1M)"
    const settings = this.callbacks.getSettings();
    if (settings.show1MModel) {
      models = models.map(m =>
        m.value === 'sonnet' ? { ...m, label: 'Sonnet (1M)' } : m
      );
    }

    return models;
  }

  private render() {
    this.container.empty();

    this.buttonEl = this.container.createDiv({ cls: 'claudian-model-btn' });
    this.setReady(this.isReady);
    this.updateDisplay();

    this.dropdownEl = this.container.createDiv({ cls: 'claudian-model-dropdown' });
    this.renderOptions();
  }

  updateDisplay() {
    if (!this.buttonEl) return;
    const currentModel = this.callbacks.getSettings().model;
    const models = this.getAvailableModels();
    const modelInfo = models.find(m => m.value === currentModel);

    const displayModel = modelInfo || models[0];

    this.buttonEl.empty();

    const labelEl = this.buttonEl.createSpan({ cls: 'claudian-model-label' });
    labelEl.setText(displayModel?.label || 'Unknown');
  }

  setReady(ready: boolean) {
    this.isReady = ready;
    this.buttonEl?.toggleClass('ready', ready);
  }

  renderOptions() {
    if (!this.dropdownEl) return;
    this.dropdownEl.empty();

    const currentModel = this.callbacks.getSettings().model;
    const models = this.getAvailableModels();

    for (const model of [...models].reverse()) {
      const option = this.dropdownEl.createDiv({ cls: 'claudian-model-option' });
      if (model.value === currentModel) {
        option.addClass('selected');
      }

      option.createSpan({ text: model.label });
      if (model.description) {
        option.setAttribute('title', model.description);
      }

      option.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.callbacks.onModelChange(model.value);
        this.updateDisplay();
        this.renderOptions();
      });
    }
  }
}

export class ThinkingBudgetSelector {
  private container: HTMLElement;
  private gearsEl: HTMLElement | null = null;
  private callbacks: ToolbarCallbacks;

  constructor(parentEl: HTMLElement, callbacks: ToolbarCallbacks) {
    this.callbacks = callbacks;
    this.container = parentEl.createDiv({ cls: 'claudian-thinking-selector' });
    this.render();
  }

  private render() {
    this.container.empty();

    const labelEl = this.container.createSpan({ cls: 'claudian-thinking-label-text' });
    labelEl.setText('Thinking:');

    this.gearsEl = this.container.createDiv({ cls: 'claudian-thinking-gears' });
    this.renderGears();
  }

  private renderGears() {
    if (!this.gearsEl) return;
    this.gearsEl.empty();

    const currentBudget = this.callbacks.getSettings().thinkingBudget;
