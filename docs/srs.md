# MindRise Software Requirements Specification (SRS) - MVP Summary

**Document Version**: 1.3 (Draft for Review)  
**Target Platform**: Mobile-first Progressive Web App (PWA)  
**Target Audience**: Ethiopian youth (university students, recent graduates, and unemployed young adults)  
**Supported Languages**: English (`en`) and Amharic (`am`)

---

## 1. Executive Summary & Purpose

MindRise provides young Ethiopians with a culturally sensitive, stigma-free, and confidential digital space to understand their mental well-being, establish daily grounding routines, and connect with peers facing similar socioeconomic and emotional pressures.

In Ethiopia, traditional stigma surrounding mental distress often discourages youth from seeking help openly. MindRise overcomes this barrier through an innovative **Two-Layer Identity Architecture**: accounts are verified at registration to prevent abuse, but only a pseudonymized Anonymous Handle is ever visible across public surfaces.

---

## 2. Phase One (MVP) Functional Scope

### 2.1 Account Verification & Privacy Onboarding

- **FR-1.1**: Real name and verified phone number/email collected at signup into a strictly private `VerifiedIdentity` record.
- **FR-1.2**: OTP SMS or email confirmation before granting posting privileges.
- **FR-1.3**: Mandatory selection of an Anonymous Handle and illustrated avatar during onboarding. Real names are NEVER exposed.
- **FR-1.4 / FR-1.5**: Anti-sybil fraud prevention (one active account per verified phone/email).

### 2.2 Self-Assessment Module

- Structured, self-report questionnaires adapted for youth stress, anxiety, burnout, and emotional fatigue.
- Automated scoring with clear, non-diagnostic feedback.
- AES-256-GCM encryption of assessment responses at rest.

### 2.3 Daily Routines & Gamified Growth

- Habit and routine tracking (mindfulness, hydration, physical movement, study blocks).
- Positive habit reinforcement through streaks and achievement points.

### 2.4 Anonymous Peer Support Community

- Safe, identity-shielded discussion spaces organized by topic categories (e.g., University Stress, Job Hunting, Daily Victories).
- Strict anonymity: handles and avatars only.

### 2.5 Safety & Moderation

- In-app reporting and content moderation queue.
- **Crisis Flagging & Referral Pathway**: Immediate display of Ethiopian crisis hotlines (such as Amanuel Hospital 8335 and National Emergency 952) when acute distress is detected.

### 2.6 Localization (i18n)

- Native bilingual support for English and Amharic with quick language switching in the header.

---

## 3. Explicitly Out of Scope for Phase One

The following features are reserved for future phases and must NOT be included in the MVP:

1. Licensed teletherapy scheduling and paid clinician booking.
2. Direct in-app video or audio calling with licensed therapists.
3. Integrated payment gateways (e.g., Telebirr, Chapa, CBE Birr) for paid clinical sessions.
4. Electronic Health Record (EHR) integration.
5. AI-driven automated conversational counseling or medical diagnosis.
6. USSD/SMS-only offline access channels.
