/**
 * Server-side webhook dispatchers for Slack and Microsoft Teams.
 * Both are fire-and-forget with a best-effort error log.
 */

// ─── Slack ────────────────────────────────────────────────────────────────────

/**
 * Post a rich Slack message using Block Kit.
 * @param {string} webhookUrl  Slack incoming webhook URL
 * @param {{ title, summary, items, type }} payload
 */
export async function postSlackAlert(webhookUrl, { title, summary, items = [], type = 'critical' }) {
  if (!webhookUrl) return;

  const color = type === 'digest' ? '#0ea5e9' : '#dc2626';
  const emoji = type === 'digest' ? '📊' : '🔴';

  const itemLines = items.slice(0, 8).map((i) => {
    const cves = (i.cves || []).slice(0, 3).map((c) => `\`${c}\``).join(' ');
    return `• <${i.link}|${slackEsc(i.title)}> — _${slackEsc(i.source)}_ ${cves}`;
  });

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${emoji} ${title}`, emoji: true },
    },
    ...(summary ? [{
      type: 'section',
      text: { type: 'mrkdwn', text: summary },
    }] : []),
    ...(itemLines.length ? [{
      type: 'section',
      text: { type: 'mrkdwn', text: itemLines.join('\n') },
    }] : []),
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: '<https://verdant-crostata-8d52cf.netlify.app|Open CyberSecurity Dashboard>' }],
    },
  ];

  const body = JSON.stringify({ attachments: [{ color, blocks }] });
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Slack webhook error ${res.status}: ${t}`);
  }
}

/**
 * Post a single critical-item Slack alert.
 */
export async function postSlackCritical(webhookUrl, item) {
  return postSlackAlert(webhookUrl, {
    type: 'critical',
    title: 'Critical Security Alert',
    summary: `*${slackEsc(item.title)}*\n${slackEsc((item.summary || '').slice(0, 300))}`,
    items: [item],
  });
}

// ─── Microsoft Teams ──────────────────────────────────────────────────────────

/**
 * Post an Adaptive Card to a Teams Incoming Webhook.
 * Uses the "Actionable Message Card" format which is supported by all Teams versions.
 */
export async function postTeamsAlert(webhookUrl, { title, summary, items = [], type = 'critical' }) {
  if (!webhookUrl) return;

  const themeColor = type === 'digest' ? '0ea5e9' : 'dc2626';
  const emoji = type === 'digest' ? '📊' : '🔴';

  const facts = items.slice(0, 8).map((i) => ({
    name: i.source || 'Unknown',
    value: `[${teamsEsc(i.title)}](${i.link || '#'})${(i.cves || []).length ? ' — ' + i.cves.slice(0, 3).join(', ') : ''}`,
  }));

  const card = {
    '@type': 'MessageCard',
    '@context': 'http://schema.org/extensions',
    themeColor,
    summary: title,
    sections: [
      {
        activityTitle: `${emoji} **${teamsEsc(title)}**`,
        activitySubtitle: summary || '',
        facts,
        markdown: true,
      },
    ],
    potentialAction: [
      {
        '@type': 'OpenUri',
        name: 'Open Dashboard',
        targets: [{ os: 'default', uri: 'https://verdant-crostata-8d52cf.netlify.app' }],
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(card),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Teams webhook error ${res.status}: ${t}`);
  }
}

export async function postTeamsCritical(webhookUrl, item) {
  return postTeamsAlert(webhookUrl, {
    type: 'critical',
    title: 'Critical Security Alert',
    summary: teamsEsc((item.summary || item.title).slice(0, 200)),
    items: [item],
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slackEsc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function teamsEsc(s) {
  return String(s || '').replace(/[*_[\]()]/g, '\\$&');
}

/**
 * Fire both Slack and Teams webhooks for a list of critical items.
 * Non-fatal — logs errors but doesn't throw.
 */
export async function broadcastCritical(adminConfig, freshItems) {
  const { slackWebhook, teamsWebhook } = adminConfig || {};
  const results = { slack: null, teams: null };

  for (const item of (freshItems || []).slice(0, 5)) {
    if (slackWebhook) {
      try {
        await postSlackCritical(slackWebhook, item);
        results.slack = 'ok';
      } catch (e) {
        console.error('[webhook] Slack error:', e.message);
        results.slack = e.message;
      }
    }
    if (teamsWebhook) {
      try {
        await postTeamsCritical(teamsWebhook, item);
        results.teams = 'ok';
      } catch (e) {
        console.error('[webhook] Teams error:', e.message);
        results.teams = e.message;
      }
    }
  }
  return results;
}

/**
 * Post a digest summary to both Slack and Teams admin channels.
 */
export async function broadcastDigest(adminConfig, { stats, criticalItems, totalItems }) {
  const { slackWebhook, teamsWebhook } = adminConfig || {};
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const summary = `*${stats?.critical_threats_today ?? 0}* critical today · *${stats?.new_cves_today ?? 0}* CVEs · *${totalItems ?? 0}* total items`;

  if (slackWebhook) {
    try {
      await postSlackAlert(slackWebhook, {
        type: 'digest',
        title: `Daily Digest — ${today}`,
        summary,
        items: criticalItems || [],
      });
    } catch (e) {
      console.error('[webhook] Slack digest error:', e.message);
    }
  }
  if (teamsWebhook) {
    try {
      await postTeamsAlert(teamsWebhook, {
        type: 'digest',
        title: `Daily Digest — ${today}`,
        summary: summary.replace(/\*/g, ''),
        items: criticalItems || [],
      });
    } catch (e) {
      console.error('[webhook] Teams digest error:', e.message);
    }
  }
}
