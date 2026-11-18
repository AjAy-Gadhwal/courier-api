import { describe, expect, it } from 'vitest';
import { TokenAuth } from '../../src/services/couriers/shared/tokenAuth.js';

describe('TokenAuth', () => {
  it('caches the token and refreshes it when forced', async () => {
    let calls = 0;
    const auth = new TokenAuth(async () => ({ token: `t${++calls}` }));

    expect(await auth.getHeaders()).toEqual({ Authorization: 'Bearer t1' });
    expect(await auth.getHeaders()).toEqual({ Authorization: 'Bearer t1' });
    expect(await auth.getHeaders(true)).toEqual({ Authorization: 'Bearer t2' });
  });

  it('shares one refresh between concurrent callers', async () => {
    let calls = 0;
    const auth = new TokenAuth(async () => {
      calls++;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { token: 'shared' };
    });

    await Promise.all([auth.getHeaders(), auth.getHeaders(), auth.getHeaders()]);
    expect(calls).toBe(1);
  });
});
