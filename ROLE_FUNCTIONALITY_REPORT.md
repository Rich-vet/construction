# CCMS — Role Functionality Report

**Project:** Construction Company Management System (CCMS)  
**Based on:** current frontend pages + `ROLE_NAV` + `App.tsx` routes + API role checks  
**Last updated:** 29 September 2026 (post Phase G hardening)  
**Goal of this doc:** Role/page matrix for the live SPA after IA merge + workflow SoD.

---

## How role access is enforced

| Layer | Where | What it controls |
|-------|--------|------------------|
| Sidebar navigation | `backend/app/utils/permissions.py` → `ROLE_NAV` | Which menu items appear |
| Frontend routes | `frontend/src/App.tsx` → `RoleRoute` | Which URLs a role may open |
| API authorization | `backend/app/routes/*` → `@roles_required` | Which backend actions are allowed |
| Project capability | `utils/project_access.py` | View / manage / operate-site |
| Workflow SoD | `utils/workflow.py` | Approve MR/expense/budget; verify tasks |

**Home redirect:** Admin → `/admin` · PM → `/pm` · SE → `/se` · Worker → `/worker`

**Admin narrowing (Phase G):** Administrators keep oversight (all projects, approvals, catalog, users, settings) but are **not** routine site operators — no Worker board, no SE dashboard, and `can_operate_site` is false for Admin (attendance / diary / task verify / MR create require assigned SE or owning PM).

---

## Quick merge map (status)

| Topic | Status |
|-------|--------|
| Settings + Company | **Merged** into Settings |
| Material Requests / Procurement queues | **Done** — lists open project procurement |
| Materials create-MR removed | **Done** — link to Requests |
| Site Diary vs Progress/Reports | **Done** — Site Diary authoritative |
| Worker Progress folded | **Done** |
| Expense / budget SoD | **Done** |
| Dark mode + StatusBadge | **Done** |
| Employees / Contractors registry | **Done** (Admin People section) |

---

## Role overview

| Role | Purpose | Focus |
|------|---------|--------|
| **Administrator** | System administration and oversight | Users, settings/company, project oversight & approvals — not routine site/worker ops |
| **Project Manager** | Project, budget, procurement, reporting | Own projects end-to-end |
| **Site Engineer** | Site operations | Attendance, materials usage, progress, reports on assigned projects |
| **Contractor/Worker** | Assigned work only | Personal tasks, evidence, view own attendance |

---

# 1. Administrator

### Sidebar

Dashboard · Projects · Milestones · Budgets · Expenses · Materials · Equipment · Material Requests · Documents · Reports · Users · Notifications · Activity Log · Settings  

Company is reached from Settings (not in sidebar). Admin does **not** use SE or Worker dashboards.

---

### Dashboard — `/admin`

**What this page is for:** System overview and shortcuts after admin login.

**On-page functions:**
- View metric cards (projects, users, low stock, etc.)
- Filter recent projects (All / Active / Completed / On Hold)
- Open a project from the recent list
- Browse a short recent-activity feed
- Quick actions → Users, Company Profile, Reports, Notifications

**Data shown:** Counts, recent projects (name, client, status, progress), recent activity lines.

**Merge note:** Preview of Projects + Activity Log + Notifications — keep as hub.

---

### Users — `/users`

**What this page is for:** Manage who can sign into CCMS and which role they have.

**On-page functions:**
- Search / filter by role and status
- **Add user** → create form
- Table: **View**, **Edit**, **Activate / Deactivate**
- Pagination

**Data shown:** Name, email, role, status, created date.

---

### User detail — `/users/:id`

**What this page is for:** Read a single account and change active status.

**On-page functions:**
- View profile fields
- **Edit** → form page
- **Activate / Deactivate**
- **Back to users**

**Merge note:** Activate/deactivate also exists on the list — acceptable duplication.

---

### User create / edit — `/users/create`, `/users/:id/edit`

**What this page is for:** Create or change account credentials and role.

**On-page functions:**
- Form: full name, email, phone, role, password, “Account active”
- **Save** / **Cancel**

---

### Settings — `/settings`

**What this page is for:** Read-only system summary and entry point to company + users.

**On-page functions:**
- View application name, company name, currency
- Button **Manage company profile** → `/company`
- Button **Manage users** → `/users`
- *(No inline edit.)*

**Merge note:** **Best merge with Company Profile** — Settings currently does almost nothing by itself.

---

### Company profile — `/company` (via Settings)

**What this page is for:** Edit the construction company’s identity used across the app.

**On-page functions:**
- Edit name, description, phone, email, address, registration
- Upload / preview logo
- **Save company profile**

---

### Projects list — `/projects`

**What this page is for:** Browse all projects (admin sees everything).

**On-page functions:**
- Status filter tabs
- **New Project**
- Click a row/card → project detail
- Optional search query

**Data shown:** Name, client, location, status, progress, dates, budget.

---

### Project create / edit — `/projects/create`, `/projects/:id/edit`

**What this page is for:** Define project shell (client, dates, budget, site engineer).

**On-page functions:**
- Form: name, client contacts, location, description, dates, budget, status, site engineer
- **Save** / **Cancel**

---

### Project detail (workspace) — `/projects/:id`

**What this page is for:** Single place to run a project’s planning, people, money, and procurement.

**Header functions:** **Edit project**, **Back**.

| Tab | What it does | Functions on the tab |
|-----|--------------|----------------------|
| **Overview** | Project summary | Read-only description and dates |
| **Tasks** | Plan work | Add task (name, priority, assignee, due); view task table |
| **Milestones** | Schedule checkpoints | Add milestone; **Complete** open ones |
| **Team** | Assign people | Add member + project role; **Remove** |
| **Budget** | Planned vs actual | Propose category amount; **Approve/Reject** pending revision (SoD — not self) |
| **Expenses** | Actual spend | Submit expense (Pending); **Approve/Reject** by another manager/admin; actuals use Approved only |
| **Procurement** | Buy materials | Request materials; **Approve/Reject**; add quotations; **Prefer**; **Create PO**; **Record delivery** |
| **Progress** | Site % updates | **View-only** list of SE progress posts |
| **Reports** | Site diaries | **View-only** list of SE site reports |

**Merge note:** This page already concatenates many domains. Standalone Material Requests / Quotations / POs / Deliveries / Progress Updates / Site Reports pages largely **repeat** pieces of these tabs.

---

### Materials — `/materials`

**What this page is for:** Stock levels, usage logging, and requesting materials.

**On-page functions:**
- Add material to catalog (name, unit, min stock) — Admin/PM
- Record stock movement (USAGE / RETURN / etc.)
- **Submit material request** (from this page)
- View stock table + recent usage + request statuses

**Merge note:** Request section overlaps Material Requests + project Procurement.

---

### Equipment — `/equipment`

**What this page is for:** Track fleet availability and field usage.

**On-page functions:**
- Add equipment to catalog — Admin/PM
- **Allocate** to a project
- **Return** open allocations
- **Log maintenance** / **Mark available**
- View fleet status, allocations, maintenance log

**Merge note:** Unique — poor merge candidate.

---

### Material requests — `/material-requests`

**What this page is for:** Cross-project list to create and approve material requests.

**On-page functions:**
- Form: project, material, qty, reason → **Submit**
- **Approve** / **Reject** pending rows (Admin/PM)

**Merge note:** Same workflow as Project → Procurement.

---

### Quotations / Purchase orders / Deliveries — `/quotations`, `/purchase-orders`, `/deliveries`

**What this page is for:** Cross-project **read-only** procurement overview (one component, three tabs/routes).

**On-page functions:**
- Switch tabs: Quotations | Purchase orders | Deliveries
- *(No create / prefer / PO / delivery buttons here — page tells you to use project workspace.)*

**Merge note:** Strong concatenate into Project Procurement + optional filtered “all projects” view.

---

### Documents — `/documents`

**What this page is for:** Store and download project files / photos.

**On-page functions:**
- Upload (project, type, name, file, description)
- **Download** existing files

---

### Progress updates — `/progress-updates`

**What this page is for:** Submit and browse site progress % posts.

**On-page functions:**
- Form: project, date, overall %, work completed, problems, next activities → **Submit**
- Table of past updates

**Merge note:** Create here; Project → Progress only displays. Can merge create into the project tab.

---

### Site reports — `/site-reports`

**What this page is for:** Daily site diary (workers, activities, safety, etc.).

**On-page functions:**
- Form: project, date, workers present, activities, materials/equipment used, problems, safety, next → **Submit**
- Table of past reports

**Merge note:** Same display-only relationship with Project → Reports tab. Also similar purpose to Progress Updates.

---

### Formal reports — `/reports`

**What this page is for:** Analytical / printable management reports (not the daily site diary).

**On-page functions:**
- Pick report type
- Filter by project / date range → **Generate**
- **Print** / **Download PDF**
- View summary cards + result table

**Merge note:** Keep separate from Site Reports.

---

### Activity log — `/activity-log`

**What this page is for:** Audit trail of who did what in the system.

**On-page functions:**
- Paginate through log entries
- *(No filters in UI currently.)*

**Data shown:** When, actor, action, details. Admin sees **global** log.

---

### Notifications — `/notifications`

**What this page is for:** Personal inbox for alerts (all roles share this page).

**On-page functions:**
- **Mark all read**
- **Mark read** per item
- **Open related record** (if linked)
- Pagination

---

# 2. Project Manager

### Sidebar

Dashboard · Projects · Attendance · Materials · Equipment · Material Requests · Quotations · Purchase Orders · Deliveries · Progress Updates · Site Reports · Documents · Reports · Notifications · Activity Log  

PM uses many of the **same page components** as Admin/SE; data is scoped to **projects they manage**.

---

### Dashboard — `/pm`

**What this page is for:** PM home — portfolio health and pending approvals.

**On-page functions:**
- View cards (my/active projects, avg progress, pending requests, budget alerts)
- Charts (status doughnut, progress bars) — display only
- **New Project**
- Open projects / material requests from lists
- Quick actions → create project, material requests, reports, quotations

**Merge note:** Summarizes Projects + Material Requests — keep as hub.

---

### Projects list / form / detail

Same pages and tab functions as Admin (see Project detail table above), except:
- List shows **owned** projects
- `can_manage` is true on owned projects → full task/milestone/team/budget/procurement actions

---

### Attendance — `/attendance`

**What this page is for:** Record who was on site for managed projects.

**On-page functions:**
- Form: project, worker, date, status, check-in, check-out, notes → **Save attendance**
- Search attendance records table
- View today stats (present / absent / late)

**Merge note:** Write side of attendance; Worker page is read-only personal view.

---

### Materials, Equipment, Material Requests, Procurement lists, Progress Updates, Site Reports, Documents, Formal Reports, Notifications

Same **page purposes and on-page functions** as described under Administrator / Site Engineer sections above.

**PM-specific notes:**
- Can **approve/reject** material requests
- Can manage material/equipment **catalog**
- Activity log is **project-scoped**, not global
- Formal Reports available

---

# 3. Site Engineer

### Sidebar

Dashboard · Projects · Attendance · Materials · Equipment · Material Requests · Progress Updates · Site Reports · Documents · Notifications · Activity Log  

---

### Dashboard — `/se`

**What this page is for:** Daily site ops hub.

**On-page functions:**
- View cards (assigned projects, today’s tasks, workers on site, low stock)
- Browse today’s tasks / project list / attendance today (read-only panels)
- Quick actions → Attendance, Materials, Progress Update, Site Report

---

### Projects list / detail

**List:** Assigned projects only; **no New Project** button.  
**Detail:** Same tabs visible, but management forms are limited (`can_manage` false):
- Cannot edit project shell, team, budget, expenses, or full procurement approve/PO/delivery flows
- Can still use operational pages (Attendance, Materials usage, Progress Updates, Site Reports, Documents)
- Can add task **comments** via API (detail UI is primarily view for planning tabs)

---

### Attendance — `/attendance`

Same functions as PM section: **record** attendance + search history.

---

### Materials — `/materials`

**On-page functions for SE:**
- Record usage / stock movements
- Submit material requests
- View stock and request status  
- **No** “add to catalog” (Admin/PM only)

---

### Equipment — `/equipment`

**On-page functions for SE:**
- Allocate / return
- Log maintenance  
- **No** catalog create

---

### Material requests — `/material-requests`

**On-page functions for SE:**
- **Create** and view requests  
- **No Approve / Reject**

---

### Progress updates — `/progress-updates`

Full create form + history table (primary write surface for progress %).

---

### Site reports — `/site-reports`

Full create form + history table (primary write surface for daily diaries).

---

### Documents — `/documents`

Upload + download for assigned projects.

---

### Activity log / Notifications

Same pages; activity is project-linked; notifications are personal.

### Not on SE sidebar / routes
Formal Reports, Quotations/PO/Deliveries overview pages, Users, Settings/Company, Worker My Tasks board.

---

# 4. Contractor / Worker

### Sidebar

Dashboard · My Tasks · Attendance · Progress · Notifications  

---

### Dashboard — `/worker`

**What this page is for:** Personal “what should I do today?” home.

**On-page functions:**
- View count cards (today / completed / in progress / pending)
- Open today’s task rows → task detail
- Quick actions → My Tasks, Attendance, Progress, Notifications
- Safety banner (informational only)

**Merge note:** Today list overlaps My Tasks → Today tab.

---

### My Tasks — `/tasks`

**What this page is for:** Full personal task inbox.

**On-page functions:**
- Filter tabs: **Today / Upcoming / Completed / Overdue** (with counts)
- Search via `?search=`
- Click row → task detail

**Data shown:** Task name, project, progress bar, due label, status, priority.

---

### Task detail — `/tasks/:id`

**What this page is for:** Do the work — update status, leave notes, upload evidence.

**On-page functions:**
- View hero info (project, assigned by, due, status)
- View progress bar
- Tabs:
  - **Details** — priority, start date, description
  - **Instructions** — instruction/description text
  - **Updates** — comment timeline
  - **Photos** — upload evidence file; view/download links
- **Update Progress** — choose allowed status → Save
- **Add Note** — post comment
- **Mark Complete** — set status Completed (when allowed)

**Merge note:** This is the only worker **write** surface for work evidence. Keep.

---

### Attendance — `/attendance` (worker view)

**What this page is for:** See your own attendance as recorded by the site engineer.

**On-page functions:**
- *(None writable.)* View today’s check-in/out card
- View “Today’s Status” (project, status, times, notes)
- Browse attendance history table

**Merge note:** Read-only twin of SE Attendance page — keep separate by role (gate already does this).

---

### Progress — `/progress`

**What this page is for:** See how your projects/tasks are advancing.

**On-page functions:**
- View primary project overall %
- View other assigned projects’ progress
- Open your tasks list with progress bars
- Browse “Recent Updates” (from notifications)
- Links to My Tasks / task detail  
- *(No forms — view only.)*

**Merge note:** **Strong concatenate** into Dashboard or My Tasks — no unique writes.

---

### Notifications — `/notifications`

Same inbox functions as other roles (mark read, open links).

---

### Not in sidebar (but gated if URL opened)

| Page | Route | Functions |
|------|-------|-----------|
| **My projects** | `/projects` | Read-only table of assigned projects (no detail navigation) |
| **My documents** | `/documents` | Download-only list of own task evidence |

**Merge note:** My documents overlaps Task Detail → Photos; My projects overlaps Worker Progress project cards.

---

## Shared page behavior (gates)

| Route | Admin / PM / SE see | Worker sees |
|-------|---------------------|-------------|
| `/projects` | Projects list (create if Admin/PM) | Read-only membership table |
| `/attendance` | Record + history | Own history only |
| `/documents` | Upload + download project docs | Own evidence downloads only |
| `/notifications` | Same inbox page for everyone | Same |

---

## Capability matrix (who can do what)

| Function | Admin | PM | SE | Worker |
|----------|:----:|:--:|:--:|:------:|
| Manage users | ✅ | — | — | — |
| Edit company (via Settings) | ✅ | — | — | — |
| Create / edit projects | ✅ | ✅ owned | — | — |
| Manage tasks / milestones / team / budget | ✅ | ✅ owned | View | Own task status only |
| Approve material requests | ✅ | ✅ | Create only | — |
| Quotations / PO / delivery **actions** | ✅ | ✅ | — | — |
| Formal analytics reports + PDF | ✅ | ✅ | — | — |
| Record attendance | ✅* | ✅ | ✅ | View own |
| Material/equipment catalog CRUD | ✅ | ✅ | Ops only | — |
| Submit progress updates / site reports | ✅ | ✅ | ✅ | — |
| Upload project documents | ✅ | ✅ | ✅ | Task evidence only |
| Global activity log | ✅ | Project-scoped | Project-scoped | — |
| Personal My Tasks workspace | Elevated | — | — | ✅ |

\*Admin can open `/attendance` even though it is not in the Admin sidebar.

---

## Recommended concatenation plan (practical)

If simplifying navigation / pages:

1. **Settings ← Company Profile** (one System page).
2. **Project Detail as source of truth** for procurement + progress + site reports; demote or remove duplicate list/create pages (or keep lists as “All projects” filters only).
3. **One Material Request entry point** (pick Project Procurement *or* Material Requests *or* Materials request box — not all three).
4. **Worker: drop or fold Progress + Documents** into Dashboard / My Tasks / Task Detail.
5. **Optional:** Merge Progress Updates + Site Reports into one “Site diary” with a type field.

Keep separate: **Equipment**, **Formal Reports**, **Users CRUD**, **Task Detail**, role **Dashboards**.

---

## Seed accounts (for checking pages)

| Email | Role | Password |
|-------|------|----------|
| `admin@example.com` | Administrator | `Password123!` |
| `pm@example.com` | Project Manager | `Password123!` |
| `se@example.com` | Site Engineer | `Password123!` |
| `worker@example.com` | Contractor/Worker | `Password123!` |

---

## Source files

- Nav keys: `backend/app/utils/permissions.py`
- Routes: `frontend/src/App.tsx`
- Pages: `frontend/src/pages/admin|pm|se|worker/`
- Gates: `ProjectsGatePage`, `AttendanceGatePage`, `DocumentsGatePage`
