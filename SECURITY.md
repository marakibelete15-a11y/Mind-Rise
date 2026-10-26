# Security Policy

## Core Principle: Two-Layer Identity Privacy

MindRise is built on an inviolable security premise: **Verified Identity data must NEVER be exposed publicly or accessible to unauthorized roles.**

Because of societal stigma surrounding mental health in Ethiopia, protecting our users' confidentiality is not merely a feature—it is a critical safety requirement.

### Identity Segregation Mandate

1. **Separation of Concerns**: Real names, verified phone numbers, and email addresses (`VerifiedIdentity`) are strictly segregated from public handle, community posts, badges, and peer interactions (`Profile`).
2. **Access Control**: Verified Identity data is strictly restricted to administrative compliance, account recovery, and anti-fraud deduplication. It is **never** accessible to community moderators conducting routine content moderation.
3. **API Contracts**: No public endpoint, community feed, comment payload, or user profile route may serialize or expose real names, phone numbers, or email addresses.
4. **Encryption at Rest**: PII and sensitive self-assessment answers must be encrypted at rest using industry-standard authenticated encryption (AES-256-GCM).

## Supported Versions

Only the latest `main` branch code is officially supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| MVP 0.x | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability within MindRise (especially any potential risk of identity de-anonymization or PII exposure), please do NOT file a public issue.

Instead, please send an encrypted or private security report to:

- **Security Contact**: `security@mindrise.et` (or the repository maintainers)
- **Response SLA**: Acknowledgment within 24 hours, assessment and triage within 72 hours.

Please include:

- A description of the vulnerability and attack vector.
- Steps to reproduce or proof of concept.
- Affected components (client, server, database, or API routes).
- Potential impact on user privacy or data security.
