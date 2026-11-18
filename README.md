# PMO Project Portfolio Management System

## 1. Project Overview
The **PMO Project Portfolio Management System** is an enterprise-grade, organization-agnostic Project Management Office (PMO) web application for managing strategic portfolios, cross-departmental initiatives, project workspaces, schedules, and task execution.

### Core Capabilities
- **Organizational Hierarchy:** Supports a structured hierarchy (`Department → Portfolio → Initiative → Project → Workstreams → Milestones → Activities → Subtasks`).
- **Role-Based Access & Authentication:** Supports `PMO Manager`, `Project Manager`, and `Team Member` roles with appropriate operational permissions.
- **Project Planning Workspace:** Provides dedicated views for each project including **Overview**, **Workstreams**, **Milestones**, **Activities & Subtasks**, **Gantt Schedule**, **Monthly Planning Calendar**, and **Kanban Board**.
- **Task Dependencies & Validation:** Supports Finish-to-Start (`FinishToStart`) predecessor/successor relationships with server-side validation preventing self-dependencies and circular relationships.
- **Automated Progress Roll-Up:** Automatically recalculates parent activity progress from subtasks, workstream progress from assigned activities, and overall project progress.
- **Bilingual Support (English & Arabic):** Full LTR and RTL layout switching across all views, forms, tables, and charts.

---

## 2. Architecture & Technology Stack
```
Angular 18 Frontend (Port 4200)
        ↓  RESTful HTTP / JSON
ASP.NET Core 8.0 Web API (Port 5000)
        ↓  Entity Framework Core 8.0 (SQL Server Provider)
Microsoft SQL Server LocalDB ((localdb)\MSSQLLocalDB • Database: PMO Agile • Windows Auth)
```

### Timeline, Calendar & Board Implementation
The **Gantt Schedule**, **Monthly Planning Calendar**, and **Kanban Board** are implemented using maintainable, zero-dependency Angular/TypeScript components backed by CSS Grid and SVG timeline calculations.

---

## 3. Project Structure
```
/
├── start-project.bat                # Dynamic local Windows launcher for Backend + Frontend
├── stop-project.bat                 # Safe process stopper for Backend + Frontend
├── README.md                        # System documentation, setup, and verification guide
├── database/
│   └── schema_and_seed.sql          # Microsoft SQL Server T-SQL DDL schema (10 tables) and initial seed data
├── backend/
│   └── PmoSystem.Api/
│       ├── PmoSystem.Api.csproj     # .NET 8 Web API project file
│       ├── Program.cs               # DI, CORS, Swagger, and EF Seeder startup
│       ├── appsettings.json         # SQL Server LocalDB connection string & CORS config
│       ├── Models/
│       │   └── Entities.cs          # Role, User, Department, Portfolio, Initiative, Project, Workstream, Milestone, Activity, TaskDependency
│       ├── DTOs/
│       │   └── PmoDtos.cs           # Request/Response DTOs with DataAnnotations validation
│       ├── Data/
│       │   ├── PmoDbContext.cs      # EF Core DbContext & Fluent API relationships
│       │   └── DbSeeder.cs          # Automatic database initialization & seed data
│       ├── Migrations/
│       │   ├── 20261004000000_InitialCreate.cs
│       │   └── 20261004050000_AddPlanningAndMonitoringEntities.cs
│       ├── Repositories/
│       │   └── GenericRepository.cs # Generic EF Core repository pattern
│       ├── Services/
│       │   └── PmoService.cs        # Business logic, progress roll-up engine & dashboard metrics
│       └── Controllers/
│           └── PmoControllers.cs    # REST API controllers (Auth, Dashboard, Departments, Portfolios, Initiatives, Projects, Workstreams, Milestones, Activities, Dependencies)
└── frontend/
    ├── package.json                 # Angular 18 dependencies & scripts
    ├── angular.json                 # Angular CLI workspace configuration
    ├── tsconfig.json                # TypeScript configuration
    └── src/
        ├── environments/
        │   └── environment.ts       # Central API URL configuration (http://localhost:5000/api)
        └── app/
            ├── models/
            │   └── pmo.models.ts    # TypeScript interfaces for domain entities
            ├── services/
            │   └── pmo-api.service.ts # Central REST API communication service
            ├── app.component.ts     # Application controller & Project Workspace views
            └── app.component.html   # Responsive template with English/Arabic RTL support
```

---

## 4. Database Entities & Schema

### Relational Tables (10 Entities)
1. `Roles` — PMO Manager, Project Manager, Team Member
2. `Users` — Organizational user accounts
3. `Departments` — IT, Finance, HR, Operations, Marketing
4. `Portfolios` — Strategic investment portfolios
5. `Initiatives` — Cross-department strategic initiatives
6. `Projects` — Deliverable projects under initiatives
7. `Workstreams` — Functional execution tracks inside a project (Requirements, UI/UX Design, Backend, Frontend, Testing, Deployment)
8. `Milestones` — Key project checkpoints (`Planned`, `In Progress`, `Completed`, `Delayed`) with `PlannedDate` and `ActualDate`
9. `Activities` — Project tasks supporting `WorkstreamId`, `MilestoneId`, and self-referencing `ParentActivityId` for **Subtasks**
10. `TaskDependencies` — Stores `PredecessorTaskId`, `SuccessorTaskId`, and `DependencyType` (`FinishToStart`)

### Applying Database Migrations
From `backend/PmoSystem.Api`:
```bash
dotnet ef database update
```
Or run `database/schema_and_seed.sql` directly against `(localdb)\MSSQLLocalDB` (`PMO Agile`), or simply start the backend (`DbSeeder.SeedAsync()` automatically creates and seeds all tables if the database is empty).

---

## 5. Progress Calculation Method
All progress calculations are performed deterministically on the backend whenever an activity or subtask changes:
1. **Parent Task Progress from Subtasks:**
   - When a parent activity has subtasks, its `ProgressPercentage` is calculated as the average of its subtasks' progress percentages (e.g., 4 subtasks where 2 are `Completed` [100%] and 2 are `Not Started` [0%] = **50%**).
   - If all subtasks are `Completed`, the parent activity status automatically becomes `Completed` (100%).
2. **Workstream Progress:**
   - Calculated as the average `ProgressPercentage` of all top-level activities assigned to that workstream.
3. **Overall Project Progress:**
   - Calculated as the average `ProgressPercentage` of all top-level activities within the project.

---

## 6. REST API Endpoints
- `POST /api/auth/login` & `GET /api/auth/users`
- `GET /api/dashboard` — Returns executive KPIs, status distributions, overdue alerts, and milestone summaries
- `GET|POST|PUT|DELETE /api/departments`
- `GET|POST|PUT|DELETE /api/portfolios`
- `GET|POST|PUT|DELETE /api/initiatives`
- `GET|POST|PUT|DELETE /api/projects`
- `GET|POST|PUT|DELETE /api/workstreams?projectId=&status=&search=`
- `GET|POST|PUT|DELETE /api/milestones?projectId=&workstreamId=&status=&search=`
- `GET|POST|PUT|DELETE /api/activities?projectId=&workstreamId=&milestoneId=&assignedUserId=&status=&priority=&search=`
- `GET|POST|DELETE /api/dependencies?projectId=` — Validates against self-dependency and circular links

---

## 7. Running & Stopping Locally on Windows
- **Start:** Double-click `start-project.bat` or run `.\start-project.bat` from the terminal.
  - Dynamically detects the repository root directory using `%~dp0` (no hardcoded paths).
  - Verifies `.NET 8.0 SDK`, `Node.js`, and `npm` installations.
  - Automatically runs `npm install` in `frontend` if `node_modules` is missing.
  - Launches Backend API (`http://localhost:5000`), Swagger UI (`http://localhost:5000/swagger`), and Angular Frontend (`http://localhost:4200`).
- **Stop:** Run `.\stop-project.bat` to cleanly terminate both backend and frontend processes.

---

## 8. Verification Guide
1. **Executive Dashboard:** Sign in as `pmo.admin` (`Pass123!`) and inspect the KPI cards, *Milestone Checkpoints*, *Projects with Overdue Activities*, *Workstream Breakdown*, and *Status Distribution*.
2. **Project Planning Workspace:** Open **Project Workspace** (or click any project row) and test all 7 tabs for **Customer Portal Implementation**:
   - **Overview:** Check overall calculated progress, workstream bars, and the Milestone Progress tracker.
   - **Workstreams:** Create, edit, or delete workstreams and view automatic progress roll-ups.
   - **Milestones:** Create or update project milestones (`Planned`, `In Progress`, `Completed`, `Delayed`).
   - **Activities & Subtasks:** Expand `Prepare Requirements Document` or `Develop Angular Self-Service Portal Views` to toggle subtasks, add a new subtask, or add/remove Predecessor/Successor dependencies.
   - **Gantt Schedule:** Inspect the visual timeline of Workstreams, Activities, Subtasks, Diamond Milestones, and Predecessor links.
   - **Calendar View:** Navigate months (`2026`) and filter by Workstream, Assigned User, or Status to inspect scheduled tasks and milestones.
   - **Kanban Board:** Move any card between `Not Started`, `In Progress`, and `Completed` and observe immediate persistence and project progress recalculation.
