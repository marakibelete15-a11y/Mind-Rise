# MindRise (ማይንድራይዝ)

> **A mobile-first Progressive Web App (PWA) for mental health, daily routines, and anonymous peer support tailored for Ethiopian youth.**

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Workspaces: npm](https://img.shields.io/badge/npm-workspaces-blue.svg)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](tsconfig.base.json)
[![React](https://img.shields.io/badge/React-18-cyan.svg)](client/)
[![Node/Express](https://img.shields.io/badge/Express-4.21-green.svg)](server/)
[![Database: Prisma & PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20%7C%20Prisma-indigo.svg)](database/)

---

## 1. Project Description

**MindRise** is designed to address the significant mental health treatment and support gap faced by Ethiopian youth—particularly university students, recent graduates, and unemployed young adults navigating high socioeconomic stress.

In Ethiopia, traditional stigma surrounding mental health frequently deters youth from seeking help openly or discussing their psychological distress. MindRise bridges this gap by offering a private, culturally resonant, and low-bandwidth digital haven. The platform enables users to:

1. Conduct self-administered, non-diagnostic mental health assessments.
2. Build grounding daily routines through habit tracking, streaks, and positive gamification.
3. Engage with an empathetic, moderated peer-support community without revealing their real names.
4. Seamlessly switch between English and Amharic with localized idioms and cultural sensitivity.
5. Immediately access crisis intervention resources (such as Ethiopian helplines **8335** and **952**) during acute emotional distress.

---

## 2. Fixed Tech Stack

MindRise is built entirely on free and open-source tooling, structured as a clean monorepo:

| Layer                   | Technologies                          | Details                                                                                              |
| :---------------------- | :------------------------------------ | :--------------------------------------------------------------------------------------------------- |
| **Frontend**            | React, Vite, TypeScript, Tailwind CSS | Mobile-first Progressive Web App (PWA) installable to phone home screens without app-store barriers. |
| **Backend**             | Node.js, Express, TypeScript          | Modular REST API with centralized error handling, JWT auth, and `/health` monitoring.                |
| **Database**            | PostgreSQL via Prisma ORM             | Relational data persistence with strict schema separation between identity and activity.             |
| **File Storage**        | Supabase Storage                      | Secure cloud storage bucket for public user avatars and community assets.                            |
| **Localization (i18n)** | Custom bilingual framework            | Native support for English (`en`) and Amharic (`am`).                                                |
| **Monorepo Tooling**    | npm workspaces                        | Unified dependency management linking `client/` and `server/`.                                       |

---

## 3. Privacy by Design: The Two-Layer Identity Architecture

The defining structural innovation of MindRise is its **Two-Layer Identity Architecture**, designed to dismantle the fear of social exposure and stigma while mitigating online abuse.

```
+-------------------------------------------------------------------------+
|                              USER ACCOUNT                               |
|                         (UUID, Status, Roles)                           |
+-------------------------------------------------------------------------+
                    |                                 |
     [Layer 1: Private & Restricted]    [Layer 2: Public & Anonymous]
                    |                                 |
                    v                                 v
+---------------------------------------+  +------------------------------+
|           VerifiedIdentity            |  |           Profile            |
|---------------------------------------|  |------------------------------|
| • Encrypted Real Name (AES-256-GCM)   |  | • Anonymous Handle           |
| • Encrypted Phone / Phone Hash        |  | • Avatar URL (Supabase)      |
| • Encrypted Email / Email Hash        |  | • Bio & Preferences          |
| • Verification Status (OTP)           |  | • Points & Habit Streaks     |
|---------------------------------------|  |------------------------------|
| RESTRICTED: Anti-sybil & Account Rec. |  | PUBLIC: Community Feeds      |
| NEVER visible to peers or moderators! |  | Visible to peer members!     |
+---------------------------------------+  +------------------------------+
```

### Core Privacy Principles:

1. **Verification Without Social Exposure**:
   - At signup, users register with their real name and a verified phone number or email. This prevents duplicate accounts, ban evasion, and coordinated trolling.
   - However, the real name and contact credentials are stored exclusively in the `VerifiedIdentity` table.
2. **Pseudonymous Community Participation**:
   - Users choose an **Anonymous Handle** (e.g., `AbyssiniaSeeker`, `SelamVibes`) and an illustrated avatar.
   - **Only this Anonymous Handle and avatar are ever exposed** on community discussion feeds, routine check-ins, or leaderboards.
3. **Database Segregation & Field-Level Encryption**:
   - `VerifiedIdentity` records and self-assessment survey responses are encrypted at rest using AES-256-GCM.
   - Public API serializers and database queries are forbidden from joining or returning `VerifiedIdentity` fields.
4. **Moderator Isolation**:
   - Community moderators reviewing flagged content have zero access to users' verified identities, ensuring complete privacy during peer discussions.

---

## 4. Phase One (MVP) Scope vs Out of Scope

Derived directly from the **MindRise Software Requirements Specification (SRS v1.3)**:

### Phase One (MVP) Scope

- [x] **Verified-but-Private Onboarding (FR-1.1 – FR-1.5)**: Phone/email OTP verification with mandatory anonymous handle and avatar selection.
- [x] **Self-Assessment Module (FR-2.1 – FR-2.5)**: Standardized, confidential self-report checkups for stress, anxiety, burnout, and emotional fatigue with instant non-diagnostic feedback.
- [x] **Daily Routines & Gamified Growth (FR-3.1 – FR-3.4)**: Daily habit tracking (morning reflection, study block, mindful walk) with streaks and reward points.
- [x] **Anonymous Peer Support Community (FR-4.1 – FR-4.5)**: Identity-shielded discussion forums categorized by topics (e.g., University Pressure, Career Transition, Small Wins).
- [x] **Safety & Moderation (FR-6.1 – FR-7.5)**: Content reporting queues and an instant **Crisis Referral Pathway** prominently featuring Ethiopian emergency hotlines (**8335** Amanuel Mental Specialized Hospital and **952** National Emergency Medical Helpline).
- [x] **Bilingual Localization (FR-5.1 – FR-5.2)**: Native Amharic (`am`) and English (`en`) interface toggling.

### Out of Scope (Future Roadmap)

- ❌ **Licensed Teletherapy Booking & Payment**: Scheduling paid clinical consultations or telehealth appointments.
- ❌ **Real-Time Video/Audio Calling**: Live streaming or video calling with practitioners or peers.
- ❌ **Payment Gateway Integration**: Telebirr, CBE Birr, or Chapa payment processing.
- ❌ **Electronic Health Records (EHR)**: Clinical hospital medical records integration.
- ❌ **AI Diagnostic Chatbots**: Medical diagnosis or autonomous therapeutic counseling.
- ❌ **USSD / Offline SMS Interface**: Feature-phone standalone USSD menus.

---

## 5. Folder Structure

```
mindrise/
├── client/                     # React + Vite + TypeScript PWA Frontend
│   ├── src/
│   │   ├── assets/             # Static graphics, SVGs, and brand assets
│   │   ├── components/         # Reusable UI components
│   │   ├── hooks/              # Custom React hooks
│   │   ├── i18n/               # Internationalization
│   │   │   ├── am/             # Amharic translations (translation.json)
│   │   │   ├── en/             # English translations (translation.json)
│   │   │   └── index.ts        # i18n helper & language types
│   │   ├── pages/              # View pages (HomePage.tsx)
│   │   ├── services/           # API clients and HTTP services
│   │   ├── utils/              # Client-side utility functions
│   │   ├── App.tsx             # Root application component
│   │   ├── index.css           # Tailwind CSS directives & typography
│   │   ├── main.tsx            # React DOM mounting entry point
│   │   └── vite-env.d.ts       # Vite & PWA type declarations
│   ├── index.html              # Mobile-first HTML5 template with PWA meta
│   ├── package.json            # Client dependencies and build scripts
│   ├── postcss.config.js       # PostCSS configuration
│   ├── tailwind.config.js      # Tailwind CSS design system theme
│   ├── tsconfig.json           # Frontend TypeScript compiler options
│   ├── tsconfig.node.json      # Node-specific TS config for Vite
│   └── vite.config.ts          # Vite build & PWA plugin configuration
├── server/                     # Node.js + Express + TypeScript REST API
│   ├── src/
│   │   ├── config/             # Environment variable validation & config
│   │   ├── controllers/        # Request controllers (health.controller.ts)
│   │   ├── middleware/         # Auth & error handling middlewares
│   │   ├── routes/             # Express routes (health.routes.ts, index.ts)
│   │   ├── services/           # Business logic layer
│   │   ├── utils/              # Cryptography and helper utilities
│   │   ├── validators/         # Request schema validation (Zod)
│   │   ├── app.ts              # Express application factory
│   │   └── index.ts            # Server bootstrap & listener
│   ├── tests/                  # Automated tests (health.test.ts)
│   ├── .env.example            # Backend-specific environment template
│   ├── package.json            # Server dependencies and test scripts
│   └── tsconfig.json           # Backend TypeScript compiler configuration
├── database/                   # Database persistence layer
│   └── prisma/
│       ├── schema.prisma       # Prisma schema (PostgreSQL & two-layer identity)
│       ├── migrations/         # Database migration history (.gitkeep)
│       └── seed/               # Database seeder (crisis hotlines & routines)
│           └── seed.ts
├── docs/                       # Project specifications & architecture
│   ├── api.md                  # REST API contract and status codes
│   ├── architecture.md         # Two-layer identity architecture & data flows
│   └── srs.md                  # Software Requirements Specification summary
├── scripts/
│   └── setup.sh                # Automated developer onboarding script
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md       # Standardized bug reporting form
│   │   └── feature_request.md  # Culturally sensitive feature request template
│   ├── workflows/
│   │   └── ci.yml              # GitHub Actions CI matrix (Lint, Typecheck, Test)
│   └── pull_request_template.md# Pull request checklist & privacy verification
├── .editorconfig               # Cross-editor formatting consistency
├── .env.example                # Root environment template (zero secrets)
├── .gitignore                  # Git ignore rules (node_modules, envs, OS artifacts)
├── .prettierrc                 # Code formatting standards
├── .prettierignore             # Prettier exclusion rules
├── tsconfig.base.json          # Shared monorepo TypeScript compiler base
├── package.json                # Root package.json defining npm workspaces
├── CONTRIBUTING.md             # Conventional Commits, branch naming, PR rules
├── SECURITY.md                 # Vulnerability reporting & identity privacy mandate
├── LICENSE                     # MIT Open Source License
└── README.md                   # Project documentation
```

---

## 6. Setup and Installation

### Prerequisites

- **Node.js**: v20.x or higher (Node v24 recommended)
- **npm**: v10.x or higher
- **PostgreSQL**: v14+ (Local native installation, no Docker required)

### Local PostgreSQL Setup (Fedora/Ubuntu/macOS)

MindRise uses a direct local PostgreSQL installation for development. No Docker containers are needed.

#### 1. Install PostgreSQL & Create Database

**Fedora / RHEL:**

```bash
sudo dnf install -y postgresql-server postgresql-contrib
sudo postgresql-setup --initdb
sudo systemctl enable --now postgresql
sudo -u postgres createuser -s $(whoami)
createdb mindrise_dev
```

**Ubuntu / Debian:**

```bash
sudo apt update && sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
sudo -u postgres createuser -s $(whoami)
createdb mindrise_dev
```

**macOS (Homebrew):**

```bash
brew install postgresql@16
brew services start postgresql@16
createuser -s $(whoami)
createdb mindrise_dev
```

#### 2. Set Up Environment & DATABASE_URL

Set your local connection string in `.env` pointing to `127.0.0.1`:

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/mindrise_dev?schema=public
# Or with your local OS user account:
# DATABASE_URL=postgresql://maraki:password@127.0.0.1:5432/mindrise_dev?schema=public
```

#### 3. Run Migrations & Seed Data

```bash
npm run db:deploy
npm run db:seed
```

### Step-by-Step Installation

1. **Clone the repository**:

   ```bash
   git clone <repository-url>
   cd MindRiseNew
   ```

2. **Run the automated setup doctor**:

   ```bash
   npm run setup
   ```

   _Alternatively, configure manually:_

   ```bash
   # Copy environment templates
   cp .env.example .env
   cp server/.env.example server/.env

   # Install dependencies for both client and server via npm workspaces
   npm install
   ```

3. **Verify the server `/health` endpoint**:
   ```bash
   npm run test:server
   ```

---

## 7. Available Scripts

All scripts can be executed from the root directory using npm workspaces:

| Command                | Action                                                                |
| :--------------------- | :-------------------------------------------------------------------- |
| `npm run dev`          | Runs **both** Client and Server concurrently                          |
| `npm run dev:client`   | Launches Vite dev server at `http://localhost:5173`                   |
| `npm run dev:server`   | Launches Express server with hot-reloading at `http://localhost:5000` |
| `npm run build`        | Builds both Client (`vite build`) and Server (`tsc`)                  |
| `npm run test`         | Runs test suites across all workspaces                                |
| `npm run test:server`  | Runs the server health check integration test                         |
| `npm run typecheck`    | Validates TypeScript types across both workspaces                     |
| `npm run lint`         | Runs linter across client and server workspaces                       |
| `npm run format`       | Auto-formats code with Prettier                                       |
| `npm run format:check` | Checks code formatting without modifying files                        |
| `npm run setup`        | Runs the initial environment verification and installation script     |

---

## 8. License

This project is licensed under the [MIT License](LICENSE).
