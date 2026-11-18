using Microsoft.EntityFrameworkCore;
using PmoSystem.Api.Models;

namespace PmoSystem.Api.Data;

public static class DbSeeder
{
    private static async Task InsertWithIdentityAsync<TEntity>(
        PmoDbContext context,
        string tableName,
        IEnumerable<TEntity> entities) where TEntity : class
    {
        await context.Set<TEntity>().AddRangeAsync(entities);
        await context.Database.ExecuteSqlRawAsync($"SET IDENTITY_INSERT [dbo].[{tableName}] ON");
        try
        {
            await context.SaveChangesAsync();
        }
        finally
        {
            await context.Database.ExecuteSqlRawAsync($"SET IDENTITY_INSERT [dbo].[{tableName}] OFF");
        }
    }

    public static async Task SeedAsync(PmoDbContext context)
    {
        await context.Database.EnsureCreatedAsync();

        await context.Database.OpenConnectionAsync();
        try
        {
            using var transaction = await context.Database.BeginTransactionAsync();

            // Organizational Hierarchy Seeding
            if (!await context.Roles.AnyAsync())
            {
                var roles = new List<Role>
                {
                    new() { Id = 1, Name = "PMO Manager", Description = "Full oversight of departments, portfolios, initiatives, projects, and governance." },
                    new() { Id = 2, Name = "Project Manager", Description = "Manages assigned initiatives, projects, schedules, and task allocations." },
                    new() { Id = 3, Name = "Team Member", Description = "Executes project activities/tasks and updates task progress and status." }
                };
                await InsertWithIdentityAsync(context, "Roles", roles);

                var users = new List<User>
            {
                new() { Id = 1, FullName = "Elena Vance", Email = "elena.vance@enterprise.org", Username = "pmo.admin", PasswordHash = "Pass123!", RoleId = 1, IsActive = true },
                new() { Id = 2, FullName = "Marcus Sterling", Email = "marcus.sterling@enterprise.org", Username = "m.sterling", PasswordHash = "Pass123!", RoleId = 2, IsActive = true },
                new() { Id = 3, FullName = "Clara Chen", Email = "clara.chen@enterprise.org", Username = "c.chen", PasswordHash = "Pass123!", RoleId = 2, IsActive = true },
                new() { Id = 4, FullName = "David Alverez", Email = "david.alverez@enterprise.org", Username = "d.alverez", PasswordHash = "Pass123!", RoleId = 3, IsActive = true },
                new() { Id = 5, FullName = "Sophia Patel", Email = "sophia.patel@enterprise.org", Username = "s.patel", PasswordHash = "Pass123!", RoleId = 3, IsActive = true },
                new() { Id = 6, FullName = "Liam O'Connor", Email = "liam.oconnor@enterprise.org", Username = "l.oconnor", PasswordHash = "Pass123!", RoleId = 3, IsActive = true },
                new() { Id = 7, FullName = "Hamada El Daley", Email = "hamadamanus2@gmail.com", Username = "Hamada El Daley", PasswordHash = "PMO@2026@@", RoleId = 1, IsActive = true }
            };
                await InsertWithIdentityAsync(context, "Users", users);

                var departments = new List<Department>
                {
                    new() { Id = 1, Name = "IT", Description = "Information Technology, Enterprise Architecture, Cloud Infrastructure, and Cybersecurity.", IsActive = true },
                    new() { Id = 2, Name = "Finance", Description = "Corporate Finance, Financial Planning & Analysis, Accounting, and Treasury.", IsActive = true },
                    new() { Id = 3, Name = "HR", Description = "Human Resources, Talent Acquisition, Organizational Development, and People Operations.", IsActive = true },
                    new() { Id = 4, Name = "Operations", Description = "Global Supply Chain, Facilities, Logistics, and Core Business Operations.", IsActive = true },
                    new() { Id = 5, Name = "Marketing", Description = "Brand Strategy, Digital Customer Acquisition, Product Marketing, and Communications.", IsActive = true }
                };
                await InsertWithIdentityAsync(context, "Departments", departments);

            var portfolios = new List<Portfolio>
            {
                new()
                {
                    Id = 1,
                    Name = "Digital Transformation Portfolio",
                    Description = "Modernizing core enterprise platforms, cloud infrastructure, and customer-facing digital touchpoints.",
                    DepartmentId = 1,
                    OwnerId = 1,
                    StartDate = new DateTime(2026, 1, 1),
                    EndDate = new DateTime(2026, 12, 31),
                    Status = "Active"
                },
                new()
                {
                    Id = 2,
                    Name = "Financial Governance & ERP Modernization",
                    Description = "Automating financial reporting, audit readiness, and ERP ledger consolidation.",
                    DepartmentId = 2,
                    OwnerId = 1,
                    StartDate = new DateTime(2026, 2, 1),
                    EndDate = new DateTime(2026, 11, 30),
                    Status = "Active"
                },
                new()
                {
                    Id = 3,
                    Name = "Operational Excellence & Supply Resilience",
                    Description = "Optimizing warehouse fulfillment, procurement workflows, and regional logistics.",
                    DepartmentId = 4,
                    OwnerId = 2,
                    StartDate = new DateTime(2026, 1, 15),
                    EndDate = new DateTime(2026, 10, 31),
                    Status = "Active"
                },
                new()
                {
                    Id = 4,
                    Name = "Workforce Empowerment & Talent Growth",
                    Description = "Next-generation employee onboarding, continuous learning, and hybrid workplace enablement.",
                    DepartmentId = 3,
                    OwnerId = 3,
                    StartDate = new DateTime(2026, 3, 1),
                    EndDate = new DateTime(2026, 12, 15),
                    Status = "Planning"
                }
            };
                await InsertWithIdentityAsync(context, "Portfolios", portfolios);

            var initiatives = new List<Initiative>
            {
                new()
                {
                    Id = 1,
                    Name = "Customer Service Initiative",
                    Description = "Unified omnichannel customer self-service and ticket resolution platform.",
                    DepartmentId = 1,
                    PortfolioId = 1,
                    OwnerId = 2,
                    StartDate = new DateTime(2026, 1, 15),
                    TargetDate = new DateTime(2026, 11, 30),
                    Status = "In Progress",
                    Priority = "High",
                    ProgressPercentage = 62
                },
                new()
                {
                    Id = 2,
                    Name = "Cloud Data Platform Migration",
                    Description = "Consolidating legacy on-premise databases into a governed enterprise data warehouse.",
                    DepartmentId = 1,
                    PortfolioId = 1,
                    OwnerId = 3,
                    StartDate = new DateTime(2026, 2, 1),
                    TargetDate = new DateTime(2026, 11, 15),
                    Status = "In Progress",
                    Priority = "Critical",
                    ProgressPercentage = 50
                },
                new()
                {
                    Id = 3,
                    Name = "Automated Expense & Treasury Control",
                    Description = "Real-time spend analytics and automated invoice reconciliation.",
                    DepartmentId = 2,
                    PortfolioId = 2,
                    OwnerId = 2,
                    StartDate = new DateTime(2026, 2, 10),
                    TargetDate = new DateTime(2026, 8, 31),
                    Status = "Completed",
                    Priority = "High",
                    ProgressPercentage = 100
                },
                new()
                {
                    Id = 4,
                    Name = "Smart Warehouse & Inventory Tracking",
                    Description = "IoT-enabled inventory tracking and automated reorder forecasting across regional hubs.",
                    DepartmentId = 4,
                    PortfolioId = 3,
                    OwnerId = 3,
                    StartDate = new DateTime(2026, 1, 20),
                    TargetDate = new DateTime(2026, 10, 28),
                    Status = "In Progress",
                    Priority = "High",
                    ProgressPercentage = 55
                },
                new()
                {
                    Id = 5,
                    Name = "Brand Experience & Analytics Revamp",
                    Description = "Multi-touch attribution modeling and unified customer journey analytics.",
                    DepartmentId = 5,
                    PortfolioId = 1,
                    OwnerId = 2,
                    StartDate = new DateTime(2026, 4, 1),
                    TargetDate = new DateTime(2026, 12, 1),
                    Status = "In Progress",
                    Priority = "Medium",
                    ProgressPercentage = 30
                },
                new()
                {
                    Id = 6,
                    Name = "Continuous Learning & Leadership Academy",
                    Description = "Digital competency framework and role-based certification tracks.",
                    DepartmentId = 3,
                    PortfolioId = 4,
                    OwnerId = 3,
                    StartDate = new DateTime(2026, 3, 15),
                    TargetDate = new DateTime(2026, 11, 30),
                    Status = "Not Started",
                    Priority = "Medium",
                    ProgressPercentage = 10
                }
            };
                await InsertWithIdentityAsync(context, "Initiatives", initiatives);

            var projects = new List<Project>
            {
                new()
                {
                    Id = 1,
                    Name = "Customer Portal Implementation",
                    Description = "Self-service web portal allowing customers to manage subscriptions, billing, and support requests.",
                    InitiativeId = 1,
                    ProjectManagerId = 2,
                    StartDate = new DateTime(2026, 1, 20),
                    EndDate = new DateTime(2026, 11, 15),
                    Status = "In Progress",
                    Priority = "High",
                    ProgressPercentage = 58
                },
                new()
                {
                    Id = 2,
                    Name = "Service Desk Ticketing Integration",
                    Description = "Bi-directional synchronization between customer support queues and engineering issue tracking.",
                    InitiativeId = 1,
                    ProjectManagerId = 3,
                    StartDate = new DateTime(2026, 3, 1),
                    EndDate = new DateTime(2026, 10, 25),
                    Status = "In Progress",
                    Priority = "Medium",
                    ProgressPercentage = 50
                },
                new()
                {
                    Id = 3,
                    Name = "Core ETL Pipeline Modernization",
                    Description = "Building resilient data ingestion pipelines for daily operational reporting.",
                    InitiativeId = 2,
                    ProjectManagerId = 3,
                    StartDate = new DateTime(2026, 2, 15),
                    EndDate = new DateTime(2026, 10, 20),
                    Status = "In Progress",
                    Priority = "Critical",
                    ProgressPercentage = 50
                },
                new()
                {
                    Id = 4,
                    Name = "Automated Invoice Matching Engine",
                    Description = "Three-way matching automation between purchase orders, goods receipts, and vendor invoices.",
                    InitiativeId = 3,
                    ProjectManagerId = 2,
                    StartDate = new DateTime(2026, 2, 15),
                    EndDate = new DateTime(2026, 7, 31),
                    Status = "Completed",
                    Priority = "High",
                    ProgressPercentage = 100
                },
                new()
                {
                    Id = 5,
                    Name = "Regional Hub Barcode & RFID Rollout",
                    Description = "Hardware deployment and WMS integration for real-time pallet scanning.",
                    InitiativeId = 4,
                    ProjectManagerId = 3,
                    StartDate = new DateTime(2026, 2, 1),
                    EndDate = new DateTime(2026, 10, 29),
                    Status = "In Progress",
                    Priority = "High",
                    ProgressPercentage = 55
                },
                new()
                {
                    Id = 6,
                    Name = "Unified Web Analytics Tagging",
                    Description = "Standardized event taxonomy across all public web properties.",
                    InitiativeId = 5,
                    ProjectManagerId = 2,
                    StartDate = new DateTime(2026, 4, 10),
                    EndDate = new DateTime(2026, 11, 30),
                    Status = "On Hold",
                    Priority = "Medium",
                    ProgressPercentage = 0
                },
                new()
                {
                    Id = 7,
                    Name = "Onboarding Portal & Checklist Automation",
                    Description = "Automated Day-1 provisioning and training schedule for new hires.",
                    InitiativeId = 6,
                    ProjectManagerId = 3,
                    StartDate = new DateTime(2026, 4, 1),
                    EndDate = new DateTime(2026, 11, 25),
                    Status = "Planned",
                    Priority = "Low",
                    ProgressPercentage = 0
                }
            };
                await InsertWithIdentityAsync(context, "Projects", projects);
            }

        // Project Execution Seeding (Workstreams, Milestones, Activities, Subtasks, and Dependencies)
        if (!await context.Workstreams.AnyAsync())
        {
            var workstreams = new List<Workstream>
            {
                // Project 1: Customer Portal Implementation Workstreams
                new() { Id = 1, Name = "Requirements", Description = "Business analysis, stakeholder interviews, and functional specifications.", ProjectId = 1, OwnerId = 2, StartDate = new DateTime(2026, 1, 20), EndDate = new DateTime(2026, 3, 15), Status = "Completed", ProgressPercentage = 100 },
                new() { Id = 2, Name = "UI/UX Design", Description = "Wireframes, interactive prototypes, and design system compliance.", ProjectId = 1, OwnerId = 4, StartDate = new DateTime(2026, 3, 10), EndDate = new DateTime(2026, 5, 15), Status = "Completed", ProgressPercentage = 100 },
                new() { Id = 3, Name = "Backend Development", Description = "REST API microservices, authentication, and billing ledger integration.", ProjectId = 1, OwnerId = 5, StartDate = new DateTime(2026, 5, 1), EndDate = new DateTime(2026, 8, 30), Status = "Completed", ProgressPercentage = 100 },
                new() { Id = 4, Name = "Frontend Development", Description = "Angular customer portal components, responsive views, and state management.", ProjectId = 1, OwnerId = 5, StartDate = new DateTime(2026, 6, 1), EndDate = new DateTime(2026, 10, 10), Status = "In Progress", ProgressPercentage = 75 },
                new() { Id = 5, Name = "Testing & QA", Description = "Integration testing, security audit, and User Acceptance Testing (UAT).", ProjectId = 1, OwnerId = 6, StartDate = new DateTime(2026, 9, 15), EndDate = new DateTime(2026, 10, 30), Status = "In Progress", ProgressPercentage = 25 },
                new() { Id = 6, Name = "Deployment & Cutover", Description = "Production release readiness, DNS cutover, and hypercare support.", ProjectId = 1, OwnerId = 2, StartDate = new DateTime(2026, 11, 1), EndDate = new DateTime(2026, 11, 15), Status = "Planned", ProgressPercentage = 0 },

                // Project 2 & 3 Workstreams
                new() { Id = 7, Name = "Webhook & API Integration", Description = "Queue synchronization and payload transformation.", ProjectId = 2, OwnerId = 3, StartDate = new DateTime(2026, 3, 1), EndDate = new DateTime(2026, 10, 25), Status = "In Progress", ProgressPercentage = 60 },
                new() { Id = 8, Name = "Data Warehouse Schema & ETL", Description = "Staging schemas and automated batch ingestion.", ProjectId = 3, OwnerId = 6, StartDate = new DateTime(2026, 2, 15), EndDate = new DateTime(2026, 10, 20), Status = "In Progress", ProgressPercentage = 50 }
            };
                await InsertWithIdentityAsync(context, "Workstreams", workstreams);

                var milestones = new List<Milestone>
                {
                    // Project 1 Milestones
                    new() { Id = 1, Name = "Requirements Approved", Description = "Formal sign-off on Customer Portal functional requirements.", ProjectId = 1, WorkstreamId = 1, OwnerId = 2, PlannedDate = new DateTime(2026, 3, 15), ActualDate = new DateTime(2026, 3, 14), Status = "Completed" },
                    new() { Id = 2, Name = "Design Completed", Description = "UI/UX design system and customer journey prototypes approved.", ProjectId = 1, WorkstreamId = 2, OwnerId = 4, PlannedDate = new DateTime(2026, 5, 15), ActualDate = new DateTime(2026, 5, 15), Status = "Completed" },
                    new() { Id = 3, Name = "Development Completed", Description = "All backend APIs and Angular portal views feature-complete.", ProjectId = 1, WorkstreamId = 4, OwnerId = 5, PlannedDate = new DateTime(2026, 9, 28), ActualDate = null, Status = "Delayed" },
                    new() { Id = 4, Name = "UAT Completed", Description = "End-to-end user acceptance testing and security audit sign-off.", ProjectId = 1, WorkstreamId = 5, OwnerId = 6, PlannedDate = new DateTime(2026, 10, 28), ActualDate = null, Status = "In Progress" },
                    new() { Id = 5, Name = "Go Live", Description = "Production launch of Customer Portal Implementation.", ProjectId = 1, WorkstreamId = 6, OwnerId = 2, PlannedDate = new DateTime(2026, 11, 15), ActualDate = null, Status = "Planned" },

                    // Project 2 & 3 Milestones
                    new() { Id = 6, Name = "Service Desk Sync Live", Description = "Production cutover of bi-directional ticket sync.", ProjectId = 2, WorkstreamId = 7, OwnerId = 3, PlannedDate = new DateTime(2026, 10, 20), ActualDate = null, Status = "In Progress" },
                    new() { Id = 7, Name = "Core Warehouse Cutover", Description = "Legacy tables retired and reporting pointed to new warehouse.", ProjectId = 3, WorkstreamId = 8, OwnerId = 3, PlannedDate = new DateTime(2026, 10, 18), ActualDate = null, Status = "Planned" }
                };
                await InsertWithIdentityAsync(context, "Milestones", milestones);

            // Parent Activities & Subtasks
            var activities = new List<Activity>
            {
                // Project 1 Parent Tasks
                new() { Id = 1, Name = "Prepare Requirements Document", Description = "Gather and baseline functional and security requirements for Customer Portal.", ProjectId = 1, WorkstreamId = 1, MilestoneId = 1, ParentActivityId = null, AssignedUserId = 4, StartDate = new DateTime(2026, 1, 22), DueDate = new DateTime(2026, 3, 15), Status = "Completed", Priority = "High", ProgressPercentage = 100 },
                new() { Id = 2, Name = "Create Portal Wireframes & Design System", Description = "Interactive Figma prototypes and WCAG contrast validation.", ProjectId = 1, WorkstreamId = 2, MilestoneId = 2, ParentActivityId = null, AssignedUserId = 4, StartDate = new DateTime(2026, 3, 16), DueDate = new DateTime(2026, 5, 15), Status = "Completed", Priority = "High", ProgressPercentage = 100 },
                new() { Id = 3, Name = "Implement Core Billing & Auth APIs", Description = "Build ASP.NET Core endpoints for customer authentication and invoice retrieval.", ProjectId = 1, WorkstreamId = 3, MilestoneId = 3, ParentActivityId = null, AssignedUserId = 5, StartDate = new DateTime(2026, 5, 16), DueDate = new DateTime(2026, 8, 25), Status = "Completed", Priority = "Critical", ProgressPercentage = 100 },
                new() { Id = 4, Name = "Develop Angular Self-Service Portal Views", Description = "Build account dashboard, invoice table, and ticket submission UI.", ProjectId = 1, WorkstreamId = 4, MilestoneId = 3, ParentActivityId = null, AssignedUserId = 5, StartDate = new DateTime(2026, 6, 15), DueDate = new DateTime(2026, 9, 28), Status = "In Progress", Priority = "High", ProgressPercentage = 50 },
                new() { Id = 5, Name = "Execute Security Audit & UAT Cycles", Description = "Run penetration testing and business stakeholder acceptance test cases.", ProjectId = 1, WorkstreamId = 5, MilestoneId = 4, ParentActivityId = null, AssignedUserId = 6, StartDate = new DateTime(2026, 9, 29), DueDate = new DateTime(2026, 10, 28), Status = "In Progress", Priority = "High", ProgressPercentage = 25 },
                new() { Id = 6, Name = "Execute Production Deployment & Cutover", Description = "Deploy containers, run smoke tests, and switch production traffic.", ProjectId = 1, WorkstreamId = 6, MilestoneId = 5, ParentActivityId = null, AssignedUserId = 2, StartDate = new DateTime(2026, 11, 1), DueDate = new DateTime(2026, 11, 15), Status = "Not Started", Priority = "Critical", ProgressPercentage = 0 },

                // Other Projects Parent Tasks
                new() { Id = 7, Name = "Configure Webhook Listeners for Support Escalations", Description = "Create real-time event handlers for high-priority ticket routing.", ProjectId = 2, WorkstreamId = 7, MilestoneId = 6, ParentActivityId = null, AssignedUserId = 4, StartDate = new DateTime(2026, 3, 10), DueDate = new DateTime(2026, 9, 25), Status = "In Progress", Priority = "Medium", ProgressPercentage = 60 },
                new() { Id = 8, Name = "Provision SQL Server Staging & Analytics Schemas", Description = "Establish relational schemas, indexes, and backup policies.", ProjectId = 3, WorkstreamId = 8, MilestoneId = 7, ParentActivityId = null, AssignedUserId = 6, StartDate = new DateTime(2026, 2, 20), DueDate = new DateTime(2026, 5, 30), Status = "Completed", Priority = "Critical", ProgressPercentage = 100 },
                new() { Id = 9, Name = "Migrate Legacy Inventory Tables to Core Warehouse", Description = "Validate data integrity and execute incremental batch transformation.", ProjectId = 3, WorkstreamId = 8, MilestoneId = 7, ParentActivityId = null, AssignedUserId = 5, StartDate = new DateTime(2026, 6, 1), DueDate = new DateTime(2026, 9, 20), Status = "In Progress", Priority = "Critical", ProgressPercentage = 40 },
                new() { Id = 10, Name = "User Acceptance Testing for ERP Invoice Engine", Description = "Sign-off with corporate finance controllers on automated ledger postings.", ProjectId = 4, WorkstreamId = null, MilestoneId = null, ParentActivityId = null, AssignedUserId = 4, StartDate = new DateTime(2026, 6, 1), DueDate = new DateTime(2026, 7, 25), Status = "Completed", Priority = "High", ProgressPercentage = 100 },
                new() { Id = 11, Name = "Calibrate RFID Scanners in Distribution Center North", Description = "Site survey and signal verification across loading docks.", ProjectId = 5, WorkstreamId = null, MilestoneId = null, ParentActivityId = null, AssignedUserId = 6, StartDate = new DateTime(2026, 3, 1), DueDate = new DateTime(2026, 10, 25), Status = "In Progress", Priority = "High", ProgressPercentage = 55 },

                // Subtasks under Task 1 ("Prepare Requirements Document" - 4 subtasks, 4 completed = 100%)
                new() { Id = 12, Name = "Interview stakeholders", Description = "Conduct workshops with Customer Support and Billing leads.", ProjectId = 1, WorkstreamId = 1, MilestoneId = 1, ParentActivityId = 1, AssignedUserId = 4, StartDate = new DateTime(2026, 1, 22), DueDate = new DateTime(2026, 2, 5), Status = "Completed", Priority = "High", ProgressPercentage = 100 },
                new() { Id = 13, Name = "Document requirements", Description = "Draft user stories and acceptance criteria.", ProjectId = 1, WorkstreamId = 1, MilestoneId = 1, ParentActivityId = 1, AssignedUserId = 4, StartDate = new DateTime(2026, 2, 6), DueDate = new DateTime(2026, 2, 20), Status = "Completed", Priority = "High", ProgressPercentage = 100 },
                new() { Id = 14, Name = "Review requirements", Description = "Peer review with architecture and security teams.", ProjectId = 1, WorkstreamId = 1, MilestoneId = 1, ParentActivityId = 1, AssignedUserId = 5, StartDate = new DateTime(2026, 2, 21), DueDate = new DateTime(2026, 3, 5), Status = "Completed", Priority = "Medium", ProgressPercentage = 100 },
                new() { Id = 15, Name = "Obtain approval", Description = "Formal sign-off from Steering Committee.", ProjectId = 1, WorkstreamId = 1, MilestoneId = 1, ParentActivityId = 1, AssignedUserId = 2, StartDate = new DateTime(2026, 3, 6), DueDate = new DateTime(2026, 3, 15), Status = "Completed", Priority = "High", ProgressPercentage = 100 },

                // Subtasks under Task 4 ("Develop Angular Self-Service Portal Views" - 4 subtasks, 2 completed = 50%)
                new() { Id = 16, Name = "Build Customer Login & Session Guard", Description = "Implement JWT interceptor and role guard.", ProjectId = 1, WorkstreamId = 4, MilestoneId = 3, ParentActivityId = 4, AssignedUserId = 5, StartDate = new DateTime(2026, 6, 15), DueDate = new DateTime(2026, 7, 15), Status = "Completed", Priority = "High", ProgressPercentage = 100 },
                new() { Id = 17, Name = "Build Invoice & Statement Download Grid", Description = "Sortable table with PDF statement download.", ProjectId = 1, WorkstreamId = 4, MilestoneId = 3, ParentActivityId = 4, AssignedUserId = 5, StartDate = new DateTime(2026, 7, 16), DueDate = new DateTime(2026, 8, 20), Status = "Completed", Priority = "High", ProgressPercentage = 100 },
                new() { Id = 18, Name = "Build Support Ticket Submission Form", Description = "Reactive form with priority selector.", ProjectId = 1, WorkstreamId = 4, MilestoneId = 3, ParentActivityId = 4, AssignedUserId = 5, StartDate = new DateTime(2026, 8, 21), DueDate = new DateTime(2026, 9, 15), Status = "In Progress", Priority = "Medium", ProgressPercentage = 50 },
                new() { Id = 19, Name = "Build Subscription Upgrade Workflow", Description = "Self-service plan comparison and checkout confirmation.", ProjectId = 1, WorkstreamId = 4, MilestoneId = 3, ParentActivityId = 4, AssignedUserId = 4, StartDate = new DateTime(2026, 9, 16), DueDate = new DateTime(2026, 9, 28), Status = "Not Started", Priority = "Medium", ProgressPercentage = 0 }
            };
                await InsertWithIdentityAsync(context, "Activities", activities);

                // Task Dependencies (Requirements -> Design -> Backend -> Frontend -> UAT -> Deployment)
                var dependencies = new List<TaskDependency>
                {
                    new() { Id = 1, PredecessorTaskId = 1, SuccessorTaskId = 2, DependencyType = "FinishToStart" },
                    new() { Id = 2, PredecessorTaskId = 2, SuccessorTaskId = 3, DependencyType = "FinishToStart" },
                    new() { Id = 3, PredecessorTaskId = 2, SuccessorTaskId = 4, DependencyType = "FinishToStart" },
                    new() { Id = 4, PredecessorTaskId = 3, SuccessorTaskId = 5, DependencyType = "FinishToStart" },
                    new() { Id = 5, PredecessorTaskId = 4, SuccessorTaskId = 5, DependencyType = "FinishToStart" },
                    new() { Id = 6, PredecessorTaskId = 5, SuccessorTaskId = 6, DependencyType = "FinishToStart" },
                    new() { Id = 7, PredecessorTaskId = 8, SuccessorTaskId = 9, DependencyType = "FinishToStart" }
                };
                await InsertWithIdentityAsync(context, "TaskDependencies", dependencies);
            }

            await transaction.CommitAsync();
        }
        finally
        {
            await context.Database.CloseConnectionAsync();
        }
    }
}
