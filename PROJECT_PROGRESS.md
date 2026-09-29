# CCMS — Project Progress & Remaining Work

**Project:** Construction Company Management System (CCMS)  
**Stack:** Flask API + React (Vite/TypeScript) + SQLAlchemy + SQLite (MySQL-ready)  
**Last updated:** 29 September 2026  

---

## Overall status

| Area | Status |
|------|--------|
| Core PRD modules | **Mostly complete** |
| Demo-ready on SQLite | **Yes** |
| Automated tests | **Passing** (major modules) |
| Live MySQL handover on this machine | **Not done** (path documented; server not installed) |
| Biggest functional gap | **Employees & Contractors CRUD** |
| Workflow refactor (audit plan) | **Phases A–G done** |

**Estimate:** roughly **~90–95%** of required school-project functionality is implemented. Remaining work is people management, design polish (Phase F), hardening (Phase G), and optional MySQL verification.

---

## Completed phases

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 1 | Foundation (Flask factory, config, migrations, React shell) | Done |
| 2 | Authentication & RBAC (login/logout, sessions, password hashing, forgot/reset) | Done |
| 3 | Administrator (users, company, activity, notifications, settings) | Done |
| 4 | Project Manager (projects, tasks, milestones, team, budget, procurement) | Done |
| 5 | Site Engineer (attendance, materials, equipment, progress, docs) | Done |
| 6 | Contractor/Worker (own tasks, comments, evidence, attendance) | Done |
| 7 | Cross-role workflows (inventory ↔ procurement, shared logs) | Done |
| 8 | Reports (9 PRD reports, filters, print, PDF) | Done |
| 9 | Notifications & activity log polish | Done |
| 10–11 | Testing + SQLite→MySQL design via `DATABASE_URL` | Done (SQLite live) |

---

## What is implemented (by PRD area)

### Authentication & security
- [x] Login / logout / session cookies  
- [x] Password hashing  
- [x] Forgot / reset password (dev-safe token flow)  
- [x] RBAC on backend routes  
- [x] CSRF protection  
- [x] File upload validation (types, size, secure names)  
- [x] Environment-based secrets (`.env`)  

### Administrator
- [x] Role-aware dashboard (counts, activity, low stock, notifications)  
- [x] User management (create, edit, activate/deactivate)  
- [x] Company profile (+ logo upload)  
- [x] Activity log  
- [x] Notifications  
- [x] Settings  

### Projects & delivery
- [x] Projects CRUD / status / PM ownership  
- [x] Project workspace (overview, team, tasks, milestones, finance, procurement tabs)  
- [x] Tasks (assign, status, comments)  
- [x] Milestones (create, complete) — **inside project workspace**  
- [x] Project members / team  

### People & attendance
- [x] Attendance recording (Site Engineer)  
- [x] Worker views own attendance  
- [x] Contractor/Worker **user accounts** and task workspace  
- [ ] **Employees registry CRUD** (model only today)  
- [ ] **Contractors registry CRUD** (model only today)  

### Materials & inventory
- [x] Materials catalog  
- [x] Purchase / usage transactions  
- [x] Low-stock awareness  
- [x] Delivery → inventory increase  

### Equipment
- [x] Equipment list / add  
- [x] Allocation to projects  
- [x] Maintenance logging  

### Finance
- [x] Budget lines by category (Materials, Labour, Equipment, Transport, Other) + revision SoD  
- [x] Expenses (Pending → Approved/Rejected, SoD; actuals/reports use Approved only)  
- [x] Budget vs actual (project workspace + reports)  
- [ ] Expense **receipt file** upload (optional polish vs PRD wording)

### Procurement
- [x] Material request → approve/reject  
- [x] Quotations → compare/select  
- [x] Purchase orders  
- [x] Deliveries → stock update / request fulfilled  

### Progress & documents
- [x] Progress updates  
- [x] Site reports  
- [x] Document / photo uploads  
- [x] Worker work evidence on tasks  

### Reports
- [x] Project Progress  
- [x] Financial  
- [x] Budget vs Actual  
- [x] Material Usage  
- [x] Inventory  
- [x] Employee/Attendance  
- [x] Equipment  
- [x] Procurement  
- [x] Site Activity  
- [x] Date / project filters, print-friendly view, PDF export  

### Notifications & activity
- [x] Notifications (list, unread count, mark read / mark all)  
- [x] Cross-role event coverage (requests, assignments, etc.)  
- [x] Activity log (admin + scoped PM/SE access)  

### Data & demo
- [x] SQLite database (`backend/instance/ccms.db`)  
- [x] Migrations (Flask-Migrate / Alembic)  
- [x] Seed: 4 demo users + Demo Civic Block scenario  
- [x] MySQL-ready URI (`DATABASE_URL=mysql+pymysql://...`)  

### Demo accounts

| Email | Role | Password |
|-------|------|----------|
| admin@example.com | Administrator | Password123! |
| manager@example.com | Project Manager | Password123! |
| engineer@example.com | Site Engineer | Password123! |
| worker@example.com | Contractor/Worker | Password123! |

---

## Remaining to implement

### Priority 1 — functional gaps (recommended)

1. **~~Employees module~~** — **Done** (API + pages + nav + seed)  
2. **~~Contractors module~~** — **Done** (API + pages + nav + seed; optional Worker user link)  

### Priority 2 — UX / navigation polish

3. **~~Sidebar completeness~~** — **Done** (Milestones / Budgets / Expenses hub → project tabs)  
4. **Expense receipts**
   - Optional upload of receipt files on expenses (PRD mentions receipts)  

5. **~~Motion / animation~~** — **Done**  
6. **~~Dashboard / page layout refresh~~** — **Done** (mockup-aligned shell: gold accents, search topbar, greeting dashboards, project cards, quick actions)  
7. **~~UI consistency / Phase F~~** — **Done** (dark mode, StatusBadge, EmptyState, LoadingButton, ConfirmDialog, mobile touch targets)

### Priority 3 — handover / environment (not missing app logic)

6. **Live MySQL verification**
   - Install MySQL/MariaDB  
   - Set `DATABASE_URL`  
   - Run `flask db upgrade`, `flask seed`, `flask verify-db`  
   - Re-test auth, CRUD, reports, uploads, permissions  

7. **Online backup / hosting (optional)**
   - Private GitHub remote or other backup (local git bundle already created once)  

---

## Intentionally out of scope (PRD)

Do **not** implement for Version 1:

- Customer / architect / supplier marketplaces  
- Online payments or public contractor registration  
- AI features, mobile app, GPS, chat  
- NCC integration  
- Complex accounting / online bidding  

These may be listed as future enhancements only.

---

## How to run (current SQLite setup)

```bash
# Backend
cd backend
.\.venv\Scripts\activate
flask --app run.py db upgrade
flask --app run.py seed
flask --app run.py run

# Frontend
cd frontend
npm run dev
```

- App: http://127.0.0.1:5173/  
- API health: http://127.0.0.1:5000/api/health  

Demo walkthrough script:

```bash
cd backend
python scripts/demo_walkthrough.py
```

---

**Suggested next implementation task**

Optional polish: expense **receipt** uploads, or live **MySQL** verification on a machine with MySQL installed. Core school PRD modules are otherwise in place.
