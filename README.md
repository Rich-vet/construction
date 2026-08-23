# Construction Company Management System (CCMS)

Professional internal construction company management web application.

**Status:** Phase 1 — Project foundation complete. Authentication is not yet implemented.

## Stack

- Backend: Python Flask
- ORM: SQLAlchemy
- Migrations: Flask-Migrate / Alembic
- Database: SQLite (development) → MySQL (handover)
- Frontend: HTML5, CSS3, JavaScript, Bootstrap 5
- Charts: Chart.js (later phases)

## Project structure

```text
ccms/
├── app/
│   ├── __init__.py          # Application factory
│   ├── extensions.py        # db, migrate, csrf
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── templates/
│   ├── static/
│   └── utils/
├── migrations/
├── tests/
├── uploads/
├── config.py
├── run.py
├── requirements.txt
├── .env.example
└── README.md
```

## Setup

1. Create and activate a virtual environment:

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Copy environment settings:

```bash
copy .env.example .env
```

4. Ensure `SECRET_KEY` in `.env` is unique for your machine.

5. Initialize the database migrations (first time):

```bash
flask --app run.py db upgrade
```

6. Run the application:

```bash
flask --app run.py run
```

Open http://127.0.0.1:5000/

## Environment variables

| Variable | Purpose |
|----------|---------|
| `SECRET_KEY` | Flask session/CSRF signing key |
| `DATABASE_URL` | SQLAlchemy URI (`sqlite:///ccms.db` or MySQL) |
| `APP_NAME` | Short product name (default: CCMS) |
| `COMPANY_DISPLAY_NAME` | Display name (temporary until company name is finalized) |
| `CURRENCY_CODE` | ISO currency code (default: ZMW) |
| `CURRENCY_SYMBOL` | Display symbol (default: K) |
| `MAX_CONTENT_LENGTH_MB` | Upload size limit |

Never commit `.env`. Use `.env.example` as the template.

## Roles (implemented later)

- Administrator
- Project Manager
- Site Engineer
- Contractor/Worker

## Development phases

1. **Foundation** — complete
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

## Testing

```bash
python -m pytest tests/ -q
```

## Notes

- Company branding currently uses **CCMS** until a legal company name is provided.
- Currency display defaults to Zambian Kwacha (`K` / `ZMW`) per PRD examples.
- Sidebar modules are shown for orientation but remain disabled until their phases are built.
