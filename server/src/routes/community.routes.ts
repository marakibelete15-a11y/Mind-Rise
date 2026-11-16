/**
 * Routes for the Anonymous Community module (SRS FR-4.1 to FR-4.5).
 *
 * WHY:
 * 1. Status Isolation: All endpoints require `authenticate`. Every write endpoint
 *    (POST, PUT, DELETE) also requires `requireActive`, ensuring that RESTRICTED
 *    accounts are prevented from posting or reacting while retaining full read access.
 * 2. Route Collision Prevention: Sub-resource paths (`/posts/:id/comments`,
 *    `/posts/:id/reactions/support`) and fixed paths (`/topics`) are declared before
 *    the wildcard `/posts/:id` parameter route.
 */

import { Router } from 'express';
import { authenticate, requireActive } from '../middleware/auth.js';
import {
  listTopicsHandler,
  createPostHandler,
  getFeedHandler,
  getPostByIdHandler,
  deletePostHandler,
  createCommentHandler,
  getCommentsHandler,
  deleteCommentHandler,
  addSupportReactionHandler,
  removeSupportReactionHandler,
} from '../controllers/community.controller.js';

const router = Router();

// All community endpoints require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// 1. Topics (Discussion Spaces)
// ---------------------------------------------------------------------------
router.get('/topics', listTopicsHandler);

// ---------------------------------------------------------------------------
// 2. Direct Comment Operations
// ---------------------------------------------------------------------------
router.delete('/comments/:id', requireActive, deleteCommentHandler);

// ---------------------------------------------------------------------------
// 3. Posts & Sub-resources
// ---------------------------------------------------------------------------
// Feed & Post Creation
router.get('/posts', getFeedHandler);
router.post('/posts', requireActive, createPostHandler);

// Post Comments
router.get('/posts/:id/comments', getCommentsHandler);
router.post('/posts/:id/comments', requireActive, createCommentHandler);

// Post Support Reactions
router.put('/posts/:id/reactions/support', requireActive, addSupportReactionHandler);
router.delete('/posts/:id/reactions/support', requireActive, removeSupportReactionHandler);

// Single Post Read & Soft Delete
router.get('/posts/:id', getPostByIdHandler);
router.delete('/posts/:id', requireActive, deletePostHandler);

export default router;
