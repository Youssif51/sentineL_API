# SeerPrice - Egyptian Electronics Price Tracker SaaS

## Overview

SeerPrice is a B2C SaaS web platform that tracks product prices across Egyptian local electronics stores and sends intelligent alerts when prices drop.

### Launch Stores
| Store | Domain | Scraping Method |
|-------|--------|----------------|
| Sigma Computer | sigma-computer.com | Axios + Cheerio (static HTML) |
| Alfrensia | alfrensia.com | Axios + Cheerio (static HTML) |
| El Badr Group | elbadrgroupeg.store | Playwright if JS-rendered |
| Kimo Store | kimostore.com | Playwright if JS-rendered |
| Games World Egypt | gamesworldegypt.com | Playwright if JS-rendered |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | NestJS (Node.js / TypeScript) |
| Database | PostgreSQL via Prisma ORM |
| Cache / Sessions / Rate Limiting | Redis |
| Job Queue | Bull (Redis-backed) |
| Scraping static HTML | Axios + Cheerio |
| Scraping JS-rendered pages | Playwright (Chromium) |
| Auth | JWT — access 15min + refresh 7d with rotation |
| Security headers | Helmet.js |
| Input validation | class-validator + class-transformer |
| Rate limiting | @nestjs/throttler + Redis store |
| Payments | Paymob (Egyptian payment gateway) |
| Email | Nodemailer (SMTP / Resend) |
| Frontend | Next.js 14 + Tailwind CSS + Recharts |
| AI (future) | pgvector (column pre-added in Week 1 schema) |

## Project Structure (Epics)

```
01-foundation-and-security/    # Week 1 — NestJS setup, Docker, DB, security layer
02-auth-and-multi-tenancy/     # Week 1 — JWT auth, brute force, tenant isolation
03-scraping-engine/            # Week 2 — 5 store adapters, Bull queue, anti-bot
04-price-tracking-and-alerts/  # Week 2 — Price history, alert engine, email
05-saas-and-billing/           # Week 3 — Paymob, plan enforcement, frontend, deploy
06-ai-features/                # Post Week 3 — Embeddings, NL search, dedup, RAG
```

## Delivery Plan

| Week | Focus | Definition of Done |
|------|-------|-------------------|
| Week 1 | Foundation + Security | POST /auth/register returns JWT. 6th wrong password = 15min lockout. /health returns 200. |
| Week 2 | Core Features | Scraper saves price from all 5 stores. Alert email arrives when price drops. |
| Week 3 | SaaS + Deploy | Pro user pays via Paymob. App live at production URL with SSL. |
| Post Week 3 | AI Phase | Arabic query returns ranked product results. |

## Plan Tiers

| Feature | Free | Pro |
|---------|------|-----|
| Tracked products | 5 max | Unlimited |
| Scrape interval | Every 3 hours | Every 1 hour |
| Bull queue priority | Priority 2 | Priority 1 |

## Security Requirements (OWASP Top 10)

- **Brute force protection**: 5 failed logins = 15min account lockout (Redis-backed)
- **Rate limiting**: 10 req/min on auth routes, 100 req/min global per user
- **JWT**: Access token 15min, refresh token 7d with rotation + reuse detection
- **Password hashing**: bcrypt cost factor 12
- **Tenant isolation**: All Prisma queries auto-scoped with tenantId
- **Input validation**: Global ValidationPipe with whitelist + forbidNonWhitelisted
- **Security headers**: Helmet.js
- **HTTPS**: Enforced in production
