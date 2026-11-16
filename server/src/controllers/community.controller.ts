/**
 * Controller for the Anonymous Community module (SRS FR-4.1 to FR-4.5).
 *
 * WHY:
 * 1. Layered Pattern: Parses params, query, and request body, delegates business
 *    logic to community service, and formats responses with standard `{ data: ... }`.
 * 2. Privacy Preservation: Controller never inspects or exposes internal author IDs.
 * 3. Status Compliance: Write endpoints require `requireActive` at the routing layer,
 *    blocking RESTRICTED/SUSPENDED users while permitting them to read feeds and topics.
 */

import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { resolveLanguage } from '../utils/localize.js';
import {
  listTopics,
  createPost,
  getFeed,
  getPostById,
  deletePost,
  createComment,
  getComments,
  deleteComment,
  addSupportReaction,
  removeSupportReaction,
} from '../services/community.service.js';
import {
  createPostSchema,
  createCommentSchema,
  feedQuerySchema,
  commentsQuerySchema,
  postIdParamSchema,
  commentIdParamSchema,
} from '../validators/community.validators.js';

/**
 * GET /api/community/topics
 * Returns available topic discussion spaces with localized titles and active post counts.
 */
export const listTopicsHandler = asyncHandler(async (req: Request, res: Response) => {
  const userLang = (req.user as { preferredLanguage?: string } | undefined)?.preferredLanguage;
  const lang = resolveLanguage(req.query.lang, userLang);

  const topics = await listTopics(lang);
  sendSuccess(res, topics, 200);
});

/**
 * POST /api/community/posts
 * Creates a new anonymous community post. Requires authenticate + requireActive.
 */
export const createPostHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const userLang = (req.user as { preferredLanguage?: string } | undefined)?.preferredLanguage;
  const lang = resolveLanguage(req.query.lang, userLang);
  const validatedBody = createPostSchema.parse(req.body);

  const post = await createPost(userId, validatedBody, lang);
  sendSuccess(res, post, 201);
});

/**
 * GET /api/community/posts
 * Returns the community feed, ordered newest-first with cursor pagination and optional topic filter.
 */
export const getFeedHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const query = feedQuerySchema.parse(req.query);

  const result = await getFeed(userId, query);
  sendSuccess(res, result, 200);
});

/**
 * GET /api/community/posts/:id
 * Retrieves a single community post. Returns 404 if soft-deleted or non-existent.
 */
export const getPostByIdHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = postIdParamSchema.parse(req.params);

  const post = await getPostById(userId, id);
  sendSuccess(res, post, 200);
});

/**
 * DELETE /api/community/posts/:id
 * Soft deletes author's post. Requires authenticate + requireActive.
 */
export const deletePostHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = postIdParamSchema.parse(req.params);

  const result = await deletePost(userId, id);
  sendSuccess(res, result, 200);
});

/**
 * POST /api/community/posts/:id/comments
 * Adds an anonymous comment to a post. Requires authenticate + requireActive.
 */
export const createCommentHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const userLang = (req.user as { preferredLanguage?: string } | undefined)?.preferredLanguage;
  const lang = resolveLanguage(req.query.lang, userLang);
  const { id } = postIdParamSchema.parse(req.params);
  const validatedBody = createCommentSchema.parse(req.body);

  const comment = await createComment(userId, id, validatedBody.content, lang);
  sendSuccess(res, comment, 201);
});

/**
 * GET /api/community/posts/:id/comments
 * Lists comments on a post, ordered oldest-first with cursor pagination.
 */
export const getCommentsHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = postIdParamSchema.parse(req.params);
  const query = commentsQuerySchema.parse(req.query);

  const result = await getComments(userId, id, query);
  sendSuccess(res, result, 200);
});

/**
 * DELETE /api/community/comments/:id
 * Soft deletes author's comment. Requires authenticate + requireActive.
 */
export const deleteCommentHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = commentIdParamSchema.parse(req.params);

  const result = await deleteComment(userId, id);
  sendSuccess(res, result, 200);
});

/**
 * PUT /api/community/posts/:id/reactions/support
 * Idempotently adds a SUPPORT reaction to a post. Requires authenticate + requireActive.
 */
export const addSupportReactionHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = postIdParamSchema.parse(req.params);

  const result = await addSupportReaction(userId, id);
  sendSuccess(res, result, 200);
});

/**
 * DELETE /api/community/posts/:id/reactions/support
 * Idempotently removes a SUPPORT reaction from a post. Requires authenticate + requireActive.
 */
export const removeSupportReactionHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = postIdParamSchema.parse(req.params);

  const result = await removeSupportReaction(userId, id);
  sendSuccess(res, result, 200);
});
