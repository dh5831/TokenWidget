const { parseClaude } = require('./sources');

// Claude 사용량 API는 요청 제한이 빡빡해서 5분마다만 조회하고, 429가 나면 간격을 늘린다
const CLAUDE_INTERVAL = 300_000;
const MAX_BACKOFF = 1_800_000;

class Store {
  constructor({ settings, loadCodex, fetchClaude, onChange, clock = Date.now }) {
    Object.assign(this, { settings, loadCodex, fetchClaude, onChange, clock });
    this.codex = {};
    this.claude = {};
    this.backoff = CLAUDE_INTERVAL;
    this.nextFetch = 0;
    this.fetching = false;
    const { claudeCache, claudeCacheTime } = settings.values;
    const cached = claudeCache && parseClaude(claudeCache);
    if (cached && claudeCacheTime) {
      this.claude = cached;
      this.nextFetch = claudeCacheTime + CLAUDE_INTERVAL;
    }
  }

  async refresh() {
    const claude = this.refreshClaude(false);
    this.codex = await this.loadCodex();
    this.onChange();
    await claude;
  }

  async refreshClaude(force) {
    if (this.fetching || (!force && this.clock() < this.nextFetch)) return;
    this.fetching = true;
    const r = await this.fetchClaude();
    this.fetching = false;
    const now = this.clock();
    if (r.kind === 'ok') {
      this.claude = r.info;
      this.backoff = CLAUDE_INTERVAL;
      this.nextFetch = now + CLAUDE_INTERVAL;
      this.settings.set({ claudeCache: r.raw, claudeCacheTime: now });
    } else if (r.kind === 'rateLimited') {
      // 이전 값이 있으면 그대로 보여주고 조용히 나중에 다시 시도
      this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF);
      this.nextFetch = now + Math.max(r.retryAfter * 1000, this.backoff);
      if (!this.claude.fiveHour) this.claude = { error: '요청 제한 중, 잠시 후 자동 재시도' };
    } else {
      this.nextFetch = now + 60_000;
      if (!this.claude.fiveHour || r.message.startsWith('토큰')) this.claude = { error: r.message };
    }
    this.onChange();
  }
}

module.exports = { Store };
