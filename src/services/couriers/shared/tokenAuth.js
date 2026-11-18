export class TokenAuth {
  constructor(fetchToken, { scheme = 'Bearer', defaultTtlSeconds = 3000, skewMs = 30000 } = {}) {
    this.fetchToken = fetchToken;
    this.scheme = scheme;
    this.defaultTtlSeconds = defaultTtlSeconds;
    this.skewMs = skewMs;
    this.cached = null;
    this.inflight = null;
  }

  async getHeaders(forceRefresh = false) {
    const token = await this.getToken(forceRefresh);
    return { Authorization: this.scheme ? `${this.scheme} ${token}` : token };
  }

  async getToken(forceRefresh) {
    if (!forceRefresh && this.cached && this.cached.expiresAt - this.skewMs > Date.now()) {
      return this.cached.value;
    }
    if (forceRefresh) this.cached = null;

    if (!this.inflight) {
      this.inflight = this.fetchToken()
        .then(({ token, ttlSeconds }) => {
          const ttl = (ttlSeconds ?? this.defaultTtlSeconds) * 1000;
          this.cached = { value: token, expiresAt: Date.now() + ttl };
          return token;
        })
        .finally(() => {
          this.inflight = null;
        });
    }
    return this.inflight;
  }
}
