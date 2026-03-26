import type { TabBarItem, TabId } from './types';

/** Callbacks for TabBar interactions. */
export interface TabBarCallbacks {
  /** Called when a tab badge is clicked. */
  onTabClick: (tabId: TabId) => void;

  /** Called when the close button is clicked on a tab. */
  onTabClose: (tabId: TabId) => void;

  /** Called when the new tab button is clicked. */
  onNewTab: () => void;

  /** Called when a tab badge is renamed via double-click. */
  onTabRename?: (tabId: TabId, newTitle: string) => Promise<void>;
}

/**
 * TabBar renders minimal numbered badge navigation.
 */
export class TabBar {
  private containerEl: HTMLElement;
  private callbacks: TabBarCallbacks;

  constructor(containerEl: HTMLElement, callbacks: TabBarCallbacks) {
    this.containerEl = containerEl;
    this.callbacks = callbacks;
    this.build();
  }

  /** Builds the tab bar UI. */
  private build(): void {
    this.containerEl.addClass('claudian-tab-badges');
  }

  /**
   * Updates the tab bar with new tab data.
   * @param items Tab items to render.
   */
  update(items: TabBarItem[]): void {
    // Clear existing badges
    this.containerEl.empty();

    // Render badges
    for (const item of items) {
      this.renderBadge(item);
    }
  }

  /** Renders a single tab badge showing conversation title. */
  private renderBadge(item: TabBarItem): void {
    // Determine state class (priority: active > attention > streaming > idle)
    let stateClass = 'claudian-tab-badge-idle';
    if (item.isActive) {
      stateClass = 'claudian-tab-badge-active';
    } else if (item.needsAttention) {
      stateClass = 'claudian-tab-badge-attention';
    } else if (item.isStreaming) {
      stateClass = 'claudian-tab-badge-streaming';
    }

    const badgeEl = this.containerEl.createDiv({
      cls: `claudian-tab-badge ${stateClass}`,
      text: item.title || 'New Chat',
    });

    // Tooltip with full title
    badgeEl.setAttribute('aria-label', item.title);
    badgeEl.setAttribute('title', item.title);

    // Click handler to switch tab (skip if already active to preserve dblclick)
    badgeEl.addEventListener('click', () => {
      if (!item.isActive) {
        this.callbacks.onTabClick(item.id);
      }
    });

    // Right-click to close (if allowed)
    if (item.canClose) {
      badgeEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.callbacks.onTabClose(item.id);
      });
    }

    // Double-click to rename (mirrors history panel rename pattern)
    badgeEl.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const currentTitle = item.title || 'New Chat';
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'claudian-rename-input';
      input.value = currentTitle;
      badgeEl.textContent = '';
      badgeEl.appendChild(input);
      input.focus();
      input.select();
      const finishRename = async (): Promise<void> => {
        const newTitle = input.value.trim() || currentTitle;
        if (this.callbacks.onTabRename) {
          await this.callbacks.onTabRename(item.id, newTitle);
        }
      };
      input.addEventListener('blur', finishRename);
      input.addEventListener('keydown', (ke) => {
        if (ke.key === 'Enter' && !ke.isComposing) {
          input.blur();
        } else if (ke.key === 'Escape' && !ke.isComposing) {
          input.value = currentTitle;
          input.blur();
        }
      });
      // Prevent click inside input from triggering tab switch
      input.addEventListener('click', (ce) => {
        ce.stopPropagation();
      });
    });
  }

  /** Destroys the tab bar. */
  destroy(): void {
    this.containerEl.empty();
    this.containerEl.removeClass('claudian-tab-badges');
  }
}
