/**
 * Localization helper for bilingual MindRise content (English 'en' and Amharic 'am').
 * 
 * WHY: MindRise is designed specifically for Ethiopian youth who may prefer
 * reading guidance and routine titles in Amharic ('am') or English ('en').
 * Centralizing the resolution logic guarantees that every endpoint adheres to
 * the exact same precedence rules (explicit query param -> user profile setting -> default fallback).
 */

export type SupportedLanguage = 'en' | 'am';

/**
 * Resolves the target language from the request query param,
 * falling back to the authenticated user's preferredLanguage,
 * and finally defaulting to 'en'.
 *
 * WHY: Precedence ensures an explicit query parameter (e.g. ?lang=am) always
 * takes top priority, allowing users to temporarily preview content in either
 * language without modifying their persistent profile setting.
 */
export function resolveLanguage(
  queryLang?: unknown,
  userPreferredLang?: string | null
): SupportedLanguage {
  if (typeof queryLang === 'string') {
    const normalized = queryLang.trim().toLowerCase();
    if (normalized === 'en' || normalized === 'am') {
      return normalized;
    }
  }

  if (typeof userPreferredLang === 'string') {
    const normalized = userPreferredLang.trim().toLowerCase();
    if (normalized === 'en' || normalized === 'am') {
      return normalized;
    }
  }

  // Default fallback when neither query nor user preference provides a supported language
  return 'en';
}

/**
 * Helper to select the localized title or text from bilingual database fields.
 *
 * WHY: Starter routines, assessment templates, and crisis resources store text
 * as separate titleEn and titleAm columns in PostgreSQL. This helper safely picks
 * the chosen language, with graceful fallback to the alternate language if
 * one translation happens to be missing or empty.
 */
export function pickLocalized(
  enVal: string | null | undefined,
  amVal: string | null | undefined,
  lang: SupportedLanguage
): string {
  if (lang === 'am') {
    return amVal && amVal.trim().length > 0 ? amVal : (enVal ?? '');
  }
  return enVal && enVal.trim().length > 0 ? enVal : (amVal ?? '');
}

export interface BilingualRow {
  titleEn: string;
  titleAm: string;
  descriptionEn?: string | null;
  descriptionAm?: string | null;
}

/**
 * Localizes a StarterRoutine database row into a client-friendly object.
 *
 * WHY: Clients consuming /routines/starter only need a single localized `title`
 * and optional `description` string rather than raw DB columns (titleEn, titleAm).
 * This keeps the JSON payload lean and mobile-friendly for low-bandwidth connections.
 */
export function localizeStarterRoutine<T extends BilingualRow>(
  row: T,
  lang: SupportedLanguage
): Omit<T, 'titleEn' | 'titleAm' | 'descriptionEn' | 'descriptionAm'> & {
  title: string;
  description: string | null;
} {
  const { titleEn, titleAm, descriptionEn, descriptionAm, ...rest } = row;
  const title = pickLocalized(titleEn, titleAm, lang);
  const rawDescription =
    lang === 'am' ? (descriptionAm ?? descriptionEn) : (descriptionEn ?? descriptionAm);
  const description =
    rawDescription && rawDescription.trim().length > 0 ? rawDescription : null;

  return {
    ...rest,
    title,
    description,
  };
}
