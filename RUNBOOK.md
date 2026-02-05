# 🧭 Genassista Backend — Runbook & Demo Guide

This runbook provides complete instructions for setting up, running, seeding, and demonstrating the **Genassista Adaptive Unified API**.  
It covers everything from a fresh environment to a working local demo with seeded data — **end-to-end in under 10 minutes**.

---

## 📘 Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Installation](#installation)
5. [Configuration](#configuration)
6. [Database & Seeding](#database--seeding)
7. [Running the Application](#running-the-application)
8. [API Documentation](#api-documentation)
9. [Demo Mode & Acceptance Flow](#demo-mode--acceptance-flow)
10. [Data Management](#data-management)
11. [Troubleshooting](#troubleshooting)
12. [Support](#support)

---

## 1. System Overview

The **Genassista Backend** provides a unified API layer that normalizes data from multiple LMS platforms (Google Classroom, Vklass, Unikum, etc.) into a **neutral JSON schema**.  
It includes sample academic data and a full demo flow for testing.

**Key Features**
- Unified API for Courses, Users, Assignments, Grades, and Submissions
- PostgreSQL database with Knex migrations
- Azure Blob or local artifact storage
- Demo routes with authentication, rate limiting, seeded data, and dashboard

---

## 2. Architecture

| Layer | Tech | Description |
|-------|------|--------------|
| API | Express + TypeScript | Core REST backend |
| Database | PostgreSQL | via Knex migrations |
| Storage | Azure Blob / Local FS | Submission artifacts |
| Contracts | OpenAPI + Zod | Unified LMS-neutral schema |
| Docs | Swagger UI | Mounted at `/api-docs` |
| Demo | Express Routes | `/api/demo/*` for sandbox showcase |

---

## 3. Prerequisites

- Node.js **v20+**
- **npm** (or Yarn)
- **Docker + Docker Compose** (for local PostgreSQL)
- Git
- PowerShell or Bash terminal

---

## 4. Installation

Clone and set up dependencies:

```bash
git clone https://genassista-ai@dev.azure.com/genassista-ai/Genassista/_git/backend
cd backend
npm ci

```

## Usage Aggregation & Verification (SCRUM-18, SCRUM-21)

Prereqs
- DATABASE_URL set; API_KEYS contains at least one key (e.g., demo-key)
- Postgres running (docker-compose up -d pg)

Migrations
```bash
npm run migrate:latest
```

Start API
```bash
npm run dev
# Server at http://localhost:3001
```

Generate demo usage
```bash
# Optional env
# DEMO_SCHOOL_ID=1 DEMO_TRAFFIC_BURST=50 BASE_URL=http://localhost:3001
npm run traffic
```

Flush interval
- Usage counters flush to Postgres within ~30s (config: USAGE_FLUSH_INTERVAL_MS)

Query aggregated usage
```bash
curl "http://localhost:3001/usage/daily?schoolId=1&from=2025-10-01&to=2025-10-31" \
  -H "X-Api-Key: demo-key"
```

Control Center graph
- Open http://localhost:3001/control/usage
- If required, set API key in browser console:
```js
localStorage.setItem('apiKey','demo-key')
```

Egress block (sandbox)
```bash
curl -X POST http://localhost:3001/__sandbox/prove-egress-block
# Expect: { ok: true, blocked: true, ... }
```

Notes
- Usage tracking requires the header `X-School-Id: <integer>` on API requests to attribute calls to a school.
- UI/Control Center calls only Core endpoints; no direct UI→Python links.
