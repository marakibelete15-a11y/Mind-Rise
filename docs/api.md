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

### Routines (SRS 2.3)
- `GET /routines` — planned: list own routines.
- `POST /routines` — planned: create a routine.
- `POST /routines/:id/checkin` — planned: record daily completion.

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
