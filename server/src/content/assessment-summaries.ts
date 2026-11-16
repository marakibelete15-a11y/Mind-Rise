// PLACEHOLDER CONTENT, REQUIRES REVIEW BY A MENTAL HEALTH PROFESSIONAL AND A NATIVE AMHARIC SPEAKER BEFORE RELEASE (SRS 5.2, 6.3).
// Separated from application logic per SRS 5.6. Never uses diagnostic labels such as "depression" or "disorder".

import { AssessmentDomain } from '@mindrise/database';
import { SupportedLanguage } from '../utils/localize.js';

export type SummaryBandKey = 'LOW' | 'MODERATE' | 'HIGH';

export interface LocalizedText {
  en: string;
  am: string;
}

/**
 * Universal bilingual disclaimer shown alongside every assessment result.
 * Strictly non-diagnostic (SRS 5.2).
 */
export const ASSESSMENT_DISCLAIMER: LocalizedText = {
  en: 'This tool does not provide a medical diagnosis and is not a substitute for professional care.',
  am: 'ይህ መሳሪያ የህክምና ምርመራ ወይም ማረጋገጫ አይሰጥም፣ እንዲሁም የባለሙያ የህክምና እና የስነ-ልቦና እንክብካቤን አይተካም።',
};

/**
 * Emergency contact advisory returned when crisis support is recommended
 * but the database query for specific hotlines fails or yields an empty list.
 */
export const EMERGENCY_FALLBACK_MESSAGE: LocalizedText = {
  en: 'Please contact local emergency services or a healthcare professional immediately.',
  am: 'እባክዎ በአስቸኳይ በአቅራቢያዎ የሚገኙ የአስቸኳይ ጊዜ አገልግሎቶችን ወይም የጤና ባለሙያዎችን ያነጋግሩ።',
};

/**
 * Bilingual reflective summary copy for each domain and severity band.
 * Phrased constructively to validate experience without assigning medical pathologies.
 */
export const DOMAIN_SUMMARIES: Record<AssessmentDomain, Record<SummaryBandKey, LocalizedText>> = {
  [AssessmentDomain.STRESS]: {
    LOW: {
      en: 'Your responses suggest you are currently managing daily pressures well, with mild and manageable stress levels.',
      am: 'የሰጡት ምላሽ የሚያሳየው ዕለታዊ ጫናዎችን በጥሩ ሁኔታ እየተቆጣጠሩ እንደሆነ እና የጭንቀት መጠኑ አነስተኛ እንደሆነ ነው።',
    },
    MODERATE: {
      en: 'Your responses indicate noticeable levels of tension. Setting boundaries and making time for brief daily pauses can help keep stress from building up.',
      am: 'የሰጡት ምላሽ የሚታይ የውጥረት ስሜት እንዳለ ያሳያል። ወሰን ማበጀት እና አጫጭር የእረፍት ጊዜያትን መውሰድ ጫናው እንዳይከማች ሊረዳ ይችላል።',
    },
    HIGH: {
      en: 'Your responses reflect significant strain and overwhelm. We encourage you to reach out to a trusted companion or explore our supportive resources for assistance.',
      am: 'የሰጡት ምላሽ ከፍተኛ ጫና እና የስሜት ከበድ ማለትን ያመለክታል። ከታመነ ጓደኛ ጋር እንዲያወሩ ወይም የድጋፍ መርጃዎችን እንዲመለከቱ እናበረታታለን።',
    },
  },
  [AssessmentDomain.ANXIETY]: {
    LOW: {
      en: 'Your responses reflect minimal worry and nervousness over the recent period.',
      am: 'የሰጡት ምላሽ በቅርብ ጊዜ ውስጥ አነስተኛ የሆነ የስጋት እና የፍርሃት ስሜት እንደነበረዎት ያሳያል።',
    },
    MODERATE: {
      en: 'Your responses indicate persistent worry or physical restlessness. Gentle breathing exercises and grounding routines may provide comfort.',
      am: 'የሰጡት ምላሽ ቀጣይነት ያለው ስጋት ወይም እረፍት ማጣት እንዳለብዎት ያሳያል። ቀስ ብለው የሚተነፍሱባቸው ልምምዶች እና አረጋጊ ልማዶች መረጋጋትን ሊሰጡ ይችላሉ።',
    },
    HIGH: {
      en: 'Your responses reflect heightened feelings of alarm and difficulty controlling worry. Connecting with a compassionate listener or counselor can help you find stability.',
      am: 'የሰጡት ምላሽ ከፍተኛ የሆነ የስጋት ስሜት እና ጭንቀትን መቆጣጠር መቸገርን ያሳያል። አድማጭ ከሆነ ሰው ወይም አማካሪ ጋር መገናኘት መረጋጋት ለማግኘት ይረዳል።',
    },
  },
  [AssessmentDomain.LOW_MOTIVATION]: {
    LOW: {
      en: 'Your responses suggest you have good day-to-day engagement and steady energy for your activities.',
      am: 'የሰጡት ምላሽ ለዕለት ተዕለት ተግባራትዎ ጥሩ ተነሳሽነት እና የተረጋጋ ጉልበት እንዳለዎት ያሳያል።',
    },
    MODERATE: {
      en: 'Your responses indicate low energy and moments of reluctance to begin tasks. Breaking activities into tiny, manageable steps can help rebuild momentum.',
      am: 'የሰጡት ምላሽ የጉልበት ማነስ እና ስራዎችን ለመጀመር መቸገር እንዳለ ያሳያል። ተግባራትን ወደ ጥቃቅን ደረጃዎች መከፋፈል ተነሳሽነትን ለመመለስ ይረዳል።',
    },
    HIGH: {
      en: 'Your responses reflect feeling deeply depleted and disengaged from daily life. Remember that taking small pauses and asking for gentle support is an act of strength.',
      am: 'የሰጡት ምላሽ ከፍተኛ የሆነ የድካም ስሜት እና ከዕለታዊ ህይወት መራቅ እንዳለ ያሳያል። እረፍት መውሰድ እና የድጋፍ እጅ መጠየቅ የጥንካሬ ምልክት መሆኑን ያስታውሱ።',
    },
  },
  [AssessmentDomain.EMOTIONAL_EXHAUSTION]: {
    LOW: {
      en: 'Your responses indicate you feel refreshed and emotionally resilient in your current routine.',
      am: 'የሰጡት ምላሽ አሁን ባለው የህይወት እንቅስቃሴዎ ውስጥ እረፍት እና ስሜታዊ ጥንካሬ እንደሚሰማዎት ያሳያል።',
    },
    MODERATE: {
      en: 'Your responses suggest fatigue at the end of the day and emotional wear. Protecting time for sleep, quiet reflection, and nourishing meals is recommended.',
      am: 'የሰጡት ምላሽ በቀኑ መጨረሻ ላይ ድካም እና የስሜት ዝለት እንደሚሰማዎት ያሳያል። ለእንቅልፍ፣ ጸጥታ ላለው እረፍት እና ተመጣጣኝ ምግብ ጊዜ መስጠት ይመከራል።',
    },
    HIGH: {
      en: 'Your responses reflect heavy burnout and feeling emotionally drained. Prioritizing rest and stepping back from non-essential pressures is essential.',
      am: 'የሰጡት ምላሽ ከፍተኛ የሆነ የስሜት መሟጠጥ እና ድካም እንዳለብዎት ያሳያል። ለእረፍት ቅድሚያ መስጠት እና ከአስገዳጅ ካልሆኑ ጫናዎች መራቅ አስፈላጊ ነው።',
    },
  },
  [AssessmentDomain.LOSS_OF_PURPOSE]: {
    LOW: {
      en: 'Your responses suggest a clear sense of personal direction and meaningful connection to your daily efforts.',
      am: 'የሰጡት ምላሽ በዕለት ተዕለት ጥረትዎ ውስጥ ግልጽ የሆነ የህይወት አቅጣጫ እና ትርጉም እንዳለዎት ያሳያል።',
    },
    MODERATE: {
      en: 'Your responses indicate uncertainty or comparison with others during this chapter. Clarifying small personal values can restore clarity.',
      am: 'የሰጡት ምላሽ በዚህ ወቅት ላይ እርግጠኛ አለመሆን ወይም ከሌሎች ጋር ራስን ማወዳደር እንዳለ ያሳያል። ትናንሽ የግል እሴቶችን ማስተዋል ግልጽነትን ያመጣል።',
    },
    HIGH: {
      en: 'Your responses reflect deep doubts about direction and meaning right now. Life transitions can feel disorienting; speaking with someone who understands can bring renewed perspective.',
      am: 'የሰጡት ምላሽ አሁን ባለው የህይወት አቅጣጫ እና ትርጉም ላይ ጥልቅ ጥርጣሬ እንዳለዎት ያሳያል። የህይወት ሽግግሮች ግራ ሊያጋቡ ይችላሉ፤ ከሚረዳዎት ሰው ጋር መነጋገር አዲስ እይታን ያመጣል።',
    },
  },
};

/**
 * Standard localized answer options for questionnaire rendering.
 */
export const OPTION_LABELS: Record<string, LocalizedText> = {
  rarely: { en: 'Rarely', am: 'አልፎ አልፎ' },
  sometimes: { en: 'Sometimes', am: 'አንዳንድ ጊዜ' },
  often: { en: 'Often', am: 'ብዙ ጊዜ' },
  always: { en: 'Always', am: 'ሁልጊዜ' },
  never: { en: 'Never', am: 'በፍጹም' },
  frequently: { en: 'Frequently', am: 'በተደጋጋሚ' },
  notAtAll: { en: 'Not at all', am: 'በፍጹም አልተሰማኝም' },
  severalDays: { en: 'Several days', am: 'ለጥቂት ቀናት' },
  overHalfDays: { en: 'More than half the days', am: 'ከግማሽ ቀናት በላይ' },
  nearlyEveryDay: { en: 'Nearly every day', am: 'በየቀኑ ማለት ይቻላል' },
};

/**
 * Helper to resolve a summary text for a given domain and summary key.
 */
export function getLocalizedSummary(
  domain: AssessmentDomain,
  summaryKey: string,
  lang: SupportedLanguage
): string {
  const band = (summaryKey.toUpperCase() as SummaryBandKey) in DOMAIN_SUMMARIES[domain]
    ? (summaryKey.toUpperCase() as SummaryBandKey)
    : 'MODERATE';
  return DOMAIN_SUMMARIES[domain][band][lang] || DOMAIN_SUMMARIES[domain][band].en;
}

/**
 * Helper to get the localized assessment disclaimer.
 */
export function getLocalizedDisclaimer(lang: SupportedLanguage): string {
  return ASSESSMENT_DISCLAIMER[lang] || ASSESSMENT_DISCLAIMER.en;
}

/**
 * Helper to get the localized emergency fallback message.
 */
export function getLocalizedEmergencyFallback(lang: SupportedLanguage): string {
  return EMERGENCY_FALLBACK_MESSAGE[lang] || EMERGENCY_FALLBACK_MESSAGE.en;
}
