/**
 * Netlify Scheduled Function — daily security digest.
 * Schedule configured in netlify.toml: runs at 08:00 UTC every day.
 *
 * Required env vars: RESEND_API_KEY, FROM_EMAIL (optional, defaults to Resend test sender)
 */
import { createAggregator } from '../../server/src/aggregator.js';
import { sendDailyDigest, isEmailConfigured } from '../email.mjs';

let aggregator;
function getAggregator() {
  if (!aggregator) {
    aggregator = createAggregator({
      cacheTtlMs: 0, // always fresh for the digest
      fetchConcurrency: 4,
      cacheDir: '/tmp/csnews-digest-cache',
    });
  }
  return aggregator;
}

async function getStore() {
  try {
    const { getStore: gs } = await import('@netlify/blobs');
    return gs('csnews-prefs');
  } catch {
    return null;
  }
}

async function getSubscribers() {
  const store = await getStore();
  if (!store) return [];
  try {
    const raw = await store.get('subscribers');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export const handler = async () => {
  console.log('[daily-digest] Starting at', new Date().toISOString());

  if (!isEmailConfigured()) {
    console.warn('[daily-digest] RESEND_API_KEY not set — skipping');
    return { statusCode: 200, body: 'Email not configured' };
  }

  const subscribers = await getSubscribers();
  const digestRecipients = subscribers.filter((s) => s.dailyDigest && s.email);

  if (!digestRecipients.length) {
    console.log('[daily-digest] No digest subscribers');
    return { statusCode: 200, body: 'No subscribers' };
  }

  // Fetch today's news
  const agg = getAggregator();
  let data;
  try {
    data = await agg.loadFeeds({ force: true });
  } catch (e) {
    console.error('[daily-digest] Feed fetch failed', e);
    return { statusCode: 500, body: e.message };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const iso = today.toISOString();

  const criticalItems = (data.items || [])
    .filter((i) => i.category === 'critical' && i.published_date >= iso)
    .slice(0, 12);

  const payload = {
    stats: data.stats,
    criticalItems,
    totalItems: data.items?.length ?? 0,
  };

  let sent = 0;
  let failed = 0;
  for (const sub of digestRecipients) {
    try {
      await sendDailyDigest(sub.email, payload);
      sent++;
      console.log('[daily-digest] Sent to', sub.email);
    } catch (e) {
      failed++;
      console.error('[daily-digest] Failed for', sub.email, e.message);
    }
  }

  console.log(`[daily-digest] Done — sent:${sent} failed:${failed}`);
  return { statusCode: 200, body: JSON.stringify({ sent, failed }) };
};
