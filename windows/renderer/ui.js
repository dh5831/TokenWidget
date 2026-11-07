function resetText(resetsAt, now) {
  if (resetsAt == null) return 'Resets —';
  const s = Math.max(0, (resetsAt - now) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h >= 24) return `Resets in ${Math.floor(h / 24)}일 ${h % 24}시간`;
  if (h > 0) return `Resets in ${h}시간${m > 0 && h < 5 ? ` ${m}분` : ''}`;
  return `Resets in ${m}분`;
}

if (typeof module !== 'undefined') module.exports = { resetText };
