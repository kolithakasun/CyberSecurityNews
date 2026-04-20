export async function postSlackMessage(webhookUrl, text) {
  if (!webhookUrl) return { ok: false, skipped: true };
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `Slack HTTP ${res.status}`);
  }
  return { ok: true };
}
