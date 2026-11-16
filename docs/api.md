# MindRise API Contract & Notes

## Base Configuration

- **Base URL**: `/api`
- **Health Check Endpoint**: `GET /health` (root level)
- **Data Exchange**: JSON (`application/json`)
- **Authentication**: `Authorization: Bearer <JWT>`
- **Character Encoding**: UTF-8 (fully supporting Ethiopic Unicode characters)

---

## Standard Response Schemas

### Success Response

All successful API responses use exactly `{ "data": ... }`.

### Error Response

Errors use `{ "error": { "code", "message", "details? } }`. Validation errors use HTTP 400 and `VALIDATION_ERROR`; restricted accounts use HTTP 403 and `ACCOUNT_RESTRICTED`.

### Shared request conventions

- Protected endpoints use `Authorization: Bearer <JWT>`; JWT claims never contain personal identity fields.
- In `development` only, `x-dev-user-id: <user UUID>` selects a database user. This header is disabled in tests and production.
- Roles are `USER`, `MODERATOR`, and `ADMIN`; statuses are `ACTIVE`, `RESTRICTED`, `SUSPENDED`, and `BANNED`.
- `?cursor=<id>&limit=<n>` paginates collections; limit defaults to 20 and is capped at 50. Collection responses include `{ "data": { "items": [], "nextCursor": null } }`.
- `?lang=en|am` selects response language, then the user's preferred language is used, then Amharic (`AM`).

---

---

## Health Check Endpoint (Phase One Skeleton)

### `GET /health`

Returns system status, environment, uptime, and current ISO timestamp.

- **Status Code**: `200 OK`
- **Response**:

```json
{
  "status": "ok",
  "service": "mindrise-server",
  "version": "0.1.0",
  "timestamp": "2026-10-26T12:00:00.000Z",
  "uptime": 12.34
}
```

---

## Planned module endpoints (SRS v1.3)

All endpoints below are planned and are mounted under `/api`.

### Auth (FR-1.1–1.5)
- `POST /auth/register` — planned: create account and private verified identity.
- `POST /auth/verify-otp` — planned: verify phone/email OTP.
- `POST /auth/login` — planned: authenticate and issue JWT.

### Users (FR-1.3, SRS 5.4)
- `GET /users/me` — planned: fetch own pseudonymous profile.
- `DELETE /users/me` — planned: request account deletion.

### Assessments (SRS 2.2)
- `GET /assessments/templates` — planned: list bilingual questionnaires.
- `POST /assessments` — planned: submit encrypted assessment answers and receive non-diagnostic feedback.
- `GET /assessments/:id` — planned: view own assessment result.

### Routines (SRS 2.3) — Phase B1 Implemented

#### `GET /api/routines/starter`
- **Description**: Returns curated starter habits localized to the requested language.
- **Authentication**: `Authorization: Bearer <JWT>`
- **Query Parameters**:
  - `lang` *(optional)*: `'en'` or `'am'`. Falls back to user's `preferredLanguage`, then `'en'`.
- **Status Code**: `200 OK`
- **Response**:
```json
{
  "data": [
    {
      "id": "d46da31f-4c5c-4b13-8c01-6cad6d26eaa8",
      "title": "Mindful Morning Walk",
      "description": "Spend 10 minutes walking mindfully without screens.",
      "category": "PHYSICAL_WELLBEING",
      "createdAt": "2026-10-26T12:00:00.000Z",
      "updatedAt": "2026-10-26T12:00:00.000Z"
    }
  ]
}
```
- **Error Codes**: `401 INVALID_TOKEN`.

#### `POST /api/routines`
- **Description**: Creates a new daily routine for the authenticated active user.
- **Authentication**: `Authorization: Bearer <JWT>` (requires `ACTIVE` account)
- **Request Body**:
```json
{
  "title": "Evening Gratitude Reflection",
  "description": "Write down 3 things I am grateful for."
}
```
- **Constraints**:
  - `title`: Trimmed, 1–100 characters. Must contain at least one letter or digit (supporting English and Ethiopic Unicode `\p{L}|\p{N}`). Rejects empty or symbol-only strings.
  - `description` *(optional)*: Max 500 characters.
  - Maximum 20 active (non-deleted) routines per user.
  - Strict validation: unknown body fields are rejected.
- **Status Code**: `201 Created`
- **Response**:
```json
{
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "userId": "00000000-0000-4000-a000-000000000011",
    "title": "Evening Gratitude Reflection",
    "description": "Write down 3 things I am grateful for.",
    "status": "ACTIVE",
    "deletedAt": null,
    "createdAt": "2026-11-16T12:00:00.000Z",
    "updatedAt": "2026-11-16T12:00:00.000Z"
  }
}
```
- **Error Codes**: `400 VALIDATION_ERROR`, `400 ROUTINE_LIMIT_REACHED`, `401 INVALID_TOKEN`, `403 ACCOUNT_RESTRICTED`.

#### `GET /api/routines`
- **Description**: Lists active (non-deleted) routines belonging to the authenticated caller, ordered newest first.
- **Authentication**: `Authorization: Bearer <JWT>`
- **Query Parameters**:
  - `cursor` *(optional)*: Routine UUID from previous page `nextCursor`.
  - `limit` *(optional)*: Items per page (default: 20, max: 50).
- **Status Code**: `200 OK`
- **Response**:
```json
{
  "data": {
    "items": [
      {
        "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "userId": "00000000-0000-4000-a000-000000000011",
        "title": "Evening Gratitude Reflection",
        "description": "Write down 3 things I am grateful for.",
        "status": "ACTIVE",
        "deletedAt": null,
        "createdAt": "2026-11-16T12:00:00.000Z",
        "updatedAt": "2026-11-16T12:00:00.000Z"
      }
    ],
    "nextCursor": null
  }
}
```
- **Error Codes**: `400 VALIDATION_ERROR`, `401 INVALID_TOKEN`.

#### `GET /api/routines/:id`
- **Description**: Retrieves a single routine owned by the caller.
- **Authentication**: `Authorization: Bearer <JWT>`
- **Path Parameters**: `:id` (UUID)
- **Status Code**: `200 OK`
- **Response**:
```json
{
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "userId": "00000000-0000-4000-a000-000000000011",
    "title": "Evening Gratitude Reflection",
    "description": "Write down 3 things I am grateful for.",
    "status": "ACTIVE",
    "deletedAt": null,
    "createdAt": "2026-11-16T12:00:00.000Z",
    "updatedAt": "2026-11-16T12:00:00.000Z"
  }
}
```
- **Error Codes**: `400 VALIDATION_ERROR`, `401 INVALID_TOKEN`, `404 ROUTINE_NOT_FOUND`.

#### `PATCH /api/routines/:id`
- **Description**: Updates an existing routine's title and/or status (`ACTIVE` | `PAUSED`).
- **Authentication**: `Authorization: Bearer <JWT>` (requires `ACTIVE` account)
- **Path Parameters**: `:id` (UUID)
- **Request Body**:
```json
{
  "title": "Updated Routine Title",
  "status": "PAUSED"
}
```
- **Status Code**: `200 OK`
- **Response**: `{ "data": { ...updatedRoutine } }`
- **Error Codes**: `400 VALIDATION_ERROR`, `401 INVALID_TOKEN`, `403 ACCOUNT_RESTRICTED`, `404 ROUTINE_NOT_FOUND`.

#### `GET /api/routines/today`
- **Description**: Returns all active, non-deleted routines for the caller, annotated with `completedToday: boolean` indicating whether a check-in has been recorded for today in the `Africa/Addis_Ababa` timezone.
- **Authentication**: `Authorization: Bearer <JWT>`
- **Status Code**: `200 OK`
- **Response**:
```json
{
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "userId": "00000000-0000-4000-a000-000000000011",
      "title": "Morning Mindful Walk",
      "description": "15 minutes without phone",
      "status": "ACTIVE",
      "deletedAt": null,
      "createdAt": "2026-11-16T12:00:00.000Z",
      "updatedAt": "2026-11-16T12:00:00.000Z",
      "completedToday": true
    }
  ]
}
```
- **Error Codes**: `401 INVALID_TOKEN`.

#### `POST /api/routines/:id/checkin`
- **Description**: Records a daily completion for a routine. Automatically awards points (10), increments streaks, and unlocks milestone badges in a single atomic transaction.
- **Authentication**: `Authorization: Bearer <JWT>` (requires `ACTIVE` account)
- **Path Parameters**: `:id` (UUID)
- **Status Code**: `200 OK`
- **Response (First Check-in Today)**:
```json
{
  "data": {
    "completion": {
      "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "routineId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "completedDate": "2026-11-16T00:00:00.000Z",
      "createdAt": "2026-11-16T12:30:00.000Z"
    },
    "alreadyCompleted": false,
    "pointsAwarded": 10,
    "progress": {
      "points": 10,
      "currentStreak": 1,
      "longestStreak": 1,
      "lastCompletedDate": "2026-11-16"
    },
    "newBadges": [
      {
        "id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
        "slug": "first-routine",
        "name": "First Step",
        "description": "Completed your very first daily routine.",
        "pointsRequired": 10,
        "iconUrl": null
      }
    ]
  }
}
```
- **Response (Subsequent Check-in Same Routine Same Day - Idempotent)**:
```json
{
  "data": {
    "completion": { ... },
    "alreadyCompleted": true,
    "pointsAwarded": 0,
    "progress": {
      "points": 10,
      "currentStreak": 1,
      "longestStreak": 1,
      "lastCompletedDate": "2026-11-16"
    },
    "newBadges": []
  }
}
```
- **Error Codes**: `400 VALIDATION_ERROR`, `400 ROUTINE_NOT_ACTIVE` (routine is paused), `401 INVALID_TOKEN`, `403 ACCOUNT_RESTRICTED`, `404 ROUTINE_NOT_FOUND` (not found, soft-deleted, or belongs to another user).

#### `DELETE /api/routines/:id`
- **Description**: Soft deletes a routine by setting `deletedAt` to current timestamp.
- **Authentication**: `Authorization: Bearer <JWT>` (requires `ACTIVE` account)
- **Path Parameters**: `:id` (UUID)
- **Status Code**: `200 OK`
- **Response**:
```json
{
  "data": {
    "message": "Routine deleted successfully",
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }
}
```
- **Error Codes**: `400 VALIDATION_ERROR`, `401 INVALID_TOKEN`, `403 ACCOUNT_RESTRICTED`, `404 ROUTINE_NOT_FOUND`.

---

### Progress & Gamification (SRS 2.3) — Phase B2 Implemented

#### `GET /api/progress`
- **Description**: Retrieves the caller's cumulative points, effective current streak, longest streak, last completed date, and earned badges list.
- **Authentication**: `Authorization: Bearer <JWT>`
- **Query Parameters**:
  - `lang` *(optional)*: `'en'` or `'am'` to localize earned badge descriptions.
- **Status Code**: `200 OK`
- **Response**:
```json
{
  "data": {
    "points": 150,
    "currentStreak": 7,
    "longestStreak": 12,
    "lastCompletedDate": "2026-11-16",
    "earnedBadges": [
      {
        "id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
        "slug": "first-routine",
        "name": "First Step",
        "description": "Completed your very first daily routine.",
        "pointsRequired": 10,
        "iconUrl": null,
        "awardedAt": "2026-11-10T08:00:00.000Z"
      }
    ]
  }
}
```
- **Error Codes**: `401 INVALID_TOKEN`.

#### `GET /api/badges`
- **Description**: Lists all available system badges localized to the requested language, annotated with an `earned: boolean` flag and `awardedAt` timestamp.
- **Authentication**: `Authorization: Bearer <JWT>`
- **Query Parameters**:
  - `lang` *(optional)*: `'en'` or `'am'`.
- **Status Code**: `200 OK`
- **Response**:
```json
{
  "data": [
    {
      "id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
      "slug": "first-routine",
      "name": "First Step",
      "description": "Completed your very first daily routine.",
      "pointsRequired": 10,
      "iconUrl": null,
      "earned": true,
      "awardedAt": "2026-11-10T08:00:00.000Z"
    },
    {
      "id": "e5f6a7b8-9012-cdef-1234-567890123456",
      "slug": "growth-master",
      "name": "Master of Growth",
      "description": "Achieved 300 wellness points through persistent habit practice.",
      "pointsRequired": 300,
      "iconUrl": null,
      "earned": false,
      "awardedAt": null
    }
  ]
}
```
- **Error Codes**: `401 INVALID_TOKEN`.

---

## Part B: Routines Design & Architecture

### 1. Layered Architecture Pattern
The Routines module follows the strict layered pattern:
```
HTTP Request -> routes -> controller -> service -> Prisma (PostgreSQL)
```
- **Routes (`routines.routes.ts`)**: Defines endpoint paths and attaches auth/active middleware guards.
- **Validators (`routines.validators.ts`)**: Enforces input constraints with Zod (`.strict()` disallows extra fields, Unicode regex validates Ethiopic & Latin scripts).
- **Controller (`routines.controller.ts`)**: Extracts parameters, invokes schemas, and formats responses with `{ "data": ... }`.
- **Service (`routines.service.ts`)**: Enforces business logic (quota limits, ownership validation, soft-deletion).

### 2. IDOR Prevention & 404 Policy
To prevent Insecure Direct Object Reference (IDOR) attacks, requests attempting to access or modify a routine belonging to another user (or a routine that was soft-deleted) return **HTTP 404 `ROUTINE_NOT_FOUND`** instead of HTTP 403 Forbidden. This ensures an attacker cannot enumerate routine UUIDs to discover which IDs exist.

### 3. Soft Delete Rationale
Routines use a `deletedAt: DateTime?` column. When a user deletes a routine:
- It is hidden from all subsequent active queries (`GET /routines` and `GET /routines/:id`).
- Its historical completion logs (`RoutineCompletion`) remain preserved in the database so past streak calculations and longitudinal wellness metrics in Phase B2 remain accurate.

### 4. Quota Enforcement
Users may have at most **20 non-deleted routines** concurrently. Exceeding this limit returns HTTP 400 with error code `ROUTINE_LIMIT_REACHED`. This prevents user cognitive overload and shields database resources.

### 5. Bilingual Localization Resolution
Localization follows a clean three-tier priority cascade:
1. Explicit request query parameter `?lang=en|am` (highest priority; allows instant preview toggling).
2. Authenticated user's `preferredLanguage` setting.
3. Fallback default to English (`en`).

### 6. How Points, Streaks, and Gamification Work (Phase B2)
- **Timezone Anchor (`Africa/Addis_Ababa`)**:
  Ethiopia operates in East Africa Time (EAT), which is UTC+3 with no Daylight Saving Time. Day boundaries and streak continuity are calculated against the Ethiopian local calendar day. For example, 20:59:59 UTC is 23:59:59 EAT (same day), while 21:00:00 UTC is 00:00:00 EAT (start of the next calendar day).
- **Points Award & Idempotency**:
  - Each unique routine completion awards **10 points** (`POINTS_PER_COMPLETION`).
  - Checking in to the same routine more than once on the same Addis calendar day is strictly idempotent: the API returns `alreadyCompleted: true` with `pointsAwarded: 0`, and no streak increment.
  - Completing different routines on the same day awards points for each routine (e.g. 10 + 10 = 20 points), but the daily streak only increments once per calendar day.
- **Streak Calculation Logic**:
  - **Same calendar day** as `lastCompletedDate`: streak remains unchanged.
  - **Consecutive calendar day** (completed yesterday): `currentStreak` increments by 1.
  - **Missed day(s)** (gap > 1 day or first time): `currentStreak` resets to 1.
  - `longestStreak` is monotonically maintained as `max(longestStreak, currentStreak)` and is preserved even when `currentStreak` resets.
- **Effective Streak on Read**:
  If a user has not checked in today or yesterday (`lastCompletedDate` is older than yesterday in Addis Ababa), their streak is broken. The `GET /api/progress` endpoint reports `currentStreak: 0` on the fly without requiring a midnight database write cron job.
- **Automatic Badge Unlocking**:
  Milestone badges are earned based on cumulative points thresholds (`pointsRequired`). During check-in, unearned badges whose thresholds have been reached are automatically and atomically granted in the database transaction.
- **Design Decision — No Completion Undo**:
  Completion records (`RoutineCompletion`) cannot be undone or revoked in this phase. This preserves mathematical monotonicity for points, prevents negative point reconciliation anomalies, and keeps streak histories tamper-resistant.



### Community (SRS 2.4)
- `GET /community/topics` — planned: list discussion spaces.
- `GET /community/posts` — planned: list paginated anonymous posts.
- `POST /community/posts` — planned: create an anonymous post.
- `POST /community/posts/:id/comments` — planned: comment on a post.

### Reports (SRS 2.5)
- `POST /reports` — planned: report content or an account.

### Crisis (SRS 2.5)
- `GET /crisis/resources` — planned: list verified local crisis hotlines.

### Moderation (SRS 2.5)
- `GET /moderation/reports` — planned: view moderation queue.
- `POST /moderation/actions` — planned: record a moderation action.
