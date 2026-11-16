import prisma, { RoutineStatus, Routine } from '@mindrise/database';
import { AppError } from '../middleware/errorHandler.js';
import {
  SupportedLanguage,
  localizeStarterRoutine,
} from '../utils/localize.js';
import { CreateRoutineInput, UpdateRoutineInput } from '../validators/routines.validators.js';

/**
 * Service layer for the Routines module.
 *
 * WHY: The service encapsulates all database interactions and core business
 * rules (e.g. ownership verification, soft delete, routine creation quota).
 * Keeping business logic out of controllers makes the code easier to unit test,
 * refactor, and reuse across different transports (REST, websockets, background jobs).
 */

const MAX_ACTIVE_ROUTINES = 20;

export class RoutinesService {
  /**
   * Retrieves curated starter routines localized to the requested language.
   *
   * WHY: Starter routines provide guidance for users who are new to mental health
   * habit tracking, giving them ready-made healthy habits (e.g. mindful breathing, walks).
   */
  async getStarterRoutines(lang: SupportedLanguage) {
    const starters = await prisma.starterRoutine.findMany({
      orderBy: { createdAt: 'asc' },
    });

    return starters.map((starter) => localizeStarterRoutine(starter, lang));
  }

  /**
   * Creates a new routine for the authenticated user.
   *
   * WHY: Limiting active routines to 20 prevents user overwhelm (decision fatigue)
   * and prevents database abuse / resource exhaustion.
   */
  async createRoutine(userId: string, input: CreateRoutineInput): Promise<Routine> {
    const activeCount = await prisma.routine.count({
      where: {
        userId,
        deletedAt: null,
      },
    });

    if (activeCount >= MAX_ACTIVE_ROUTINES) {
      throw new AppError(
        400,
        'ROUTINE_LIMIT_REACHED',
        `Maximum limit of ${MAX_ACTIVE_ROUTINES} active routines reached. Please pause or delete existing routines first.`
      );
    }

    return prisma.routine.create({
      data: {
        userId,
        title: input.title,
        description: input.description ?? null,
        status: RoutineStatus.ACTIVE,
      },
    });
  }

  /**
   * Retrieves paginated non-deleted routines for the authenticated user (newest first).
   *
   * WHY: Cursor-based pagination scales efficiently with large data sets
   * because it avoids SQL OFFSET performance degradation on deep pages.
   */
  async getUserRoutines(
    userId: string,
    options: { cursor?: string; limit: number }
  ): Promise<{ items: Routine[]; nextCursor: string | null }> {
    const limit = options.limit;

    // Fetch limit + 1 rows to determine if there is a next page
    const routines = await prisma.routine.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit + 1,
      ...(options.cursor
        ? {
            cursor: { id: options.cursor },
            skip: 1, // Skip the cursor element itself
          }
        : {}),
    });

    const hasMore = routines.length > limit;
    const items = hasMore ? routines.slice(0, limit) : routines;
    const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

    return { items, nextCursor };
  }

  /**
   * Retrieves a single routine by ID, ensuring strict ownership.
   *
   * WHY: Returning 404 (instead of 403 Forbidden) when a routine belongs to another
   * user or was soft-deleted prevents ID enumeration (Insecure Direct Object Reference / IDOR).
   * An attacker cannot determine whether a routine ID exists on the system.
   */
  async getRoutineById(userId: string, routineId: string): Promise<Routine> {
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

    return routine;
  }

  /**
   * Updates an existing routine's title, status, or description.
   *
   * WHY: Users can pause routines when taking a break without losing their habit setup.
   */
  async updateRoutine(
    userId: string,
    routineId: string,
    input: UpdateRoutineInput
  ): Promise<Routine> {
    // Verify ownership and existence before attempting update
    await this.getRoutineById(userId, routineId);

    return prisma.routine.update({
      where: { id: routineId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      },
    });
  }

  /**
   * Soft-deletes a routine by setting deletedAt to the current timestamp.
   *
   * WHY: We use soft delete instead of hard delete so past completion logs
   * and streak history are preserved for longitudinal wellness insights.
   */
  async deleteRoutine(userId: string, routineId: string): Promise<Routine> {
    // Verify ownership and existence before deleting
    await this.getRoutineById(userId, routineId);

    return prisma.routine.update({
      where: { id: routineId },
      data: {
        deletedAt: new Date(),
      },
    });
  }
}

export const routinesService = new RoutinesService();
