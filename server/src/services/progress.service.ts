import prisma, { Badge, RoutineCompletion } from '@mindrise/database';
import { AppError } from '../middleware/errorHandler.js';
import {
  ClockFn,
  getAddisDateString,
  getAddisYesterdayString,
  parseDateStringToDate,
  formatDateToDateString,
} from '../utils/dates.js';
import { pickLocalized, SupportedLanguage } from '../utils/localize.js';

/**
 * Service for Habit Check-ins, Streak Tracking, Points, and Badges.
 *
 * WHY:
 * 1. Habits build mental resilience through daily consistency. Points and streaks
 *    provide positive operant reinforcement (gamification) without competitive pressure.
 * 2. All streak calculations are strictly locked to the Africa/Addis_Ababa timezone (UTC+3)
 *    so midnight in Ethiopia defines the day boundary for all users.
 * 3. The entire check-in mutation runs in a single transaction to prevent race conditions
 *    and ensure points, streaks, completions, and badge unlocking are atomic.
 */

export const POINTS_PER_COMPLETION = 10;

export interface CheckInResult {
  completion: RoutineCompletion;
  alreadyCompleted: boolean;
  pointsAwarded: number;
  progress: {
    points: number;
    currentStreak: number;
    longestStreak: number;
    lastCompletedDate: string | null;
  };
  newBadges: Array<{
    id: string;
    slug: string;
    name: string;
    description: string;
    pointsRequired: number;
    iconUrl: string | null;
  }>;
}

export class ProgressService {
  /**
   * Helper to compute the effective streak on read.
   *
   * WHY: If a user misses one or more days, their streak is broken. Rather than running
   * a daily background cron job to reset millions of user records at midnight,
   * we calculate the effective streak on read: if lastCompletedDate is older than yesterday,
   * currentStreak is reported as 0 without mutating the database.
   */
  getEffectiveStreak(
    currentStreak: number,
    lastCompletedDate: Date | null,
    clock?: ClockFn
  ): number {
    if (!lastCompletedDate || currentStreak === 0) {
      return 0;
    }

    const lastDateStr = formatDateToDateString(lastCompletedDate);
    const todayAddisStr = getAddisDateString(clock);
    const yesterdayAddisStr = getAddisYesterdayString(clock);

    // If completed today or yesterday, the streak remains intact
    if (lastDateStr === todayAddisStr || lastDateStr === yesterdayAddisStr) {
      return currentStreak;
    }

    // Older than yesterday: the streak is broken
    return 0;
  }

  /**
   * Records a daily check-in for a routine.
   *
   * WHY:
   * - Must belong to caller, be ACTIVE, and not soft-deleted.
   * - Idempotent: repeated check-ins on the same routine on the same day award no extra points.
   * - Streak increments once per day: completing 3 routines on the same day gives 30 points,
   *   but advances the streak by only 1 day.
   */
  async checkIn(userId: string, routineId: string, clock?: ClockFn): Promise<CheckInResult> {
    // 1. Verify existence, ownership, and active status
    const routine = await prisma.routine.findFirst({
      where: {
        id: routineId,
        userId,
        deletedAt: null,
      },
    });

    if (!routine) {
      throw new AppError(404, 'ROUTINE_NOT_FOUND', 'Routine not found.');
    }

    if (routine.status !== 'ACTIVE') {
      throw new AppError(400, 'ROUTINE_NOT_ACTIVE', 'Cannot check in to a paused routine.');
    }

    const todayAddisStr = getAddisDateString(clock);
    const yesterdayAddisStr = getAddisYesterdayString(clock);
    const todayDate = parseDateStringToDate(todayAddisStr);

    try {
      return await prisma.$transaction(async (tx) => {
        // 2. Check if this routine was already completed today
        const existingCompletion = await tx.routineCompletion.findUnique({
          where: {
            routineId_completedDate: {
              routineId,
              completedDate: todayDate,
            },
          },
        });

        if (existingCompletion) {
          // Idempotent return: no points awarded, no streak change
          const currentProgress = await tx.userProgress.findUnique({
            where: { userId },
          });

          const rawStreak = currentProgress?.currentStreak ?? 0;
          const effectiveStreak = this.getEffectiveStreak(
            rawStreak,
            currentProgress?.lastCompletedDate ?? null,
            clock
          );

          return {
            completion: existingCompletion,
            alreadyCompleted: true,
            pointsAwarded: 0,
            progress: {
              points: currentProgress?.points ?? 0,
              currentStreak: effectiveStreak,
              longestStreak: currentProgress?.longestStreak ?? 0,
              lastCompletedDate: currentProgress?.lastCompletedDate
                ? formatDateToDateString(currentProgress.lastCompletedDate)
                : null,
            },
            newBadges: [],
          };
        }

        // 3. Create RoutineCompletion
        const completion = await tx.routineCompletion.create({
          data: {
            routineId,
            completedDate: todayDate,
          },
        });

        // 4. Retrieve or initialize user progress
        const currentProgress = await tx.userProgress.findUnique({
          where: { userId },
        });

        const currentPoints = currentProgress?.points ?? 0;
        const currentStreak = currentProgress?.currentStreak ?? 0;
        const currentLongest = currentProgress?.longestStreak ?? 0;
        const lastDate = currentProgress?.lastCompletedDate;
        const lastDateStr = lastDate ? formatDateToDateString(lastDate) : null;

        // 5. Calculate new streak
        let newStreak: number;
        if (lastDateStr === todayAddisStr) {
          // Already completed another routine today: streak count is unchanged
          newStreak = currentStreak;
        } else if (lastDateStr === yesterdayAddisStr) {
          // Completed yesterday: streak continues!
          newStreak = currentStreak + 1;
        } else {
          // First check-in ever, or missed one or more days: reset streak to 1
          newStreak = 1;
        }

        const newLongestStreak = Math.max(currentLongest, newStreak);
        const newPoints = currentPoints + POINTS_PER_COMPLETION;

        // 6. Persist updated progress
        await tx.userProgress.upsert({
          where: { userId },
          update: {
            points: newPoints,
            currentStreak: newStreak,
            longestStreak: newLongestStreak,
            lastCompletedDate: todayDate,
          },
          create: {
            userId,
            points: newPoints,
            currentStreak: newStreak,
            longestStreak: newLongestStreak,
            lastCompletedDate: todayDate,
          },
        });

        // 7. Check and award eligible badges
        const eligibleBadges = await tx.badge.findMany({
          where: {
            pointsRequired: { lte: newPoints },
          },
        });

        const existingUserBadges = await tx.userBadge.findMany({
          where: { userId },
        });
        const awardedBadgeIds = new Set(existingUserBadges.map((ub) => ub.badgeId));

        const newlyUnlockedBadges: Badge[] = [];
        for (const badge of eligibleBadges) {
          if (!awardedBadgeIds.has(badge.id)) {
            // Upsert safely handles any rare concurrent check-ins
            await tx.userBadge.upsert({
              where: {
                userId_badgeId: {
                  userId,
                  badgeId: badge.id,
                },
              },
              update: {},
              create: {
                userId,
                badgeId: badge.id,
              },
            });
            newlyUnlockedBadges.push(badge);
          }
        }

        return {
          completion,
          alreadyCompleted: false,
          pointsAwarded: POINTS_PER_COMPLETION,
          progress: {
            points: newPoints,
            currentStreak: newStreak,
            longestStreak: newLongestStreak,
            lastCompletedDate: todayAddisStr,
          },
          newBadges: newlyUnlockedBadges.map((b) => ({
            id: b.id,
            slug: b.slug,
            name: b.nameEn,
            description: b.descriptionEn,
            pointsRequired: b.pointsRequired,
            iconUrl: b.iconUrl,
          })),
        };
      });
    } catch (err: any) {
      // If a race condition fired P2002 on concurrent creation, handle idempotently
      if (err?.code === 'P2002') {
        const existingCompletion = await prisma.routineCompletion.findUnique({
          where: {
            routineId_completedDate: {
              routineId,
              completedDate: todayDate,
            },
          },
        });

        const currentProgress = await prisma.userProgress.findUnique({
          where: { userId },
        });

        const rawStreak = currentProgress?.currentStreak ?? 0;
        const effectiveStreak = this.getEffectiveStreak(
          rawStreak,
          currentProgress?.lastCompletedDate ?? null,
          clock
        );

        return {
          completion: existingCompletion!,
          alreadyCompleted: true,
          pointsAwarded: 0,
          progress: {
            points: currentProgress?.points ?? 0,
            currentStreak: effectiveStreak,
            longestStreak: currentProgress?.longestStreak ?? 0,
            lastCompletedDate: currentProgress?.lastCompletedDate
              ? formatDateToDateString(currentProgress.lastCompletedDate)
              : null,
          },
          newBadges: [],
        };
      }
      throw err;
    }
  }

  /**
   * Retrieves overall progress, effective streak, and earned badges for a user.
   */
  async getUserProgress(userId: string, lang: SupportedLanguage = 'en', clock?: ClockFn) {
    const progress = await prisma.userProgress.findUnique({
      where: { userId },
    });

    const userBadges = await prisma.userBadge.findMany({
      where: { userId },
      include: { badge: true },
      orderBy: { awardedAt: 'desc' },
    });

    const rawStreak = progress?.currentStreak ?? 0;
    const effectiveStreak = this.getEffectiveStreak(
      rawStreak,
      progress?.lastCompletedDate ?? null,
      clock
    );

    return {
      points: progress?.points ?? 0,
      currentStreak: effectiveStreak,
      longestStreak: progress?.longestStreak ?? 0,
      lastCompletedDate: progress?.lastCompletedDate
        ? formatDateToDateString(progress.lastCompletedDate)
        : null,
      earnedBadges: userBadges.map((ub) => ({
        id: ub.badge.id,
        slug: ub.badge.slug,
        name: pickLocalized(ub.badge.nameEn, ub.badge.nameAm, lang),
        description: pickLocalized(ub.badge.descriptionEn, ub.badge.descriptionAm, lang),
        pointsRequired: ub.badge.pointsRequired,
        iconUrl: ub.badge.iconUrl,
        awardedAt: ub.awardedAt.toISOString(),
      })),
    };
  }

  /**
   * Retrieves all available badges localized by language, annotated with earned status.
   */
  async getAllBadges(userId: string, lang: SupportedLanguage) {
    const badges = await prisma.badge.findMany({
      orderBy: { pointsRequired: 'asc' },
    });

    const userBadges = await prisma.userBadge.findMany({
      where: { userId },
    });

    const earnedMap = new Map<string, Date>();
    for (const ub of userBadges) {
      earnedMap.set(ub.badgeId, ub.awardedAt);
    }

    return badges.map((b) => ({
      id: b.id,
      slug: b.slug,
      name: pickLocalized(b.nameEn, b.nameAm, lang),
      description: pickLocalized(b.descriptionEn, b.descriptionAm, lang),
      pointsRequired: b.pointsRequired,
      iconUrl: b.iconUrl,
      earned: earnedMap.has(b.id),
      awardedAt: earnedMap.get(b.id)?.toISOString() ?? null,
    }));
  }
}

export const progressService = new ProgressService();
