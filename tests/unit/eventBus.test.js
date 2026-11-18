import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/events/eventBus.js';

describe('EventBus', () => {
  it('awaits every handler', async () => {
    const bus = new EventBus();
    const seen = [];
    bus.on('x', async (v) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      seen.push(`a${v}`);
    });
    bus.on('x', (v) => seen.push(`b${v}`));

    await bus.emit('x', 1);
    expect(seen.sort()).toEqual(['a1', 'b1']);
  });

  it('does not let a failing handler break the caller or other handlers', async () => {
    const bus = new EventBus();
    let ran = false;
    bus.on('x', () => {
      throw new Error('boom');
    });
    bus.on('x', () => {
      ran = true;
    });

    await expect(bus.emit('x', 1)).resolves.toBeUndefined();
    expect(ran).toBe(true);
  });
});
