# Construction Company Management System (CCMS)

Professional internal construction company management web application.

**Status:** Phase 3 — Administrator role complete.

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
| Database | SQLite (dev) → MySQL (handover) |
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

Replace these passwords before any real deployment.

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
| `DATABASE_URL` | SQLAlchemy URI |
| `CORS_ORIGINS` | Allowed React origins |
| `DEV_EXPOSE_PASSWORD_RESET_TOKEN` | Include reset token in API (dev only) |
| `APP_NAME` / `COMPANY_DISPLAY_NAME` | Branding (temporary: CCMS) |
| `CURRENCY_CODE` / `CURRENCY_SYMBOL` | ZMW / K |

### Frontend (`frontend/.env`)

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Leave empty in dev (Vite proxy). Set to API origin in production. |

Never commit `.env` files.

## Testing

```bash
cd backend
pytest tests/ -q

cd ../frontend
npm run build
```

## Roles

Administrator · Project Manager · Site Engineer · Contractor/Worker

## Phases

1. Foundation — complete
2. Authentication & RBAC — complete
3. **Administrator role — complete**
4. Project Manager role — next
5. Site Engineer role
6. Contractor/Worker role
7. Cross-role workflows
8. Reports
9. Notifications & activity logs
10. Testing & optimization
11. SQLite → MySQL migration
