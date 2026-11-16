/**
 * Service Layer for the Anonymous Community module (SRS FR-4.1 to FR-4.5).
 *
 * WHY:
 * 1. Privacy Protection (SRS 5.4): Explicit Prisma `select` clauses ensure that
 *    sensitive user credentials (`VerifiedIdentity`, `phone`, `email`, `firstName`,
 *    `lastName`) are NEVER fetched or joined. Only `Profile` public fields are selected.
 * 2. Moderation & Evidence Preservation: Author deletion of posts and comments is a
 *    SOFT DELETE (`deletedAt: new Date()`). Soft-deleted content is excluded from all
 *    feeds, searches, and comments, but remains preserved for Phase B5 moderation evidence.
 * 3. Rate Limiting: Database-backed hourly throttles (10 posts/hour, 30 comments/hour)
 *    prevent flood attacks and spam.
 * 4. Concurrency & Idempotency: Reactions catch PostgreSQL P2002 unique constraint
 *    conflicts to ensure parallel requests resolve idempotently without throwing 500 errors.
 */

import prisma, {
  ReactionType,
  CrisisSource,
  CrisisPriority,
} from '@mindrise/database';
import { AppError } from '../middleware/errorHandler.js';
import { SupportedLanguage, pickLocalized } from '../utils/localize.js';
import {
  mapPost,
  mapComment,
  PostResponseDTO,
  CommentResponseDTO,
  TopicResponseDTO,
} from '../utils/community.mapper.js';
import * as crisisService from './crisis.service.js';
import {
  getActiveCrisisResources,
  CrisisPayloadDTO,
} from '../utils/crisis-resources.js';
import { scanText } from '../utils/risk-scanner.js';

export interface PostWithCrisisDTO extends PostResponseDTO {
  crisis: CrisisPayloadDTO;
}

export interface CommentWithCrisisDTO extends CommentResponseDTO {
  crisis: CrisisPayloadDTO;
}

/**
 * Crisis notifier adapter.
 * Allows Part B community to invoke Part A's crisis service while
 * remaining cleanly spyable and mockable in tests without touching Part A files.
 */
export const crisisNotifier = {
  raiseFlag: (input: {
    userId: string;
    source: CrisisSource;
    sourceId: string;
    priority: CrisisPriority;
  }) => crisisService.raiseFlag(input),
};

export interface ContentCreatedPayload {
  type: 'POST' | 'COMMENT';
  id: string;
  content: string;
  authorId: string;
  lang?: SupportedLanguage;
}

/**
 * Hook triggered after any community post or comment is saved (SRS FR-4.6).
 * Scans content for risk language. If matched, notifies crisis service and retrieves
 * localized crisis resources.
 *
 * NON-BLOCKING SAFETY RULE:
 * This scan and flag escalation must NEVER throw, abort, or delay creation,
 * nor reveal to the client that content was flagged or internal flag priorities.
 */
export async function onContentCreated(
  payload: ContentCreatedPayload
): Promise<CrisisPayloadDTO> {
  const defaultCrisis: CrisisPayloadDTO = { show: false, resources: [] };
  try {
    const scanResult = scanText(payload.content);
    if (!scanResult.matched || !scanResult.priority) {
      return defaultCrisis;
    }

    // Flag escalation (inside try/catch to maintain non-blocking behavior)
    try {
      await crisisNotifier.raiseFlag({
        userId: payload.authorId,
        // The CrisisSource enum defines ASSESSMENT and POST.
        // For comments, we use source POST with the comment's UUID in sourceId.
        source: CrisisSource.POST,
        sourceId: payload.id,
        priority:
          scanResult.priority === 'CRITICAL'
            ? CrisisPriority.CRITICAL
            : CrisisPriority.HIGH,
      });
    } catch (err) {
      // Log only UUIDs and error message; NEVER log content or matched phrases
      console.error('Crisis escalation raiseFlag failed', {
        userId: payload.authorId,
        sourceId: payload.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Retrieve active crisis resources localized for the user
    const crisisResources = await getActiveCrisisResources(payload.lang ?? 'en');
    return {
      show: true,
      resources: crisisResources.resources,
      ...(crisisResources.emergencyMessage
        ? { emergencyMessage: crisisResources.emergencyMessage }
        : {}),
    };
  } catch (err) {
    console.error('Safety scan execution failed', {
      sourceId: payload.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return defaultCrisis;
  }
}

/**
 * Lists available topic discussion spaces localized by requested language.
 * Returns active post count per topic (excluding soft-deleted posts).
 */
export async function listTopics(
  lang: SupportedLanguage = 'en'
): Promise<TopicResponseDTO[]> {
  const topics = await prisma.topic.findMany({
    include: {
      _count: {
        select: {
          posts: {
            where: { deletedAt: null },
          },
        },
      },
    },
    orderBy: { nameEn: 'asc' },
  });

  return topics.map((t) => ({
    id: t.id,
    slug: t.slug,
    name: pickLocalized(t.nameEn, t.nameAm, lang),
    description: pickLocalized(t.descriptionEn, t.descriptionAm, lang),
    postCount: t._count.posts,
  }));
}

/**
 * Creates an anonymous community post.
 * Enforces topic existence and hourly posting quota (10 posts/hour).
 */
export async function createPost(
  userId: string,
  input: {
    topicId: string;
    title: string;
    content: string;
  },
  lang: SupportedLanguage = 'en'
): Promise<PostWithCrisisDTO> {
  // 1. Verify Topic Space Exists
  const topic = await prisma.topic.findUnique({
    where: { id: input.topicId },
    select: { id: true },
  });
  if (!topic) {
    throw new AppError(404, 'TOPIC_NOT_FOUND', 'Topic space not found.');
  }

  // 2. Enforce Post Rate Limit (10 posts per user per hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const postCountLastHour = await prisma.post.count({
    where: {
      authorId: userId,
      createdAt: { gte: oneHourAgo },
    },
  });

  if (postCountLastHour >= 10) {
    throw new AppError(
      429,
      'POST_RATE_LIMIT',
      'You have reached the maximum of 10 posts per hour.'
    );
  }

  // 3. Persist Post with Strict Author Profile Select
  const post = await prisma.post.create({
    data: {
      authorId: userId,
      topicId: input.topicId,
      title: input.title,
      content: input.content,
    },
    select: {
      id: true,
      authorId: true,
      topicId: true,
      title: true,
      content: true,
      isPinned: true,
      createdAt: true,
      author: {
        select: {
          profile: {
            select: {
              anonymousHandle: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
  });

  // 4. Trigger Phase B5 Safety Hook (scans title + content)
  const textToScan = `${input.title} ${input.content}`;
  const crisis = await onContentCreated({
    type: 'POST',
    id: post.id,
    content: textToScan,
    authorId: userId,
    lang,
  });

  const mapped = mapPost(post, userId, {
    reactedByMe: false,
    supportCount: 0,
    commentCount: 0,
  });

  return {
    ...mapped,
    crisis,
  };
}

/**
 * Retrieves the community feed, ordered newest-first with cursor-based pagination.
 * Excludes soft-deleted posts and batches reaction status to prevent N+1 queries.
 */
export async function getFeed(
  userId: string,
  options: {
    cursor?: string;
    limit?: number;
    topicId?: string;
  }
): Promise<{ items: PostResponseDTO[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);

  const whereClause: {
    deletedAt: null;
    topicId?: string;
  } = {
    deletedAt: null,
    ...(options.topicId ? { topicId: options.topicId } : {}),
  };

  const posts = await prisma.post.findMany({
    where: whereClause,
    take: limit + 1,
    cursor: options.cursor ? { id: options.cursor } : undefined,
    skip: options.cursor ? 1 : 0,
    orderBy: [
      { createdAt: 'desc' },
      { id: 'desc' },
    ],
    select: {
      id: true,
      authorId: true,
      topicId: true,
      title: true,
      content: true,
      isPinned: true,
      createdAt: true,
      author: {
        select: {
          profile: {
            select: {
              anonymousHandle: true,
              avatarUrl: true,
            },
          },
        },
      },
      _count: {
        select: {
          reactions: true,
          comments: {
            where: { deletedAt: null },
          },
        },
      },
    },
  });

  const hasMore = posts.length > limit;
  const items = hasMore ? posts.slice(0, limit) : posts;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  // Batch query user's reactions on this page
  const postIds = items.map((p) => p.id);
  const userReactions = await prisma.reaction.findMany({
    where: {
      postId: { in: postIds },
      userId,
      type: ReactionType.SUPPORT,
    },
    select: { postId: true },
  });
  const reactedPostIds = new Set(userReactions.map((r) => r.postId));

  const mappedItems: PostResponseDTO[] = items.map((p) =>
    mapPost(p, userId, {
      reactedByMe: reactedPostIds.has(p.id),
      supportCount: p._count.reactions,
      commentCount: p._count.comments,
    })
  );

  return { items: mappedItems, nextCursor };
}

/**
 * Retrieves a single community post by ID.
 * Returns 404 if deleted or not found.
 */
export async function getPostById(
  userId: string,
  postId: string
): Promise<PostResponseDTO> {
  const post = await prisma.post.findFirst({
    where: {
      id: postId,
      deletedAt: null,
    },
    select: {
      id: true,
      authorId: true,
      topicId: true,
      title: true,
      content: true,
      isPinned: true,
      createdAt: true,
      author: {
        select: {
          profile: {
            select: {
              anonymousHandle: true,
              avatarUrl: true,
            },
          },
        },
      },
      _count: {
        select: {
          reactions: true,
          comments: {
            where: { deletedAt: null },
          },
        },
      },
    },
  });

  if (!post) {
    throw new AppError(404, 'POST_NOT_FOUND', 'Post not found.');
  }

  const reaction = await prisma.reaction.findUnique({
    where: {
      postId_userId_type: {
        postId,
        userId,
        type: ReactionType.SUPPORT,
      },
    },
    select: { id: true },
  });

  return mapPost(post, userId, {
    reactedByMe: Boolean(reaction),
    supportCount: post._count.reactions,
    commentCount: post._count.comments,
  });
}

/**
 * Soft deletes a post (SRS FR-4.5 & Phase B5 audit trail).
 * Only the owning author can delete. Returns 404 for others.
 */
export async function deletePost(
  userId: string,
  postId: string
): Promise<{ success: boolean; message: string }> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      authorId: true,
      deletedAt: true,
    },
  });

  if (!post || post.deletedAt !== null || post.authorId !== userId) {
    throw new AppError(404, 'POST_NOT_FOUND', 'Post not found.');
  }

  // Soft delete preserves evidence in DB while hiding from all read queries
  await prisma.post.update({
    where: { id: postId },
    data: { deletedAt: new Date() },
  });

  return { success: true, message: 'Post deleted successfully.' };
}

/**
 * Creates a comment on a community post.
 * Enforces parent post existence, active status, and comment rate limit (30 comments/hour).
 */
export async function createComment(
  userId: string,
  postId: string,
  content: string,
  lang: SupportedLanguage = 'en'
): Promise<CommentWithCrisisDTO> {
  // 1. Verify Parent Post Exists and is not Deleted
  const post = await prisma.post.findFirst({
    where: {
      id: postId,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!post) {
    throw new AppError(404, 'POST_NOT_FOUND', 'Post not found.');
  }

  // 2. Enforce Comment Rate Limit (30 comments per user per hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const commentCountLastHour = await prisma.comment.count({
    where: {
      authorId: userId,
      createdAt: { gte: oneHourAgo },
    },
  });

  if (commentCountLastHour >= 30) {
    throw new AppError(
      429,
      'COMMENT_RATE_LIMIT',
      'You have reached the maximum of 30 comments per hour.'
    );
  }

  // 3. Persist Comment with Strict Author Profile Select
  const comment = await prisma.comment.create({
    data: {
      postId,
      authorId: userId,
      content,
    },
    select: {
      id: true,
      postId: true,
      authorId: true,
      content: true,
      createdAt: true,
      author: {
        select: {
          profile: {
            select: {
              anonymousHandle: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
  });

  // 4. Trigger Phase B5 Safety Hook
  const crisis = await onContentCreated({
    type: 'COMMENT',
    id: comment.id,
    content: comment.content,
    authorId: userId,
    lang,
  });

  const mapped = mapComment(comment, userId);

  return {
    ...mapped,
    crisis,
  };
}

/**
 * Retrieves comments on a post, ordered oldest first, with cursor pagination.
 * Excludes soft-deleted comments.
 */
export async function getComments(
  userId: string,
  postId: string,
  options: {
    cursor?: string;
    limit?: number;
  }
): Promise<{ items: CommentResponseDTO[]; nextCursor: string | null }> {
  // 1. Verify Parent Post Exists and is not Deleted
  const post = await prisma.post.findFirst({
    where: {
      id: postId,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!post) {
    throw new AppError(404, 'POST_NOT_FOUND', 'Post not found.');
  }

  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);

  const comments = await prisma.comment.findMany({
    where: {
      postId,
      deletedAt: null,
    },
    take: limit + 1,
    cursor: options.cursor ? { id: options.cursor } : undefined,
    skip: options.cursor ? 1 : 0,
    orderBy: [
      { createdAt: 'asc' },
      { id: 'asc' },
    ],
    select: {
      id: true,
      postId: true,
      authorId: true,
      content: true,
      createdAt: true,
      author: {
        select: {
          profile: {
            select: {
              anonymousHandle: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
  });

  const hasMore = comments.length > limit;
  const items = hasMore ? comments.slice(0, limit) : comments;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return {
    items: items.map((c) => mapComment(c, userId)),
    nextCursor,
  };
}

/**
 * Soft deletes a comment (SRS FR-4.5).
 * Only the owning author can delete. Returns 404 for others.
 */
export async function deleteComment(
  userId: string,
  commentId: string
): Promise<{ success: boolean; message: string }> {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      authorId: true,
      deletedAt: true,
    },
  });

  if (!comment || comment.deletedAt !== null || comment.authorId !== userId) {
    throw new AppError(404, 'COMMENT_NOT_FOUND', 'Comment not found.');
  }

  // Soft delete
  await prisma.comment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  });

  return { success: true, message: 'Comment deleted successfully.' };
}

/**
 * Adds a SUPPORT reaction to a post idempotently.
 * Catches P2002 unique constraint race so concurrent requests both succeed.
 */
export async function addSupportReaction(
  userId: string,
  postId: string
): Promise<{ supportCount: number; reactedByMe: boolean }> {
  // 1. Verify Post Exists and is not Deleted
  const post = await prisma.post.findFirst({
    where: {
      id: postId,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!post) {
    throw new AppError(404, 'POST_NOT_FOUND', 'Post not found.');
  }

  // 2. Insert Reaction Idempotently
  try {
    await prisma.reaction.create({
      data: {
        postId,
        userId,
        type: ReactionType.SUPPORT,
      },
    });
  } catch (err: unknown) {
    // If unique constraint violation (P2002), reaction already exists; ignore error
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    ) {
      // Already reacted; proceed cleanly
    } else {
      throw err;
    }
  }

  const supportCount = await prisma.reaction.count({
    where: {
      postId,
      type: ReactionType.SUPPORT,
    },
  });

  return {
    supportCount,
    reactedByMe: true,
  };
}

/**
 * Removes a SUPPORT reaction from a post idempotently.
 */
export async function removeSupportReaction(
  userId: string,
  postId: string
): Promise<{ supportCount: number; reactedByMe: boolean }> {
  // 1. Verify Post Exists and is not Deleted
  const post = await prisma.post.findFirst({
    where: {
      id: postId,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!post) {
    throw new AppError(404, 'POST_NOT_FOUND', 'Post not found.');
  }

  // 2. Delete Reaction if present
  await prisma.reaction.deleteMany({
    where: {
      postId,
      userId,
      type: ReactionType.SUPPORT,
    },
  });

  const supportCount = await prisma.reaction.count({
    where: {
      postId,
      type: ReactionType.SUPPORT,
    },
  });

  return {
    supportCount,
    reactedByMe: false,
  };
}
