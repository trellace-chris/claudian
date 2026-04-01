/**
 * Detects provider from environment variables
 */

import { parseEnvironmentVariables } from './env';
import type { EnvSnippet } from '../core/types';

export interface ProviderInfo {
  name: string;
  hasApiKey: boolean;
  baseUrl: string | null;
  models: {
    default: string;
    options: string[];
  };
}

/**
 * Checks if env vars define a provider (has API key)
 */
export function isProviderConfig(envVars: string): boolean {
  if (!envVars.trim()) return false;

  const vars = parseEnvironmentVariables(envVars);
  return Boolean(vars.ANTHROPIC_AUTH_TOKEN);
}

/**
 * Extracts provider info from environment variables
 */
export function extractProviderInfo(envVars: string): ProviderInfo | null {
  if (!isProviderConfig(envVars)) {
    return null;
  }

  const vars = parseEnvironmentVariables(envVars);

  // Get API key
  const apiKey = vars.ANTHROPIC_AUTH_TOKEN;

  // Get base URL (optional, for non-Anthropic providers)
  const baseUrl = vars.ANTHROPIC_BASE_URL || null;

  // Extract models from env vars
  const models = extractModelsFromEnvVars(vars);

  // Provider name from base URL or default
  const name = detectProviderName(baseUrl, models);

  return {
    name,
    hasApiKey: Boolean(apiKey),
    baseUrl,
    models
  };
}

/**
 * Extracts all models from environment variables
 */
function extractModelsFromEnvVars(vars: Record<string, string>): { default: string; options: string[] } {
  const options = new Set<string>();

  // Default model (highest priority)
  const defaultModel = vars.ANTHROPIC_MODEL || '';

  // Add model-based env vars
  if (vars.ANTHROPIC_DEFAULT_OPUS_MODEL) options.add(vars.ANTHROPIC_DEFAULT_OPUS_MODEL);
  if (vars.ANTHROPIC_DEFAULT_SONNET_MODEL) options.add(vars.ANTHROPIC_DEFAULT_SONNET_MODEL);
  if (vars.ANTHROPIC_DEFAULT_HAIKU_MODEL) options.add(vars.ANTHROPIC_DEFAULT_HAIKU_MODEL);
  if (vars.ANTHROPIC_SUBAGENT_MODEL) options.add(vars.ANTHROPIC_SUBAGENT_MODEL);

  // Always include the default model
  if (defaultModel) {
    options.add(defaultModel);
  }

  return {
    default: defaultModel,
    options: Array.from(options)
  };
}

/**
 * Detects provider name from base URL and models
 */
function detectProviderName(baseUrl: string | null, models: { default: string; options: string[] }): string {
  // Check base URL for provider hints
  if (baseUrl) {
    if (baseUrl.includes('moonshot.ai')) return 'Moonshot';
    if (baseUrl.includes('deepseek.com')) return 'DeepSeek';
    if (baseUrl.includes('anthropic.com')) return 'Anthropic';
  }

  // Check model names for hints
  if (models.options.some(m => m.includes('kimi'))) return 'Moonshot Kimi';
  if (models.options.some(m => m.includes('deepseek'))) return 'DeepSeek';
  if (models.options.some(m => m.includes('claude')) || models.options.some(m => m.includes('haiku') || m.includes('sonnet') || m.includes('opus'))) {
    return 'Anthropic';
  }

  return 'Custom Provider';
}

/**
 * Gets all provider names from saved snippets
 */
export function getProviderNamesFromSnippets(envSnippets: EnvSnippet[]): string[] {
  return envSnippets
    .filter(snippet => isProviderConfig(snippet.envVars))
    .map(snippet => snippet.name)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Finds a snippet by provider name
 */
export function findSnippetByProviderName(envSnippets: EnvSnippet[], providerName: string): EnvSnippet | undefined {
  return envSnippets.find(snippet =>
    snippet.name.toLowerCase() === providerName.toLowerCase() &&
    isProviderConfig(snippet.envVars)
  );
}

/**
 * Gets model display name (human readable)
 */
export function getModelDisplayName(modelId: string): string {
  return modelId
    .split(/[-_/]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .replace(/\bAi\b/g, 'AI');
}
