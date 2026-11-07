const card = document.getElementById('card');
const pageEl = document.getElementById('page');
const dots = document.getElementById('dots');

const NS = 'http://www.w3.org/2000/svg';
const ICONS = {
  Codex: 'M4 6l5 6-5 6M12 18h8',
  Claude: 'M12 2c.8 6 4 9.2 10 10-6 .8-9.2 4-10 10-.8-6-4-9.2-10-10 6-.8 9.2-4 10-10z',
};

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function header(name) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', ICONS[name]);
  if (name === 'Codex') {
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', '2.2');
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
  } else {
    p.setAttribute('fill', 'currentColor');
  }
  svg.append(p);
  const h = el('div', 'header');
  h.append(svg, name);
  return h;
}

function bar(percent) {
  const b = el('div', 'bar');
  const fill = el('i');
  fill.style.width = `${percent}%`;
  b.append(fill);
  return b;
}

const pct = (limit, suffix = '%') => (limit ? `${Math.round(limit.leftPercent)}${suffix}` : '—');

function limitRow(title, limit, now) {
  const row = el('div', 'row');
  const line = el('div', 'line');
  line.append(el('span', 'title', title), el('span', 'value', pct(limit, '% left')));
  row.append(line, bar(limit?.leftPercent ?? 0), el('div', 'reset', resetText(limit?.resetsAt, now)));
  return row;
}

function renderPage(name, info, now, compact) {
  if (compact) {
    const line = el('div', 'line');
    line.append(header(name), el('span', 'value', pct(info.fiveHour)));
    return [line, bar(info.fiveHour?.leftPercent ?? 0),
      el('div', 'reset', info.error ?? resetText(info.fiveHour?.resetsAt, now))];
  }
  if (info.error) return [header(name), el('div', 'error', info.error)];
  return [header(name), limitRow('5 hours', info.fiveHour, now), limitRow('Weekly', info.weekly, now)];
}

let lastPage = null;

window.widget.onState(({ codex, claude, now, page, compact }) => {
  card.classList.toggle('compact', compact);
  pageEl.replaceChildren(...(page === 0
    ? renderPage('Codex', codex, now, compact)
    : renderPage('Claude', claude, now, compact)));

  if (lastPage !== null && lastPage !== page) {
    pageEl.classList.remove('from-left', 'from-right');
    void pageEl.offsetWidth; // 애니메이션을 다시 시작시킨다
    pageEl.classList.add(page === 0 ? 'from-left' : 'from-right');
  }
  lastPage = page;

  dots.replaceChildren(...[0, 1].map((i) => {
    const d = el('button', i === page ? 'on' : '');
    d.addEventListener('click', () => window.widget.setPage(i));
    return d;
  }));
});

// 윗부분(로고 줄)을 잡으면 창 이동, 나머지는 좌우로 쓸어서 페이지 넘기기
let gesture = null;

card.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || e.target.closest('#dots')) return;
  const headerHeight = card.classList.contains('compact') ? 42 : 58;
  const dragging = e.clientY < headerHeight;
  gesture = { dragging, x: e.clientX, y: e.clientY, fired: false };
  card.setPointerCapture(e.pointerId);
  if (dragging) window.widget.dragStart();
});

card.addEventListener('pointermove', (e) => {
  if (!gesture) return;
  if (gesture.dragging) {
    window.widget.dragMove();
    return;
  }
  const dx = e.clientX - gesture.x;
  const dy = e.clientY - gesture.y;
  if (!gesture.fired && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
    gesture.fired = true;
    window.widget.go(dx < 0 ? 1 : -1);
  }
});

function endGesture() {
  if (gesture?.dragging) window.widget.dragEnd();
  gesture = null;
}
card.addEventListener('pointerup', endGesture);
card.addEventListener('pointercancel', endGesture);

card.addEventListener('dblclick', (e) => {
  if (!e.target.closest('#dots')) window.widget.toggleCompact();
});

window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.widget.menu();
});

// 터치패드 두 손가락 좌우 스와이프로 페이지 전환
let swipeAccum = 0;
let swipeFired = false;
let swipeIdle;

window.addEventListener('wheel', (e) => {
  clearTimeout(swipeIdle);
  swipeIdle = setTimeout(() => { swipeAccum = 0; swipeFired = false; }, 200);
  if (swipeFired) return;
  swipeAccum += e.deltaX;
  if (Math.abs(swipeAccum) > 30) {
    swipeFired = true;
    window.widget.go(swipeAccum > 0 ? 1 : -1);
  }
}, { passive: true });
