export function computeCveTrends(items, limit = 12) {
  const counts = new Map();
  for (const it of items) {
    for (const c of it.cves || []) {
      counts.set(c, (counts.get(c) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([cve, count]) => ({ cve, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function cveNvdUrl(cve) {
  return `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(cve)}`;
}

export function exportJson(items, stats) {
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), stats, items }, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cyber-news-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportCsv(items) {
  const headers = ['title', 'source', 'published_date', 'category', 'severity_score', 'link', 'cves', 'tags'];
  const lines = [headers.join(',')];
  for (const it of items) {
    const row = headers.map((h) => {
      let v = it[h];
      if (h === 'cves' || h === 'tags') v = (v || []).join(';');
      if (v === undefined || v === null) v = '';
      const s = String(v).replaceAll('"', '""');
      return `"${s}"`;
    });
    lines.push(row.join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cyber-news-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
