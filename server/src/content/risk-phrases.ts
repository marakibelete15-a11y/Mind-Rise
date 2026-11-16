// PLACEHOLDER LIST, REQUIRES REVIEW BY A MENTAL HEALTH PROFESSIONAL AND A NATIVE AMHARIC SPEAKER BEFORE RELEASE (SRS 6.3).
// A keyword scan is a safety net and NOT a detector or a diagnosis (FR-6.4); it will miss things and produce false positives.
// Keep it separate from the code (SRS 5.6).

/**
 * Curated risk phrases grouped by severity tier.
 *
 * CRITICAL Tier: Explicit statements of self-harm intent, active suicide plans, or lethal preparations.
 * HIGH Tier: Severe hopelessness, wishing for non-existence or death without an explicit active plan.
 */

export interface RiskPhraseCatalog {
  critical: {
    en: string[];
    am: string[];
  };
  high: {
    en: string[];
    am: string[];
  };
}

export const RISK_PHRASES: RiskPhraseCatalog = {
  critical: {
    en: [
      'i want to kill myself',
      'i am going to kill myself',
      'im going to kill myself',
      'i will kill myself',
      'i want to end my life',
      'i am going to end my life',
      'im going to end my life',
      'i will end my life',
      'planning my suicide',
      'commit suicide',
      'committing suicide',
      'ready to die today',
      'goodbye everyone suicide',
      'suicide note',
      'hanging myself',
      'overdosing to die',
    ],
    am: [
      'ራሴን መግደል እፈልጋለሁ',
      'ራሴን ልገድል ነው',
      'ራሴን አጠፋለሁ',
      'ራሴን ማጥፋት እፈልጋለሁ',
      'ህይወቴን ማጥፋት እፈልጋለሁ',
      'ህይወቴን ልጨርስ ነው',
      'የስንብት ደብዳቤ',
      'ራስን የማጥፋት እቅድ',
    ],
  },
  high: {
    en: [
      'i want to die',
      'i wish i were dead',
      'i wish i was dead',
      'i have no reason to live',
      'there is no reason to live',
      'no reason to live',
      'i dont want to wake up',
      "i don't want to wake up",
      'i cant take this life anymore',
      "i can't take this life anymore",
      'better off without me',
      'everyone would be better off without me',
      'tired of living',
      'no hope left for me',
      'nothing to live for',
      'want to disappear forever',
    ],
    am: [
      'መሞት እፈልጋለሁ',
      'ህይወት ሰልችቶኛል',
      'መኖር አልፈልግም',
      'መኖር ሰልችቶኛል',
      'ምንም ተስፋ የለኝም',
      'የምኖርበት ምንም ምክንያት የለም',
      'ከዚህ አለም ብሰወር ይሻላል',
      'ሳልነቃ ብቀር እመኛለሁ',
    ],
  },
};
