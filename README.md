# Collab Deal OS

Creator-brand collaboration marketplace with role-based workspaces, deal and creator discovery, private messaging, structured offers and creator networking. Built with React, TypeScript and Supabase.

Collab Deal OS brings collaboration discovery and negotiation into one workspace. Brands can publish opportunities, creators can discover deals and express interest, and both sides can move into private conversations and structured offers.

## Current project

This repository contains the newer marketplace iteration. The earlier [collab-deal-os](https://github.com/mohammedzaid00100/collab-deal-os) repository is the discontinued prototype.

[View deployed website](https://collab-deal-os.mohammedzaid00100.workers.dev/)

## Core features

- Creator and brand onboarding with role-based workspaces.
- Deal/campaign publishing and opportunity discovery.
- Creator discovery and matching.
- Interest/comment interactions and creator networking.
- Private conversation screens and messaging components.
- Structured offers and collaboration-term workflows.
- Profile, notification and account-management interfaces.

The current source includes messaging routes and components; descriptions of the earlier version as having no chat are obsolete.

## Stack

React, TypeScript, Tailwind CSS, Supabase, Vinext/Next.js-compatible routing, Cloudflare Workers and Capacitor for the Android project.

## Local development

Use Node 22.13+ and npm:

```bash
npm ci
npm run setup
npm run dev
```

Copy `.env.example` to ignored `.env.local` and configure the services used by your working environment. Keep private credentials server-side and out of Git history.

## Verification commands

```bash
npm run typecheck
npm run lint
npm test
npm run test:db
npm run build
```

These are repository commands, not a claim that they were rerun for this documentation update. A deployed page is not proof that every provider integration or multi-account workflow is production-ready.

## Engineering references

- [Deployment notes](docs/DEPLOYMENT.md)
- [Android notes](docs/ANDROID.md)
- [Security notes](SECURITY.md)
- [Historical project status](PROJECT_STATUS.md)
- [Payment removal and future reintroduction](PAYMENT_REMOVAL_AND_FUTURE_REINTRODUCTION.md)

The dated status document describes an earlier implementation phase. Check current source and the payment-removal notes before treating older messaging, billing or deployment statements as current behavior.
