/**
 * Risk-Language Scanner for Community Content (SRS FR-4.6, FR-6.4).
 *
 * WHY:
 * 1. Safety Net (FR-6.4): Provides a heuristic screening layer to identify explicit self-harm intent
 *    (CRITICAL) or severe hopelessness (HIGH) in posts and comments.
 * 2. Pure & Non-Diagnostic: This is a keyword safety net, NOT a diagnostic tool. It never makes clinical
 *    determinations and is decoupled from user-facing labels.
 * 3. Multilingual Support: Accurately handles both English (Latin script) and Amharic (Ethiopic/Ge'ez script).
 *    Ethiopic script does not have case distinctions and uses specific word separators (e.g. U+1361 ፡).
 * 4. Privacy & Confidentiality (SRS 5.4, 6.1): Scanned text and matched phrases are NEVER logged.
 */

import { RISK_PHRASES } from '../content/risk-phrases.js';

export interface ScanResult {
  matched: boolean;
  priority: 'CRITICAL' | 'HIGH' | null;
}

/**
 * Normalizes text for risk scanning:
 * - Unicode NFKC normalization
 * - Lowercases Latin script
 * - Strips apostrophes (unifying "don't" and "dont")
 * - Converts all punctuation (including Ge'ez punctuation like U+1361 ፡ and U+1362 ።) to whitespace
 * - Collapses repeated whitespace to a single space
 */
export function normalizeRiskText(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Pre-normalize all catalog phrases at module initialization for optimal runtime performance
const NORMALIZED_CRITICAL_PHRASES = [
  ...RISK_PHRASES.critical.en.map(normalizeRiskText),
  ...RISK_PHRASES.critical.am.map(normalizeRiskText),
].filter((phrase) => phrase.length > 0);

const NORMALIZED_HIGH_PHRASES = [
  ...RISK_PHRASES.high.en.map(normalizeRiskText),
  ...RISK_PHRASES.high.am.map(normalizeRiskText),
].filter((phrase) => phrase.length > 0);

/**
 * Pure function that scans input text against the risk phrase catalog.
 *
 * Employs whitespace padding around words and phrases to ensure whole-phrase matching
 * across Latin and Ethiopic scripts without false positives on harmless substrings
 * (e.g., "kill this exam" or "dying of laughter").
 *
 * Evaluates CRITICAL tier first, followed by HIGH tier.
 * NEVER logs the scanned text or matched phrases.
 */
export function scanText(text: string): ScanResult {
  const normalized = normalizeRiskText(text);
  if (!normalized) {
    return { matched: false, priority: null };
  }

  // Whitespace-pad the normalized string to ensure boundary matching
  const padded = ` ${normalized} `;

  // 1. Evaluate CRITICAL Tier first
  for (const phrase of NORMALIZED_CRITICAL_PHRASES) {
    const target = ` ${phrase} `;
    if (padded.includes(target)) {
      return { matched: true, priority: 'CRITICAL' };
    }
  }

  // 2. Evaluate HIGH Tier second
  for (const phrase of NORMALIZED_HIGH_PHRASES) {
    const target = ` ${phrase} `;
    if (padded.includes(target)) {
      return { matched: true, priority: 'HIGH' };
    }
  }

  return { matched: false, priority: null };
}
