export function buildOpenApiSpec(serverOrigin: string) {
  const cleanOrigin = serverOrigin.replace(/\/+$/, '');

  const jsonContent = (schemaRef: string) => ({
    'application/json': {
      schema: { $ref: `#/components/schemas/${schemaRef}` }
    }
  });

  const okResponse = (description: string, schema?: Record<string, unknown>) => ({
    '200': {
      description,
      ...(schema
        ? {
            content: {
              'application/json': { schema }
            }
          }
        : {})
    }
  });

  const idParam = (name = 'id', description = 'Resource ID') => ({
    name,
    in: 'path',
    required: true,
    description,
    schema: { type: 'integer' }
  });

  const queryParam = (
    name: string,
    description: string,
    type: 'string' | 'integer' | 'boolean' = 'string'
  ) => ({
    name,
    in: 'query',
    required: false,
    description,
    schema: { type }
  });

  return {
    openapi: '3.0.3',
    info: {
      title: 'NEXORA PMO — Project Portfolio Management System API',
      version: '1.0.0',
      description:
        'Interactive RESTful OpenAPI 3.0 documentation for NEXORA PMO. Use POST /api/auth/login or /api/auth/quick-login to obtain a Bearer JWT token, then click "Authorize" above to test protected endpoints.'
    },
    servers: [
      {
        url: cleanOrigin,
        description: 'Active NEXORA PMO Server'
      }
    ],
    tags: [
      { name: 'Auth & Profile', description: 'Authentication, registration, profile, and password management' },
      { name: 'Users & Roles (Admin)', description: 'Admin-only user management and role assignments' },
      { name: 'Dashboard & PMO Module', description: 'Executive KPIs, PMO dashboard, progress tracking, overdue alerts, and activity search' },
      { name: 'Departments', description: 'Organizational departments CRUD and relationships' },
      { name: 'Portfolios', description: 'Strategic investment portfolios CRUD' },
      { name: 'Initiatives', description: 'Cross-department strategic initiatives CRUD' },
      { name: 'Projects & Schedule', description: 'Projects CRUD and project planning & scheduling timeline APIs' },
      { name: 'Workstreams, Milestones & Activities', description: 'Execution workstreams, milestones, activities, subtasks, and dependencies' },
      { name: 'Strategic Planning', description: 'Strategic plans, initiatives, activities, approvals, and chatter' },
      { name: 'Admin Studio & Settings', description: 'Screen visibility, custom field schemas, and per-role screen access' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Paste the token returned from POST /api/auth/login or /api/auth/quick-login'
        }
      },
      schemas: {
        LoginRequest: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string', example: 'hamada.admin' },
            password: { type: 'string', example: 'Pass123!' }
          }
        },
        QuickLoginRequest: {
          type: 'object',
          properties: {
            userId: { type: 'integer', example: 1 },
            username: { type: 'string', example: 'hamada.admin' }
          }
        },
        RegisterRequest: {
          type: 'object',
          required: ['fullName', 'username', 'email', 'password'],
          properties: {
            fullName: { type: 'string', example: 'Sara Al-Mansour' },
            username: { type: 'string', example: 'sara.mansour' },
            email: { type: 'string', example: 'sara@nexora.pmo' },
            password: { type: 'string', example: 'Pass123!' }
          }
        },
        DepartmentInput: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', example: 'Digital Transformation' },
            nameAr: { type: 'string', example: 'التحول الرقمي' },
            description: { type: 'string' },
            headOfDepartment: { type: 'string' },
            budgetAllocated: { type: 'number', example: 2500000 }
          }
        },
        PortfolioInput: {
          type: 'object',
          required: ['name', 'departmentId'],
          properties: {
            name: { type: 'string', example: 'Enterprise Digital Portfolio' },
            nameAr: { type: 'string' },
            description: { type: 'string' },
            departmentId: { type: 'integer', example: 1 },
            budget: { type: 'number', example: 5000000 },
            status: { type: 'string', example: 'Active' }
          }
        },
        InitiativeInput: {
          type: 'object',
          required: ['name', 'portfolioId'],
          properties: {
            name: { type: 'string', example: 'Cloud Modernization Program' },
            nameAr: { type: 'string' },
            description: { type: 'string' },
            portfolioId: { type: 'integer', example: 1 },
            ownerUserId: { type: 'integer', example: 1 },
            startDate: { type: 'string', format: 'date', example: '2026-01-01' },
            targetDate: { type: 'string', format: 'date', example: '2026-12-31' },
            status: { type: 'string', example: 'In Progress' }
          }
        },
        ProjectInput: {
          type: 'object',
          required: ['name', 'initiativeId'],
          properties: {
            name: { type: 'string', example: 'Customer Portal Implementation' },
            nameAr: { type: 'string' },
            description: { type: 'string' },
            initiativeId: { type: 'integer', example: 1 },
            projectManagerId: { type: 'integer', example: 2 },
            startDate: { type: 'string', format: 'date', example: '2026-02-01' },
            targetDate: { type: 'string', format: 'date', example: '2026-10-30' },
            budget: { type: 'number', example: 1200000 },
            status: { type: 'string', example: 'In Progress' }
          }
        },
        ProjectScheduleUpdateInput: {
          type: 'object',
          required: ['startDate', 'targetDate'],
          properties: {
            startDate: { type: 'string', format: 'date', example: '2026-02-01' },
            targetDate: { type: 'string', format: 'date', example: '2026-11-15' }
          }
        },
        ActivityInput: {
          type: 'object',
          required: ['title', 'projectId'],
          properties: {
            title: { type: 'string', example: 'Configure API Gateway' },
            titleAr: { type: 'string' },
            description: { type: 'string' },
            projectId: { type: 'integer', example: 1 },
            workstreamId: { type: 'integer', example: 1 },
            milestoneId: { type: 'integer', nullable: true },
            parentActivityId: { type: 'integer', nullable: true },
            assignedUserId: { type: 'integer', example: 3 },
            startDate: { type: 'string', format: 'date', example: '2026-09-01' },
            dueDate: { type: 'string', format: 'date', example: '2026-09-20' },
            priority: { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'], example: 'High' },
            status: { type: 'string', enum: ['Not Started', 'In Progress', 'Completed', 'Delayed'], example: 'In Progress' },
            progressPercentage: { type: 'number', example: 50 }
          }
        },
        ActivityStatusPatch: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string', enum: ['Not Started', 'In Progress', 'Completed', 'Delayed'] },
            progressPercentage: { type: 'number', example: 100 }
          }
        },
        WorkstreamInput: {
          type: 'object',
          required: ['name', 'projectId'],
          properties: {
            name: { type: 'string', example: 'Backend Engineering' },
            projectId: { type: 'integer', example: 1 },
            leadName: { type: 'string' },
            status: { type: 'string', example: 'In Progress' }
          }
        },
        MilestoneInput: {
          type: 'object',
          required: ['name', 'projectId', 'plannedDate'],
          properties: {
            name: { type: 'string', example: 'Beta Release Sign-Off' },
            projectId: { type: 'integer', example: 1 },
            workstreamId: { type: 'integer', nullable: true },
            plannedDate: { type: 'string', format: 'date', example: '2026-10-15' },
            actualDate: { type: 'string', format: 'date', nullable: true },
            status: { type: 'string', enum: ['Planned', 'In Progress', 'Completed', 'Delayed'] }
          }
        },
        DependencyInput: {
          type: 'object',
          required: ['predecessorTaskId', 'successorTaskId'],
          properties: {
            predecessorTaskId: { type: 'integer', example: 1 },
            successorTaskId: { type: 'integer', example: 2 },
            dependencyType: { type: 'string', example: 'FinishToStart' }
          }
        },
        GenericObject: {
          type: 'object',
          additionalProperties: true
        }
      }
    },
    security: [{ bearerAuth: [] }],
    paths: {
      // ==================== AUTH & PROFILE ====================
      '/api/auth/login': {
        post: {
          tags: ['Auth & Profile'],
          summary: 'Sign in with username/email and password',
          security: [],
          requestBody: { required: true, content: jsonContent('LoginRequest') },
          responses: okResponse('Authenticated user & JWT token')
        }
      },
      '/api/auth/quick-login': {
        post: {
          tags: ['Auth & Profile'],
          summary: 'Quick sign in for demo accounts',
          security: [],
          requestBody: { required: true, content: jsonContent('QuickLoginRequest') },
          responses: okResponse('Authenticated user & JWT token')
        }
      },
      '/api/auth/register': {
        post: {
          tags: ['Auth & Profile'],
          summary: 'Register a new user account',
          security: [],
          requestBody: { required: true, content: jsonContent('RegisterRequest') },
          responses: okResponse('Created user & JWT token')
        }
      },
      '/api/auth/logout': {
        post: {
          tags: ['Auth & Profile'],
          summary: 'Revoke active session token',
          responses: okResponse('Logged out')
        }
      },
      '/api/auth/me': {
        get: {
          tags: ['Auth & Profile'],
          summary: 'Get currently authenticated user profile',
          responses: okResponse('Current user profile')
        }
      },
      '/api/auth/users': {
        get: {
          tags: ['Auth & Profile'],
          summary: 'List available user accounts for login switcher',
          security: [],
          responses: okResponse('Public account summary list')
        }
      },
      '/api/auth/forgot-password': {
        post: {
          tags: ['Auth & Profile'],
          summary: 'Request password reset code',
          security: [],
          requestBody: { required: true, content: jsonContent('GenericObject') },
          responses: okResponse('Reset verification generated')
        }
      },
      '/api/auth/reset-password': {
        post: {
          tags: ['Auth & Profile'],
          summary: 'Reset password using verification code',
          security: [],
          requestBody: { required: true, content: jsonContent('GenericObject') },
          responses: okResponse('Password reset completed')
        }
      },
      '/api/auth/profile': {
        put: {
          tags: ['Auth & Profile'],
          summary: 'Update authenticated user profile',
          requestBody: { required: true, content: jsonContent('GenericObject') },
          responses: okResponse('Updated profile')
        }
      },
      '/api/auth/change-password': {
        post: {
          tags: ['Auth & Profile'],
          summary: 'Change current user password',
          requestBody: { required: true, content: jsonContent('GenericObject') },
          responses: okResponse('Password updated')
        }
      },

      // ==================== USERS & ROLES (ADMIN) ====================
      '/api/roles': {
        get: {
          tags: ['Users & Roles (Admin)'],
          summary: 'Get all system roles',
          responses: okResponse('List of roles')
        }
      },
      '/api/users/options': {
        get: {
          tags: ['Users & Roles (Admin)'],
          summary: 'Get assignable user options for owners and managers',
          responses: okResponse('Assignable user options')
        }
      },
      '/api/users': {
        get: {
          tags: ['Users & Roles (Admin)'],
          summary: 'List all users (Admin account only)',
          responses: okResponse('User list')
        },
        post: {
          tags: ['Users & Roles (Admin)'],
          summary: 'Create a new user (Admin account only)',
          requestBody: { required: true, content: jsonContent('GenericObject') },
          responses: okResponse('Created user')
        }
      },
      '/api/users/{id}': {
        get: {
          tags: ['Users & Roles (Admin)'],
          summary: 'Get user by ID (Admin account only)',
          parameters: [idParam()],
          responses: okResponse('User details')
        },
        put: {
          tags: ['Users & Roles (Admin)'],
          summary: 'Update user details (Admin account only)',
          parameters: [idParam()],
          requestBody: { required: true, content: jsonContent('GenericObject') },
          responses: okResponse('Updated user')
        }
      },
      '/api/users/{id}/status': {
        patch: {
          tags: ['Users & Roles (Admin)'],
          summary: 'Activate or deactivate user account (Admin account only)',
          parameters: [idParam()],
          requestBody: { required: true, content: jsonContent('GenericObject') },
          responses: okResponse('Updated user status')
        }
      },
      '/api/auth/users/{id}/role': {
        put: {
          tags: ['Users & Roles (Admin)'],
          summary: 'Assign role to user (Admin account only)',
          parameters: [idParam()],
          requestBody: { required: true, content: jsonContent('GenericObject') },
          responses: okResponse('Updated user role')
        }
      },

      // ==================== DASHBOARD & PMO MODULE ====================
      '/api/dashboard': {
        get: {
          tags: ['Dashboard & PMO Module'],
          summary: 'Get executive dashboard KPIs and overview metrics',
          responses: okResponse('Executive dashboard metrics')
        }
      },
      '/api/pmo-dashboard': {
        get: {
          tags: ['Dashboard & PMO Module'],
          summary: 'Get consolidated PMO Module dashboard telemetry',
          responses: okResponse('PMO Module dashboard data')
        }
      },
      '/api/pmo/executive-dashboard': {
        get: {
          tags: ['Dashboard & PMO Module'],
          summary: 'Get PMO executive portfolio dashboard',
          responses: okResponse('PMO executive dashboard')
        }
      },
      '/api/pmo/department-kanban': {
        get: {
          tags: ['Dashboard & PMO Module'],
          summary: 'Get department-grouped Kanban project board',
          responses: okResponse('Department Kanban items')
        }
      },
      '/api/pmo/single-page-projects': {
        get: {
          tags: ['Dashboard & PMO Module'],
          summary: 'Get unified single-page projects overview',
          responses: okResponse('Single-page projects summary')
        }
      },
      '/api/pmo/high-risk-initiatives': {
        get: {
          tags: ['Dashboard & PMO Module'],
          summary: 'Get high-risk and delayed initiatives',
          responses: okResponse('High-risk initiatives')
        }
      },
      '/api/pmo/master-tasks': {
        get: {
          tags: ['Dashboard & PMO Module'],
          summary: 'Get master PMO activity schedule list',
          responses: okResponse('Master task list')
        }
      },
      '/api/pmo/export-ppt': {
        post: {
          tags: ['Dashboard & PMO Module'],
          summary: 'Generate executive PowerPoint briefing payload',
          requestBody: { required: false, content: jsonContent('GenericObject') },
          responses: okResponse('Presentation slides payload')
        }
      },
      '/api/progress/summary': {
        get: {
          tags: ['Dashboard & PMO Module'],
          summary: 'Get overall PMO progress tracking summary',
          responses: okResponse('Progress summary')
        }
      },
      '/api/progress/initiatives': {
        get: {
          tags: ['Dashboard & PMO Module'],
          summary: 'Get progress breakdown across initiatives',
          responses: okResponse('Initiative progress list')
        }
      },
      '/api/progress/initiatives/{id}': {
        get: {
          tags: ['Dashboard & PMO Module'],
          summary: 'Get detailed progress for a specific initiative',
          parameters: [idParam()],
          responses: okResponse('Initiative progress detail')
        }
      },
      '/api/progress/projects': {
        get: {
          tags: ['Dashboard & PMO Module'],
          summary: 'Get progress breakdown across projects',
          responses: okResponse('Project progress list')
        }
      },
      '/api/progress/projects/{id}': {
        get: {
          tags: ['Dashboard & PMO Module'],
          summary: 'Get detailed progress for a specific project',
          parameters: [idParam()],
          responses: okResponse('Project progress detail')
        }
      },
      '/api/overdue-activities': {
        get: {
          tags: ['Dashboard & PMO Module'],
          summary: 'List overdue activities across PMO',
          parameters: [queryParam('projectId', 'Filter by project ID', 'integer'), queryParam('priority', 'Filter by priority')],
          responses: okResponse('Overdue activities list')
        }
      },
      '/api/overdue-activities/{id}': {
        get: {
          tags: ['Dashboard & PMO Module'],
          summary: 'Get overdue activity detail by ID',
          parameters: [idParam()],
          responses: okResponse('Overdue activity detail')
        }
      },
      '/api/activity-search': {
        get: {
          tags: ['Dashboard & PMO Module'],
          summary: 'Search activities across projects, owners, statuses, and priorities',
          parameters: [
            queryParam('q', 'Search keyword'),
            queryParam('status', 'Activity status'),
            queryParam('priority', 'Activity priority'),
            queryParam('projectId', 'Project ID', 'integer')
          ],
          responses: okResponse('Matching activities')
        }
      },
      '/api/activity-search/{id}': {
        get: {
          tags: ['Dashboard & PMO Module'],
          summary: 'Get searched activity detail by ID',
          parameters: [idParam()],
          responses: okResponse('Activity detail')
        }
      },

      // ==================== DEPARTMENTS ====================
      '/api/departments': {
        get: {
          tags: ['Departments'],
          summary: 'List all departments',
          parameters: [queryParam('search', 'Filter departments by name')],
          responses: okResponse('Departments list')
        },
        post: {
          tags: ['Departments'],
          summary: 'Create a department',
          requestBody: { required: true, content: jsonContent('DepartmentInput') },
          responses: okResponse('Created department')
        }
      },
      '/api/departments/{id}': {
        get: {
          tags: ['Departments'],
          summary: 'Get department by ID',
          parameters: [idParam()],
          responses: okResponse('Department detail')
        },
        put: {
          tags: ['Departments'],
          summary: 'Update department',
          parameters: [idParam()],
          requestBody: { required: true, content: jsonContent('DepartmentInput') },
          responses: okResponse('Updated department')
        },
        delete: {
          tags: ['Departments'],
          summary: 'Delete department',
          parameters: [idParam()],
          responses: okResponse('Deleted department')
        }
      },
      '/api/departments/{id}/relationships': {
        get: {
          tags: ['Departments'],
          summary: 'Get portfolios, initiatives, and projects linked to a department',
          parameters: [idParam()],
          responses: okResponse('Department hierarchy relationships')
        }
      },

      // ==================== PORTFOLIOS ====================
      '/api/portfolios': {
        get: {
          tags: ['Portfolios'],
          summary: 'List all portfolios',
          parameters: [queryParam('departmentId', 'Filter by department ID', 'integer')],
          responses: okResponse('Portfolios list')
        },
        post: {
          tags: ['Portfolios'],
          summary: 'Create a portfolio',
          requestBody: { required: true, content: jsonContent('PortfolioInput') },
          responses: okResponse('Created portfolio')
        }
      },
      '/api/portfolios/{id}': {
        get: {
          tags: ['Portfolios'],
          summary: 'Get portfolio by ID',
          parameters: [idParam()],
          responses: okResponse('Portfolio detail')
        },
        put: {
          tags: ['Portfolios'],
          summary: 'Update portfolio',
          parameters: [idParam()],
          requestBody: { required: true, content: jsonContent('PortfolioInput') },
          responses: okResponse('Updated portfolio')
        },
        delete: {
          tags: ['Portfolios'],
          summary: 'Delete portfolio',
          parameters: [idParam()],
          responses: okResponse('Deleted portfolio')
        }
      },
      '/api/portfolios/{id}/initiatives': {
        get: {
          tags: ['Portfolios'],
          summary: 'List initiatives under a portfolio',
          parameters: [idParam()],
          responses: okResponse('Portfolio initiatives')
        }
      },

      // ==================== INITIATIVES ====================
      '/api/initiatives': {
        get: {
          tags: ['Initiatives'],
          summary: 'List all initiatives',
          parameters: [queryParam('portfolioId', 'Filter by portfolio ID', 'integer')],
          responses: okResponse('Initiatives list')
        },
        post: {
          tags: ['Initiatives'],
          summary: 'Create an initiative',
          requestBody: { required: true, content: jsonContent('InitiativeInput') },
          responses: okResponse('Created initiative')
        }
      },
      '/api/initiatives/{id}': {
        get: {
          tags: ['Initiatives'],
          summary: 'Get initiative by ID',
          parameters: [idParam()],
          responses: okResponse('Initiative detail')
        },
        put: {
          tags: ['Initiatives'],
          summary: 'Update initiative',
          parameters: [idParam()],
          requestBody: { required: true, content: jsonContent('InitiativeInput') },
          responses: okResponse('Updated initiative')
        },
        delete: {
          tags: ['Initiatives'],
          summary: 'Delete initiative',
          parameters: [idParam()],
          responses: okResponse('Deleted initiative')
        }
      },
      '/api/initiatives/{id}/projects': {
        get: {
          tags: ['Initiatives'],
          summary: 'List projects under an initiative',
          parameters: [idParam()],
          responses: okResponse('Initiative projects')
        }
      },

      // ==================== PROJECTS & SCHEDULE ====================
      '/api/projects': {
        get: {
          tags: ['Projects & Schedule'],
          summary: 'List all projects',
          parameters: [queryParam('initiativeId', 'Filter by initiative ID', 'integer')],
          responses: okResponse('Projects list')
        },
        post: {
          tags: ['Projects & Schedule'],
          summary: 'Create a project',
          requestBody: { required: true, content: jsonContent('ProjectInput') },
          responses: okResponse('Created project')
        }
      },
      '/api/projects/{id}': {
        get: {
          tags: ['Projects & Schedule'],
          summary: 'Get project by ID',
          parameters: [idParam()],
          responses: okResponse('Project detail')
        },
        put: {
          tags: ['Projects & Schedule'],
          summary: 'Update project',
          parameters: [idParam()],
          requestBody: { required: true, content: jsonContent('ProjectInput') },
          responses: okResponse('Updated project')
        },
        delete: {
          tags: ['Projects & Schedule'],
          summary: 'Delete project',
          parameters: [idParam()],
          responses: okResponse('Deleted project')
        }
      },
      '/api/projects/{id}/schedule': {
        get: {
          tags: ['Projects & Schedule'],
          summary: 'Get project planned schedule, chronological activities, and date conflict checks',
          parameters: [idParam()],
          responses: okResponse('Project schedule payload')
        },
        put: {
          tags: ['Projects & Schedule'],
          summary: 'Update project planned start and target dates with schedule conflict detection',
          parameters: [idParam()],
          requestBody: { required: true, content: jsonContent('ProjectScheduleUpdateInput') },
          responses: okResponse('Updated project schedule & conflict warnings')
        }
      },
      '/api/projects/{id}/schedule/activities/{activityId}': {
        put: {
          tags: ['Projects & Schedule'],
          summary: 'Update activity planned dates within project schedule validation rules',
          parameters: [idParam('id', 'Project ID'), idParam('activityId', 'Activity ID')],
          requestBody: { required: true, content: jsonContent('GenericObject') },
          responses: okResponse('Updated activity schedule')
        }
      },
      '/api/projects/{id}/activities': {
        get: {
          tags: ['Projects & Schedule'],
          summary: 'List activities belonging to a project',
          parameters: [idParam()],
          responses: okResponse('Project activities')
        }
      },

      // ==================== WORKSTREAMS, MILESTONES & ACTIVITIES ====================
      '/api/workstreams': {
        get: {
          tags: ['Workstreams, Milestones & Activities'],
          summary: 'List workstreams',
          parameters: [queryParam('projectId', 'Project ID', 'integer'), queryParam('status', 'Status filter')],
          responses: okResponse('Workstreams list')
        },
        post: {
          tags: ['Workstreams, Milestones & Activities'],
          summary: 'Create a workstream',
          requestBody: { required: true, content: jsonContent('WorkstreamInput') },
          responses: okResponse('Created workstream')
        }
      },
      '/api/workstreams/{id}': {
        put: {
          tags: ['Workstreams, Milestones & Activities'],
          summary: 'Update a workstream',
          parameters: [idParam()],
          requestBody: { required: true, content: jsonContent('WorkstreamInput') },
          responses: okResponse('Updated workstream')
        },
        delete: {
          tags: ['Workstreams, Milestones & Activities'],
          summary: 'Delete a workstream',
          parameters: [idParam()],
          responses: okResponse('Deleted workstream')
        }
      },
      '/api/milestones': {
        get: {
          tags: ['Workstreams, Milestones & Activities'],
          summary: 'List milestones',
          parameters: [queryParam('projectId', 'Project ID', 'integer')],
          responses: okResponse('Milestones list')
        },
        post: {
          tags: ['Workstreams, Milestones & Activities'],
          summary: 'Create a milestone',
          requestBody: { required: true, content: jsonContent('MilestoneInput') },
          responses: okResponse('Created milestone')
        }
      },
      '/api/milestones/{id}': {
        put: {
          tags: ['Workstreams, Milestones & Activities'],
          summary: 'Update a milestone',
          parameters: [idParam()],
          requestBody: { required: true, content: jsonContent('MilestoneInput') },
          responses: okResponse('Updated milestone')
        },
        delete: {
          tags: ['Workstreams, Milestones & Activities'],
          summary: 'Delete a milestone',
          parameters: [idParam()],
          responses: okResponse('Deleted milestone')
        }
      },
      '/api/activities': {
        get: {
          tags: ['Workstreams, Milestones & Activities'],
          summary: 'List activities and subtasks',
          parameters: [
            queryParam('projectId', 'Project ID', 'integer'),
            queryParam('workstreamId', 'Workstream ID', 'integer'),
            queryParam('status', 'Status filter')
          ],
          responses: okResponse('Activities list')
        },
        post: {
          tags: ['Workstreams, Milestones & Activities'],
          summary: 'Create a new activity or subtask',
          requestBody: { required: true, content: jsonContent('ActivityInput') },
          responses: okResponse('Created activity')
        }
      },
      '/api/activities/{id}': {
        get: {
          tags: ['Workstreams, Milestones & Activities'],
          summary: 'Get activity by ID',
          parameters: [idParam()],
          responses: okResponse('Activity detail')
        },
        put: {
          tags: ['Workstreams, Milestones & Activities'],
          summary: 'Update activity and trigger automatic progress roll-up',
          parameters: [idParam()],
          requestBody: { required: true, content: jsonContent('ActivityInput') },
          responses: okResponse('Updated activity')
        },
        delete: {
          tags: ['Workstreams, Milestones & Activities'],
          summary: 'Delete activity',
          parameters: [idParam()],
          responses: okResponse('Deleted activity')
        }
      },
      '/api/activities/{id}/status': {
        patch: {
          tags: ['Workstreams, Milestones & Activities'],
          summary: 'Update activity status and progress percentage',
          parameters: [idParam()],
          requestBody: { required: true, content: jsonContent('ActivityStatusPatch') },
          responses: okResponse('Updated activity status')
        }
      },
      '/api/dependencies': {
        get: {
          tags: ['Workstreams, Milestones & Activities'],
          summary: 'List task dependencies',
          parameters: [queryParam('projectId', 'Project ID', 'integer')],
          responses: okResponse('Task dependencies list')
        },
        post: {
          tags: ['Workstreams, Milestones & Activities'],
          summary: 'Create a FinishToStart task dependency (validates against circular links)',
          requestBody: { required: true, content: jsonContent('DependencyInput') },
          responses: okResponse('Created dependency')
        }
      },
      '/api/dependencies/{id}': {
        delete: {
          tags: ['Workstreams, Milestones & Activities'],
          summary: 'Delete a task dependency',
          parameters: [idParam()],
          responses: okResponse('Deleted dependency')
        }
      },

      // ==================== STRATEGIC PLANNING ====================
      '/api/strategic-planning/plans': {
        get: {
          tags: ['Strategic Planning'],
          summary: 'List strategic plans',
          responses: okResponse('Strategic plans')
        },
        post: {
          tags: ['Strategic Planning'],
          summary: 'Create a strategic plan',
          requestBody: { required: true, content: jsonContent('GenericObject') },
          responses: okResponse('Created strategic plan')
        }
      },
      '/api/strategic-planning/plans/{id}': {
        get: {
          tags: ['Strategic Planning'],
          summary: 'Get strategic plan by ID',
          parameters: [idParam()],
          responses: okResponse('Strategic plan detail')
        },
        put: {
          tags: ['Strategic Planning'],
          summary: 'Update strategic plan',
          parameters: [idParam()],
          requestBody: { required: true, content: jsonContent('GenericObject') },
          responses: okResponse('Updated strategic plan')
        },
        delete: {
          tags: ['Strategic Planning'],
          summary: 'Delete strategic plan',
          parameters: [idParam()],
          responses: okResponse('Deleted strategic plan')
        }
      },
      '/api/strategic-planning/initiatives': {
        get: {
          tags: ['Strategic Planning'],
          summary: 'List strategic initiatives',
          responses: okResponse('Strategic initiatives')
        },
        post: {
          tags: ['Strategic Planning'],
          summary: 'Create strategic initiative',
          requestBody: { required: true, content: jsonContent('GenericObject') },
          responses: okResponse('Created strategic initiative')
        }
      },
      '/api/strategic-planning/initiatives/{id}': {
        get: {
          tags: ['Strategic Planning'],
          summary: 'Get strategic initiative by ID',
          parameters: [idParam()],
          responses: okResponse('Strategic initiative detail')
        },
        put: {
          tags: ['Strategic Planning'],
          summary: 'Update strategic initiative',
          parameters: [idParam()],
          requestBody: { required: true, content: jsonContent('GenericObject') },
          responses: okResponse('Updated strategic initiative')
        },
        delete: {
          tags: ['Strategic Planning'],
          summary: 'Delete strategic initiative',
          parameters: [idParam()],
          responses: okResponse('Deleted strategic initiative')
        }
      },
      '/api/strategic-planning/initiatives/{id}/duplicate': {
        post: {
          tags: ['Strategic Planning'],
          summary: 'Duplicate a strategic initiative',
          parameters: [idParam()],
          responses: okResponse('Duplicated strategic initiative')
        }
      },
      '/api/strategic-planning/initiatives/{id}/approve': {
        post: {
          tags: ['Strategic Planning'],
          summary: 'Approve a strategic initiative',
          parameters: [idParam()],
          responses: okResponse('Approved strategic initiative')
        }
      },
      '/api/strategic-planning/activities': {
        get: {
          tags: ['Strategic Planning'],
          summary: 'List strategic activities',
          responses: okResponse('Strategic activities')
        },
        post: {
          tags: ['Strategic Planning'],
          summary: 'Create strategic activity',
          requestBody: { required: true, content: jsonContent('GenericObject') },
          responses: okResponse('Created strategic activity')
        }
      },
      '/api/strategic-planning/activities/{id}': {
        get: {
          tags: ['Strategic Planning'],
          summary: 'Get strategic activity by ID',
          parameters: [idParam()],
          responses: okResponse('Strategic activity detail')
        },
        put: {
          tags: ['Strategic Planning'],
          summary: 'Update strategic activity',
          parameters: [idParam()],
          requestBody: { required: true, content: jsonContent('GenericObject') },
          responses: okResponse('Updated strategic activity')
        },
        delete: {
          tags: ['Strategic Planning'],
          summary: 'Delete strategic activity',
          parameters: [idParam()],
          responses: okResponse('Deleted strategic activity')
        }
      },
      '/api/strategic-planning/activities/{id}/duplicate': {
        post: {
          tags: ['Strategic Planning'],
          summary: 'Duplicate a strategic activity',
          parameters: [idParam()],
          responses: okResponse('Duplicated strategic activity')
        }
      },
      '/api/strategic-planning/activities/{id}/approve': {
        post: {
          tags: ['Strategic Planning'],
          summary: 'Approve a strategic activity',
          parameters: [idParam()],
          responses: okResponse('Approved strategic activity')
        }
      },
      '/api/strategic-planning/activities/{id}/chatter': {
        post: {
          tags: ['Strategic Planning'],
          summary: 'Post a chatter comment on a strategic activity',
          parameters: [idParam()],
          requestBody: { required: true, content: jsonContent('GenericObject') },
          responses: okResponse('Added chatter comment')
        }
      },

      // ==================== ADMIN STUDIO & SETTINGS ====================
      '/api/admin/settings': {
        get: {
          tags: ['Admin Studio & Settings'],
          summary: 'Get system settings including screen visibility, field schemas, and per-role screen permissions',
          security: [],
          responses: okResponse('System settings')
        },
        put: {
          tags: ['Admin Studio & Settings'],
          summary: 'Update system settings (Admin account only)',
          requestBody: { required: true, content: jsonContent('GenericObject') },
          responses: okResponse('Updated system settings')
        }
      },
      '/api/admin/settings/reset': {
        post: {
          tags: ['Admin Studio & Settings'],
          summary: 'Reset all system settings to defaults (Admin account only)',
          responses: okResponse('Reset system settings')
        }
      },
      '/api/admin/screens/{screenId}/fields': {
        post: {
          tags: ['Admin Studio & Settings'],
          summary: 'Add custom field to a screen (Admin account only)',
          parameters: [
            { name: 'screenId', in: 'path', required: true, schema: { type: 'string' } }
          ],
          requestBody: { required: true, content: jsonContent('GenericObject') },
          responses: okResponse('Added field')
        }
      },
      '/api/admin/screens/{screenId}/fields/{fieldKey}': {
        put: {
          tags: ['Admin Studio & Settings'],
          summary: 'Update field on a screen (Admin account only)',
          parameters: [
            { name: 'screenId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'fieldKey', in: 'path', required: true, schema: { type: 'string' } }
          ],
          requestBody: { required: true, content: jsonContent('GenericObject') },
          responses: okResponse('Updated field')
        },
        delete: {
          tags: ['Admin Studio & Settings'],
          summary: 'Delete field from a screen (Admin account only)',
          parameters: [
            { name: 'screenId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'fieldKey', in: 'path', required: true, schema: { type: 'string' } }
          ],
          responses: okResponse('Deleted field')
        }
      },
      '/api/admin/screens/{screenId}/reset': {
        post: {
          tags: ['Admin Studio & Settings'],
          summary: 'Reset screen schema to default (Admin account only)',
          parameters: [
            { name: 'screenId', in: 'path', required: true, schema: { type: 'string' } }
          ],
          responses: okResponse('Reset screen schema')
        }
      },
      '/api/admin/database/config': {
        get: {
          tags: ['Admin Studio & Settings'],
          summary: 'Get saved SQL Server connection config and live status (Admin account only)',
          responses: okResponse('SQL Server configuration and status')
        }
      },
      '/api/admin/database/test': {
        post: {
          tags: ['Admin Studio & Settings'],
          summary: 'Test direct SQL Server LocalDB connection without saving (Admin account only)',
          requestBody: { required: true, content: jsonContent('GenericObject') },
          responses: okResponse('SQL Server connection test result')
        }
      },
      '/api/admin/database/connect': {
        post: {
          tags: ['Admin Studio & Settings'],
          summary: 'Connect directly to SQL Server LocalDB, initialize schema, sync data, and update ASP.NET Core appsettings.json (Admin account only)',
          requestBody: { required: true, content: jsonContent('GenericObject') },
          responses: okResponse('Connected to SQL Server')
        }
      },
      '/api/admin/database/disconnect': {
        post: {
          tags: ['Admin Studio & Settings'],
          summary: 'Disconnect live SQL Server write-through sync (Admin account only)',
          responses: okResponse('Disconnected SQL Server sync')
        }
      },
      '/api/admin/database/sync': {
        post: {
          tags: ['Admin Studio & Settings'],
          summary: 'Run manual SQL Server schema init, push, or pull sync (Admin account only)',
          requestBody: { required: true, content: jsonContent('GenericObject') },
          responses: okResponse('SQL Server sync completed')
        }
      },
      '/api/reset-seed': {
        post: {
          tags: ['Admin Studio & Settings'],
          summary: 'Reset database to initial demo seed data (Admin account only)',
          responses: okResponse('Database reseeded')
        }
      }
    }
  };
}
