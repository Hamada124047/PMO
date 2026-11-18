-- ============================================================================
-- PMO PROJECT PORTFOLIO MANAGEMENT SYSTEM - DATABASE SCHEMA & SEED DATA
-- Database Engine : Microsoft SQL Server LocalDB ((localdb)\MSSQLLocalDB)
-- Database Name   : PMO Agile
-- ORM Compatibility: Entity Framework Core 8.0 (Microsoft.EntityFrameworkCore.SqlServer)
-- ============================================================================

IF DB_ID(N'PMO Agile') IS NULL
BEGIN
    CREATE DATABASE [PMO Agile];
END
GO

USE [PMO Agile];
GO

-- Drop tables in reverse dependency order if resetting
IF OBJECT_ID(N'[dbo].[TaskDependencies]', N'U') IS NOT NULL DROP TABLE [dbo].[TaskDependencies];
IF OBJECT_ID(N'[dbo].[Activities]', N'U') IS NOT NULL DROP TABLE [dbo].[Activities];
IF OBJECT_ID(N'[dbo].[Milestones]', N'U') IS NOT NULL DROP TABLE [dbo].[Milestones];
IF OBJECT_ID(N'[dbo].[Workstreams]', N'U') IS NOT NULL DROP TABLE [dbo].[Workstreams];
IF OBJECT_ID(N'[dbo].[Projects]', N'U') IS NOT NULL DROP TABLE [dbo].[Projects];
IF OBJECT_ID(N'[dbo].[Initiatives]', N'U') IS NOT NULL DROP TABLE [dbo].[Initiatives];
IF OBJECT_ID(N'[dbo].[Portfolios]', N'U') IS NOT NULL DROP TABLE [dbo].[Portfolios];
IF OBJECT_ID(N'[dbo].[Departments]', N'U') IS NOT NULL DROP TABLE [dbo].[Departments];
IF OBJECT_ID(N'[dbo].[Users]', N'U') IS NOT NULL DROP TABLE [dbo].[Users];
IF OBJECT_ID(N'[dbo].[Roles]', N'U') IS NOT NULL DROP TABLE [dbo].[Roles];
GO

-- 1. ROLES TABLE
CREATE TABLE [dbo].[Roles] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [Name] NVARCHAR(100) NOT NULL,
    [Description] NVARCHAR(500) NULL,
    CONSTRAINT [IX_Roles_Name] UNIQUE ([Name])
);
GO

-- 2. USERS TABLE
CREATE TABLE [dbo].[Users] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [FullName] NVARCHAR(150) NOT NULL,
    [Email] NVARCHAR(150) NOT NULL,
    [Username] NVARCHAR(100) NOT NULL,
    [PasswordHash] NVARCHAR(255) NOT NULL,
    [RoleId] INT NOT NULL,
    [IsActive] BIT NOT NULL CONSTRAINT [DF_Users_IsActive] DEFAULT (1),
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_Users_CreatedAt] DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT [IX_Users_Username] UNIQUE ([Username]),
    CONSTRAINT [IX_Users_Email] UNIQUE ([Email]),
    CONSTRAINT [FK_Users_Roles_RoleId] FOREIGN KEY ([RoleId]) REFERENCES [dbo].[Roles] ([Id]) ON DELETE NO ACTION
);
GO

-- 3. DEPARTMENTS TABLE
CREATE TABLE [dbo].[Departments] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [Name] NVARCHAR(150) NOT NULL,
    [Description] NVARCHAR(1000) NULL,
    [IsActive] BIT NOT NULL CONSTRAINT [DF_Departments_IsActive] DEFAULT (1),
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_Departments_CreatedAt] DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT [IX_Departments_Name] UNIQUE ([Name])
);
GO

-- 4. PORTFOLIOS TABLE
CREATE TABLE [dbo].[Portfolios] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [Name] NVARCHAR(200) NOT NULL,
    [Description] NVARCHAR(1500) NULL,
    [DepartmentId] INT NULL,
    [OwnerId] INT NULL,
    [StartDate] DATE NOT NULL,
    [EndDate] DATE NOT NULL,
    [Status] NVARCHAR(50) NOT NULL CONSTRAINT [DF_Portfolios_Status] DEFAULT (N'Active'),
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_Portfolios_CreatedAt] DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT [FK_Portfolios_Departments_DepartmentId] FOREIGN KEY ([DepartmentId]) REFERENCES [dbo].[Departments] ([Id]) ON DELETE SET NULL,
    CONSTRAINT [FK_Portfolios_Users_OwnerId] FOREIGN KEY ([OwnerId]) REFERENCES [dbo].[Users] ([Id]) ON DELETE SET NULL
);
GO

-- 5. INITIATIVES TABLE
CREATE TABLE [dbo].[Initiatives] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [Name] NVARCHAR(200) NOT NULL,
    [Description] NVARCHAR(1500) NULL,
    [DepartmentId] INT NULL,
    [PortfolioId] INT NOT NULL,
    [OwnerId] INT NULL,
    [StartDate] DATE NOT NULL,
    [TargetDate] DATE NOT NULL,
    [Status] NVARCHAR(50) NOT NULL CONSTRAINT [DF_Initiatives_Status] DEFAULT (N'In Progress'),
    [Priority] NVARCHAR(50) NOT NULL CONSTRAINT [DF_Initiatives_Priority] DEFAULT (N'Medium'),
    [ProgressPercentage] INT NOT NULL CONSTRAINT [DF_Initiatives_ProgressPercentage] DEFAULT (0),
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_Initiatives_CreatedAt] DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT [FK_Initiatives_Departments_DepartmentId] FOREIGN KEY ([DepartmentId]) REFERENCES [dbo].[Departments] ([Id]) ON DELETE SET NULL,
    CONSTRAINT [FK_Initiatives_Portfolios_PortfolioId] FOREIGN KEY ([PortfolioId]) REFERENCES [dbo].[Portfolios] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_Initiatives_Users_OwnerId] FOREIGN KEY ([OwnerId]) REFERENCES [dbo].[Users] ([Id]) ON DELETE SET NULL
);
GO

-- 6. PROJECTS TABLE
CREATE TABLE [dbo].[Projects] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [Name] NVARCHAR(200) NOT NULL,
    [Description] NVARCHAR(1500) NULL,
    [InitiativeId] INT NOT NULL,
    [ProjectManagerId] INT NULL,
    [StartDate] DATE NOT NULL,
    [EndDate] DATE NOT NULL,
    [Status] NVARCHAR(50) NOT NULL CONSTRAINT [DF_Projects_Status] DEFAULT (N'In Progress'),
    [Priority] NVARCHAR(50) NOT NULL CONSTRAINT [DF_Projects_Priority] DEFAULT (N'Medium'),
    [ProgressPercentage] INT NOT NULL CONSTRAINT [DF_Projects_ProgressPercentage] DEFAULT (0),
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_Projects_CreatedAt] DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT [FK_Projects_Initiatives_InitiativeId] FOREIGN KEY ([InitiativeId]) REFERENCES [dbo].[Initiatives] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_Projects_Users_ProjectManagerId] FOREIGN KEY ([ProjectManagerId]) REFERENCES [dbo].[Users] ([Id]) ON DELETE SET NULL
);
GO

-- 7. WORKSTREAMS TABLE
CREATE TABLE [dbo].[Workstreams] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [Name] NVARCHAR(200) NOT NULL,
    [Description] NVARCHAR(1500) NULL,
    [ProjectId] INT NOT NULL,
    [OwnerId] INT NULL,
    [StartDate] DATE NOT NULL,
    [EndDate] DATE NOT NULL,
    [Status] NVARCHAR(50) NOT NULL CONSTRAINT [DF_Workstreams_Status] DEFAULT (N'In Progress'),
    [ProgressPercentage] INT NOT NULL CONSTRAINT [DF_Workstreams_ProgressPercentage] DEFAULT (0),
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_Workstreams_CreatedAt] DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT [FK_Workstreams_Projects_ProjectId] FOREIGN KEY ([ProjectId]) REFERENCES [dbo].[Projects] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_Workstreams_Users_OwnerId] FOREIGN KEY ([OwnerId]) REFERENCES [dbo].[Users] ([Id]) ON DELETE SET NULL
);
GO

-- 8. MILESTONES TABLE
CREATE TABLE [dbo].[Milestones] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [Name] NVARCHAR(200) NOT NULL,
    [Description] NVARCHAR(1500) NULL,
    [ProjectId] INT NOT NULL,
    [WorkstreamId] INT NULL,
    [OwnerId] INT NULL,
    [PlannedDate] DATE NOT NULL,
    [ActualDate] DATE NULL,
    [Status] NVARCHAR(50) NOT NULL CONSTRAINT [DF_Milestones_Status] DEFAULT (N'Planned'),
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_Milestones_CreatedAt] DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT [FK_Milestones_Projects_ProjectId] FOREIGN KEY ([ProjectId]) REFERENCES [dbo].[Projects] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_Milestones_Workstreams_WorkstreamId] FOREIGN KEY ([WorkstreamId]) REFERENCES [dbo].[Workstreams] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_Milestones_Users_OwnerId] FOREIGN KEY ([OwnerId]) REFERENCES [dbo].[Users] ([Id]) ON DELETE SET NULL
);
GO

-- 9. ACTIVITIES / TASKS TABLE
CREATE TABLE [dbo].[Activities] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [Name] NVARCHAR(200) NOT NULL,
    [Description] NVARCHAR(1500) NULL,
    [ProjectId] INT NOT NULL,
    [WorkstreamId] INT NULL,
    [MilestoneId] INT NULL,
    [ParentActivityId] INT NULL,
    [AssignedUserId] INT NULL,
    [StartDate] DATE NOT NULL,
    [DueDate] DATE NOT NULL,
    [Status] NVARCHAR(50) NOT NULL CONSTRAINT [DF_Activities_Status] DEFAULT (N'Not Started'),
    [Priority] NVARCHAR(50) NOT NULL CONSTRAINT [DF_Activities_Priority] DEFAULT (N'Medium'),
    [ProgressPercentage] INT NOT NULL CONSTRAINT [DF_Activities_ProgressPercentage] DEFAULT (0),
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_Activities_CreatedAt] DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT [FK_Activities_Projects_ProjectId] FOREIGN KEY ([ProjectId]) REFERENCES [dbo].[Projects] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_Activities_Workstreams_WorkstreamId] FOREIGN KEY ([WorkstreamId]) REFERENCES [dbo].[Workstreams] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_Activities_Milestones_MilestoneId] FOREIGN KEY ([MilestoneId]) REFERENCES [dbo].[Milestones] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_Activities_Activities_ParentActivityId] FOREIGN KEY ([ParentActivityId]) REFERENCES [dbo].[Activities] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_Activities_Users_AssignedUserId] FOREIGN KEY ([AssignedUserId]) REFERENCES [dbo].[Users] ([Id]) ON DELETE SET NULL
);
GO

-- 10. TASK DEPENDENCIES TABLE
CREATE TABLE [dbo].[TaskDependencies] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [PredecessorTaskId] INT NOT NULL,
    [SuccessorTaskId] INT NOT NULL,
    [DependencyType] NVARCHAR(30) NOT NULL CONSTRAINT [DF_TaskDependencies_Type] DEFAULT (N'FinishToStart'),
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_TaskDependencies_CreatedAt] DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT [IX_TaskDependencies_Pred_Succ] UNIQUE ([PredecessorTaskId], [SuccessorTaskId]),
    CONSTRAINT [FK_TaskDependencies_Predecessor] FOREIGN KEY ([PredecessorTaskId]) REFERENCES [dbo].[Activities] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_TaskDependencies_Successor] FOREIGN KEY ([SuccessorTaskId]) REFERENCES [dbo].[Activities] ([Id]) ON DELETE NO ACTION
);
GO

-- ============================================================================
-- SEED DATA
-- ============================================================================

SET IDENTITY_INSERT [dbo].[Roles] ON;
INSERT INTO [dbo].[Roles] ([Id], [Name], [Description]) VALUES
(1, N'PMO Manager', N'Full oversight of departments, portfolios, initiatives, projects, and governance.'),
(2, N'Project Manager', N'Manages assigned initiatives, projects, schedules, and task allocations.'),
(3, N'Team Member', N'Executes project activities/tasks and updates task progress and status.');
SET IDENTITY_INSERT [dbo].[Roles] OFF;
GO

SET IDENTITY_INSERT [dbo].[Users] ON;
INSERT INTO [dbo].[Users] ([Id], [FullName], [Email], [Username], [PasswordHash], [RoleId], [IsActive]) VALUES
(1, N'Elena Vance', N'elena.vance@enterprise.org', N'pmo.admin', N'Pass123!', 1, 1),
(2, N'Marcus Sterling', N'marcus.sterling@enterprise.org', N'm.sterling', N'Pass123!', 2, 1),
(3, N'Clara Chen', N'clara.chen@enterprise.org', N'c.chen', N'Pass123!', 2, 1),
(4, N'David Alverez', N'david.alverez@enterprise.org', N'd.alverez', N'Pass123!', 3, 1),
(5, N'Sophia Patel', N'sophia.patel@enterprise.org', N's.patel', N'Pass123!', 3, 1),
(6, N'Liam O''Connor', N'liam.oconnor@enterprise.org', N'l.oconnor', N'Pass123!', 3, 1),
(7, N'Hamada El Daley', N'hamadamanus2@gmail.com', N'Hamada El Daley', N'PMO@2026@@', 1, 1);
SET IDENTITY_INSERT [dbo].[Users] OFF;
GO

SET IDENTITY_INSERT [dbo].[Departments] ON;
INSERT INTO [dbo].[Departments] ([Id], [Name], [Description], [IsActive]) VALUES
(1, N'IT', N'Information Technology, Enterprise Architecture, Cloud Infrastructure, and Cybersecurity.', 1),
(2, N'Finance', N'Corporate Finance, Financial Planning & Analysis, Accounting, and Treasury.', 1),
(3, N'HR', N'Human Resources, Talent Acquisition, Organizational Development, and People Operations.', 1),
(4, N'Operations', N'Global Supply Chain, Facilities, Logistics, and Core Business Operations.', 1),
(5, N'Marketing', N'Brand Strategy, Digital Customer Acquisition, Product Marketing, and Communications.', 1);
SET IDENTITY_INSERT [dbo].[Departments] OFF;
GO

SET IDENTITY_INSERT [dbo].[Portfolios] ON;
INSERT INTO [dbo].[Portfolios] ([Id], [Name], [Description], [DepartmentId], [OwnerId], [StartDate], [EndDate], [Status]) VALUES
(1, N'Digital Transformation Portfolio', N'Modernizing core enterprise platforms, cloud infrastructure, and customer-facing digital touchpoints.', 1, 1, '2026-01-01', '2026-12-31', N'Active'),
(2, N'Financial Governance & ERP Modernization', N'Automating financial reporting, audit readiness, and ERP ledger consolidation.', 2, 1, '2026-02-01', '2026-11-30', N'Active'),
(3, N'Operational Excellence & Supply Resilience', N'Optimizing warehouse fulfillment, procurement workflows, and regional logistics.', 4, 2, '2026-01-15', '2026-10-31', N'Active'),
(4, N'Workforce Empowerment & Talent Growth', N'Next-generation employee onboarding, continuous learning, and hybrid workplace enablement.', 3, 3, '2026-03-01', '2026-12-15', N'Planning');
SET IDENTITY_INSERT [dbo].[Portfolios] OFF;
GO

SET IDENTITY_INSERT [dbo].[Initiatives] ON;
INSERT INTO [dbo].[Initiatives] ([Id], [Name], [Description], [DepartmentId], [PortfolioId], [OwnerId], [StartDate], [TargetDate], [Status], [Priority], [ProgressPercentage]) VALUES
(1, N'Customer Service Initiative', N'Unified omnichannel customer self-service and ticket resolution platform.', 1, 1, 2, '2026-01-15', '2026-11-30', N'In Progress', N'High', 62),
(2, N'Cloud Data Platform Migration', N'Consolidating legacy on-premise databases into a governed enterprise data warehouse.', 1, 1, 3, '2026-02-01', '2026-11-15', N'In Progress', N'Critical', 50),
(3, N'Automated Expense & Treasury Control', N'Real-time spend analytics and automated invoice reconciliation.', 2, 2, 2, '2026-02-10', '2026-08-31', N'Completed', N'High', 100),
(4, N'Smart Warehouse & Inventory Tracking', N'IoT-enabled inventory tracking and automated reorder forecasting across regional hubs.', 4, 3, 3, '2026-01-20', '2026-10-28', N'In Progress', N'High', 55),
(5, N'Brand Experience & Analytics Revamp', N'Multi-touch attribution modeling and unified customer journey analytics.', 5, 1, 2, '2026-04-01', '2026-12-01', N'In Progress', N'Medium', 30),
(6, N'Continuous Learning & Leadership Academy', N'Digital competency framework and role-based certification tracks.', 3, 4, 3, '2026-03-15', '2026-11-30', N'Not Started', N'Medium', 10);
SET IDENTITY_INSERT [dbo].[Initiatives] OFF;
GO

SET IDENTITY_INSERT [dbo].[Projects] ON;
INSERT INTO [dbo].[Projects] ([Id], [Name], [Description], [InitiativeId], [ProjectManagerId], [StartDate], [EndDate], [Status], [Priority], [ProgressPercentage]) VALUES
(1, N'Customer Portal Implementation', N'Self-service web portal allowing customers to manage subscriptions, billing, and support requests.', 1, 2, '2026-01-20', '2026-11-15', N'In Progress', N'High', 63),
(2, N'Service Desk Ticketing Integration', N'Bi-directional synchronization between customer support queues and engineering issue tracking.', 1, 3, '2026-03-01', '2026-10-25', N'In Progress', N'Medium', 60),
(3, N'Core ETL Pipeline Modernization', N'Building resilient data ingestion pipelines for daily operational reporting.', 2, 3, '2026-02-15', '2026-10-20', N'In Progress', N'Critical', 70),
(4, N'Automated Invoice Matching Engine', N'Three-way matching automation between purchase orders, goods receipts, and vendor invoices.', 3, 2, '2026-02-15', '2026-07-31', N'Completed', N'High', 100),
(5, N'Regional Hub Barcode & RFID Rollout', N'Hardware deployment and WMS integration for real-time pallet scanning.', 4, 3, '2026-02-01', '2026-10-29', N'In Progress', N'High', 55),
(6, N'Unified Web Analytics Tagging', N'Standardized event taxonomy across all public web properties.', 5, 2, '2026-04-10', '2026-11-30', N'On Hold', N'Medium', 0),
(7, N'Onboarding Portal & Checklist Automation', N'Automated Day-1 provisioning and training schedule for new hires.', 6, 3, '2026-04-01', '2026-11-25', N'Planned', N'Low', 0);
SET IDENTITY_INSERT [dbo].[Projects] OFF;
GO

SET IDENTITY_INSERT [dbo].[Workstreams] ON;
INSERT INTO [dbo].[Workstreams] ([Id], [Name], [Description], [ProjectId], [OwnerId], [StartDate], [EndDate], [Status], [ProgressPercentage]) VALUES
(1, N'Requirements', N'Business analysis, stakeholder interviews, and functional specifications.', 1, 2, '2026-01-20', '2026-03-15', N'Completed', 100),
(2, N'UI/UX Design', N'Wireframes, interactive prototypes, and design system compliance.', 1, 4, '2026-03-10', '2026-05-15', N'Completed', 100),
(3, N'Backend Development', N'REST API microservices, authentication, and billing ledger integration.', 1, 5, '2026-05-01', '2026-08-30', N'Completed', 100),
(4, N'Frontend Development', N'Angular customer portal components, responsive views, and state management.', 1, 5, '2026-06-01', '2026-10-10', N'In Progress', 50),
(5, N'Testing & QA', N'Integration testing, security audit, and User Acceptance Testing (UAT).', 1, 6, '2026-09-15', '2026-10-30', N'In Progress', 25),
(6, N'Deployment & Cutover', N'Production release readiness, DNS cutover, and hypercare support.', 1, 2, '2026-11-01', '2026-11-15', N'Planned', 0),
(7, N'Webhook & API Integration', N'Queue synchronization and payload transformation.', 2, 3, '2026-03-01', '2026-10-25', N'In Progress', 60),
(8, N'Data Warehouse Schema & ETL', N'Staging schemas and automated batch ingestion.', 3, 6, '2026-02-15', '2026-10-20', N'In Progress', 70);
SET IDENTITY_INSERT [dbo].[Workstreams] OFF;
GO

SET IDENTITY_INSERT [dbo].[Milestones] ON;
INSERT INTO [dbo].[Milestones] ([Id], [Name], [Description], [ProjectId], [WorkstreamId], [OwnerId], [PlannedDate], [ActualDate], [Status]) VALUES
(1, N'Requirements Approved', N'Formal sign-off on Customer Portal functional requirements.', 1, 1, 2, '2026-03-15', '2026-03-14', N'Completed'),
(2, N'Design Completed', N'UI/UX design system and customer journey prototypes approved.', 1, 2, 4, '2026-05-15', '2026-05-15', N'Completed'),
(3, N'Development Completed', N'All backend APIs and Angular portal views feature-complete.', 1, 4, 5, '2026-09-28', NULL, N'Delayed'),
(4, N'UAT Completed', N'End-to-end user acceptance testing and security audit sign-off.', 1, 5, 6, '2026-10-28', NULL, N'In Progress'),
(5, N'Go Live', N'Production launch of Customer Portal Implementation.', 1, 6, 2, '2026-11-15', NULL, N'Planned'),
(6, N'Service Desk Sync Live', N'Production cutover of bi-directional ticket sync.', 2, 7, 3, '2026-10-20', NULL, N'In Progress'),
(7, N'Core Warehouse Cutover', N'Legacy tables retired and reporting pointed to new warehouse.', 3, 8, 3, '2026-10-18', NULL, N'Planned');
SET IDENTITY_INSERT [dbo].[Milestones] OFF;
GO

SET IDENTITY_INSERT [dbo].[Activities] ON;
INSERT INTO [dbo].[Activities] ([Id], [Name], [Description], [ProjectId], [WorkstreamId], [MilestoneId], [ParentActivityId], [AssignedUserId], [StartDate], [DueDate], [Status], [Priority], [ProgressPercentage]) VALUES
(1, N'Prepare Requirements Document', N'Gather and baseline functional and security requirements for Customer Portal.', 1, 1, 1, NULL, 4, '2026-01-22', '2026-03-15', N'Completed', N'High', 100),
(2, N'Create Portal Wireframes & Design System', N'Interactive Figma prototypes and WCAG contrast validation.', 1, 2, 2, NULL, 4, '2026-03-16', '2026-05-15', N'Completed', N'High', 100),
(3, N'Implement Core Billing & Auth APIs', N'Build ASP.NET Core endpoints for customer authentication and invoice retrieval.', 1, 3, 3, NULL, 5, '2026-05-16', '2026-08-25', N'Completed', N'Critical', 100),
(4, N'Develop Angular Self-Service Portal Views', N'Build account dashboard, invoice table, and ticket submission UI.', 1, 4, 3, NULL, 5, '2026-06-15', '2026-09-28', N'In Progress', N'High', 50),
(5, N'Execute Security Audit & UAT Cycles', N'Run penetration testing and business stakeholder acceptance test cases.', 1, 5, 4, NULL, 6, '2026-09-29', '2026-10-28', N'In Progress', N'High', 25),
(6, N'Execute Production Deployment & Cutover', N'Deploy containers, run smoke tests, and switch production traffic.', 1, 6, 5, NULL, 2, '2026-11-01', '2026-11-15', N'Not Started', N'Critical', 0),
(7, N'Configure Webhook Listeners for Support Escalations', N'Create real-time event handlers for high-priority ticket routing.', 2, 7, 6, NULL, 4, '2026-03-10', '2026-09-25', N'In Progress', N'Medium', 60),
(8, N'Provision SQL Server Staging & Analytics Schemas', N'Establish relational schemas, indexes, and backup policies.', 3, 8, 7, NULL, 6, '2026-02-20', '2026-05-30', N'Completed', N'Critical', 100),
(9, N'Migrate Legacy Inventory Tables to Core Warehouse', N'Validate data integrity and execute incremental batch transformation.', 3, 8, 7, NULL, 5, '2026-06-01', '2026-09-20', N'In Progress', N'Critical', 40),
(10, N'User Acceptance Testing for ERP Invoice Engine', N'Sign-off with corporate finance controllers on automated ledger postings.', 4, NULL, NULL, NULL, 4, '2026-06-01', '2026-07-25', N'Completed', N'High', 100),
(11, N'Calibrate RFID Scanners in Distribution Center North', N'Site survey and signal verification across loading docks.', 5, NULL, NULL, NULL, 6, '2026-03-01', '2026-10-25', N'In Progress', N'High', 55),
(12, N'Interview stakeholders', N'Conduct workshops with Customer Support and Billing leads.', 1, 1, 1, 1, 4, '2026-01-22', '2026-02-05', N'Completed', N'High', 100),
(13, N'Document requirements', N'Draft user stories and acceptance criteria.', 1, 1, 1, 1, 4, '2026-02-06', '2026-02-20', N'Completed', N'High', 100),
(14, N'Review requirements', N'Peer review with architecture and security teams.', 1, 1, 1, 1, 5, '2026-02-21', '2026-03-05', N'Completed', N'Medium', 100),
(15, N'Obtain approval', N'Formal sign-off from Steering Committee.', 1, 1, 1, 1, 2, '2026-03-06', '2026-03-15', N'Completed', N'High', 100),
(16, N'Build Customer Login & Session Guard', N'Implement JWT interceptor and role guard.', 1, 4, 3, 4, 5, '2026-06-15', '2026-07-15', N'Completed', N'High', 100),
(17, N'Build Invoice & Statement Download Grid', N'Sortable table with PDF statement download.', 1, 4, 3, 4, 5, '2026-07-16', '2026-08-20', N'Completed', N'High', 100),
(18, N'Build Support Ticket Submission Form', N'Reactive form with priority selector.', 1, 4, 3, 4, 5, '2026-08-21', '2026-09-15', N'In Progress', N'Medium', 0),
(19, N'Build Subscription Upgrade Workflow', N'Self-service plan comparison and checkout confirmation.', 1, 4, 3, 4, 4, '2026-09-16', '2026-09-28', N'Not Started', N'Medium', 0);
SET IDENTITY_INSERT [dbo].[Activities] OFF;
GO

SET IDENTITY_INSERT [dbo].[TaskDependencies] ON;
INSERT INTO [dbo].[TaskDependencies] ([Id], [PredecessorTaskId], [SuccessorTaskId], [DependencyType]) VALUES
(1, 1, 2, N'FinishToStart'),
(2, 2, 3, N'FinishToStart'),
(3, 2, 4, N'FinishToStart'),
(4, 3, 5, N'FinishToStart'),
(5, 4, 5, N'FinishToStart'),
(6, 5, 6, N'FinishToStart'),
(7, 8, 9, N'FinishToStart');
SET IDENTITY_INSERT [dbo].[TaskDependencies] OFF;
GO
