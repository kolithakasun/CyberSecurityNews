import {
  ATTACK_TYPE_KEYWORDS,
  CVSS_REGEX,
  HIGH_RISK_KEYWORDS,
  HIGH_SEVERITY_KEYWORDS,
  MEDIUM_SEVERITY_KEYWORDS,
} from './config.js';

const CATEGORY_ORDER = {
  critical: 4,
  high: 3,
  medium: 2,
  informational: 1,
};

export function normalizeText(...parts) {
  return parts
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesAny(haystack, keywords) {
  return keywords.some((k) => haystack.includes(k.toLowerCase()));
}

export function extractCvssScore(text) {
  if (!text) return null;
  CVSS_REGEX.lastIndex = 0;
  let best = null;
  let m;
  while ((m = CVSS_REGEX.exec(text)) !== null) {
    const n = Number.parseFloat(m[1]);
    if (!Number.isFinite(n)) continue;
    if (best === null || n > best) best = n;
  }
  return best;
}

export function classifyCategoryAndSeverity({ title = '', summary = '', tags = [] }) {
  const blob = normalizeText(title, summary, tags.join(' '));
  let category = 'informational';
  let severityScore = 0;
  let reasons = [];

  const cvss = extractCvssScore(blob);
  if (cvss !== null) {
    severityScore = Math.max(severityScore, cvss);
    if (cvss >= 9) {
      category = 'critical';
      reasons.push(`CVSS ${cvss}`);
    } else if (cvss >= 7) {
      category = category === 'critical' ? 'critical' : 'high';
      reasons.push(`CVSS ${cvss}`);
    } else if (cvss >= 4) {
      if (CATEGORY_ORDER[category] < CATEGORY_ORDER.medium) {
        category = 'medium';
        reasons.push(`CVSS ${cvss}`);
      }
    }
  }

  if (matchesAny(blob, HIGH_RISK_KEYWORDS)) {
    category = 'critical';
    reasons.push('high-risk keyword');
    severityScore = Math.max(severityScore, 9.5);
  } else if (matchesAny(blob, HIGH_SEVERITY_KEYWORDS)) {
    if (CATEGORY_ORDER[category] < CATEGORY_ORDER.high) {
      category = 'high';
      reasons.push('high-severity keyword');
    }
    severityScore = Math.max(severityScore, 7.5);
  } else if (matchesAny(blob, MEDIUM_SEVERITY_KEYWORDS)) {
    if (CATEGORY_ORDER[category] < CATEGORY_ORDER.medium) {
      category = 'medium';
      reasons.push('medium-severity keyword');
    }
    severityScore = Math.max(severityScore, 5);
  }

  if (category === 'informational') {
    severityScore = Math.max(severityScore, 2);
  }

  return {
    category,
    severity_score: Math.round(severityScore * 10) / 10,
    classification_reasons: [...new Set(reasons)],
  };
}

export function inferAttackTypes(text) {
  const lower = normalizeText(text);
  const found = new Set();
  for (const [needle, label] of Object.entries(ATTACK_TYPE_KEYWORDS)) {
    if (lower.includes(needle)) found.add(label);
  }
  return [...found];
}

export function categoryLabel(category) {
  switch (category) {
    case 'critical':
      return 'Critical Threats';
    case 'high':
      return 'High Risk';
    case 'medium':
      return 'Medium';
    default:
      return 'Informational';
  }
}

export function categoryEmoji(category) {
  switch (category) {
    case 'critical':
      return '🔴';
    case 'high':
      return '🟠';
    case 'medium':
      return '🟡';
    default:
      return '🔵';
  }
}
