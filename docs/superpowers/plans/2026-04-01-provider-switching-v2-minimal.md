# Provider Switching V2 — Minimal Implementation

**Goal:** Add provider switching to Claudian using existing EnvSnippet infrastructure with minimal code changes.

**Key Insight:** Each tab creates a separate Claude Code session with its own environment. We don't need to persist provider selection to settings — just apply env vars when user selects a snippet.

---

## Architecture (Simplified)

```
InputToolbar
├── ModelSelector (existing - reads from getEnvironmentVariables())
├── ThinkingBudgetSelector (existing)
└── ProviderSelector (NEW - simple dropdown)
    ├── Lists env snippets from settings.envSnippets
    ├── "Default" option applies empty env (clears provider-specific vars)
    └── On change: calls plugin.applyEnvironmentVariables(snippet.envVars)
```

**No persistence needed.** When user switches provider:
1. Apply env vars to current session
2. Model selector automatically refreshes (it already calls `getEnvironmentVariables()`)
3. Next tab starts fresh (can pick different provider)

---

## Files to Modify

### 1. Create: `src/features/chat/ui/ProviderSelector.ts` (Minimal)

```typescript
import { Setting } from 'obsidian';
import type ClaudianPlugin from '../../../main';
import type { EnvSnippet } from '../../../core/types';

export interface ProviderSelectorCallbacks {
  onProviderChange: (snippet: EnvSnippet | null) => void;
}

export class ProviderSelector {
  private dropdown: HTMLSelectElement;

  constructor(
    private container: HTMLElement,
    private plugin: ClaudianPlugin,
    private callbacks: ProviderSelectorCallbacks
  ) {}

  create(): void {
    const setting = new Setting(this.container)
      .setName('Provider')
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
        this.dropdown.addClass('claudian-provider-selector');
      });
  }

  refresh(): void {
    // Rebuild dropdown with current snippets
    this.container.empty();
    this.create();
  }
}
```

**Lines of code:** ~50  
**Complexity:** Low — just a dropdown that calls existing `applyEnvironmentVariables()`

---

### 2. Modify: `src/features/chat/ui/InputToolbar.ts` (Minimal)

Add to `ToolbarCallbacks` interface:
```typescript
export interface ToolbarCallbacks {
  // ... existing callbacks
  onProviderChange?: (snippet: EnvSnippet | null) => Promise<void>;
}
```

Modify `createInputToolbar()` to:
1. Create ProviderSelector before ModelSelector
2. Pass `onProviderChange` callback that:
   - Calls `plugin.applyEnvironmentVariables(snippet?.envVars || '')`
   - Refreshes ModelSelector (so it sees new ANTHROPIC_MODEL values)

```typescript
// In createInputToolbar():
const providerSelector = new ProviderSelector(container, plugin, {
  onProviderChange: async (snippet) => {
    await plugin.applyEnvironmentVariables(snippet?.envVars || '');
    // Refresh model selector to pick up new env vars
    modelSelector.refresh();
  }
});
providerSelector.create();

// Existing model selector (now reads updated env vars)
const modelSelector = new ModelSelector(...);
```

---

### 3. Modify: `src/features/chat/ui/ModelSelector.ts` (Minor)

Ensure `refresh()` re-reads environment variables:

```typescript
refresh(): void {
  this.container.empty();
  // Re-read env vars on refresh
  this.currentEnvVars = this.callbacks.getEnvironmentVariables();
  this.create();
}
```

---

### 4. Modify: `src/features/chat/ui/index.ts` (One line)

```typescript
export { ProviderSelector } from './ProviderSelector';
```

---

## What This Eliminates (vs V1)

| V1 Approach | V2 Approach | Why Simpler |
|-------------|-------------|-------------|
| `provider-detector.ts` with complex parsing | No detection needed | Just apply env vars, let Claude Code handle it |
| `lastAppliedSnippetId` in settings | No persistence | Each tab is independent session |
| `getProviderEnvVars` callback | Use existing `getEnvironmentVariables()` | Already returns active env vars |
| Provider name detection logic | Just show snippet.name | User names their snippets |
| Model extraction from env vars | Claude Code handles via ANTHROPIC_*_MODEL vars | Native behavior |

---

## Testing Steps

1. **Create env snippets in settings:**
   - Name: "DeepSeek", Vars: `ANTHROPIC_AUTH_TOKEN=sk-xxx\nANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic\nANTHROPIC_MODEL=deepseek-chat`
   - Name: "Kimi", Vars: `ANTHROPIC_AUTH_TOKEN=xxx\nANTHROPIC_BASE_URL=https://api.moonshot.cn/anthropic`

2. **Open new tab:**
   - Select "DeepSeek" from provider dropdown
   - Model selector should refresh
   - Check that API calls go to DeepSeek

3. **Open another tab:**
   - Select "Kimi" 
   - Verify different provider is used

4. **Switch back to first tab:**
   - Should still be on DeepSeek (per-session isolation)

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaks existing model selector | Keep existing logic, just add refresh trigger |
| Provider env vars malformed | Claude Code will error, user fixes in settings |
| Tab doesn't remember provider | By design — each tab is independent |
| ContextUsageMeter disappears | ProviderSelector goes in same container as other selectors, doesn't change layout |

---

## Implementation Order

1. **Add ProviderSelector component** (50 lines)
2. **Wire up in InputToolbar** (20 lines modified)
3. **Export from index.ts** (1 line)
4. **Test with real env snippets**
5. **Build and release**

**Total estimated change:** ~100 lines of new/modified code vs ~400 lines in V1.

---

*Plan created: 2026-04-01*  
*Branch: feature/provider-switching-v2*  
*Status: Ready for implementation*
