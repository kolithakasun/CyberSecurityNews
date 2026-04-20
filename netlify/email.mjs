/**
 * Email sending via Resend (https://resend.com).
 * Set RESEND_API_KEY and FROM_EMAIL in Netlify environment variables.
 *
 * From-address rules:
 *   - With your own verified domain: use any address @yourdomain.com
 *   - Without domain verification: use the default Resend test address
 *     "onboarding@resend.dev" (deliverable only to the Resend account owner)
 */

const FROM = process.env.FROM_EMAIL || 'CyberSec News <onboarding@resend.dev>';

let _resend = null;
function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) {
    const { Resend } = await_resend_import();
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

// Lazy require so esbuild doesn't fail if resend is absent in local dev
function await_resend_import() {
  try {
    return require('resend');
  } catch {
    throw new Error('resend package not found — run: npm install in the repo root');
  }
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendCriticalAlert(toEmail, item) {
  const client = getResend();
  if (!client) return { skipped: true, reason: 'RESEND_API_KEY not set' };
  const { error } = await client.emails.send({
    from: FROM,
    to: toEmail,
    subject: `🔴 Critical Security Alert: ${item.title.slice(0, 70)}`,
    html: criticalAlertHtml(item),
  });
  if (error) throw new Error(error.message || JSON.stringify(error));
  return { ok: true };
}

export async function sendDailyDigest(toEmail, { stats, criticalItems, totalItems }) {
  const client = getResend();
  if (!client) return { skipped: true, reason: 'RESEND_API_KEY not set' };
  const { error } = await client.emails.send({
    from: FROM,
    to: toEmail,
    subject: `📊 CyberSecurity Daily Digest — ${new Date().toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    })}`,
    html: dailyDigestHtml({ stats, criticalItems, totalItems }),
  });
  if (error) throw new Error(error.message || JSON.stringify(error));
  return { ok: true };
}

// ─── HTML templates ──────────────────────────────────────────────────────────

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cveChips(cves = []) {
  return cves
    .slice(0, 6)
    .map(
      (c) =>
        `<a href="https://nvd.nist.gov/vuln/detail/${c}" style="display:inline-block;margin:2px 4px 2px 0;padding:2px 8px;background:#1e3a5f;color:#38bdf8;font-family:monospace;font-size:11px;border-radius:4px;text-decoration:none;">${c}</a>`,
    )
    .join('');
}

function criticalAlertHtml(item) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:24px 16px;">
  <div style="border-radius:12px;overflow:hidden;border:1px solid rgba(239,68,68,0.25);background:#1e293b;">
    <div style="padding:24px;background:linear-gradient(135deg,rgba(239,68,68,0.18),transparent);border-bottom:1px solid rgba(239,68,68,0.2);">
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:rgba(252,165,165,.8);">🔴 Critical Security Alert</p>
      <h1 style="margin:0;font-size:19px;font-weight:700;color:#fef2f2;line-height:1.4;">${esc(item.title)}</h1>
    </div>
    <div style="padding:24px;">
      <div style="margin-bottom:14px;">
        <span style="display:inline-block;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;background:rgba(239,68,68,.15);color:#fca5a5;border:1px solid rgba(239,68,68,.3);">CRITICAL</span>
        ${item.severity_score ? `<span style="color:#94a3b8;font-size:12px;margin-left:8px;">Score ${item.severity_score}</span>` : ''}
        <span style="color:#94a3b8;font-size:12px;margin-left:8px;">— ${esc(item.source)}</span>
      </div>
      ${item.summary ? `<p style="margin:0 0 16px;color:#cbd5e1;font-size:14px;line-height:1.65;">${esc(item.summary.slice(0, 450))}${item.summary.length > 450 ? '…' : ''}</p>` : ''}
      ${(item.cves || []).length ? `<div style="margin-bottom:16px;">${cveChips(item.cves)}</div>` : ''}
      ${(item.tags || []).filter((t) => !String(t).startsWith('CVE-')).slice(0, 5).map((t) => `<span style="display:inline-block;margin:2px 3px 2px 0;padding:2px 8px;background:rgba(255,255,255,.06);color:#94a3b8;font-size:11px;border-radius:99px;">${esc(t)}</span>`).join('')}
      ${item.link ? `<div style="margin-top:20px;"><a href="${esc(item.link)}" style="display:inline-block;padding:10px 22px;background:#0ea5e9;color:#0f172a;font-weight:700;font-size:14px;border-radius:8px;text-decoration:none;">Read full article →</a></div>` : ''}
    </div>
    <div style="padding:14px 24px;border-top:1px solid rgba(255,255,255,.05);font-size:11px;color:rgba(148,163,184,.5);">
      CyberSecurity News Dashboard · <a href="https://verdant-crostata-8d52cf.netlify.app" style="color:#38bdf8;text-decoration:none;">Open dashboard</a>
    </div>
  </div>
</div>
</body></html>`;
}

function criticalRow(item) {
  return `<tr>
  <td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.05);">
    ${item.link ? `<a href="${esc(item.link)}" style="display:block;margin-bottom:3px;font-size:14px;font-weight:500;color:#f1f5f9;text-decoration:none;">${esc(item.title)}</a>` : `<span style="display:block;margin-bottom:3px;font-size:14px;color:#f1f5f9;">${esc(item.title)}</span>`}
    <span style="font-size:12px;color:rgba(148,163,184,.7);">${esc(item.source)}</span>
    ${(item.cves || []).slice(0, 3).map((c) => `<a href="https://nvd.nist.gov/vuln/detail/${c}" style="margin-left:6px;font-family:monospace;font-size:11px;color:#38bdf8;text-decoration:none;">${c}</a>`).join('')}
  </td></tr>`;
}

function dailyDigestHtml({ stats, criticalItems, totalItems }) {
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const topSources = (stats?.top_sources || []).slice(0, 5);
  const critRows = (criticalItems || []).slice(0, 10).map(criticalRow).join('');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:640px;margin:0 auto;padding:24px 16px;">
  <div style="border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,.1);background:#1e293b;">

    <!-- Header -->
    <div style="padding:24px 28px;border-bottom:1px solid rgba(255,255,255,.07);">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:rgba(148,163,184,.7);">📊 Daily Digest</p>
      <h1 style="margin:0 0 4px;font-size:22px;font-weight:700;color:#f8fafc;">CyberSecurity News</h1>
      <p style="margin:0;font-size:13px;color:rgba(148,163,184,.7);">${dateStr}</p>
    </div>

    <!-- Stats row -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-bottom:1px solid rgba(255,255,255,.07);">
      <tr>
        <td width="33%" style="padding:20px 16px;text-align:center;border-right:1px solid rgba(255,255,255,.07);">
          <div style="font-size:36px;font-weight:700;color:#fca5a5;">${stats?.critical_threats_today ?? 0}</div>
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:rgba(148,163,184,.6);margin-top:4px;">Critical today</div>
        </td>
        <td width="33%" style="padding:20px 16px;text-align:center;border-right:1px solid rgba(255,255,255,.07);">
          <div style="font-size:36px;font-weight:700;color:#7dd3fc;">${stats?.new_cves_today ?? 0}</div>
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:rgba(148,163,184,.6);margin-top:4px;">CVEs today</div>
        </td>
        <td width="33%" style="padding:20px 16px;text-align:center;">
          <div style="font-size:36px;font-weight:700;color:#a5b4fc;">${totalItems ?? stats?.total_items ?? 0}</div>
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:rgba(148,163,184,.6);margin-top:4px;">Total items</div>
        </td>
      </tr>
    </table>

    <!-- Critical items -->
    ${critRows ? `
    <div style="padding:18px 28px 8px;">
      <h2 style="margin:0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#fca5a5;">🔴 Critical Threats</h2>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-bottom:1px solid rgba(255,255,255,.07);">
      <tbody>${critRows}</tbody>
    </table>` : ''}

    <!-- Top sources -->
    ${topSources.length ? `
    <div style="padding:18px 28px;">
      <h2 style="margin:0 0 12px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:rgba(148,163,184,.7);">Top Sources</h2>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${topSources.map((s) => `<tr><td style="padding:4px 0;font-size:13px;color:#cbd5e1;">${esc(s.source)}</td><td style="padding:4px 0;font-size:12px;color:#94a3b8;font-family:monospace;text-align:right;">${s.count}</td></tr>`).join('')}
      </table>
    </div>` : ''}

    <!-- Footer -->
    <div style="padding:14px 28px;border-top:1px solid rgba(255,255,255,.05);font-size:11px;color:rgba(148,163,184,.5);">
      CyberSecurity News Dashboard ·
      <a href="https://verdant-crostata-8d52cf.netlify.app" style="color:#38bdf8;text-decoration:none;">Open dashboard</a>
    </div>
  </div>
</div>
</body></html>`;
}
