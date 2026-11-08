const fs = require('node:fs/promises');
const { execFile } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');

const codexRoot = () =>
  path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'sessions');
const claudeCredentialsFile = () =>
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

async function claudeCredentials(file = claudeCredentialsFile()) {
  try {
    const oauth = JSON.parse(await fs.readFile(file, 'utf8')).claudeAiOauth;
    if (!oauth?.accessToken) return null;
    const expiresAt = typeof oauth.expiresAt === 'number' ? oauth.expiresAt : null;
    return { token: oauth.accessToken, expired: expiresAt !== null && expiresAt < Date.now() + 60_000 };
  } catch {
    return null;
  }
}

async function requestUsage(fetchImpl, token) {
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

// 위젯은 토큰을 직접 갱신하지 않고, 만료되면 Claude Code가 갱신하게 한다
async function fetchClaude(fetchImpl, tokenFile, refresh = async () => false) {
  let cred = await claudeCredentials(tokenFile);
  if (!cred) return { kind: 'failed', message: 'Claude 로그인 정보 없음' };
  if (cred.expired && (await refresh())) cred = (await claudeCredentials(tokenFile)) ?? cred;
  const result = await requestUsage(fetchImpl, cred.token);
  if (result.kind === 'failed' && result.message.startsWith('토큰') && (await refresh())) {
    const fresh = await claudeCredentials(tokenFile);
    if (fresh && fresh.token !== cred.token) return requestUsage(fetchImpl, fresh.token);
  }
  return result;
}

const CLAUDE_ARGS = ['-p', 'Reply with OK', '--model', 'haiku', '--tools', '', '--no-session-persistence'];

async function findClaude() {
  const home = os.homedir();
  const candidates = process.platform === 'win32'
    ? [path.join(home, '.local', 'bin', 'claude.exe'),
      path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'npm', 'claude.cmd')]
    : [path.join(home, '.local', 'bin', 'claude'), '/opt/homebrew/bin/claude', '/usr/local/bin/claude'];
  for (const c of candidates) {
    try {
      await fs.access(c);
      return c;
    } catch { /* 다음 위치 확인 */ }
  }
  const found = await run(process.platform === 'win32' ? 'where.exe' : 'which', ['claude'], 10_000);
  return found.ok ? found.stdout.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? null : null;
}

function run(file, args, timeout) {
  return new Promise((resolve) => {
    // .cmd 파일은 셸로만 실행할 수 있어서, 그때는 인자를 직접 따옴표로 감싼다
    const shell = /\.(cmd|bat)$/i.test(file);
    const finalArgs = shell ? args.map((a) => `"${a}"`) : args;
    execFile(shell ? `"${file}"` : file, finalArgs,
      { timeout, windowsHide: true, shell, cwd: os.tmpdir() },
      (err, stdout) => resolve({ ok: !err, stdout: String(stdout) }));
  });
}

// 아주 짧은 요청 하나를 보내면 Claude Code가 자격 증명 파일의 토큰을 새로 받아 둔다
// 실패한 뒤에는 10분 동안 다시 실행하지 않는다
function makeCliRefresher({ find = findClaude, exec = run, clock = Date.now } = {}) {
  let last = -Infinity;
  let running = null;
  return () => {
    if (running) return running;
    if (clock() - last < 600_000) return Promise.resolve(false);
    last = clock();
    running = (async () => {
      const claude = await find();
      const ok = claude ? (await exec(claude, CLAUDE_ARGS, 90_000)).ok : false;
      if (ok) last = -Infinity;
      return ok;
    })().finally(() => { running = null; });
    return running;
  };
}

module.exports = { loadCodex, parseClaude, fetchClaude, makeCliRefresher };
