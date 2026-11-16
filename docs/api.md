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
