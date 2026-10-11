import { describe, expect, it } from 'vitest';

import { AutoPullScheduler } from '../../src/application/scheduler';
import type { TimerAdapter } from '../../src/application/scheduler';

interface FakeTimer {
  adapter: TimerAdapter;
  callbacks: (() => void)[];
  cancelledCount: number;
  lastIntervalMs: number | undefined;
}

function createFakeTimer(): FakeTimer {
  const timer: FakeTimer = {
    callbacks: [],
    cancelledCount: 0,
    lastIntervalMs: undefined,
    adapter: {
      schedule(callback, intervalMs) {
        timer.callbacks.push(callback);
        timer.lastIntervalMs = intervalMs;

        return () => {
          timer.cancelledCount += 1;
        };
      },
    },
  };

  return timer;
}

function createDeferred(): {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
} {
  let resolve: () => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe('AutoPullScheduler', () => {
  it('schedules repeating cycles at the requested interval', () => {
    const timer = createFakeTimer();
    const scheduler = new AutoPullScheduler(timer.adapter, async () => {});

    scheduler.start(15_000);

    expect(timer.lastIntervalMs).toBe(15_000);
  });

  it('runs the cycle when the timer fires', async () => {
    const timer = createFakeTimer();
    let ticks = 0;
    const scheduler = new AutoPullScheduler(timer.adapter, async () => {
      ticks += 1;
    });

    scheduler.start(1000);
    timer.callbacks[0]?.();
    await Promise.resolve();

    expect(ticks).toBe(1);
  });

  it('skips overlapping ticks while a cycle is in flight', async () => {
    const timer = createFakeTimer();
    const deferred = createDeferred();
    let invocations = 0;
    const scheduler = new AutoPullScheduler(timer.adapter, async () => {
      invocations += 1;
      await deferred.promise;
    });

    const first = scheduler.tick();
    const second = scheduler.tick();

    expect(second).toBeInstanceOf(Promise);
    await second;
    expect(invocations).toBe(1);

    deferred.resolve();
    await first;
  });

  it('accepts new ticks after the previous cycle resolved', async () => {
    const timer = createFakeTimer();
    let invocations = 0;
    const scheduler = new AutoPullScheduler(timer.adapter, async () => {
      invocations += 1;
    });

    await scheduler.tick();
    await scheduler.tick();

    expect(invocations).toBe(2);
  });

  it('resets the in-flight flag after a failed cycle', async () => {
    const timer = createFakeTimer();
    let invocations = 0;
    const scheduler = new AutoPullScheduler(timer.adapter, async () => {
      invocations += 1;
      if (invocations === 1) {
        throw new Error('cycle failed');
      }
    });

    await expect(scheduler.tick()).rejects.toThrow('cycle failed');
    await scheduler.tick();

    expect(invocations).toBe(2);
  });

  it('cancels the previous schedule when restarted', () => {
    const timer = createFakeTimer();
    const scheduler = new AutoPullScheduler(timer.adapter, async () => {});

    scheduler.start(1000);
    scheduler.start(2000);

    expect(timer.cancelledCount).toBe(1);
    expect(timer.lastIntervalMs).toBe(2000);
  });

  it('ignores stop when nothing is scheduled', () => {
    const timer = createFakeTimer();
    const scheduler = new AutoPullScheduler(timer.adapter, async () => {});

    scheduler.stop();
    scheduler.start(1000);
    scheduler.stop();

    expect(timer.cancelledCount).toBe(1);
  });
});
