# Construction Company Management System (CCMS)

Professional internal construction company management web application.

**Status:** Phase 1 — Project foundation (split API + React SPA).

## Architecture

```text
CCMS/
├── backend/     # Python Flask REST API (SQLAlchemy, Migrate)
├── frontend/    # React + TypeScript (Vite, Bootstrap 5)
└── README.md
```

- **Backend:** Flask JSON API on port `5000`
- **Frontend:** React SPA on port `5173` (proxies `/api` to Flask in development)
- **Auth (Phase 2):** Cookie sessions + CORS credentials

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

## Environment

### Backend (`backend/.env`)

| Variable | Purpose |
|----------|---------|
| `SECRET_KEY` | Session/CSRF signing |
| `DATABASE_URL` | SQLAlchemy URI |
| `CORS_ORIGINS` | Allowed React origins |
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

## Roles (later)

Administrator · Project Manager · Site Engineer · Contractor/Worker

## Phases

1. **Foundation** — complete (this structure)
2. Authentication & RBAC — next
3. Administrator role
4. Project Manager role
5. Site Engineer role
6. Contractor/Worker role
7. Cross-role workflows
8. Reports
9. Notifications & activity logs
10. Testing & optimization
11. SQLite → MySQL migration
