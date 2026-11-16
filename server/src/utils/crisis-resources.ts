/**
 * Shared helper for fetching and localizing active crisis hotlines and specialized facilities (SRS FR-2.4, FR-4.6).
 *
 * WHY:
 * 1. Single Source of Truth: Used by both the Self-Assessment module (Phase B3) and the Anonymous Community
 *    module (Phase B5) whenever elevated risk is detected.
 * 2. Fail-Safe Availability: If the database is unreachable or no active resources are configured,
 *    the system must NEVER crash or return an unhelpful empty screen. It provides a localized fallback
 *    message advising the user to contact local emergency services immediately.
 * 3. Consistent Localization: Content is mapped to the user's preferred language (English or Amharic).
 */

import prisma from '@mindrise/database';
import { SupportedLanguage, pickLocalized } from './localize.js';
import { getLocalizedEmergencyFallback } from '../content/assessment-summaries.js';

export interface CrisisResourceDTO {
  name: string;
  description: string;
  phone: string;
}

export interface CrisisPayloadDTO {
  show: boolean;
  resources: CrisisResourceDTO[];
  emergencyMessage?: string;
}

/**
 * Retrieves all currently active crisis hotlines and care facilities from PostgreSQL.
 * If the query fails or returns zero records, returns a safe emergency fallback advisory.
 */
export async function getActiveCrisisResources(
  lang: SupportedLanguage = 'en'
): Promise<{ resources: CrisisResourceDTO[]; emergencyMessage?: string }> {
  try {
    const activeResources = await prisma.crisisResource.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    const resources: CrisisResourceDTO[] = activeResources.map((r) => ({
      name: pickLocalized(r.nameEn, r.nameAm, lang),
      description: pickLocalized(r.descriptionEn, r.descriptionAm, lang),
      phone: r.phone,
    }));

    if (resources.length === 0) {
      return {
        resources: [],
        emergencyMessage: getLocalizedEmergencyFallback(lang),
      };
    }

    return { resources };
  } catch (err) {
    console.error('Failed to query active crisis resources', {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      resources: [],
      emergencyMessage: getLocalizedEmergencyFallback(lang),
    };
  }
}
