import { Router } from 'express';
import { authenticate, requireActive } from '../middleware/auth.js';
import {
  getStarterRoutines,
  createRoutine,
  listRoutines,
  getRoutineById,
  updateRoutine,
  deleteRoutine,
} from '../controllers/routines.controller.js';

const router = Router();

/**
 * Routines Module Routing
 *
 * WHY:
 * 1. GET /starter is registered before GET /:id to prevent Express from matching
 *    the string literal "starter" as a dynamic :id parameter.
 * 2. authenticate middleware verifies identity and sets req.user.
 * 3. requireActive middleware ensures only accounts in ACTIVE status can perform
 *    state-modifying writes (POST, PATCH, DELETE). Restricted, suspended, or banned
 *    accounts are blocked with 403 ACCOUNT_RESTRICTED, though they retain read access.
 */

// Starter routines (publicly curated catalog, authenticated)
router.get('/starter', authenticate, getStarterRoutines);

// Routines collection: Create (active accounts only) and List (authenticated)
router.post('/', authenticate, requireActive, createRoutine);
router.get('/', authenticate, listRoutines);

// Routine resource by ID: Read, Update, and Soft Delete
router.get('/:id', authenticate, getRoutineById);
router.patch('/:id', authenticate, requireActive, updateRoutine);
router.delete('/:id', authenticate, requireActive, deleteRoutine);

export default router;
