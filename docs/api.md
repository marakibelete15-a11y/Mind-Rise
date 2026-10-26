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

```json
{
  "data": { ... },
  "meta": {
    "timestamp": "2026-10-26T12:00:00.000Z"
  }
}
```

### Error Response

All server errors strictly adhere to the unified error contract:

```json
{
  "error": {
    "code": "VALIDATION_ERROR | INVALID_TOKEN | FORBIDDEN | NOT_FOUND | INTERNAL_ERROR",
    "message": "Human-readable description of error.",
    "details": [
      {
        "field": "fieldName",
        "message": "Specific field error"
      }
    ]
  }
}
```

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

## API Routes Roadmap (MVP)

| Method | Endpoint                    | Description                           | Protected    |
| :----- | :-------------------------- | :------------------------------------ | :----------- |
| `GET`  | `/health`                   | Server health and operational status  | No           |
| `POST` | `/api/auth/register`        | Register new user + verified identity | No           |
| `POST` | `/api/auth/verify-otp`      | Verify SMS/email OTP code             | No           |
| `POST` | `/api/auth/login`           | Authenticate user & issue JWT         | No           |
| `GET`  | `/api/users/me`             | Fetch authenticated user's profile    | Yes (Bearer) |
| `POST` | `/api/assessments`          | Submit self-assessment responses      | Yes (Bearer) |
| `GET`  | `/api/routines`             | List user's active daily habits       | Yes (Bearer) |
| `POST` | `/api/routines/:id/checkin` | Check in daily routine completion     | Yes (Bearer) |
| `GET`  | `/api/community/posts`      | Paginated anonymous community posts   | Yes (Bearer) |
| `POST` | `/api/community/posts`      | Create anonymous community post       | Yes (Bearer) |
| `GET`  | `/api/crisis/resources`     | List local Ethiopian crisis hotlines  | No           |
