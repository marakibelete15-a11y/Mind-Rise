# MindRise System Architecture

## Architecture Overview

MindRise is architected as a mobile-first Progressive Web App (PWA) backed by a decoupled Node.js Express REST API, PostgreSQL database managed via Prisma ORM, and Supabase Storage for static media assets.

```
+-------------------------------------------------------------+
|                     Client Application                      |
|          (React + Vite + TypeScript + Tailwind CSS)         |
|               PWA / Service Worker / i18n                   |
+-------------------------------------------------------------+
                              |
                              | HTTPS / JSON (REST API)
                              v
+-------------------------------------------------------------+
|                   Backend Server (Express)                  |
|     Routes -> Middleware (Auth/Error) -> Controllers        |
|               Services -> Cryptography Engine               |
+-------------------------------------------------------------+
            |                                    |
            | SQL Queries                        | Media Uploads
            v                                    v
+-----------------------+              +----------------------+
|  PostgreSQL Database  |              |   Supabase Storage   |
|     (Prisma ORM)      |              |   (User Avatars)     |
+-----------------------+              +----------------------+
```

---

## Privacy by Design: The Two-Layer Identity Architecture

The core privacy innovation of MindRise is the absolute separation between Verified Identity records (used only for anti-fraud and recovery) and Public Anonymous Profiles (used for peer community interactions).

```
                      +-------------------+
                      |   User Account    |
                      |   (UUID, Role)    |
                      +-------------------+
                               / \
            1-to-1 Private   /     \   1-to-1 Public
                           /         \
                          v           v
+-------------------------------+  +-------------------------------+
|       VerifiedIdentity        |  |            Profile            |
|-------------------------------|  |-------------------------------|
| - encryptedRealName           |  | - handle (e.g. "Abyssinia")   |
| - encryptedPhone / phoneHash  |  | - avatarUrl (Supabase)        |
| - encryptedEmail / emailHash  |  | - bio                         |
| - isPhoneVerified             |  | - points & streak count       |
+-------------------------------+  +-------------------------------+
               |                                   |
    RESTRICTED & AUDITED                 PUBLIC COMMUNITY FEEDS
   - Admin anti-sybil checks            - Peer discussion threads
   - Account recovery                   - Routine leaderboards
   - Safety escalation                  - Community posts & comments
   * NEVER visible to peers             * Visible to all peers
```

### Key Security & Privacy Safeguards:

1. **No Accidental Leaks**: The `VerifiedIdentity` model is never queried or included in public profile queries or community serializer responses.
2. **Encrypted at Rest**: Real names, contact details, and sensitive clinical self-assessment answers are encrypted using AES-256-GCM authenticated encryption.
3. **Audit Logging**: Any administrative access to the `VerifiedIdentity` table must be logged with timestamp, administrator ID, and justification.
4. **Moderator Isolation**: Community moderators reviewing flagged posts or comments have zero access to the author's real identity.
