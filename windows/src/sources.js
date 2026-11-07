const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const codexRoot = () =>
  path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'sessions');
const claudeCredentials = () =>
  path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), '.credentials.json');

async function jsonlFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true, recursive: true });
  const files = [];
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith('.jsonl')) continue;
    const file = path.join(e.parentPath, e.name);
    try {
      files.push({ file, mtime: (await fs.stat(file)).mtimeMs });
    } catch { /* 읽는 사이 지워진 파일은 건너뛴다 */ }
  }
  return files.sort((a, b) => b.mtime - a.mtime);
}

function codexLimit(d, nowMs) {
  if (!d || typeof d.used_percent !== 'number') return null;
  const resetsAt = typeof d.resets_at === 'number' ? d.resets_at * 1000 : null;
  // 로그는 마지막 Codex 사용 시점 기준이라, 리셋 시간이 지났으면 100%로 본다
  if (resetsAt !== null && resetsAt < nowMs) return { leftPercent: 100, resetsAt: null };
  return { leftPercent: Math.max(0, 100 - d.used_percent), resetsAt };
}

async function loadCodex(root = codexRoot(), nowMs = Date.now()) {
  let files;
  try {
    files = await jsonlFiles(root);
  } catch {
    return { error: '~/.codex/sessions 없음' };
  }
  // 최근 파일부터 rate_limits 이벤트를 찾는다
  for (const { file } of files.slice(0, 20)) {
    let text;
    try {
      text = await fs.readFile(file, 'utf8');
    } catch {
      continue;
    }
    for (const line of text.split('\n').reverse()) {
      if (!line.includes('"rate_limits"')) continue;
      try {
        const rl = JSON.parse(line).payload?.rate_limits;
        if (!rl) continue;
        return { fiveHour: codexLimit(rl.primary, nowMs), weekly: codexLimit(rl.secondary, nowMs) };
      } catch { /* 쓰는 중인 줄은 건너뛴다 */ }
    }
  }
  return { error: 'Codex 사용 기록 없음' };
}

function claudeLimit(d) {
  if (!d || typeof d.utilization !== 'number') return null;
  const t = typeof d.resets_at === 'string' ? Date.parse(d.resets_at) : NaN;
  return { leftPercent: Math.max(0, 100 - d.utilization), resetsAt: Number.isNaN(t) ? null : t };
}

function parseClaude(text) {
  try {
    const obj = JSON.parse(text);
    if (!obj || typeof obj !== 'object') return null;
    return { fiveHour: claudeLimit(obj.five_hour), weekly: claudeLimit(obj.seven_day) };
  } catch {
    return null;
  }
}

async function claudeToken(file = claudeCredentials()) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')).claudeAiOauth?.accessToken ?? null;
  } catch {
    return null;
  }
}

async function fetchClaude(fetchImpl, tokenFile) {
  const token = await claudeToken(tokenFile);
  if (!token) return { kind: 'failed', message: 'Claude 로그인 정보 없음' };
  try {
    const res = await fetchImpl('https://api.anthropic.com/api/oauth/usage', {
      headers: { Authorization: `Bearer ${token}`, 'anthropic-beta': 'oauth-2025-04-20' },
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 429) {
      const retry = Number(res.headers.get('retry-after'));
      return { kind: 'rateLimited', retryAfter: Number.isFinite(retry) ? retry : 0 };
    }
    if (res.status === 401) return { kind: 'failed', message: '토큰 만료 (claude 한번 실행)' };
    if (res.status !== 200) return { kind: 'failed', message: `HTTP ${res.status}` };
    const raw = await res.text();
    const info = parseClaude(raw);
    return info ? { kind: 'ok', info, raw } : { kind: 'failed', message: '응답 형식 오류' };
  } catch {
    return { kind: 'failed', message: '네트워크 오류' };
  }
}

module.exports = { loadCodex, parseClaude, fetchClaude };
