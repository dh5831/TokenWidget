const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadCodex, parseClaude, fetchClaude } = require('../src/sources');
const { Store } = require('../src/store');
const { resetText } = require('../renderer/ui');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'tw-'));
const settings = (values = {}) => ({ values, set(p) { Object.assign(this.values, p); } });
const NOW = 1_800_000_000_000;

function makeStore(fetchClaudeImpl, values) {
  const clock = { now: NOW };
  const store = new Store({
    settings: settings(values), loadCodex: async () => ({}), fetchClaude: fetchClaudeImpl,
    onChange() {}, clock: () => clock.now,
  });
  return { store, clock };
}

test('Codex: 가장 최근 파일의 마지막 rate_limits를 읽는다', async () => {
  const root = tmp();
  const dir = path.join(root, '2026', '11');
  fs.mkdirSync(dir, { recursive: true });
  const event = (used) => JSON.stringify({ payload: { rate_limits: {
    primary: { used_percent: used, resets_at: NOW / 1000 + 100 },
    secondary: { used_percent: 10, resets_at: NOW / 1000 - 100 },
  } } });
  fs.writeFileSync(path.join(dir, 'a.jsonl'), `${event(1)}\n${event(25)}\n{"rate_limits": broken\n`);
  const info = await loadCodex(root, NOW);
  assert.deepEqual(info.fiveHour, { leftPercent: 75, resetsAt: NOW + 100_000 });
  assert.deepEqual(info.weekly, { leftPercent: 100, resetsAt: null }); // 리셋 지남
});

test('Codex: 폴더나 기록이 없으면 오류 문구', async () => {
  assert.equal((await loadCodex(path.join(tmp(), 'none'))).error, '~/.codex/sessions 없음');
  assert.equal((await loadCodex(tmp())).error, 'Codex 사용 기록 없음');
});

test('Claude: 응답을 파싱한다', () => {
  const info = parseClaude('{"five_hour":{"utilization":30,"resets_at":"2026-11-07T10:00:00.000+00:00"},"seven_day":null}');
  assert.equal(info.fiveHour.leftPercent, 70);
  assert.equal(info.fiveHour.resetsAt, Date.UTC(2026, 10, 7, 10));
  assert.equal(info.weekly, null);
  assert.equal(parseClaude('nope'), null);
});

test('Claude: 자격 증명 파일 토큰으로 요청하고 상태 코드를 구분한다', async () => {
  const file = path.join(tmp(), '.credentials.json');
  assert.equal((await fetchClaude(null, file)).message, 'Claude 로그인 정보 없음');
  fs.writeFileSync(file, '{"claudeAiOauth":{"accessToken":"abc"}}');
  const respond = (r) => async (_url, opts) => {
    assert.equal(opts.headers.Authorization, 'Bearer abc');
    return new Response(r.body ?? '', { status: r.status, headers: r.headers });
  };
  assert.equal((await fetchClaude(respond({ status: 200, body: '{}' }), file)).kind, 'ok');
  assert.deepEqual(await fetchClaude(respond({ status: 429, headers: { 'Retry-After': '90' } }), file), { kind: 'rateLimited', retryAfter: 90 });
  assert.match((await fetchClaude(respond({ status: 401 }), file)).message, /^토큰 만료/);
  assert.equal((await fetchClaude(respond({ status: 500 }), file)).message, 'HTTP 500');
  assert.equal((await fetchClaude(async () => { throw new Error(); }, file)).message, '네트워크 오류');
});

test('Store: 5분 안에는 다시 조회하지 않고 force면 조회한다', async () => {
  let calls = 0;
  const { store, clock } = makeStore(async () => { calls++; return { kind: 'ok', info: {}, raw: '{}' }; });
  await store.refreshClaude(false);
  await store.refreshClaude(false);
  assert.equal(calls, 1);
  await store.refreshClaude(true);
  assert.equal(calls, 2);
  clock.now += 300_000;
  await store.refreshClaude(false);
  assert.equal(calls, 3);
});

test('Store: 429면 이전 값을 유지하고 간격을 두 배로, 최대 30분', async () => {
  const { store } = makeStore(async () => ({ kind: 'rateLimited', retryAfter: 0 }));
  store.claude = { fiveHour: { leftPercent: 50 } };
  await store.refreshClaude(true);
  assert.equal(store.nextFetch, NOW + 600_000);
  assert.equal(store.claude.fiveHour.leftPercent, 50);
  for (let i = 0; i < 5; i++) await store.refreshClaude(true);
  assert.equal(store.nextFetch, NOW + 1_800_000);
});

test('Store: 토큰 오류만 기존 값을 덮어쓴다', async () => {
  let message = '네트워크 오류';
  const { store } = makeStore(async () => ({ kind: 'failed', message }));
  store.claude = { fiveHour: { leftPercent: 50 } };
  await store.refreshClaude(true);
  assert.equal(store.claude.fiveHour.leftPercent, 50);
  message = '토큰 만료 (claude 한번 실행)';
  await store.refreshClaude(true);
  assert.equal(store.claude.error, message);
});

test('Store: 캐시로 시작하면 값을 복원하고 남은 시간만큼 기다린다', () => {
  const { store } = makeStore(async () => {}, { claudeCache: '{"five_hour":{"utilization":10}}', claudeCacheTime: NOW });
  assert.equal(store.claude.fiveHour.leftPercent, 90);
  assert.equal(store.nextFetch, NOW + 300_000);
});

test('리셋 문구', () => {
  const at = (s) => resetText(NOW + s * 1000, NOW);
  assert.equal(resetText(null, NOW), 'Resets —');
  assert.equal(at(30 * 60), 'Resets in 30분');
  assert.equal(at(2 * 3600 + 5 * 60), 'Resets in 2시간 5분');
  assert.equal(at(6 * 3600 + 5 * 60), 'Resets in 6시간');
  assert.equal(at(50 * 3600), 'Resets in 2일 2시간');
});
