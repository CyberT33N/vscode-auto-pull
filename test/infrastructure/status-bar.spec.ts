import { describe, expect, it } from 'vitest';

import type { CycleOutcome } from '../../src/domain/cycle-report';
import { AutoPullStatusPresenter } from '../../src/infrastructure/ui/status-bar';
import type { StatusBarTarget } from '../../src/infrastructure/ui/status-bar';

function createItem(): StatusBarTarget & { shown: number; hidden: number } {
  const item = {
    text: '',
    tooltip: '',
    shown: 0,
    hidden: 0,
    show() {
      item.shown += 1;
    },
    hide() {
      item.hidden += 1;
    },
  };

  return item;
}

describe('AutoPullStatusPresenter', () => {
  it('hides the item when the status bar is disabled', () => {
    const item = createItem();
    const presenter = new AutoPullStatusPresenter(item);

    presenter.present([{ repository: 'a', result: 'up-to-date' }], false);

    expect(item.hidden).toBe(1);
    expect(item.shown).toBe(0);
  });

  it('renders the summary and per-repository tooltip when enabled', () => {
    const item = createItem();
    const presenter = new AutoPullStatusPresenter(item);
    const outcomes: CycleOutcome[] = [
      { repository: 'repo-a', result: 'updated', operation: 'fast-forward' },
      { repository: 'repo-b', result: 'skipped', skipReason: 'no-upstream' },
    ];

    presenter.present(outcomes, true);

    expect(item.text).toBe('$(cloud-download) Auto Pull: 1 updated');
    expect(item.tooltip).toBe('repo-a: updated via fast-forward\nrepo-b: skipped (no-upstream)');
    expect(item.shown).toBe(1);
  });
});
