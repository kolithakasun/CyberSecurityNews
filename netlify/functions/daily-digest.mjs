/**
 * Netlify Scheduled Function — daily security digest.
 * Schedule configured in netlify.toml: runs at 08:00 UTC every day.
 *
 * Required env vars: RESEND_API_KEY, FROM_EMAIL (optional)
 */
import { createAggregator } from '../../server/src/aggregator.js';
import { sendDailyDigest, isEmailConfigured } from '../email.mjs';
import { broadcastDigest } from '../webhooks.mjs';

let aggregator;
function getAggregator() {
  if (!aggregator) {
    aggregator = createAggregator({
      cacheTtlMs: 0,
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
  } catch { return null; }
}

async function blobGet(store, key) {
  try { const r = await store.get(key); return r ? JSON.parse(r) : null; } catch { return null; }
}

export const handler = async () => {
  console.log('[daily-digest] Starting at', new Date().toISOString());

  const store = await getStore();
  const subscribers = (store ? await blobGet(store, 'subscribers') : null) || [];
  const adminCfg = (store ? await blobGet(store, 'admin-config') : null) || {};

  const digestRecipients = subscribers.filter((s) => s.dailyDigest);
  const emailEnabled = isEmailConfigured();

  if (!emailEnabled && !adminCfg.slackWebhook && !adminCfg.teamsWebhook) {
    console.warn('[daily-digest] No email or webhook configured — skipping');
    return { statusCode: 200, body: 'Nothing configured' };
  }

  // Fetch fresh news
  const agg = getAggregator();
  let data;
  try {
    data = await agg.loadFeeds({ force: true });
  } catch (e) {
    console.error('[daily-digest] Feed fetch failed:', e);
    return { statusCode: 500, body: e.message };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const iso = today.toISOString();

  const criticalItems = (data.items || [])
    .filter((i) => i.category === 'critical' && i.published_date >= iso)
    .slice(0, 12);

  const payload = { stats: data.stats, criticalItems, totalItems: data.items?.length ?? 0 };

  // ── Email digest ────────────────────────────────────────────────────────────
  let emailSent = 0;
  let emailFailed = 0;

  if (emailEnabled && digestRecipients.length) {
    // Collect all unique email addresses across all subscribers
    const allEmails = [
      ...new Set(
        digestRecipients.flatMap((s) =>
          Array.isArray(s.emails) ? s.emails : (s.email ? [s.email] : []),
        ),
      ),
    ];

    if (allEmails.length) {
      try {
        await sendDailyDigest(allEmails, payload);
        emailSent = allEmails.length;
        console.log('[daily-digest] Digest sent to', allEmails.length, 'addresses');
      } catch (e) {
        emailFailed++;
        console.error('[daily-digest] Email error:', e.message);
      }
    }
  }

  // ── Webhook broadcast (Slack + Teams) ───────────────────────────────────────
  if (adminCfg.notifyOnDigest !== false) {
    await broadcastDigest(adminCfg, payload);
  }

  console.log(`[daily-digest] Done — emailSent:${emailSent} emailFailed:${emailFailed}`);
  return { statusCode: 200, body: JSON.stringify({ emailSent, emailFailed }) };
};
