import { Router } from 'express';
import { authenticate, requireActive } from '../middleware/auth.js';
import {
  getStarterRoutines,
  getTodayRoutines,
  createRoutine,
  listRoutines,
  checkInRoutine,
  getRoutineById,
  updateRoutine,
  deleteRoutine,
} from '../controllers/routines.controller.js';

const router = Router();

/**
 * Routines Module Routing
 *
 * WHY:
 * 1. GET /starter and GET /today MUST be declared BEFORE GET /:id so Express
 *    does not swallow the static paths "starter" or "today" as dynamic :id parameters.
 * 2. authenticate middleware verifies identity and sets req.user.
 * 3. requireActive middleware ensures only accounts in ACTIVE status can perform
 *    state-modifying writes (POST, PATCH, DELETE, checkin). Restricted or suspended
 *    accounts are blocked with 403 ACCOUNT_RESTRICTED, though they retain read access.
 */

// Static subroutes (must precede dynamic /:id parameter)
router.get('/starter', authenticate, getStarterRoutines);
router.get('/today', authenticate, getTodayRoutines);

// Routines collection: Create (active accounts only) and List (authenticated)
router.post('/', authenticate, requireActive, createRoutine);
router.get('/', authenticate, listRoutines);

// Habit check-in (active accounts only)
router.post('/:id/checkin', authenticate, requireActive, checkInRoutine);

// Routine resource by ID: Read, Update, and Soft Delete
router.get('/:id', authenticate, getRoutineById);
router.patch('/:id', authenticate, requireActive, updateRoutine);
router.delete('/:id', authenticate, requireActive, deleteRoutine);

export default router;
