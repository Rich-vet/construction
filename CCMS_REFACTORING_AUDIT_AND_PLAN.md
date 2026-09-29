# CCMS — System Audit & Refactoring Implementation Plan

**Status:** Phases A–G implemented (refactor complete for planned slices).  

Remaining outside this plan: expense receipt uploads, live MySQL verify. 
**Date:** 29 September 2026  
**Stack:** React (Vite/TS) + Flask + SQLAlchemy + SQLite (MySQL-ready)  
**Companion docs:** `ROLE_FUNCTIONALITY_REPORT.md`, `PROJECT_PROGRESS.md`, `README.md`

This plan follows the mandated sequence: **Audit → Function map → Information architecture → Backend workflows → Frontend → Design system → UX → Test.** Implementation must not start until this plan is accepted (or explicitly amended).

---

## 0. Executive verdict

CCMS already has a working four-role product with real project scoping, procurement primitives, site ops, worker tasks, reports, notifications, and activity logging. It is **not** a greenfield rebuild.

The main gaps versus the refactor brief are:

1. **Duplicated authoritative UIs** for the same business operations (especially materials / procurement / progress).
2. **Incomplete state machines** (tasks, material requests, expenses, budgets are flatter than specified).
3. **Weak separation of duties** (backend often checks role + project access, not creator ≠ approver + state).
4. **Admin over-privileged** for day-to-day site/worker operations (routes allow Admin on SE/Worker surfaces).
5. **UX / design system** partially present (tokens, PageChrome) but no dark mode, inconsistent action hierarchy, and uneven loading/empty/confirm patterns.
6. **Site Diary split** across `ProgressUpdate` and `SiteReport` (+ worker Progress aggregation page).

**Strategy:** Preserve working modules; **merge duplicates into one authoritative location**; **extend backend workflows first**; then align UI and design system. Prefer **feasible MVP increments** over inventing enterprise modules (no payroll/GPS/BIM; optional Procurement Officer later).

**Audit sources:** codebase inspection + frontend route/page inventory + backend service/status inventory (folded into §1.4–1.5).

---

## 1. Current architecture snapshot

### 1.1 Frontend

| Area | Location | Notes |
|------|----------|--------|
| Routes / RBAC shell | `frontend/src/App.tsx`, `RoleRoute`, `ProtectedRoute` | Role lists on routes; workers gated via `*GatePage` |
| Nav | `navigation.ts` + API `ROLE_NAV` | Filters unimplemented items; role-specific keys |
| Admin | `pages/admin/*` | Users, Settings, Company, Activity, Notifications, Dashboard |
| PM | `pages/pm/*` | Dashboard, Projects list/form/detail, MaterialRequests, ProcurementLists |
| SE | `pages/se/*` | Dashboard, Attendance, Materials, Equipment, ProgressUpdates, SiteReports, Documents |
| Worker | `pages/worker/*` | Dashboard, MyTasks, TaskDetail, Attendance, Progress, Projects/Documents variants |
| Shared UI | `components/ui/PageChrome.tsx`, `styles/main.css` | Light theme tokens; metric cards, pills, progress; **no dark theme** |

### 1.2 Backend

| Area | Location | Notes |
|------|----------|--------|
| Roles | `utils/roles.py`, `utils/permissions.py` | 4 roles; ROLE_NAV |
| Project access | `utils/project_access.py` | Admin all; PM owned; SE assigned; Worker membership |
| Projects / finance / procurement | `services/project_service.py`, `routes/projects.py` | Large service; `assert_can_manage` / `assert_can_operate_site` |
| Site ops | `services/site_service.py`, `routes/site.py` | Attendance, materials usage, equipment, progress, site reports, docs |
| Worker | `services/worker_service.py`, `routes/worker.py` | Own tasks; worker may set **Completed** today |
| Audit | `services/activity_service.py` → `ActivityLog` | Many mutations logged; not full before/after |
| Auth | Session + CSRF cookie | Solid baseline |

### 1.3 Key model statuses (today)

| Entity | Current statuses | Spec target |
|--------|------------------|-------------|
| Project | Planned, Active, On Hold, Completed, Cancelled | PLANNING → ACTIVE → ON_HOLD → COMPLETED → CLOSED |
| Task | Pending, In Progress, Completed, Cancelled | ASSIGNED → IN_PROGRESS → READY_FOR_REVIEW → VERIFIED |
| Material request | Pending, Approved, Rejected, Fulfilled | DRAFT → SUBMITTED → … → RECEIVED → CLOSED |
| Purchase order | Draft, Approved, Ordered, Delivered, Cancelled | Partially aligned |
| Expense | *(no status — immediate)* | DRAFT → … → APPROVED |
| Budget line | *(silent upsert)* | Approved + revision workflow |
| ProgressUpdate / SiteReport | Separate tables | Coherent Site Diary |

### 1.4 Backend transition reality (confirmed service audit)

Concrete service behaviour that the refactor must deliberately change (not assume):

| Workflow | Function | Actual behaviour today |
|----------|----------|------------------------|
| Create MR | `create_material_request` | Always → `Pending`; SE/PM/Admin with `can_operate_site` |
| Review MR | `review_material_request` | Accepts Approved/Rejected/**Fulfilled** with **no from-state gate**; **no** `actor != requested_by` |
| Create quotation | `create_quotation` | PM manage; no quotation status enum (only `is_selected`) |
| Prefer quote | `select_quotation` | Creator may select own quote |
| Create PO | `create_purchase_order_from_quotation` | Forces status **`Approved` immediately** — model `Draft`/`Ordered`/`Cancelled` largely unused |
| Delivery | `record_delivery` | PO → `Delivered` (no partial); stock += qty; matching **Approved** MRs → `Fulfilled` |
| Task (PM) | `update_task` | Any of 4 statuses; no transition matrix |
| Task (worker) | `update_my_task_status` | Pending / In Progress / **Completed**; self-complete allowed |
| Expense | `create_expense` | Instant; no status |
| Budget | `upsert_budget_line` | Instant overwrite |
| Progress | `create_progress_update` | May raise `project.progress` if higher; no PM verify |
| Site report | `create_site_report` | Free-text materials/equipment; `workers_present` integer **not** tied to Attendance |
| Audit | `log_activity` | Mutations logged; **login/logout not logged**; often no before/after values |
| Uploads | `utils/uploads.py` | Size + ext (+ logo MIME); docs trust ext over MIME; local `uploads/` |

**SoD missing on every controlled decision path:** MR review, quote select, PO create, delivery receive, expense, budget, task complete, progress %.

### 1.5 Frontend reality (confirmed page audit)

**Route / role elevation (notable):** Admin is on `/se`, `/worker`, `/tasks`, `/progress` in addition to admin routes — operational break-glass via UI, not oversight-only.

**Duplication clusters (UI):**

| Cluster | Surfaces |
|---------|----------|
| MR create ×3 | `MaterialRequestsPage`, `ProjectDetailPage` Procurement, `MaterialsPage` |
| MR approve ×2 | `MaterialRequestsPage`, `ProjectDetailPage` (role/`can_manage` only — no self-approve UI guard) |
| Procurement mutations vs lists | Writes only on `ProjectDetailPage`; `/quotations|purchase-orders|deliveries` read-only |
| Progress / site diary | Create: `ProgressUpdatesPage`, `SiteReportsPage`; Project tabs Progress/Reports view-only |
| Settings / company | `SettingsPage` shell + `CompanyProfilePage` edit |
| Worker thin pages | `WorkerProgressPage` (no writes); `WorkerDocumentsPage` (download index of Task Detail uploads) |

**Design system today:**

- Light tokens only in `styles/main.css` (semantic success/warning/danger present).
- Shared UI almost only `PageChrome.tsx` (hero, metrics, FilterTabs, StatusPill, ProgressBar, QuickActions).
- **Missing:** LoadingButton, EmptyState, ConfirmDialog, Toast, Skeleton, StatusBadge with icon+text, dark theme.
- Mixed Bootstrap `Button` / raw `btn` / occasional `Badge` instead of `StatusPill`.
- No CSS for `ready-for-review` / `verified`.

**Frontend permission pattern:** `RoleRoute` string allow-lists + sparse flags (`can_manage`, `can_manage_catalog`) + ad-hoc `user.role` checks. No shared `canApprove` / `canVerify` helpers yet — must consume backend capability flags after Phase A.

**Hotspot:** `ProjectDetailPage.tsx` is the mega-workspace (~890 lines) owning most PM write flows; Progress/Reports tabs are display-only while SE has separate create pages — either make project Site tabs authoritative or remove the duplicate SE create nav after Site Diary merge.

---

## 2. Duplication audit (must fix)

### 2.1 Critical duplicates (same business operation, multiple UIs)

| Function | Implementations found | Problem |
|----------|----------------------|---------|
| **Create material request** | Project Detail → Procurement; `/material-requests`; Materials page “Submit request” | Three create forms |
| **Approve / reject MR** | Project Detail; `/material-requests` | Two approve UIs; backend lacks SoD |
| **Quotations / Prefer / Create PO / Delivery** | Project Detail procurement tab | Lists at `/quotations`, `/purchase-orders`, `/deliveries` are **read-only copies** |
| **Progress entry** | `/progress-updates` (create); Project Detail → Progress (view); Worker `/progress` (aggregate view) | Engineers enter progress separately from site reports |
| **Site diary / daily report** | `/site-reports` (create); Project Detail → Reports (view) | Overlaps ProgressUpdate fields (activities, problems, next) |
| **Company settings** | `/settings` (read-only hub) + `/company` (edit) | Two pages for one concern |
| **Worker documents** | Task Detail → Photos (upload); `/documents` worker list (download index) | Upload vs index split OK; index is thin duplicate |
| **Today’s tasks** | Worker Dashboard + My Tasks → Today | Acceptable if dashboard is preview only |

### 2.2 Acceptable “reference” surfaces (keep as links, not second workflows)

- Role dashboards → shortcuts to authoritative pages  
- Notifications → deep-links  
- Project Detail **view** tabs for items authored elsewhere (if create lives in one place)  
- Formal `/reports` analytics vs Site Diary (different purpose — **keep separate**)

### 2.3 Not duplicated / keep standalone

- Equipment allocate / return / maintenance  
- Users CRUD  
- Formal Reports + PDF  
- Worker Task Detail (execution surface)  
- Attendance record (SE) vs My Attendance (worker view) — **role gate, not duplicate workflow**

---

## 3. Permission & SoD gaps (security)

| Check | Today | Required |
|-------|-------|----------|
| Role on route / API | Yes (`roles_required`) | Keep |
| Project membership / ownership | Yes (`project_access`) | Keep / tighten |
| Creator ≠ approver (MR) | **Missing** in `review_material_request` | Must add |
| PM creating then approving own MR | Possible (PM can create + `assert_can_manage` approve) | Block |
| Expense submit ≠ approve | N/A (no approval) | Add workflow |
| Budget silent edit | `upsert_budget_line` any manager | Revision + approve |
| Worker “Completed” = official done | Worker can set Completed | Change to Ready for Review; SE verifies |
| Admin site/worker elevation | Admin on SE + Worker routes | Narrow Admin to oversight; no routine site writes (or auditable break-glass) |
| State-gated actions | Partial (e.g. completed project protection) | Expand to all workflows |
| Frontend-only hiding | Buttons often role-based | Backend remains source of truth; UI consumes capability flags |

**Existing strength:** `can_manage_project` / `can_operate_site` / project editable checks — extend into `can_*` helpers rather than inventing a new auth system.

---

## 4. Function ownership map (proposed authoritative locations)

> Rule: **ONE BUSINESS FUNCTION → ONE AUTHORITATIVE WORKFLOW → ONE AUTHORITATIVE UI.**  
> Other pages may **link**, never re-implement.

| Function | Owner role(s) | Authoritative UI | Create | Approve / Verify | States (target) | Notify | Audit |
|----------|---------------|------------------|--------|------------------|-----------------|--------|-------|
| Manage users | Admin | Users | Admin | — | Active/Inactive | Optional | Yes |
| Company / app settings | Admin | **Settings** (merge Company) | Admin | — | — | — | Yes |
| Create / edit project | PM (Admin oversight) | Projects → Form | PM/Admin | — | Project lifecycle | Team | Yes |
| Project overview | PM/SE (scoped) | **Project → Overview** | — | — | — | — | — |
| Create / plan task | PM | **Project → Tasks** | PM | — | Task lifecycle | Assignee | Yes |
| Execute task / evidence | Worker | **Task Detail** | Notes/evidence | — | → Ready for Review | SE | Yes |
| Verify task | SE | **Project → Tasks** (or Task verify action) | — | SE verify | → Verified | Worker | Yes |
| Milestones | PM | **Project → Milestones** | PM | Complete | — | — | Yes |
| Team assign | PM | **Project → Team** | PM | — | — | Member | Yes |
| Attendance record | SE | **Project → Site → Attendance** *(or keep `/attendance` as project-filtered SE tool that deep-links)* | SE | — | Present/Absent/Late | — | Yes |
| View own attendance | Worker | Worker Attendance | — | — | — | — | — |
| Site Diary (merged progress+report) | SE | **Project → Site → Diary** | SE | — | Dated entries | PM | Yes |
| Material request | SE (create) | **Procurement → Requests** *(module; project-scoped filter)* | SE | PM/Admin (≠ creator) | Full MR lifecycle | PM/creator | Yes |
| Quotation | PM / optional Procurement | **Procurement → Quotations** | PM | Prefer | — | — | Yes |
| Purchase order | PM / optional Procurement | **Procurement → Purchase Orders** | PM | — | PO statuses | — | Yes |
| Delivery / receive | SE or PM | **Procurement → Deliveries** | Receiver | — | Updates stock + MR | — | Yes |
| Stock / usage | SE | **Procurement → Stock / Usage** | SE | — | Transactions | Low stock | Yes |
| Equipment | SE | Equipment | SE | — | Available/… | — | Yes |
| Expense submit | PM (MVP) / SE later | **Project → Expenses** | Submitter | PM/Admin ≠ creator | Approval states | Approver | Yes |
| Budget baseline / revision | PM | **Project → Budget** | PM | Admin/second approver | Revision states | — | Yes |
| Documents | SE/PM | **Project → Documents** | Uploaders | — | — | — | Yes |
| Formal reports | PM/Admin | Reports | Generate | — | — | — | — |
| Notifications | All | Notifications | System | — | Read/unread | — | — |
| Activity log | Admin global; PM/SE scoped | Activity Log | System | — | — | — | Self |

### Adjustments vs the brief’s sample table

- **Attendance:** Spec says Project → Attendance. Current strong page is `/attendance`. **Plan:** keep `/attendance` as SE operational page with **required project filter**, and add a Project → Site tab that **links** to it pre-filtered (no second form).  
- **Procurement:** Spec wants a Procurement & Materials module. Current mutations live in Project Detail. **Plan:** **Project → Procurement** remains the write workspace for a single project; top-level Procurement nav becomes **cross-project queue** (filter/list + open project context) — not a third create form.  
- **Site Diary:** Merge Progress Updates + Site Reports into one diary model/UI over time; temporary bridge: one SE “Site Diary” page writing one API that can populate both until migration.  
- **Optional Procurement Officer:** **Out of MVP.** Admin/PM continue procurement duties; design `can_procure` permission hook for later.

---

## 5. Target information architecture (navigation)

### Administrator
Dashboard · Projects · Users · Procurement (oversight queues) · Reports · Documents (optional) · Notifications · Activity Log · Settings  

**Remove from routine Admin ops:** Worker task board, SE dashboards as primary work, creating site diary / attendance in normal UI (break-glass only if kept, fully audited).

### Project Manager
Dashboard · Projects · Procurement · Reports · Notifications · Activity Log  

*(Attendance / Materials / Equipment reachable from Project → Site / Procurement deep-links, not as duplicate top-level CRUD.)*

### Site Engineer
Dashboard · Projects · Attendance · Procurement (Stock + Requests create) · Equipment · Site Diary · Documents · Notifications · Activity Log  

### Worker
Dashboard · My Tasks · Attendance · Notifications  

**Remove:** Worker Progress page (fold into Dashboard); Worker Documents sidebar (keep downloads on Task Detail).

---

## 6. Workflow redesign (backend-first)

### 6.1 Task (high priority, feasible)

**Today:** Worker sets `Completed`.  
**Target:**

```
Pending (Assigned) → In Progress → Ready for Review → Verified
                                         ↘ Cancelled
```

- Worker allowed: Pending → In Progress → Ready for Review (+ notes/evidence).  
- SE (project site engineer / can_operate_site): Ready for Review → Verified.  
- PM may replan / cancel while not Verified.  
- Map legacy `Completed` → `Verified` in migration.

### 6.2 Material request (high priority)

**Today:** Pending → Approved/Rejected/Fulfilled; no SoD.  

**MVP feasible subset** (avoid over-building 10 states day one):

```
Pending → Approved | Rejected | Returned
Approved → Ordered (when PO created) → Received/Fulfilled (on delivery)
```

Full DRAFT/SUBMITTED/PARTIALLY_RECEIVED can follow once MVP SoD + state gates work.

**Must-have backend rules:**
- `requested_by_id != actor.id` on approve/reject  
- Only Pending (or Returned) reviewable  
- Already processed → clear business error  

### 6.3 Expense (medium)

Add `status`: Draft/Submitted/Approved/Rejected.  
Only Approved amounts roll into official actuals/reports.  
Approver ≠ `recorded_by_id`.

### 6.4 Budget (medium)

- Freeze “approved” category amounts.  
- `BudgetRevision` (or revision fields) requiring approval.  
- Show original / current / committed / actual / remaining / variance (committed ≈ open POs; actual ≈ approved expenses + delivered materials cost if available).

### 6.5 Site Diary (medium–high UX value)

Unify ProgressUpdate + SiteReport into **SiteDiaryEntry** (or one write API dual-writing during transition):

Date, activities, workers present, progress %, materials/equipment used, problems, safety, photos, notes, next activities.

Deprecate separate SE nav items in favour of **Site Diary**.

### 6.6 Project lifecycle

Align labels: Planned≈PLANNING; add Closed if needed; gate edits when Completed/Closed (already partially done).

---

## 7. UI / UX / design system plan (after backend)

### 7.1 Action hierarchy
Per page: one primary CTA; secondary filters/export; tertiary utilities; destructive visually distinct + confirm.

### 7.2 Shared components to expand
Buttons (variants), StatusBadge (text+icon, not colour-only), EmptyState, ConfirmDialog, Toast, PageHeader, FilterBar, Skeleton, LoadingButton.

### 7.3 Themes
Add intentional **light + dark** via `[data-theme=dark]` tokens (not invert). Persist preference in Settings / localStorage.

### 7.4 Feedback
LoadingButton states; toasts for success; inline errors with recovery; empty states with permission-aware CTA.

### 7.5 Mobile
Worker + SE flows first: large touch targets, bottom-friendly actions on Task Detail, responsive tables → cards.

### 7.6 Files
Audit uploads (type/size/MIME/filename). Keep local `uploads/` for school/demo; document production object-storage swap without rewriting domain logic.

---

## 8. Phased implementation plan

### Phase A — Foundations (no user-visible IA break)
1. Introduce shared `permissions` / `workflows` helpers (`can_approve_material_request`, `can_verify_task`, …).  
2. Enforce SoD + state checks on existing MR review + task status APIs.  
3. Capability flags on API responses for UI (`can_approve`, `can_verify`, …).  
4. Tests for SoD and direct API bypass attempts.

### Phase B — Deduplicate UI (IA)
1. Merge Settings + Company.  
2. Remove create-MR from Materials page; link to authoritative Requests.  
3. Procurement list pages become queues → open Project Procurement (no parallel create).  
4. Worker: remove/fold Progress page; dashboards = summary + links only.  
5. Update `ROLE_NAV` + sidebar labels.

### Phase C — Task verification workflow
1. DB migration for new task statuses.  
2. Worker UI: Start / Update / Ready for Review (not Mark Complete as final).  
3. SE verify action on Project Tasks / task review queue.  
4. Notifications + audit.

### Phase D — Site Diary consolidation
1. Design diary API; migrate or dual-write.  
2. Single SE diary UI; Project Site tab.  
3. Retire duplicate Progress Updates / Site Reports nav entries.

### Phase E — Expense + budget controls
1. ~~Expense status + approval.~~ **Done** (Pending → Approved/Rejected; SoD).  
2. ~~Budget revision workflow.~~ **Done** (propose pending amount; approve/reject by another manager).  
3. ~~Reports use approved figures only.~~ **Done** (workspace actuals + financial reports).

### Phase F — Design system + dark mode + UX polish
1. ~~Tokens, components, status language.~~ **Done** (`StatusBadge` with icon+text, `EmptyState`, `LoadingButton`, `ConfirmDialog`).  
2. ~~Dark mode.~~ **Done** (dark-only UI; light theme removed).  
3. ~~Empty/loading/confirm pass on primary flows.~~ **Done** (projects empty state; shared feedback components).  
4. ~~Accessibility pass (focus, labels, non-colour status).~~ **Done** (status icons; theme control labels; larger mobile touch targets).  
5. Bonus: Milestones / Budgets / Expenses hub pages deep-link into project tabs.

### Phase G — Hardening
1. ~~Admin privilege narrowing.~~ **Done** (no worker/SE dashboard routes; `can_operate_site` excludes Admin).  
2. ~~Upload validation hardening.~~ **Done** (path/MIME/magic/size; logo size cap).  
3. ~~Full role matrix tests (UI + API).~~ **Done** (`tests/test_role_matrix.py`).  
4. ~~Update `ROLE_FUNCTIONALITY_REPORT.md` to match final system.~~ **Done**.

---

## 9. Feasibility cuts (explicit non-goals for MVP refactor)

| Spec item | Decision |
|-----------|----------|
| Full 10-state MR machine day one | **Defer** partial states; ship SoD + core states first |
| Procurement Officer role | **Optional later**; permission hook only |
| GPS / payroll / BIM / IoT | **Out of scope** |
| Enterprise approval limits matrix | Simple SoD first; limits later if needed |
| Object storage | Document adapter; keep local files for current deployment |
| Rebuild all pages from scratch | **No** — merge and extend |

---

## 10. Conflict register (spec vs current — deliberate refactors)

| # | Conflict | Resolution |
|---|----------|------------|
| 1 | Worker can Complete tasks | Change to Ready for Review + SE Verified |
| 2 | Expenses instantly count | Add approval; reports use approved only |
| 3 | Budget freely editable | Revision workflow |
| 4 | MR creator can be PM who also approves | Block self-approval; prefer SE create |
| 5 | Admin on worker/SE operational routes | Narrow; oversight dashboards + audit |
| 6 | ProgressUpdate ≠ SiteReport | Merge into Site Diary |
| 7 | Triple MR create UIs | Single Requests workflow |
| 8 | Settings vs Company | Merge |
| 9 | Project statuses naming | Map Planned↔Planning; add Closed carefully |
| 10 | Dark mode absent | Add in Phase F |

---

## 11. Testing matrix (when implementation starts)

- Auth: login/logout/session/CSRF  
- Each role: nav, deep URL, API deny  
- MR: create → approve/reject/return → cannot self-approve → double-process error  
- Task: worker ready → SE verify → worker cannot verify  
- Expense/budget once built  
- No duplicate create forms remain  
- Light/dark, mobile worker task flow  
- Audit rows for controlled actions  

---

## 12. Final quality checklist (exit criteria)

Use the brief’s §38 checklist. Minimum bar to call refactor “done for MVP”:

- [ ] One authoritative UI per business operation (no triple MR create)  
- [ ] Backend SoD + state gates for MR and tasks  
- [ ] Worker cannot officially complete without SE verify  
- [ ] Settings consolidated  
- [ ] Dashboards are summaries + links  
- [ ] Site Diary path defined (merged or transitional single entry)  
- [ ] Shared status/button patterns; meaningful feedback on primary flows  
- [ ] Dark mode usable  
- [ ] Tests cover authorization bypass attempts  
- [ ] Docs updated (`ROLE_FUNCTIONALITY_REPORT.md`)

---

## 13. Recommended next step (awaiting your approval)

**Do not start coding all phases at once.**

Proposed first implementation slice after you approve this plan:

**Slice 1 (Phase A+B partial):**  
1) Backend SoD + state checks for material requests  
2) Task Ready-for-Review / Verified API  
3) Remove duplicate MR create from Materials; merge Settings+Company  
4) Update nav ownership  

Reply with approval or amendments (especially on: Admin break-glass access, whether Attendance stays top-level for SE, and how aggressive Site Diary merge should be in MVP).
