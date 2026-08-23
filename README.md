# Construction Company Management System (CCMS)

Professional internal construction company management web application.

**Status:** Complete — all PRD phases implemented (SQLite default; MySQL via `DATABASE_URL`).

## Architecture

```text
CCMS/
├── backend/     # Python Flask REST API (SQLAlchemy, Migrate)
├── frontend/    # React + TypeScript (Vite, Bootstrap 5)
└── README.md
```

- **Backend:** Flask JSON API on port `5000`
- **Frontend:** React SPA on port `5173` (proxies `/api` to Flask in development)
- **Auth:** Cookie sessions + CSRF + CORS credentials

## Stack

| Layer | Technology |
|-------|------------|
| API | Python Flask |
| ORM | SQLAlchemy + Flask-Migrate |
| Database | SQLite (dev) → MySQL (handover via `DATABASE_URL`) |
| UI | React 19, TypeScript, Vite |
| Styling | Bootstrap 5, React-Bootstrap, custom design system |

## Setup

### Backend

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
flask --app run.py db upgrade
flask --app run.py seed
flask --app run.py run
```

API health: http://127.0.0.1:5000/api/health

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App: http://127.0.0.1:5173/

## Demo accounts (development)

| Email | Role | Password |
|-------|------|----------|
| admin@example.com | Administrator | Password123! |
| manager@example.com | Project Manager | Password123! |
| engineer@example.com | Site Engineer | Password123! |
| worker@example.com | Contractor/Worker | Password123! |

`flask --app run.py seed` also creates **Demo Civic Block** (Active project with team, tasks, milestones, budgets, expenses, and notifications). Use `--no-scenario` to skip it.

Replace demo passwords before any real deployment.

## Auth API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/auth/csrf` | CSRF token |
| GET | `/api/auth/me` | Current session |
| POST | `/api/auth/login` | Sign in |
| POST | `/api/auth/logout` | Sign out |
| POST | `/api/auth/forgot-password` | Dev-safe reset token |
| POST | `/api/auth/reset-password` | Apply new password |

When `DEV_EXPOSE_PASSWORD_RESET_TOKEN=true`, forgot-password returns the raw token (no email required).

## Environment

### Backend (`backend/.env`)

| Variable | Purpose |
|----------|---------|
| `SECRET_KEY` | Session/CSRF signing |
| `DATABASE_URL` | SQLAlchemy URI (SQLite or MySQL) |
| `CORS_ORIGINS` | Allowed React origins |
| `DEV_EXPOSE_PASSWORD_RESET_TOKEN` | Include reset token in API (dev only) |
| `APP_NAME` / `COMPANY_DISPLAY_NAME` | Branding (temporary: CCMS) |
| `CURRENCY_CODE` / `CURRENCY_SYMBOL` | ZMW / K |

### Frontend (`frontend/.env`)

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Leave empty in dev (Vite proxy). Set to API origin in production. |

Never commit `.env` files.

## Demo walkthrough

```bash
cd backend
python scripts/demo_walkthrough.py
```

Exercises login and core endpoints for all four roles against the seeded Demo Civic Block (expects development SQLite DB).

## Testing

```bash
cd backend
pytest tests/ -q

# Optional live MySQL suite (requires a reachable MySQL/MariaDB database):
# set CCMS_MYSQL_URL=mysql+pymysql://user:pass@127.0.0.1:3306/ccms?charset=utf8mb4
# pytest tests/test_mysql.py -m mysql -q

cd ../frontend
npm run build
```

Coverage includes authentication/RBAC, admin, projects/procurement, site ops, worker tasks, cross-role inventory linkage, reports, notifications, finance (budget vs actual), progress/milestones, and MySQL dialect DDL compile checks.

## SQLite → MySQL handover

Business logic does not change — only `DATABASE_URL`.

1. Create an empty MySQL/MariaDB database (utf8mb4), e.g. `ccms`.
2. Install client driver (already in `requirements.txt`: `PyMySQL`).
3. Set in `backend/.env`:

```env
DATABASE_URL=mysql+pymysql://USER:PASSWORD@127.0.0.1:3306/ccms?charset=utf8mb4
```

Helper template:

```bash
flask --app run.py print-mysql-uri
```

4. Apply schema and seed:

```bash
flask --app run.py db upgrade
flask --app run.py seed
flask --app run.py verify-db
```

5. Re-run the API test suite against SQLite memory (default), then optionally the live MySQL marker above.
6. Start the API and React app as usual; confirm login, project CRUD, reports, uploads, and RBAC.

To migrate existing SQLite *data* (optional for school demos), export/import manually or re-seed — schema is identical via Alembic.

## Roles

Administrator · Project Manager · Site Engineer · Contractor/Worker

## Phases

1. Foundation — complete  
2. Authentication & RBAC — complete  
3. Administrator role — complete  
4. Project Manager role — complete  
5. Site Engineer role — complete  
6. Contractor/Worker role — complete  
7. Cross-role workflows — complete  
8. Reports — complete  
9. Notifications & activity logs — complete  
10. Testing & optimization — complete  
11. SQLite → MySQL migration path — complete (switch via `DATABASE_URL`)
