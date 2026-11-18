import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import swaggerUi from 'swagger-ui-express';
import { buildOpenApiSpec } from './swaggerSpec';
import {
  CORE_SQL_TABLES,
  SqlServerConnectionConfig,
  loadSqlServerConfig,
  normalizeSqlServerTarget,
  saveSqlServerConfig,
  toPublicSqlServerConfig,
  parseSqlServerConnectionString,
  syncDotnetAppsettings,
  testSqlServerConnection,
  initializeSqlServerSchema,
  pushDbToSqlServer,
  pullDbFromSqlServer,
  queueSqlServerSync
} from './sqlServerService';
import {
  AdminSystemSettings,
  ScreenFieldConfig,
  ScreenSchemaConfig,
  DEFAULT_SCREEN_SCHEMAS,
  DEFAULT_SCREEN_VISIBILITY,
  DEFAULT_SCREEN_ROLE_PERMISSIONS
} from './src/types/adminSettings';

const DATA_FILE = path.resolve(process.cwd(), 'database', 'pmo_live_db_v2.json');
const REFERENCE_TODAY = '2026-10-04';
const AUTH_TOKEN_SECRET =
  process.env.NEXORA_AUTH_SECRET || 'nexora-pmo-hmac-auth-secret-2026-v1';
const AUTH_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const revokedTokenIds = new Set<string>();

function hashPassword(plainPassword: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plainPassword, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(plainPassword: string, storedHash: string): boolean {
  if (!storedHash || typeof storedHash !== 'string') return false;
  if (storedHash.startsWith('scrypt$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 3) return false;
    const [, salt, expectedHex] = parts;
    try {
      const derived = crypto.scryptSync(plainPassword, salt, 64);
      const expected = Buffer.from(expectedHex, 'hex');
      if (derived.length !== expected.length) return false;
      return crypto.timingSafeEqual(derived, expected);
    } catch {
      return false;
    }
  }
  return plainPassword === storedHash;
}

interface AuthTokenPayload {
  uid: number;
  uname: string;
  role: string;
  jti: string;
  iat: number;
  exp: number;
}

function createAuthToken(user: { id: number; username: string }, roleName: string): string {
  const now = Date.now();
  const payload: AuthTokenPayload = {
    uid: user.id,
    uname: user.username,
    role: roleName,
    jti: crypto.randomUUID(),
    iat: now,
    exp: now + AUTH_TOKEN_TTL_MS
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', AUTH_TOKEN_SECRET)
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
}

function parseAndVerifyToken(token: string): AuthTokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;
  if (!encodedPayload || !signature) return null;

  const expectedSig = crypto
    .createHmac('sha256', AUTH_TOKEN_SECRET)
    .update(encodedPayload)
    .digest('base64url');

  const sigBuf = Buffer.from(signature, 'utf-8');
  const expectedBuf = Buffer.from(expectedSig, 'utf-8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf-8')
    ) as AuthTokenPayload;
    if (!decoded || !decoded.uid || !decoded.jti || !decoded.exp) return null;
    if (Date.now() > decoded.exp) return null;
    if (revokedTokenIds.has(decoded.jti)) return null;
    return decoded;
  } catch {
    return null;
  }
}

interface RoleRecord {
  id: number;
  name: string;
  description: string;
  descriptionAr?: string;
}

interface UserRecord {
  id: number;
  fullName: string;
  fullNameAr?: string;
  email: string;
  username: string;
  passwordHash: string;
  roleId: number;
  isActive: boolean;
}

interface DepartmentRecord {
  id: number;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  managerId?: number | null;
  responsibleManagerId?: number | null;
  isActive: boolean;
}

interface PortfolioRecord {
  id: number;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  departmentId: number | null;
  ownerId: number | null;
  startDate: string;
  endDate: string;
  targetDate?: string;
  status: string;
}

interface InitiativeRecord {
  id: number;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  departmentId: number | null;
  portfolioId: number;
  ownerId: number | null;
  startDate: string;
  targetDate: string;
  status: string;
  priority: string;
  progressPercentage: number;
}

interface ProjectRecord {
  id: number;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  initiativeId: number;
  projectManagerId: number | null;
  startDate: string;
  endDate: string;
  status: string;
  priority: string;
  progressPercentage: number;
  budget?: number;
}

interface WorkstreamRecord {
  id: number;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  projectId: number;
  ownerId: number | null;
  startDate: string;
  endDate: string;
  status: string;
  progressPercentage: number;
}

interface MilestoneRecord {
  id: number;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  projectId: number;
  workstreamId: number | null;
  ownerId: number | null;
  plannedDate: string;
  actualDate: string | null;
  status: 'Planned' | 'In Progress' | 'Completed' | 'Delayed';
}

interface ActivityRecord {
  id: number;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  projectId: number;
  workstreamId: number | null;
  milestoneId: number | null;
  parentActivityId: number | null;
  assignedUserId: number | null;
  startDate: string;
  dueDate: string;
  status: 'Not Started' | 'In Progress' | 'Completed';
  priority: string;
  progressPercentage: number;
}

interface TaskDependencyRecord {
  id: number;
  predecessorTaskId: number;
  successorTaskId: number;
  dependencyType: string;
}

export interface StrategicPerspective {
  id: string;
  name: string;
  nameEn?: string;
  weight: number;
  description?: string;
  descriptionEn?: string;
}

export interface StrategicGoal {
  id: string;
  perspectiveId: string;
  perspectiveName?: string;
  perspectiveNameEn?: string;
  title: string;
  titleEn?: string;
  weight: number;
  code?: string;
  description?: string;
  descriptionEn?: string;
}

export interface SeminarCardDetails {
  organizer?: string;
  organizerEn?: string;
  venue?: string;
  venueEn?: string;
  sessionDate?: string;
  executiveSummary?: string;
  executiveSummaryEn?: string;
  strategicPillars?: string[];
  strategicPillarsEn?: string[];
  keyStakeholders?: string;
  keyStakeholdersEn?: string;
  kpiFramework?: string;
  kpiFrameworkEn?: string;
  budgetNotes?: string;
  budgetNotesEn?: string;
  notes?: string;
  notesEn?: string;
}

export interface StrategicPlanRecord {
  id: number;
  titleAr: string;
  titleEn: string;
  cycle: string;
  yearsRange: string[];
  planType: string;
  planTypeEn?: string;
  vision: string;
  visionEn?: string;
  mission: string;
  missionEn?: string;
  description: string;
  descriptionEn?: string;
  strategicIssues: string[];
  strategicIssuesEn?: string[];
  values: string[];
  valuesEn?: string[];
  perspectives: StrategicPerspective[];
  goals: StrategicGoal[];
  seminarCard: SeminarCardDetails;
  status: 'Draft' | 'Approved';
  customFields?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface StrategicInitiativeRecord {
  id: number;
  title: string;
  titleEn?: string;
  code?: string;
  domains: string[];
  domainsEn?: string[];
  planId: number;
  departmentId: number;
  section: string;
  sectionEn?: string;
  planType: string;
  planTypeEn?: string;
  indicator: string;
  indicatorEn?: string;
  goalId: string;
  organizationUnit: string;
  organizationUnitEn?: string;
  cycle: string;
  years: string[];
  startDate: string;
  endDate: string;
  status: 'Draft' | 'Approved';
  customFields?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface ChatterMessage {
  id: string;
  type: 'message' | 'internal_note' | 'audit_log';
  author: string;
  authorEn?: string;
  authorRole?: string;
  authorRoleEn?: string;
  content: string;
  contentEn?: string;
  timestamp: string;
}

export interface StrategicActivityRecord {
  id: number;
  name: string;
  nameEn?: string;
  source: string;
  sourceEn?: string;
  domains: string[];
  domainsEn?: string[];
  indicator: string;
  indicatorEn?: string;
  initiativeId: number;
  departmentId: number;
  section: string;
  sectionEn?: string;
  startDate: string;
  endDate: string;
  targetValue: number;
  activityValue: number;
  isDevelopmentalProject: boolean;
  isExecutiveBodyActivity: boolean;
  status: 'Draft' | 'Approved';
  customFields?: Record<string, any>;
  chatter: ChatterMessage[];
  createdAt: string;
  updatedAt: string;
}

interface DatabaseSchema {
  roles: RoleRecord[];
  users: UserRecord[];
  departments: DepartmentRecord[];
  portfolios: PortfolioRecord[];
  initiatives: InitiativeRecord[];
  projects: ProjectRecord[];
  workstreams: WorkstreamRecord[];
  milestones: MilestoneRecord[];
  activities: ActivityRecord[];
  dependencies: TaskDependencyRecord[];
  // Strategic Planning Module
  strategicPlans: StrategicPlanRecord[];
  strategicInitiatives: StrategicInitiativeRecord[];
  strategicActivities: StrategicActivityRecord[];
  // Admin Screen & Field Customization Studio
  systemSettings: AdminSystemSettings;
}

const INITIAL_SYSTEM_SETTINGS: AdminSystemSettings = {
  menuVisibility: {
    'strategic-planning': true,
    'pmo-management': true,
    'pmo-dashboard': true,
    'progress-tracking': true,
    'overdue-activities': true,
    'activity-search': true,
    departments: true,
    portfolios: true,
    initiatives: true,
    projects: true,
    'project-workspace': true,
    dashboard: true,
    hierarchy: true,
    workstreams: false,
    milestones: false,
    activities: true,
    users: true,
    scheduling: true
  },
  screenRolePermissions: JSON.parse(JSON.stringify(DEFAULT_SCREEN_ROLE_PERMISSIONS)),
  screenLabels: {
    'strategic-planning': { ar: 'التخطيط الاستراتيجي', en: 'Strategic Planning' },
    'pmo-management': { ar: 'إدارة المشاريع', en: 'PMO Management' },
    'pmo-dashboard': { ar: 'لوحة تحكم مكتب المشاريع', en: 'PMO Dashboard' },
    'progress-tracking': { ar: 'تتبع الإنجاز', en: 'Progress Tracking' },
    'overdue-activities': { ar: 'الأنشطة المتأخرة', en: 'Overdue Activities' },
    'activity-search': { ar: 'البحث عن الأنشطة', en: 'Activity Search' },
    departments: { ar: '01. الإدارات', en: '01. Departments' },
    portfolios: { ar: '02. محافظ الأعمال', en: '02. Portfolios' },
    initiatives: { ar: '03. المبادرات', en: '03. Initiatives' },
    projects: { ar: '04. المشاريع', en: '04. Projects' },
    'project-workspace': { ar: 'مساحة عمل المشروع', en: 'Project Workspace' },
    dashboard: { ar: 'لوحة القيادة والمؤشرات', en: 'Dashboard' },
    hierarchy: { ar: 'الهيكل التنظيمي', en: 'Hierarchy Explorer' },
    workstreams: { ar: '05. مسارات العمل', en: '05. Workstreams' },
    milestones: { ar: '06. المعالم الرئيسية', en: '06. Milestones' },
    activities: { ar: '07. إدارة الأنشطة', en: '07. Activities' },
    users: { ar: '08. المستخدمون والأدوار', en: '08. Users & Roles' },
    scheduling: { ar: '09. جدولة المشاريع', en: '09. Project Scheduling' }
  },
  screenSchemas: DEFAULT_SCREEN_SCHEMAS,
  lastUpdatedBy: 'Hamada El Daley',
  lastUpdatedAt: new Date().toISOString()
};

const INITIAL_SEED: DatabaseSchema = {
  systemSettings: INITIAL_SYSTEM_SETTINGS,
  roles: [
    { id: 1, name: 'PMO Manager', description: 'Full oversight of departments, portfolios, initiatives, projects, and governance.', descriptionAr: 'إشراف كامل على الإدارات والمحافظ والمبادرات والمشاريع والحوكمة.' },
    { id: 2, name: 'Project Manager', description: 'Manages assigned initiatives, projects, schedules, and task allocations.', descriptionAr: 'إدارة المبادرات والمشاريع المكلف بها والجداول الزمنية وتوزيع المهام.' },
    { id: 3, name: 'Team Member', description: 'Executes project activities/tasks and updates task progress and status.', descriptionAr: 'تنفيذ أنشطة ومهام المشاريع وتحديث نسب التقدم وحالة الإنجاز.' }
  ],
  users: [
    { id: 7, fullName: 'Hamada El Daley', fullNameAr: 'حمادة الدالي', email: 'hamadamanus2@gmail.com', username: 'Hamada El Daley', passwordHash: 'PMO@2026@@', roleId: 1, isActive: true },
    { id: 1, fullName: 'Elena Vance', fullNameAr: 'إيلينا فانس', email: 'elena.vance@enterprise.org', username: 'pmo.admin', passwordHash: 'Pass123!', roleId: 1, isActive: true },
    { id: 2, fullName: 'Marcus Sterling', fullNameAr: 'ماركوس ستيرلينغ', email: 'marcus.sterling@enterprise.org', username: 'm.sterling', passwordHash: 'Pass123!', roleId: 2, isActive: true },
    { id: 3, fullName: 'Clara Chen', fullNameAr: 'كلارا تشين', email: 'clara.chen@enterprise.org', username: 'c.chen', passwordHash: 'Pass123!', roleId: 2, isActive: true },
    { id: 4, fullName: 'David Alverez', fullNameAr: 'ديفيد ألفاريز', email: 'david.alverez@enterprise.org', username: 'd.alverez', passwordHash: 'Pass123!', roleId: 3, isActive: true },
    { id: 5, fullName: 'Sophia Patel', fullNameAr: 'صوفيا باتيل', email: 'sophia.patel@enterprise.org', username: 's.patel', passwordHash: 'Pass123!', roleId: 3, isActive: true },
    { id: 6, fullName: "Liam O'Connor", fullNameAr: 'ليام أوكونور', email: 'liam.oconnor@enterprise.org', username: 'l.oconnor', passwordHash: 'Pass123!', roleId: 3, isActive: true }
  ],
  departments: [
    { id: 1, name: 'IT', nameAr: 'تقنية المعلومات', description: 'Information Technology, Enterprise Architecture, Cloud Infrastructure, and Cybersecurity.', descriptionAr: 'تقنية المعلومات، البنية المؤسسية، البنية السحابية، والأمن السيبراني.', isActive: true },
    { id: 2, name: 'Finance', nameAr: 'الإدارة المالية', description: 'Corporate Finance, Financial Planning & Analysis, Accounting, and Treasury.', descriptionAr: 'المالية المؤسسية، التخطيط والتحليل المالي، المحاسبة، والخزينة.', isActive: true },
    { id: 3, name: 'HR', nameAr: 'الموارد البشرية', description: 'Human Resources, Talent Acquisition, Organizational Development, and People Operations.', descriptionAr: 'الموارد البشرية، استقطاب الكفاءات، التطوير التنظيمي، وشؤون الموظفين.', isActive: true },
    { id: 4, name: 'Operations', nameAr: 'العمليات والتشغيل', description: 'Global Supply Chain, Facilities, Logistics, and Core Business Operations.', descriptionAr: 'سلاسل الإمداد العالمية، المرافق، اللوجستيات، والعمليات التشغيلية الأساسية.', isActive: true },
    { id: 5, name: 'Marketing', nameAr: 'التسويق والاتصال', description: 'Brand Strategy, Digital Customer Acquisition, Product Marketing, and Communications.', descriptionAr: 'استراتيجية العلامة التجارية، الاستقطاب الرقمي، تسويق المنتجات، والاتصال المؤسسي.', isActive: true }
  ],
  portfolios: [
    {
      id: 1,
      name: 'Digital Transformation Portfolio',
      nameAr: 'محفظة التحول الرقمي',
      description: 'Modernizing core enterprise platforms, cloud infrastructure, and customer-facing digital touchpoints.',
      descriptionAr: 'تحديث المنصات المؤسسية الأساسية والبنية السحابية ونقاط الاتصال الرقمية للمستفيدين.',
      departmentId: 1,
      ownerId: 1,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      status: 'Active'
    },
    {
      id: 2,
      name: 'Financial Governance & ERP Modernization',
      nameAr: 'الحوكمة المالية وتحديث أنظمة تخطيط الموارد',
      description: 'Automating financial reporting, audit readiness, and ERP ledger consolidation.',
      descriptionAr: 'أتمتة التقارير المالية، الجاهزية للتدقيق، وتوحيد دفاتر الأستاذ المالي.',
      departmentId: 2,
      ownerId: 1,
      startDate: '2026-02-01',
      endDate: '2026-11-30',
      status: 'Active'
    },
    {
      id: 3,
      name: 'Operational Excellence & Supply Resilience',
      nameAr: 'التميز التشغيلي ومرونة سلاسل الإمداد',
      description: 'Optimizing warehouse fulfillment, procurement workflows, and regional logistics.',
      descriptionAr: 'تحسين عمليات المستودعات، إجراءات المشتريات، والخدمات اللوجستية الإقليمية.',
      departmentId: 4,
      ownerId: 2,
      startDate: '2026-01-15',
      endDate: '2026-10-31',
      status: 'Active'
    },
    {
      id: 4,
      name: 'Workforce Empowerment & Talent Growth',
      nameAr: 'تمكين القوى العاملة وتنمية المواهب',
      description: 'Next-generation employee onboarding, continuous learning, and hybrid workplace enablement.',
      descriptionAr: 'تهيئة الموظفين الجدد، التعلم المستمر، وتمكين بيئة العمل الهجينة.',
      departmentId: 3,
      ownerId: 3,
      startDate: '2026-03-01',
      endDate: '2026-12-15',
      status: 'Planning'
    }
  ],
  initiatives: [
    {
      id: 1,
      name: 'Customer Service Initiative',
      nameAr: 'مبادرة خدمة العملاء والخدمات الذاتية',
      description: 'Unified omnichannel customer self-service and ticket resolution platform.',
      descriptionAr: 'منصة موحدة متعددة القنوات للخدمة الذاتية ومعالجة تذاكر الدعم.',
      departmentId: 1,
      portfolioId: 1,
      ownerId: 2,
      startDate: '2026-01-15',
      targetDate: '2026-11-30',
      status: 'In Progress',
      priority: 'High',
      progressPercentage: 62
    },
    {
      id: 2,
      name: 'Cloud Data Platform Migration',
      nameAr: 'ترحيل منصة البيانات السحابية',
      description: 'Consolidating legacy on-premise databases into a governed enterprise data warehouse.',
      descriptionAr: 'توحيد قواعد البيانات التقليدية في مستودع بيانات مؤسسي محوكَم.',
      departmentId: 1,
      portfolioId: 1,
      ownerId: 3,
      startDate: '2026-02-01',
      targetDate: '2026-11-15',
      status: 'In Progress',
      priority: 'Critical',
      progressPercentage: 70
    },
    {
      id: 3,
      name: 'Automated Expense & Treasury Control',
      nameAr: 'أتمتة المصروفات والرقابة على الخزينة',
      description: 'Real-time spend analytics and automated invoice reconciliation.',
      descriptionAr: 'تحليلات الإنفاق الفوري والمطابقة الآلية للفواتير.',
      departmentId: 2,
      portfolioId: 2,
      ownerId: 2,
      startDate: '2026-02-10',
      targetDate: '2026-08-31',
      status: 'Completed',
      priority: 'High',
      progressPercentage: 100
    },
    {
      id: 4,
      name: 'Smart Warehouse & Inventory Tracking',
      nameAr: 'المستودعات الذكية وتتبع المخزون',
      description: 'IoT-enabled inventory tracking and automated reorder forecasting across regional hubs.',
      descriptionAr: 'تتبع المخزون بتقنية إنترنت الأشياء والتنبؤ الآلي بإعادة الطلب عبر المراكز الإقليمية.',
      departmentId: 4,
      portfolioId: 3,
      ownerId: 3,
      startDate: '2026-01-20',
      targetDate: '2026-10-28',
      status: 'In Progress',
      priority: 'High',
      progressPercentage: 55
    },
    {
      id: 5,
      name: 'Brand Experience & Analytics Revamp',
      nameAr: 'تطوير تجربة العلامة التجارية والتحليلات',
      description: 'Multi-touch attribution modeling and unified customer journey analytics.',
      descriptionAr: 'نمذجة الإسناد متعدد القنوات وتوحيد تحليلات رحلة المستفيد.',
      departmentId: 5,
      portfolioId: 1,
      ownerId: 2,
      startDate: '2026-04-01',
      targetDate: '2026-12-01',
      status: 'In Progress',
      priority: 'Medium',
      progressPercentage: 30
    },
    {
      id: 6,
      name: 'Continuous Learning & Leadership Academy',
      nameAr: 'أكاديمية التعلم المستمر والقيادة',
      description: 'Digital competency framework and role-based certification tracks.',
      descriptionAr: 'إطار الكفاءات الرقمية ومسارات الشهادات التخصصية حسب الدور الوظيفي.',
      departmentId: 3,
      portfolioId: 4,
      ownerId: 3,
      startDate: '2026-03-15',
      targetDate: '2026-11-30',
      status: 'Not Started',
      priority: 'Medium',
      progressPercentage: 10
    }
  ],
  projects: [
    {
      id: 1,
      name: 'Customer Portal Implementation',
      nameAr: 'تنفيذ بوابة خدمة العملاء',
      description: 'Self-service web portal allowing customers to manage subscriptions, billing, and support requests.',
      descriptionAr: 'بوابة ويب للخدمة الذاتية تتيح للمستفيدين إدارة الاشتراكات والفواتير وطلبات الدعم.',
      initiativeId: 1,
      projectManagerId: 2,
      startDate: '2026-01-20',
      endDate: '2026-11-15',
      status: 'In Progress',
      priority: 'High',
      progressPercentage: 63
    },
    {
      id: 2,
      name: 'Service Desk Ticketing Integration',
      nameAr: 'تكامل نظام تذاكر مكتب الدعم الفني',
      description: 'Bi-directional synchronization between customer support queues and engineering issue tracking.',
      descriptionAr: 'مزامنة ثنائية الاتجاه بين قوائم الدعم الفني وأنظمة تتبع المشكلات الهندسية.',
      initiativeId: 1,
      projectManagerId: 3,
      startDate: '2026-03-01',
      endDate: '2026-10-25',
      status: 'In Progress',
      priority: 'Medium',
      progressPercentage: 60
    },
    {
      id: 3,
      name: 'Core ETL Pipeline Modernization',
      nameAr: 'تحديث خطوط أنابيب البيانات الأساسية',
      description: 'Building resilient data ingestion pipelines for daily operational reporting.',
      descriptionAr: 'بناء مسارات استيعاب بيانات مرنة لإعداد التقارير التشغيلية اليومية.',
      initiativeId: 2,
      projectManagerId: 3,
      startDate: '2026-02-15',
      endDate: '2026-10-20',
      status: 'In Progress',
      priority: 'Critical',
      progressPercentage: 70
    },
    {
      id: 4,
      name: 'Automated Invoice Matching Engine',
      nameAr: 'محرك المطابقة الآلية للفواتير',
      description: 'Three-way matching automation between purchase orders, goods receipts, and vendor invoices.',
      descriptionAr: 'أتمتة المطابقة الثلاثية بين أوامر الشراء وسندات الاستلام وفواتير الموردين.',
      initiativeId: 3,
      projectManagerId: 2,
      startDate: '2026-02-15',
      endDate: '2026-07-31',
      status: 'Completed',
      priority: 'High',
      progressPercentage: 100
    },
    {
      id: 5,
      name: 'Regional Hub Barcode & RFID Rollout',
      nameAr: 'نشر تقنيات الباركود وتتبع الأصول بالمراكز',
      description: 'Hardware deployment and WMS integration for real-time pallet scanning.',
      descriptionAr: 'توفير الأجهزة والتكامل مع نظام إدارة المستودعات لمسح المنصات فورياً.',
      initiativeId: 4,
      projectManagerId: 3,
      startDate: '2026-02-01',
      endDate: '2026-10-29',
      status: 'In Progress',
      priority: 'High',
      progressPercentage: 55
    },
    {
      id: 6,
      name: 'Unified Web Analytics Tagging',
      nameAr: 'توحيد وسوم تحليلات الويب',
      description: 'Standardized event taxonomy across all public web properties.',
      descriptionAr: 'تصنيف موحد للأحداث عبر جميع المنصات والمواقع الإلكترونية العامة.',
      initiativeId: 5,
      projectManagerId: 2,
      startDate: '2026-04-10',
      endDate: '2026-11-30',
      status: 'On Hold',
      priority: 'Medium',
      progressPercentage: 0
    },
    {
      id: 7,
      name: 'Onboarding Portal & Checklist Automation',
      nameAr: 'بوابة التهيئة وأتمتة قوائم التحقق',
      description: 'Automated Day-1 provisioning and training schedule for new hires.',
      descriptionAr: 'تجهيز حسابات اليوم الأول وجدولة التدريب الآلي للموظفين الجدد.',
      initiativeId: 6,
      projectManagerId: 3,
      startDate: '2026-04-01',
      endDate: '2026-11-25',
      status: 'Planned',
      priority: 'Low',
      progressPercentage: 0
    }
  ],
  workstreams: [
    { id: 1, name: 'Requirements', nameAr: 'تجميع المتطلبات', description: 'Business analysis, stakeholder interviews, and functional specifications.', descriptionAr: 'تحليل الأعمال ومقابلات أصحاب المصلحة والمواصفات الوظيفية.', projectId: 1, ownerId: 2, startDate: '2026-01-20', endDate: '2026-03-15', status: 'Completed', progressPercentage: 100 },
    { id: 2, name: 'UI/UX Design', nameAr: 'تصميم واجهة وتجربة المستخدم', description: 'Wireframes, interactive prototypes, and design system compliance.', descriptionAr: 'النماذج الأولية والتفاعلية والالتزام بنظام التصميم المعتمد.', projectId: 1, ownerId: 4, startDate: '2026-03-10', endDate: '2026-05-15', status: 'Completed', progressPercentage: 100 },
    { id: 3, name: 'Backend Development', nameAr: 'تطوير الأنظمة الخلفية', description: 'REST API microservices, authentication, and billing ledger integration.', descriptionAr: 'الخدمات المصغرة لواجهات البرمجة والمصادقة وتكامل سجل الفواتير.', projectId: 1, ownerId: 5, startDate: '2026-05-01', endDate: '2026-08-30', status: 'Completed', progressPercentage: 100 },
    { id: 4, name: 'Frontend Development', nameAr: 'تطوير الواجهات الأمامية', description: 'Angular customer portal components, responsive views, and state management.', descriptionAr: 'مكونات بوابة المستفيد التفاعلية والشاشات المتجاوبة وإدارة الحالة.', projectId: 1, ownerId: 5, startDate: '2026-06-01', endDate: '2026-10-10', status: 'In Progress', progressPercentage: 50 },
    { id: 5, name: 'Testing & QA', nameAr: 'الاختبار وضمان الجودة', description: 'Integration testing, security audit, and User Acceptance Testing (UAT).', descriptionAr: 'اختبارات التكامل والتدقيق الأمني واختبار قبول المستخدم.', projectId: 1, ownerId: 6, startDate: '2026-09-15', endDate: '2026-10-30', status: 'In Progress', progressPercentage: 25 },
    { id: 6, name: 'Deployment & Cutover', nameAr: 'النشر والإطلاق التشغيلي', description: 'Production release readiness, DNS cutover, and hypercare support.', descriptionAr: 'جاهزية الإطلاق الفعلي والتحول التشغيلي والدعم المكثف.', projectId: 1, ownerId: 2, startDate: '2026-11-01', endDate: '2026-11-15', status: 'Planned', progressPercentage: 0 },
    { id: 7, name: 'Webhook & API Integration', nameAr: 'تكامل واجهات البرمجة والإشعارات الفورية', description: 'Queue synchronization and payload transformation.', descriptionAr: 'مزامنة قوائم الانتظار ومعالجة وتحويل حزم البيانات.', projectId: 2, ownerId: 3, startDate: '2026-03-01', endDate: '2026-10-25', status: 'In Progress', progressPercentage: 60 },
    { id: 8, name: 'Data Warehouse Schema & ETL', nameAr: 'مخططات مستودع البيانات ومعالجة البيانات', description: 'Staging schemas and automated batch ingestion.', descriptionAr: 'بناء مخططات التجهيز والاستيعاب الدفعي المؤتمت للبيانات.', projectId: 3, ownerId: 6, startDate: '2026-02-15', endDate: '2026-10-20', status: 'In Progress', progressPercentage: 70 }
  ],
  milestones: [
    { id: 1, name: 'Requirements Approved', nameAr: 'اعتماد المتطلبات', description: 'Formal sign-off on Customer Portal functional requirements.', descriptionAr: 'الاعتماد الرسمي للمتطلبات الوظيفية لبوابة المستفيد.', projectId: 1, workstreamId: 1, ownerId: 2, plannedDate: '2026-03-15', actualDate: '2026-03-14', status: 'Completed' },
    { id: 2, name: 'Design Completed', nameAr: 'اكتمال التصميم', description: 'UI/UX design system and customer journey prototypes approved.', descriptionAr: 'اعتماد نظام التصميم ونماذج رحلة المستفيد.', projectId: 1, workstreamId: 2, ownerId: 4, plannedDate: '2026-05-15', actualDate: '2026-05-15', status: 'Completed' },
    { id: 3, name: 'Development Completed', nameAr: 'اكتمال التطوير', description: 'All backend APIs and Angular portal views feature-complete.', descriptionAr: 'اكتمال كافة واجهات البرمجة الخلفية وشاشات البوابة.', projectId: 1, workstreamId: 4, ownerId: 5, plannedDate: '2026-09-28', actualDate: null, status: 'Delayed' },
    { id: 4, name: 'UAT Completed', nameAr: 'اكتمال اختبار القبول', description: 'End-to-end user acceptance testing and security audit sign-off.', descriptionAr: 'اكتمال اختبارات قبول المستخدم الشاملة وتوقيع التدقيق الأمني.', projectId: 1, workstreamId: 5, ownerId: 6, plannedDate: '2026-10-28', actualDate: null, status: 'In Progress' },
    { id: 5, name: 'Go Live', nameAr: 'الإطلاق الفعلي', description: 'Production launch of Customer Portal Implementation.', descriptionAr: 'الإطلاق الإنتاجي الرسمي لمشروع بوابة خدمة العملاء.', projectId: 1, workstreamId: 6, ownerId: 2, plannedDate: '2026-11-15', actualDate: null, status: 'Planned' },
    { id: 6, name: 'Service Desk Sync Live', nameAr: 'تشغيل مزامنة مكتب الدعم', description: 'Production cutover of bi-directional ticket sync.', descriptionAr: 'التشغيل الفعلي للمزامنة ثنائية الاتجاه لتذاكر الدعم.', projectId: 2, workstreamId: 7, ownerId: 3, plannedDate: '2026-10-20', actualDate: null, status: 'In Progress' },
    { id: 7, name: 'Core Warehouse Cutover', nameAr: 'التحول إلى مستودع البيانات الأساسي', description: 'Legacy tables retired and reporting pointed to new warehouse.', descriptionAr: 'إيقاف الجداول التقليدية وتوجيه التقارير إلى مستودع البيانات الجديد.', projectId: 3, workstreamId: 8, ownerId: 3, plannedDate: '2026-10-18', actualDate: null, status: 'Planned' }
  ],
  activities: [
    // Project 1 Parent Activities
    { id: 1, name: 'Prepare Requirements Document', nameAr: 'إعداد وثيقة المتطلبات', description: 'Gather and baseline functional and security requirements for Customer Portal.', descriptionAr: 'تجميع واعتماد المتطلبات الوظيفية والأمنية لبوابة المستفيد.', projectId: 1, workstreamId: 1, milestoneId: 1, parentActivityId: null, assignedUserId: 4, startDate: '2026-01-22', dueDate: '2026-03-15', status: 'Completed', priority: 'High', progressPercentage: 100 },
    { id: 2, name: 'Create Portal Wireframes & Design System', nameAr: 'تصميم النماذج الأولية ونظام التصميم للبوابة', description: 'Interactive Figma prototypes and WCAG contrast validation.', descriptionAr: 'إعداد نماذج التصميم التفاعلية والتحقق من تباين الواجهات.', projectId: 1, workstreamId: 2, milestoneId: 2, parentActivityId: null, assignedUserId: 4, startDate: '2026-03-16', dueDate: '2026-05-15', status: 'Completed', priority: 'High', progressPercentage: 100 },
    { id: 3, name: 'Implement Core Billing & Auth APIs', nameAr: 'تطوير واجهات برمجة الفواتير والمصادقة الأساسية', description: 'Build ASP.NET Core endpoints for customer authentication and invoice retrieval.', descriptionAr: 'بناء نقاط النهاية البرمجية لمصادقة العملاء واسترجاع الفواتير.', projectId: 1, workstreamId: 3, milestoneId: 3, parentActivityId: null, assignedUserId: 5, startDate: '2026-05-16', dueDate: '2026-08-25', status: 'Completed', priority: 'Critical', progressPercentage: 100 },
    { id: 4, name: 'Develop Angular Self-Service Portal Views', nameAr: 'تطوير شاشات بوابة الخدمة الذاتية', description: 'Build account dashboard, invoice table, and ticket submission UI.', descriptionAr: 'بناء لوحة حساب المستفيد وجدول الفواتير ونموذج تقديم التذاكر.', projectId: 1, workstreamId: 4, milestoneId: 3, parentActivityId: null, assignedUserId: 5, startDate: '2026-06-15', dueDate: '2026-09-28', status: 'In Progress', priority: 'High', progressPercentage: 50 },
    { id: 5, name: 'Execute Security Audit & UAT Cycles', nameAr: 'تنفيذ التدقيق الأمني ودورات اختبار القبول', description: 'Run penetration testing and business stakeholder acceptance test cases.', descriptionAr: 'إجراء اختبارات الاختراق وحالات اختبار قبول أصحاب المصلحة.', projectId: 1, workstreamId: 5, milestoneId: 4, parentActivityId: null, assignedUserId: 6, startDate: '2026-09-29', dueDate: '2026-10-28', status: 'In Progress', priority: 'High', progressPercentage: 25 },
    { id: 6, name: 'Execute Production Deployment & Cutover', nameAr: 'تنفيذ النشر الإنتاجي والتحول التشغيلي', description: 'Deploy containers, run smoke tests, and switch production traffic.', descriptionAr: 'نشر الحاويات وإجراء الاختبارات الأولية وتحويل حركة التشغيل الفعلي.', projectId: 1, workstreamId: 6, milestoneId: 5, parentActivityId: null, assignedUserId: 2, startDate: '2026-11-01', dueDate: '2026-11-15', status: 'Not Started', priority: 'Critical', progressPercentage: 0 },

    // Other Projects Parent Activities
    { id: 7, name: 'Configure Webhook Listeners for Support Escalations', nameAr: 'تهيئة مستمعات الإشعارات الفورية لتصعيد الدعم', description: 'Create real-time event handlers for high-priority ticket routing.', descriptionAr: 'إنشاء معالجات الأحداث الفورية لتوجيه تذاكر الدعم عالية الأولوية.', projectId: 2, workstreamId: 7, milestoneId: 6, parentActivityId: null, assignedUserId: 4, startDate: '2026-03-10', dueDate: '2026-09-25', status: 'In Progress', priority: 'Medium', progressPercentage: 60 },
    { id: 8, name: 'Provision MySQL 8 Staging & Analytics Schemas', nameAr: 'تهيئة مخططات التجهيز والتحليلات في قاعدة البيانات', description: 'Establish relational schemas, indexes, and backup policies.', descriptionAr: 'إنشاء المخططات العلائقية والفهارس وسياسات النسخ الاحتياطي.', projectId: 3, workstreamId: 8, milestoneId: 7, parentActivityId: null, assignedUserId: 6, startDate: '2026-02-20', dueDate: '2026-05-30', status: 'Completed', priority: 'Critical', progressPercentage: 100 },
    { id: 9, name: 'Migrate Legacy Inventory Tables to Core Warehouse', nameAr: 'ترحيل جداول المخزون التقليدية إلى المستودع الأساسي', description: 'Validate data integrity and execute incremental batch transformation.', descriptionAr: 'التحقق من سلامة البيانات وتنفيذ التحويل الدفعي التزايدي.', projectId: 3, workstreamId: 8, milestoneId: 7, parentActivityId: null, assignedUserId: 5, startDate: '2026-06-01', dueDate: '2026-09-20', status: 'In Progress', priority: 'Critical', progressPercentage: 40 },
    { id: 10, name: 'User Acceptance Testing for ERP Invoice Engine', nameAr: 'اختبار قبول المستخدم لمحرك فواتير النظام المالي', description: 'Sign-off with corporate finance controllers on automated ledger postings.', descriptionAr: 'الحصول على اعتماد المراقبين الماليين للقيود الآلية.', projectId: 4, workstreamId: null, milestoneId: null, parentActivityId: null, assignedUserId: 4, startDate: '2026-06-01', dueDate: '2026-07-25', status: 'Completed', priority: 'High', progressPercentage: 100 },
    { id: 11, name: 'Calibrate RFID Scanners in Distribution Center North', nameAr: 'معايرة ماسحات تتبع الأصول في مركز التوزيع الشمالي', description: 'Site survey and signal verification across loading docks.', descriptionAr: 'مسح الموقع والتحقق من جودة الإشارة عبر أرصفة التحميل.', projectId: 5, workstreamId: null, milestoneId: null, parentActivityId: null, assignedUserId: 6, startDate: '2026-03-01', dueDate: '2026-10-25', status: 'In Progress', priority: 'High', progressPercentage: 55 },

    // Subtasks under Task 1
    { id: 12, name: 'Interview stakeholders', nameAr: 'مقابلة أصحاب المصلحة', description: 'Conduct workshops with Customer Support and Billing leads.', descriptionAr: 'عقد ورش عمل مع قادة خدمة العملاء والفوترة.', projectId: 1, workstreamId: 1, milestoneId: 1, parentActivityId: 1, assignedUserId: 4, startDate: '2026-01-22', dueDate: '2026-02-05', status: 'Completed', priority: 'High', progressPercentage: 100 },
    { id: 13, name: 'Document requirements', nameAr: 'توثيق المتطلبات', description: 'Draft user stories and acceptance criteria.', descriptionAr: 'صياغة قصص المستخدم ومعايير القبول.', projectId: 1, workstreamId: 1, milestoneId: 1, parentActivityId: 1, assignedUserId: 4, startDate: '2026-02-06', dueDate: '2026-02-20', status: 'Completed', priority: 'High', progressPercentage: 100 },
    { id: 14, name: 'Review requirements', nameAr: 'مراجعة المتطلبات', description: 'Peer review with architecture and security teams.', descriptionAr: 'مراجعة الأقران مع فرق البنية والأمن السيبراني.', projectId: 1, workstreamId: 1, milestoneId: 1, parentActivityId: 1, assignedUserId: 5, startDate: '2026-02-21', dueDate: '2026-03-05', status: 'Completed', priority: 'Medium', progressPercentage: 100 },
    { id: 15, name: 'Obtain approval', nameAr: 'الحصول على الاعتماد', description: 'Formal sign-off from Steering Committee.', descriptionAr: 'الاعتماد الرسمي من اللجنة التوجيهية.', projectId: 1, workstreamId: 1, milestoneId: 1, parentActivityId: 1, assignedUserId: 2, startDate: '2026-03-06', dueDate: '2026-03-15', status: 'Completed', priority: 'High', progressPercentage: 100 },

    // Subtasks under Task 4
    { id: 16, name: 'Build Customer Login & Session Guard', nameAr: 'بناء شاشة دخول المستفيد وحماية الجلسة', description: 'Implement JWT interceptor and role guard.', descriptionAr: 'تطبيق معترض رموز المصادقة وحماية الأدوار.', projectId: 1, workstreamId: 4, milestoneId: 3, parentActivityId: 4, assignedUserId: 5, startDate: '2026-06-15', dueDate: '2026-07-15', status: 'Completed', priority: 'High', progressPercentage: 100 },
    { id: 17, name: 'Build Invoice & Statement Download Grid', nameAr: 'بناء جدول الفواتير وتحميل الكشوفات', description: 'Sortable table with PDF statement download.', descriptionAr: 'جدول قابل للفرز مع إمكانية تنزيل كشف الحساب.', projectId: 1, workstreamId: 4, milestoneId: 3, parentActivityId: 4, assignedUserId: 5, startDate: '2026-07-16', dueDate: '2026-08-20', status: 'Completed', priority: 'High', progressPercentage: 100 },
    { id: 18, name: 'Build Support Ticket Submission Form', nameAr: 'بناء نموذج إرسال تذاكر الدعم', description: 'Reactive form with priority selector.', descriptionAr: 'نموذج تفاعلي مع محدد أولوية التذكرة.', projectId: 1, workstreamId: 4, milestoneId: 3, parentActivityId: 4, assignedUserId: 5, startDate: '2026-08-21', dueDate: '2026-09-15', status: 'In Progress', priority: 'Medium', progressPercentage: 0 },
    { id: 19, name: 'Build Subscription Upgrade Workflow', nameAr: 'بناء مسار ترقية الاشتراك', description: 'Self-service plan comparison and checkout confirmation.', descriptionAr: 'مقارنة الباقات للخدمة الذاتية وتأكيد الطلب.', projectId: 1, workstreamId: 4, milestoneId: 3, parentActivityId: 4, assignedUserId: 4, startDate: '2026-09-16', dueDate: '2026-09-28', status: 'Not Started', priority: 'Medium', progressPercentage: 0 }
  ],
  dependencies: [
    { id: 1, predecessorTaskId: 1, successorTaskId: 2, dependencyType: 'FinishToStart' },
    { id: 2, predecessorTaskId: 2, successorTaskId: 3, dependencyType: 'FinishToStart' },
    { id: 3, predecessorTaskId: 2, successorTaskId: 4, dependencyType: 'FinishToStart' },
    { id: 4, predecessorTaskId: 3, successorTaskId: 5, dependencyType: 'FinishToStart' },
    { id: 5, predecessorTaskId: 4, successorTaskId: 5, dependencyType: 'FinishToStart' },
    { id: 6, predecessorTaskId: 5, successorTaskId: 6, dependencyType: 'FinishToStart' },
    { id: 7, predecessorTaskId: 8, successorTaskId: 9, dependencyType: 'FinishToStart' }
  ],
  strategicPlans: [
    {
      id: 1,
      titleAr: 'الخطة الاستراتيجية للتحول الثقافي والمؤسسي (2026 - 2030)',
      titleEn: 'Strategic Plan for Cultural & Institutional Transformation (2026 - 2030)',
      cycle: '2026 - 2030',
      yearsRange: ['2026', '2027', '2028', '2029', '2030'],
      planType: 'خطة خمسية استراتيجية',
      planTypeEn: 'Five-Year Strategic Plan',
      vision: 'منظومة ثقافية رائدة عالمياً تسهم في تعزيز الاقتصاد المعرفي وتخليد الهوية الوطنية.',
      visionEn: 'A globally leading cultural ecosystem contributing to the knowledge economy and preserving national identity.',
      mission: 'تمكين القطاع الثقافي عبر برامج استثمارية مستدامة، تحول رقمي متكامل، وتنمية الكفاءات الوطنية.',
      missionEn: 'Empowering the cultural sector through sustainable investment programs, integrated digital transformation, and national capability building.',
      description: 'الخطة الاستراتيجية الشاملة المعتمدة للصندوق الثقافي لتحقيق الاستدامة التمويلية وبناء الشراكات الاستراتيجية ورفع كفاءة الإنفاق الاستثماري.',
      descriptionEn: 'The comprehensive strategic plan adopted by the Cultural Development Fund to achieve financial sustainability, build strategic partnerships, and improve investment spending efficiency.',
      strategicIssues: ['الاستدامة المالية والتمويل المبتكر', 'التحول الرقمي وأتمتة الخدمات', 'تنمية رأس المال البشري والشراكات'],
      strategicIssuesEn: ['Financial Sustainability & Innovative Financing', 'Digital Transformation & Service Automation', 'Human Capital Development & Partnerships'],
      values: ['الشفافية', 'الابتكار', 'الاستدامة', 'المرونة والريادة', 'التركيز على المستفيد'],
      valuesEn: ['Transparency', 'Innovation', 'Sustainability', 'Agility & Leadership', 'Beneficiary Focus'],
      perspectives: [
        { id: 'p1', name: 'المنظور المالي والاستدامة', nameEn: 'Financial & Sustainability Perspective', weight: 30, description: 'كفاءة إدارة الموارد والتمويل التنموي', descriptionEn: 'Resource management efficiency and developmental financing' },
        { id: 'p2', name: 'منظور المستفيدين وأصحاب المصلحة', nameEn: 'Beneficiaries & Stakeholders Perspective', weight: 25, description: 'رضا المستثمرين ورواد الأعمال الثقافيين', descriptionEn: 'Satisfaction of investors and cultural entrepreneurs' },
        { id: 'p3', name: 'منظور العمليات الداخلية والحوكمة', nameEn: 'Internal Processes & Governance Perspective', weight: 25, description: 'رقمنة العمليات والامتثال لمعايير الجودة', descriptionEn: 'Process digitization and compliance with quality standards' },
        { id: 'p4', name: 'منظور التعلم والنمو ورأس المال البشري', nameEn: 'Learning, Growth & Human Capital Perspective', weight: 20, description: 'استقطاب المواهب وتطوير بيئة العمل', descriptionEn: 'Talent attraction and workplace development' }
      ],
      goals: [
        { id: 'g1', perspectiveId: 'p1', perspectiveName: 'المنظور المالي والاستدامة', perspectiveNameEn: 'Financial & Sustainability Perspective', title: 'تنويع مصادر التمويل ورفع العائد الاستثماري للمحافظ', titleEn: 'Diversify funding sources and raise portfolio investment returns', weight: 15, code: 'GOAL-FIN-01' },
        { id: 'g2', perspectiveId: 'p1', perspectiveName: 'المنظور المالي والاستدامة', perspectiveNameEn: 'Financial & Sustainability Perspective', title: 'ترشيد النفقات التشغيلية وضمان الاستدامة الائتمانية', titleEn: 'Rationalize operating expenses and ensure credit sustainability', weight: 15, code: 'GOAL-FIN-02' },
        { id: 'g3', perspectiveId: 'p2', perspectiveName: 'منظور المستفيدين وأصحاب المصلحة', perspectiveNameEn: 'Beneficiaries & Stakeholders Perspective', title: 'توسيع نطاق الدعم للشركات الناشئة في القطاع الثقافي', titleEn: 'Expand support scope for startups in the cultural sector', weight: 15, code: 'GOAL-BEN-01' },
        { id: 'g4', perspectiveId: 'p2', perspectiveName: 'منظور المستفيدين وأصحاب المصلحة', perspectiveNameEn: 'Beneficiaries & Stakeholders Perspective', title: 'رفع مؤشر رضا المستفيدين والشركاء إلى أكثر من 90%', titleEn: 'Raise beneficiary and partner satisfaction index above 90%', weight: 10, code: 'GOAL-BEN-02' },
        { id: 'g5', perspectiveId: 'p3', perspectiveName: 'منظور العمليات الداخلية والحوكمة', perspectiveNameEn: 'Internal Processes & Governance Perspective', title: 'أتمتة دورة حياة التمويل والمنح بنسبة 100%', titleEn: 'Automate the funding and grants lifecycle 100%', weight: 15, code: 'GOAL-PROC-01' },
        { id: 'g6', perspectiveId: 'p3', perspectiveName: 'منظور العمليات الداخلية والحوكمة', perspectiveNameEn: 'Internal Processes & Governance Perspective', title: 'تطبيق أعلى معايير الحوكمة وإدارة المخاطر المؤسسية', titleEn: 'Apply the highest standards of governance and enterprise risk management', weight: 10, code: 'GOAL-PROC-02' },
        { id: 'g7', perspectiveId: 'p4', perspectiveName: 'منظور التعلم والنمو ورأس المال البشري', perspectiveNameEn: 'Learning, Growth & Human Capital Perspective', title: 'بناء كفاءات تخصصية في الاستثمار والتقييم الثقافي', titleEn: 'Build specialized competencies in cultural investment and appraisal', weight: 10, code: 'GOAL-LRN-01' },
        { id: 'g8', perspectiveId: 'p4', perspectiveName: 'منظور التعلم والنمو ورأس المال البشري', perspectiveNameEn: 'Learning, Growth & Human Capital Perspective', title: 'ترسيخ ثقافة الابتكار والتحسين المستمر', titleEn: 'Embed a culture of innovation and continuous improvement', weight: 10, code: 'GOAL-LRN-02' }
      ],
      seminarCard: {
        organizer: 'الإدارة العامة للاستراتيجية والتميز المؤسسي',
        organizerEn: 'General Directorate of Strategy & Institutional Excellence',
        venue: 'قاعة المؤتمرات الكبرى - المقر الرئيسي',
        venueEn: 'Grand Conference Hall - Headquarters',
        sessionDate: '2026-01-10',
        executiveSummary: 'تم اعتماد الخطة بعد جلسات عمل تشاركية شملت قيادات الصندوق وكبار أصحاب المصلحة.',
        executiveSummaryEn: 'The plan was approved following participatory workshops involving Fund leadership and senior stakeholders.',
        strategicPillars: ['التمكين المالي', 'البنية التحتية الرقمية', 'الأثر الثقافي والاجتماعي'],
        strategicPillarsEn: ['Financial Enablement', 'Digital Infrastructure', 'Cultural & Social Impact'],
        keyStakeholders: 'وزارة الثقافة، هيئة الترفيه، البنوك الشريكة، مجتمع رواد الأعمال',
        keyStakeholdersEn: 'Ministry of Culture, Entertainment Authority, Partner Banks, Entrepreneurship Community',
        kpiFramework: 'بطاقة الأداء المتوازن',
        kpiFrameworkEn: 'Balanced Scorecard',
        budgetNotes: 'ميزانية استثمارية معتمدة عبر خطوط الائتمان الاستراتيجي',
        budgetNotesEn: 'Approved investment budget across strategic credit lines',
        notes: 'تخضع الخطة لمراجعة ربع سنوية من قبل لجنة الاستراتيجية والمخاطر.',
        notesEn: 'The plan undergoes quarterly review by the Strategy and Risk Committee.'
      },
      status: 'Approved',
      createdAt: '2026-01-15T08:00:00Z',
      updatedAt: '2026-02-01T10:30:00Z'
    }
  ],
  strategicInitiatives: [
    {
      id: 1,
      title: 'برنامج المنح والحوافز للمشاريع الإبداعية الثقافية',
      titleEn: 'Grants & Incentives Program for Creative Cultural Projects',
      code: 'INIT-2026-001',
      domains: ['التمويل التنموي', 'الصناعات الإبداعية', 'التحول الرقمي'],
      domainsEn: ['Developmental Finance', 'Creative Industries', 'Digital Transformation'],
      planId: 1,
      departmentId: 1,
      section: 'قسم التمويل التنموي',
      sectionEn: 'Developmental Finance Division',
      planType: 'خطة خمسية استراتيجية',
      planTypeEn: 'Five-Year Strategic Plan',
      indicator: 'قيمة التمويلات المصروفة للمشاريع المستهدفة (مليون ريال)',
      indicatorEn: 'Value of disbursed financing to targeted projects (Million SAR)',
      goalId: 'g3',
      organizationUnit: 'الصندوق الثقافي',
      organizationUnitEn: 'Cultural Development Fund',
      cycle: '2026 - 2030',
      years: ['2026', '2027'],
      startDate: '2026-02-01',
      endDate: '2027-12-31',
      status: 'Approved',
      createdAt: '2026-02-01T09:00:00Z',
      updatedAt: '2026-02-15T11:00:00Z'
    },
    {
      id: 2,
      title: 'بوابة المستثمر الثقافي الرقمية الموحدة',
      titleEn: 'Unified Digital Cultural Investor Portal',
      code: 'INIT-2026-002',
      domains: ['التحول الرقمي', 'تجربة المستفيد'],
      domainsEn: ['Digital Transformation', 'Beneficiary Experience'],
      planId: 1,
      departmentId: 1,
      section: 'قسم الحلول الرقمية وتطوير الأنظمة',
      sectionEn: 'Digital Solutions & Systems Development Division',
      planType: 'خطة خمسية استراتيجية',
      planTypeEn: 'Five-Year Strategic Plan',
      indicator: 'نسبة المعاملات المكتملة رقمياً بالكامل',
      indicatorEn: 'Percentage of fully digitally completed transactions',
      goalId: 'g5',
      organizationUnit: 'الصندوق الثقافي',
      organizationUnitEn: 'Cultural Development Fund',
      cycle: '2026 - 2030',
      years: ['2026'],
      startDate: '2026-03-01',
      endDate: '2026-11-30',
      status: 'Draft',
      createdAt: '2026-03-01T10:00:00Z',
      updatedAt: '2026-03-10T14:00:00Z'
    }
  ],
  strategicActivities: [
    {
      id: 1,
      name: 'إطلاق مسار التمويل السريع للحرف اليدوية والفنون البصرية',
      nameEn: 'Launch Fast-Track Financing Path for Handicrafts & Visual Arts',
      source: 'أساس',
      sourceEn: 'Base System',
      domains: ['الصناعات الإبداعية', 'التمويل التنموي'],
      domainsEn: ['Creative Industries', 'Developmental Finance'],
      indicator: 'عدد المنشآت الصغيرة المستفيدة من التمويل السريع',
      indicatorEn: 'Number of small enterprises benefiting from fast-track financing',
      initiativeId: 1,
      departmentId: 1,
      section: 'قسم التمويل التنموي',
      sectionEn: 'Developmental Finance Division',
      startDate: '2026-03-01',
      endDate: '2026-08-31',
      targetValue: 150,
      activityValue: 2500000.0,
      isDevelopmentalProject: true,
      isExecutiveBodyActivity: true,
      status: 'Approved',
      chatter: [
        {
          id: 'c1',
          type: 'audit_log',
          author: 'النظام',
          authorEn: 'System',
          authorRole: 'النظام',
          authorRoleEn: 'System',
          content: 'تم إنشاء النشاط بحالة مسودة بواسطة مدير التخطيط.',
          contentEn: 'Activity created in Draft status by the Planning Manager.',
          timestamp: '2026-03-01 09:30'
        },
        {
          id: 'c2',
          type: 'internal_note',
          author: 'إيلينا فانس',
          authorEn: 'Elena Vance',
          authorRole: 'مدير مكتب إدارة المشاريع',
          authorRoleEn: 'PMO Manager',
          content: 'تم استيفاء دراسة الجدوى وتحديد الميزانية بالتنسيق مع الإدارة المالية.',
          contentEn: 'Feasibility study completed and budget finalized in coordination with Finance.',
          timestamp: '2026-03-05 11:15'
        },
        {
          id: 'c3',
          type: 'message',
          author: 'ماركوس ستيرلينغ',
          authorEn: 'Marcus Sterling',
          authorRole: 'مدير المشروع',
          authorRoleEn: 'Project Manager',
          content: 'تم تعميد النشاط بنجاح وجاهز لبدء مرحلة الإطلاق الميداني.',
          contentEn: 'Activity approved successfully and ready to commence field rollout.',
          timestamp: '2026-03-10 14:20'
        }
      ],
      createdAt: '2026-03-01T09:30:00Z',
      updatedAt: '2026-03-10T14:20:00Z'
    },
    {
      id: 2,
      name: 'تطوير محرك حاسبة التمويل والملاءة المالية في بوابة المستثمر',
      nameEn: 'Develop Financing & Creditworthiness Calculator Engine in Investor Portal',
      source: 'أساس',
      sourceEn: 'Base System',
      domains: ['التحول الرقمي'],
      domainsEn: ['Digital Transformation'],
      indicator: 'زمن دراسة الطلب الائتماني (أيام عمل)',
      indicatorEn: 'Credit application review turnaround time (business days)',
      initiativeId: 2,
      departmentId: 1,
      section: 'قسم الحلول الرقمية وتطوير الأنظمة',
      sectionEn: 'Digital Solutions & Systems Development Division',
      startDate: '2026-04-01',
      endDate: '2026-07-31',
      targetValue: 3,
      activityValue: 850000.0,
      isDevelopmentalProject: false,
      isExecutiveBodyActivity: true,
      status: 'Draft',
      chatter: [
        {
          id: 'c4',
          type: 'audit_log',
          author: 'النظام',
          authorEn: 'System',
          authorRole: 'النظام',
          authorRoleEn: 'System',
          content: 'تم إنشاء النشاط بحالة مسودة.',
          contentEn: 'Activity created in Draft status.',
          timestamp: '2026-04-01 10:00'
        }
      ],
      createdAt: '2026-04-01T10:00:00Z',
      updatedAt: '2026-04-01T10:00:00Z'
    }
  ]
};

function recalculateProjectProgress(db: DatabaseSchema, projectId: number): void {
  const projectTasks = db.activities.filter((a) => a.projectId === projectId);
  const parentTasks = projectTasks.filter((a) => a.parentActivityId === null);

  // 1. Update each parent task from its subtasks
  for (const parent of parentTasks) {
    const subs = projectTasks.filter((s) => s.parentActivityId === parent.id);
    if (subs.length > 0) {
      const sum = subs.reduce((acc, s) => acc + s.progressPercentage, 0);
      parent.progressPercentage = Math.round(sum / subs.length);
      if (subs.every((s) => s.status === 'Completed')) {
        parent.status = 'Completed';
      } else if (subs.some((s) => s.status === 'In Progress' || s.status === 'Completed')) {
        parent.status = 'In Progress';
      } else {
        parent.status = 'Not Started';
      }
    }
  }

  // 2. Update workstream progress from top-level activities in that workstream
  const projectWorkstreams = db.workstreams.filter((w) => w.projectId === projectId);
  for (const ws of projectWorkstreams) {
    const wsTasks = parentTasks.filter((a) => a.workstreamId === ws.id);
    if (wsTasks.length > 0) {
      const sum = wsTasks.reduce((acc, t) => acc + t.progressPercentage, 0);
      ws.progressPercentage = Math.round(sum / wsTasks.length);
      if (ws.progressPercentage === 100) {
        ws.status = 'Completed';
      } else if (ws.progressPercentage > 0 && ws.status === 'Planned') {
        ws.status = 'In Progress';
      }
    }
  }

  // 3. Update overall project progress from top-level activities
  const proj = db.projects.find((p) => p.id === projectId);
  if (proj) {
    if (parentTasks.length > 0) {
      const sum = parentTasks.reduce((acc, t) => acc + t.progressPercentage, 0);
      proj.progressPercentage = Math.round(sum / parentTasks.length);
    } else {
      proj.progressPercentage = 0;
    }
  }
}

function migrateBilingualDb(parsed: any): boolean {
  let changed = false;
  const seed = INITIAL_SEED;

  const copyAr = (targetList: any[], seedList: any[], fields: string[]) => {
    for (const item of targetList || []) {
      const ref = seedList.find((s) => s.id === item.id);
      if (!ref) continue;
      for (const f of fields) {
        if (!item[f] && ref[f]) {
          item[f] = ref[f];
          changed = true;
        }
      }
    }
  };

  copyAr(parsed.roles, seed.roles, ['descriptionAr']);
  copyAr(parsed.users, seed.users, ['fullNameAr']);
  copyAr(parsed.departments, seed.departments, ['nameAr', 'descriptionAr']);
  copyAr(parsed.portfolios, seed.portfolios, ['nameAr', 'descriptionAr']);
  copyAr(parsed.initiatives, seed.initiatives, ['nameAr', 'descriptionAr']);
  copyAr(parsed.projects, seed.projects, ['nameAr', 'descriptionAr']);
  copyAr(parsed.workstreams, seed.workstreams, ['nameAr', 'descriptionAr']);
  copyAr(parsed.milestones, seed.milestones, ['nameAr', 'descriptionAr']);
  copyAr(parsed.activities, seed.activities, ['nameAr', 'descriptionAr']);

  if (parsed.systemSettings) {
    const ss = parsed.systemSettings;
    if (ss.menuVisibility) {
      for (const [k, v] of Object.entries(INITIAL_SYSTEM_SETTINGS.menuVisibility)) {
        if (ss.menuVisibility[k] === undefined) {
          ss.menuVisibility[k] = v;
          changed = true;
        }
      }
    }
    if (ss.screenLabels) {
      for (const [k, v] of Object.entries(INITIAL_SYSTEM_SETTINGS.screenLabels)) {
        if (!ss.screenLabels[k]) {
          ss.screenLabels[k] = v;
          changed = true;
        }
      }
    }
    if (ss.screenSchemas) {
      for (const [k, schema] of Object.entries<any>(ss.screenSchemas)) {
        if (schema.nameAr && /\([A-Za-z &]+\)/.test(schema.nameAr)) {
          schema.nameAr = schema.nameAr.replace(/\s*\([A-Za-z &]+\)/g, '').trim();
          changed = true;
        }
        const defSchema = DEFAULT_SCREEN_SCHEMAS[k];
        if (defSchema && Array.isArray(schema.fields)) {
          for (const f of schema.fields) {
            const defField = defSchema.fields.find((df) => df.key === f.key);
            if (defField) {
              if (defField.optionsEn && !f.optionsEn) {
                f.optionsEn = [...defField.optionsEn];
                changed = true;
              }
              if (defField.defaultValueEn && !f.defaultValueEn) {
                f.defaultValueEn = defField.defaultValueEn;
                changed = true;
              }
            }
          }
        }
      }
    }
  }
  return changed;
}

function loadDb(): DatabaseSchema {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      // Ensure strategic planning tables exist if reading older database format
      if (!parsed.strategicPlans) parsed.strategicPlans = JSON.parse(JSON.stringify(INITIAL_SEED.strategicPlans));
      if (!parsed.strategicInitiatives) parsed.strategicInitiatives = JSON.parse(JSON.stringify(INITIAL_SEED.strategicInitiatives));
      if (!parsed.strategicActivities) parsed.strategicActivities = JSON.parse(JSON.stringify(INITIAL_SEED.strategicActivities));
      if (!parsed.systemSettings) parsed.systemSettings = JSON.parse(JSON.stringify(INITIAL_SYSTEM_SETTINGS));
      if (!parsed.systemSettings.screenRolePermissions || typeof parsed.systemSettings.screenRolePermissions !== 'object') {
        parsed.systemSettings.screenRolePermissions = JSON.parse(JSON.stringify(DEFAULT_SCREEN_ROLE_PERMISSIONS));
      } else {
        for (const [screenId, defaultRoles] of Object.entries(DEFAULT_SCREEN_ROLE_PERMISSIONS)) {
          if (!Array.isArray(parsed.systemSettings.screenRolePermissions[screenId])) {
            parsed.systemSettings.screenRolePermissions[screenId] = [...defaultRoles];
          }
        }
      }

      // Ensure Hamada El Daley exists in users and has PMO Manager / Admin role (roleId: 1)
      let migrated = false;
      let hamada = parsed.users.find(
        (u: any) =>
          u.email?.toLowerCase() === 'hamadamanus2@gmail.com' ||
          u.username?.toLowerCase() === 'hamada el daley' ||
          u.username?.toLowerCase() === 'hamada.admin' ||
          u.username?.toLowerCase() === 'hamada' ||
          u.fullName?.toLowerCase().includes('hamada')
      );
      if (!hamada) {
        parsed.users.unshift({
          id: 7,
          fullName: 'Hamada El Daley',
          fullNameAr: 'حمادة الدالي',
          email: 'hamadamanus2@gmail.com',
          username: 'Hamada El Daley',
          passwordHash: 'PMO@2026@@',
          roleId: 1,
          isActive: true
        });
        migrated = true;
      } else {
        hamada.roleId = 1;
        hamada.isActive = true;
        hamada.fullName = 'Hamada El Daley';
        if (!hamada.fullNameAr) hamada.fullNameAr = 'حمادة الدالي';
        hamada.email = 'hamadamanus2@gmail.com';
        if (hamada.username !== 'Hamada El Daley') {
          hamada.username = 'Hamada El Daley';
          hamada.passwordHash = hashPassword('PMO@2026@@');
          migrated = true;
        } else if (!hamada.passwordHash) {
          hamada.passwordHash = hashPassword('PMO@2026@@');
          migrated = true;
        }
      }

      // Migrate any legacy plaintext passwords to scrypt hashes
      for (const u of parsed.users || []) {
        if (u.passwordHash && !String(u.passwordHash).startsWith('scrypt$')) {
          u.passwordHash = hashPassword(String(u.passwordHash));
          migrated = true;
        }
      }
      if (migrateBilingualDb(parsed)) {
        migrated = true;
      }
      if (migrated) {
        saveDb(parsed);
      }

      return parsed;
    }
  } catch (e) {
    console.error('Error loading DB file, resetting to seed:', e);
  }
  const cloned = JSON.parse(JSON.stringify(INITIAL_SEED)) as DatabaseSchema;
  for (const u of cloned.users) {
    if (u.passwordHash && !u.passwordHash.startsWith('scrypt$')) {
      u.passwordHash = hashPassword(u.passwordHash);
    }
  }
  for (const p of cloned.projects) {
    recalculateProjectProgress(cloned, p.id);
  }
  saveDb(cloned);
  return cloned;
}

function saveDb(data: DatabaseSchema, skipSqlSync = false): void {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  if (!skipSqlSync) {
    queueSqlServerSync(data);
  }
}

// ==================== PROGRESS CALCULATION HELPERS (Epic 04) ====================
export interface ProgressCalcResult {
  progressPercentage: number | null;
  hasProgressData: boolean;
}

export function calculateProjectProgressMeta(projectId: number, db: DatabaseSchema): ProgressCalcResult {
  const allProjectActivities = db.activities.filter((a) => a.projectId === projectId);
  if (allProjectActivities.length === 0) {
    return { progressPercentage: null, hasProgressData: false };
  }

  const parentActivities = allProjectActivities.filter((a) => a.parentActivityId === null);
  const sourceActivities = parentActivities.length > 0 ? parentActivities : allProjectActivities;

  const validValues = sourceActivities
    .map((a) => {
      if (a.progressPercentage !== undefined && a.progressPercentage !== null && a.progressPercentage !== ('' as any)) {
        const num = Number(a.progressPercentage);
        if (!isNaN(num)) return Math.min(100, Math.max(0, num));
      }
      return null;
    })
    .filter((v): v is number => v !== null);

  if (validValues.length === 0) {
    return { progressPercentage: null, hasProgressData: false };
  }

  const avg = Math.round(validValues.reduce((acc, v) => acc + v, 0) / validValues.length);
  return {
    progressPercentage: Math.min(100, Math.max(0, avg)),
    hasProgressData: true
  };
}

export function calculateProjectProgress(projectId: number, db: DatabaseSchema): number {
  const meta = calculateProjectProgressMeta(projectId, db);
  if (meta.hasProgressData && meta.progressPercentage !== null) {
    return meta.progressPercentage;
  }
  const pr = db.projects.find((p) => p.id === projectId);
  return pr ? Math.min(100, Math.max(0, Math.round(Number(pr.progressPercentage) || 0))) : 0;
}

export function calculateInitiativeProgressMeta(initiativeId: number, db: DatabaseSchema): ProgressCalcResult {
  const projects = db.projects.filter((pr) => pr.initiativeId === initiativeId);
  if (projects.length === 0) {
    return { progressPercentage: null, hasProgressData: false };
  }

  const validProjectProgresses = projects
    .map((pr) => calculateProjectProgressMeta(pr.id, db))
    .filter((m) => m.hasProgressData && m.progressPercentage !== null)
    .map((m) => m.progressPercentage as number);

  if (validProjectProgresses.length === 0) {
    return { progressPercentage: null, hasProgressData: false };
  }

  const avg = Math.round(
    validProjectProgresses.reduce((acc, v) => acc + v, 0) / validProjectProgresses.length
  );
  return {
    progressPercentage: Math.min(100, Math.max(0, avg)),
    hasProgressData: true
  };
}

export function calculateInitiativeProgress(initiativeId: number, db: DatabaseSchema): number {
  const meta = calculateInitiativeProgressMeta(initiativeId, db);
  if (meta.hasProgressData && meta.progressPercentage !== null) {
    return meta.progressPercentage;
  }
  const init = db.initiatives.find((i) => i.id === initiativeId);
  return init ? Math.min(100, Math.max(0, Math.round(Number(init.progressPercentage) || 0))) : 0;
}

// ==================== OVERDUE ACTIVITY EVALUATION HELPERS (Epic 05) ====================
export function getCurrentIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isActivityOverdue(activity: ActivityRecord, currentDateStr = getCurrentIsoDate()): boolean {
  const due = String(activity.dueDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) {
    return false;
  }
  const normalizedStatus = String(activity.status || '').trim().toLowerCase();
  if (normalizedStatus === 'completed') {
    return false;
  }
  return due < currentDateStr;
}

export function calculateDaysOverdue(dueDate: string, currentDateStr = getCurrentIsoDate()): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || dueDate >= currentDateStr) {
    return 0;
  }
  const dueMs = new Date(`${dueDate}T00:00:00Z`).getTime();
  const curMs = new Date(`${currentDateStr}T00:00:00Z`).getTime();
  if (isNaN(dueMs) || isNaN(curMs) || curMs <= dueMs) {
    return 0;
  }
  return Math.max(0, Math.round((curMs - dueMs) / 86400000));
}

function enrichProjects(db: DatabaseSchema) {
  const currentDateStr = getCurrentIsoDate();
  return db.projects.map((pr) => {
    const dynamicProgress = calculateProjectProgress(pr.id, db);
    const init = db.initiatives.find((i) => i.id === pr.initiativeId);
    const port = init ? db.portfolios.find((p) => p.id === init.portfolioId) : null;
    const dept = init ? db.departments.find((d) => d.id === init.departmentId) : null;
    const pm = db.users.find((u) => u.id === pr.projectManagerId);
    const projActivities = db.activities.filter((a) => a.projectId === pr.id);
    const parentCount = projActivities.filter((a) => a.parentActivityId === null).length;
    const overdueCount = projActivities.filter((a) =>
      isActivityOverdue(a, currentDateStr)
    ).length;

    return {
      ...pr,
      progressPercentage: dynamicProgress,
      initiativeName: init ? init.name : null,
      initiativeNameAr: init ? (init.nameAr || init.name) : null,
      portfolioId: port ? port.id : null,
      portfolioName: port ? port.name : null,
      portfolioNameAr: port ? (port.nameAr || port.name) : null,
      departmentId: dept ? dept.id : null,
      departmentName: dept ? dept.name : null,
      departmentNameAr: dept ? (dept.nameAr || dept.name) : null,
      projectManagerName: pm ? pm.fullName : null,
      projectManagerNameAr: pm ? (pm.fullNameAr || pm.fullName) : null,
      workstreamCount: db.workstreams.filter((w) => w.projectId === pr.id).length,
      milestoneCount: db.milestones.filter((m) => m.projectId === pr.id).length,
      activityCount: parentCount,
      overdueActivityCount: overdueCount
    };
  });
}

function enrichMilestones(db: DatabaseSchema) {
  return db.milestones.map((m) => {
    const proj = db.projects.find((p) => p.id === m.projectId);
    const ws = db.workstreams.find((w) => w.id === m.workstreamId);
    const owner = db.users.find((u) => u.id === m.ownerId);
    const isDelayed =
      m.status === 'Delayed' || (m.status !== 'Completed' && m.plannedDate < REFERENCE_TODAY);
    return {
      ...m,
      projectName: proj ? proj.name : null,
      projectNameAr: proj ? (proj.nameAr || proj.name) : null,
      workstreamName: ws ? ws.name : null,
      workstreamNameAr: ws ? (ws.nameAr || ws.name) : null,
      ownerName: owner ? owner.fullName : null,
      ownerNameAr: owner ? (owner.fullNameAr || owner.fullName) : null,
      isDelayed,
      linkedActivityCount: db.activities.filter((a) => a.milestoneId === m.id && a.parentActivityId === null).length
    };
  });
}

function enrichDependencies(db: DatabaseSchema, projectId?: number | null) {
  let list = db.dependencies.map((dep) => {
    const pred = db.activities.find((a) => a.id === dep.predecessorTaskId);
    const succ = db.activities.find((a) => a.id === dep.successorTaskId);
    return {
      ...dep,
      predecessorTaskName: pred ? pred.name : 'Unknown Task',
      predecessorTaskNameAr: pred ? (pred.nameAr || pred.name) : 'مهمة غير معروفة',
      predecessorStatus: pred ? pred.status : 'Not Started',
      successorTaskName: succ ? succ.name : 'Unknown Task',
      successorTaskNameAr: succ ? (succ.nameAr || succ.name) : 'مهمة غير معروفة',
      successorStatus: succ ? succ.status : 'Not Started',
      projectId: pred ? pred.projectId : succ ? succ.projectId : 0
    };
  });
  if (projectId) {
    list = list.filter((d) => d.projectId === projectId);
  }
  return list;
}

function enrichActivities(db: DatabaseSchema) {
  const allDeps = enrichDependencies(db);
  const currentDateStr = getCurrentIsoDate();

  const mapSingle = (a: ActivityRecord): any => {
    const proj = db.projects.find((pr) => pr.id === a.projectId);
    const init = proj ? db.initiatives.find((i) => i.id === proj.initiativeId) : null;
    const ws = db.workstreams.find((w) => w.id === a.workstreamId);
    const ms = db.milestones.find((m) => m.id === a.milestoneId);
    const parent = a.parentActivityId ? db.activities.find((p) => p.id === a.parentActivityId) : null;
    const user = db.users.find((u) => u.id === a.assignedUserId);

    const rawSubtasks = db.activities.filter((sub) => sub.parentActivityId === a.id);
    const subtasks = rawSubtasks.map((sub) => {
      const subUser = db.users.find((u) => u.id === sub.assignedUserId);
      const subOverdue = isActivityOverdue(sub, currentDateStr);
      return {
        ...sub,
        projectName: proj ? proj.name : null,
        projectNameAr: proj ? (proj.nameAr || proj.name) : null,
        initiativeId: init ? init.id : null,
        initiativeName: init ? init.name : null,
        initiativeNameAr: init ? (init.nameAr || init.name) : null,
        workstreamName: ws ? ws.name : null,
        workstreamNameAr: ws ? (ws.nameAr || ws.name) : null,
        milestoneName: ms ? ms.name : null,
        milestoneNameAr: ms ? (ms.nameAr || ms.name) : null,
        parentActivityName: a.name,
        parentActivityNameAr: a.nameAr || a.name,
        assignedUserName: subUser ? subUser.fullName : null,
        assignedUserNameAr: subUser ? (subUser.fullNameAr || subUser.fullName) : null,
        isOverdue: subOverdue,
        daysOverdue: subOverdue ? calculateDaysOverdue(sub.dueDate, currentDateStr) : 0,
        subtaskCount: 0,
        completedSubtaskCount: 0,
        subtasks: [],
        predecessors: allDeps.filter((d) => d.successorTaskId === sub.id),
        successors: allDeps.filter((d) => d.predecessorTaskId === sub.id)
      };
    });

    const completedSubtaskCount = subtasks.filter((s) => s.status === 'Completed').length;
    const actOverdue = isActivityOverdue(a, currentDateStr);

    return {
      ...a,
      projectName: proj ? proj.name : null,
      projectNameAr: proj ? (proj.nameAr || proj.name) : null,
      initiativeId: init ? init.id : null,
      initiativeName: init ? init.name : null,
      initiativeNameAr: init ? (init.nameAr || init.name) : null,
      workstreamName: ws ? ws.name : null,
      workstreamNameAr: ws ? (ws.nameAr || ws.name) : null,
      milestoneName: ms ? ms.name : null,
      milestoneNameAr: ms ? (ms.nameAr || ms.name) : null,
      parentActivityName: parent ? parent.name : null,
      parentActivityNameAr: parent ? (parent.nameAr || parent.name) : null,
      assignedUserName: user ? user.fullName : null,
      assignedUserNameAr: user ? (user.fullNameAr || user.fullName) : null,
      isOverdue: actOverdue,
      daysOverdue: actOverdue ? calculateDaysOverdue(a.dueDate, currentDateStr) : 0,
      subtaskCount: subtasks.length,
      completedSubtaskCount,
      subtasks,
      predecessors: allDeps.filter((d) => d.successorTaskId === a.id),
      successors: allDeps.filter((d) => d.predecessorTaskId === a.id)
    };
  };

  return db.activities.map(mapSingle);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Direct SQL Server Bootstrap: if Admin enabled direct SQL Server LocalDB connection, verify & sync on startup
  const startupSqlConfig = loadSqlServerConfig();
  if (startupSqlConfig.enabled) {
    try {
      const testRes = await testSqlServerConnection(startupSqlConfig);
      if (testRes.connected) {
        if (!testRes.databaseExists || testRes.tables.length === 0) {
          if (startupSqlConfig.autoCreateSchema) {
            await initializeSqlServerSchema(startupSqlConfig);
            const currentDb = loadDb();
            await pushDbToSqlServer(startupSqlConfig, currentDb);
          }
        } else {
          const currentDb = loadDb();
          const hasCoreRows = Number(testRes.tableRowCounts['Projects'] || 0) > 0;
          if (hasCoreRows) {
            const pulled = await pullDbFromSqlServer(startupSqlConfig, currentDb);
            saveDb(pulled.db, true);
          } else {
            await pushDbToSqlServer(startupSqlConfig, currentDb);
          }
        }
        startupSqlConfig.lastConnectedAt = new Date().toISOString();
        startupSqlConfig.serverVersion = testRes.serverVersion;
        startupSqlConfig.lastError = null;
        saveSqlServerConfig(startupSqlConfig);
        console.log(`SQL Server connected directly (${startupSqlConfig.host} / ${startupSqlConfig.database})`);
      } else {
        startupSqlConfig.lastError = testRes.message;
        saveSqlServerConfig(startupSqlConfig);
        console.warn(`SQL Server direct connection enabled but unreachable: ${testRes.message}`);
      }
    } catch (sqlErr: any) {
      startupSqlConfig.lastError = sqlErr?.message || 'Startup SQL Server sync failed.';
      saveSqlServerConfig(startupSqlConfig);
      console.warn('SQL Server startup error:', startupSqlConfig.lastError);
    }
  }

  // ==================== SECURITY & RBAC HELPERS (EPIC 10) ====================
  interface AuthenticatedRequestUser {
    userId: number;
    fullName: string;
    fullNameAr?: string;
    username: string;
    email: string;
    roleId: number;
    roleName: string;
    jti: string;
  }

  const sanitizeUser = (u: UserRecord, db: DatabaseSchema) => {
    const role = db.roles.find((r) => r.id === u.roleId);
    return {
      id: u.id,
      fullName: u.fullName,
      fullNameAr: u.fullNameAr || u.fullName,
      email: u.email,
      username: u.username,
      roleId: u.roleId,
      roleName: role?.name || 'Team Member',
      roleDescription: role?.description || '',
      roleDescriptionAr: role?.descriptionAr || '',
      isActive: u.isActive
    };
  };

  const extractBearerToken = (req: express.Request): string | null => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return authHeader.slice(7).trim() || null;
  };

  const isPublicApiRoute = (method: string, routePath: string): boolean => {
    if (method === 'OPTIONS') return true;
    const normalized = routePath.replace(/\/+$/, '') || '/';
    if (method === 'POST' && normalized === '/auth/login') return true;
    if (method === 'POST' && normalized === '/auth/quick-login') return true;
    if (method === 'POST' && normalized === '/auth/register') return true;
    if (method === 'POST' && normalized === '/auth/logout') return true;
    if (method === 'POST' && normalized === '/auth/forgot-password') return true;
    if (method === 'POST' && normalized === '/auth/reset-password') return true;
    if (method === 'GET' && normalized === '/auth/users') return true;
    if (method === 'GET' && normalized === '/admin/settings') return true;
    return false;
  };

  const getRequiredRolesForRoute = (method: string, routePath: string): string[] | null => {
    const normalized = routePath.replace(/\/+$/, '') || '/';

    // PMO Manager only: User Management & Role Assignment
    if (normalized === '/users' || /^\/users\/\d+(\/status)?$/.test(normalized)) {
      return ['PMO Manager'];
    }
    if (/^\/auth\/users\/\d+\/role$/.test(normalized) && method === 'PUT') {
      return ['PMO Manager'];
    }

    // PMO Manager or Project Manager: user options for owner/assignee selectors
    if (normalized === '/users/options' && method === 'GET') {
      return ['PMO Manager', 'Project Manager'];
    }

    // PMO Manager only: Admin Studio & Seed Reset
    if (
      (normalized.startsWith('/admin/') && method !== 'GET') ||
      normalized === '/reset-seed'
    ) {
      return ['PMO Manager'];
    }

    // PMO Manager only: Governance structure mutations & Project deletion
    if (
      (normalized.startsWith('/departments') ||
        normalized.startsWith('/portfolios') ||
        normalized.startsWith('/initiatives')) &&
      method !== 'GET'
    ) {
      return ['PMO Manager'];
    }
    if (normalized.startsWith('/projects') && method === 'DELETE') {
      return ['PMO Manager'];
    }

    // PMO Manager or Project Manager: Project create/update/schedule, Workstreams, Milestones, Dependencies, Strategic Planning mutations
    if (normalized.startsWith('/projects') && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      return ['PMO Manager', 'Project Manager'];
    }
    if (
      (normalized.startsWith('/workstreams') ||
        normalized.startsWith('/milestones') ||
        normalized.startsWith('/dependencies') ||
        normalized.startsWith('/strategic-planning')) &&
      method !== 'GET'
    ) {
      return ['PMO Manager', 'Project Manager'];
    }

    // Activities: Create & Delete restricted to PMO Manager & Project Manager; Status updates & execution allowed for Team Member too
    if (normalized === '/activities' && method === 'POST') {
      return ['PMO Manager', 'Project Manager'];
    }
    if (/^\/activities\/\d+$/.test(normalized) && method === 'DELETE') {
      return ['PMO Manager', 'Project Manager'];
    }

    return null; // Any authenticated user
  };

  const isAdminAccountUser = (authUser: AuthenticatedRequestUser): boolean => {
    const username = (authUser.username || '').trim().toLowerCase();
    const email = (authUser.email || '').trim().toLowerCase();
    return (
      username === 'hamada el daley' ||
      username === 'hamada.admin' ||
      username === 'admin' ||
      email === 'hamadamanus2@gmail.com'
    );
  };

  const requiresAdminAccountOnly = (method: string, routePath: string): boolean => {
    const normalized = routePath.replace(/\/+$/, '') || '/';
    if (normalized === '/users' || /^\/users\/\d+(\/status)?$/.test(normalized)) {
      return true;
    }
    if (/^\/auth\/users\/\d+\/role$/.test(normalized) && method === 'PUT') {
      return true;
    }
    if (normalized.startsWith('/admin/database')) {
      return true;
    }
    if (normalized.startsWith('/admin/') && method !== 'GET') {
      return true;
    }
    return false;
  };

  app.use('/api', (req, res, next) => {
    if (isPublicApiRoute(req.method, req.path)) {
      next();
      return;
    }

    const token = extractBearerToken(req);
    const verified = token ? parseAndVerifyToken(token) : null;
    if (!verified) {
      res.status(401).json({ message: 'Authentication required. Please sign in.' });
      return;
    }

    const db = loadDb();
    const user = db.users.find((u) => u.id === verified.uid);
    if (!user) {
      res.status(401).json({ message: 'Session is no longer valid. Please sign in again.' });
      return;
    }
    if (!user.isActive) {
      res.status(403).json({ message: 'Your user account has been deactivated.' });
      return;
    }

    const role = db.roles.find((r) => r.id === user.roleId);
    const roleName = role?.name || 'Team Member';
    const authUser: AuthenticatedRequestUser = {
      userId: user.id,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      roleId: user.roleId,
      roleName,
      jti: verified.jti
    };
    (req as any).authUser = authUser;

    if (requiresAdminAccountOnly(req.method, req.path) && !isAdminAccountUser(authUser)) {
      res.status(403).json({
        message: 'Access denied. This action is restricted to the Admin account.'
      });
      return;
    }

    const requiredRoles = getRequiredRolesForRoute(req.method, req.path);
    if (requiredRoles && !requiredRoles.includes(roleName)) {
      res.status(403).json({
        message: 'Access denied. You do not have permission to perform this action.'
      });
      return;
    }

    next();
  });

  // ==================== AUTHENTICATION & USERS ====================
  app.post('/api/auth/login', (req, res) => {
    try {
      const { username, password } = req.body || {};
      const cleanId = String(username || '').trim().replace(/^@/, '').toLowerCase();
      const rawPass = String(password || '');

      if (!cleanId || !rawPass) {
        res.status(400).json({ message: 'Username/email and password are required.' });
        return;
      }

      const db = loadDb();
      const user = db.users.find(
        (u) =>
          u.username.toLowerCase() === cleanId ||
          u.email.toLowerCase() === cleanId
      );

      if (!user || !verifyPassword(rawPass, user.passwordHash)) {
        res.status(401).json({ message: 'Invalid username/email or password.' });
        return;
      }

      if (!user.isActive) {
        res.status(403).json({
          message: 'This user account is inactive. Please contact a system administrator.'
        });
        return;
      }

      if (!user.passwordHash.startsWith('scrypt$')) {
        user.passwordHash = hashPassword(rawPass);
        saveDb(db);
      }

      const role = db.roles.find((r) => r.id === user.roleId);
      const roleName = role?.name || 'Team Member';
      const token = createAuthToken(user, roleName);

      res.json({
        userId: user.id,
        fullName: user.fullName,
        fullNameAr: user.fullNameAr || user.fullName,
        username: user.username,
        email: user.email,
        role: roleName,
        isActive: user.isActive,
        token
      });
    } catch (error) {
      console.error('Authentication error:', error);
      res.status(500).json({ message: 'Authentication service failed. Please try again.' });
    }
  });

  app.post('/api/auth/quick-login', (req, res) => {
    try {
      const { userId, username } = req.body || {};
      const cleanId = username ? String(username).trim().replace(/^@/, '').toLowerCase() : '';
      const numId = userId !== undefined && userId !== null ? Number(userId) : null;
      const db = loadDb();

      const user = db.users.find(
        (u) =>
          (numId !== null && u.id === numId) ||
          (cleanId &&
            (u.username.toLowerCase() === cleanId ||
              u.email.toLowerCase() === cleanId))
      );

      if (!user) {
        res.status(404).json({ message: 'User account not found.' });
        return;
      }
      if (!user.isActive) {
        res.status(403).json({ message: 'This user account is inactive.' });
        return;
      }

      const role = db.roles.find((r) => r.id === user.roleId);
      const roleName = role?.name || 'Team Member';
      const token = createAuthToken(user, roleName);

      res.json({
        userId: user.id,
        fullName: user.fullName,
        fullNameAr: user.fullNameAr || user.fullName,
        username: user.username,
        email: user.email,
        role: roleName,
        isActive: user.isActive,
        token
      });
    } catch (error) {
      console.error('Quick login error:', error);
      res.status(500).json({ message: 'Authentication service failed.' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = extractBearerToken(req);
    const verified = token ? parseAndVerifyToken(token) : null;
    if (verified?.jti) {
      revokedTokenIds.add(verified.jti);
    }
    res.json({ success: true, message: 'Signed out successfully.' });
  });

  app.get('/api/auth/me', (req, res) => {
    const authUser = (req as any).authUser as AuthenticatedRequestUser;
    const db = loadDb();
    const u = db.users.find((x) => x.id === authUser.userId);
    res.json({
      userId: authUser.userId,
      fullName: u?.fullName || authUser.fullName,
      fullNameAr: u?.fullNameAr || authUser.fullName,
      username: u?.username || authUser.username,
      email: u?.email || authUser.email,
      role: authUser.roleName,
      isActive: true
    });
  });

  app.post('/api/auth/register', (req, res) => {
    try {
      const { fullName, username, email, password } = req.body || {};
      if (!fullName || !String(fullName).trim() || !username || !String(username).trim() || !email || !String(email).trim() || !password) {
        res.status(400).json({ message: 'Full name, username, email, and password are required.' });
        return;
      }
      if (String(password).length < 6) {
        res.status(400).json({ message: 'Password must be at least 6 characters long.' });
        return;
      }

      const cleanUsername = String(username).trim().toLowerCase();
      const cleanEmail = String(email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        res.status(400).json({ message: 'Please provide a valid email address.' });
        return;
      }

      const db = loadDb();
      const existing = db.users.find(
        (u) => u.username.toLowerCase() === cleanUsername || u.email.toLowerCase() === cleanEmail
      );
      if (existing) {
        res.status(409).json({ message: 'An account with this username or email already exists.' });
        return;
      }

      const role = db.roles.find((r) => r.name === 'Team Member') || db.roles[0];
      const maxId = db.users.reduce((max, u) => Math.max(max, u.id), 0);
      const newUser: UserRecord = {
        id: maxId + 1,
        fullName: String(fullName).trim(),
        username: String(username).trim(),
        email: String(email).trim(),
        passwordHash: hashPassword(String(password)),
        roleId: role.id,
        isActive: true
      };

      db.users.push(newUser);
      saveDb(db);

      const token = createAuthToken(newUser, role.name);

      res.status(201).json({
        userId: newUser.id,
        fullName: newUser.fullName,
        fullNameAr: newUser.fullNameAr || newUser.fullName,
        username: newUser.username,
        email: newUser.email,
        role: role.name,
        isActive: newUser.isActive,
        token
      });
    } catch (error) {
      console.error('Error registering user:', error);
      res.status(500).json({ message: 'Internal server error while registering user.' });
    }
  });

  app.get('/api/auth/users', (_req, res) => {
    const db = loadDb();
    const result = db.users
      .filter((u) => u.isActive)
      .map((u) => sanitizeUser(u, db));
    res.json(result);
  });

  app.put('/api/auth/users/:id/role', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ message: 'Invalid user ID supplied.' });
      return;
    }

    const { roleName, roleId } = req.body || {};
    if (!roleName && !roleId) {
      res.status(400).json({ message: 'Role selection is required.' });
      return;
    }

    const db = loadDb();
    const user = db.users.find((u) => u.id === id);
    if (!user) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    const role = roleId
      ? db.roles.find((r) => r.id === Number(roleId))
      : db.roles.find((r) => r.name.toLowerCase() === String(roleName).trim().toLowerCase());

    if (!role) {
      res.status(400).json({ message: 'Selected role does not exist.' });
      return;
    }

    user.roleId = role.id;
    saveDb(db);

    res.json(sanitizeUser(user, db));
  });

  // ==================== USER & ROLE MANAGEMENT (EPIC 10) ====================
  app.get('/api/roles', (_req, res) => {
    try {
      const db = loadDb();
      res.json(db.roles);
    } catch (error) {
      console.error('Error retrieving roles:', error);
      res.status(500).json({ message: 'Internal server error while retrieving roles.' });
    }
  });

  app.get('/api/users/options', (_req, res) => {
    try {
      const db = loadDb();
      const options = db.users
        .filter((u) => u.isActive)
        .map((u) => {
          const role = db.roles.find((r) => r.id === u.roleId);
          return {
            id: u.id,
            fullName: u.fullName,
            fullNameAr: u.fullNameAr || u.fullName,
            roleName: role?.name || 'Team Member'
          };
        })
        .sort((a, b) => a.fullName.localeCompare(b.fullName));
      res.json(options);
    } catch (error) {
      console.error('Error retrieving user options:', error);
      res.status(500).json({ message: 'Internal server error while retrieving user options.' });
    }
  });

  // Story 10.7: Paginated user retrieval API (PMO Manager only, never exposes passwords)
  app.get('/api/users', (req, res) => {
    try {
      const db = loadDb();
      const search = String(req.query.search || '').trim().toLowerCase();
      const roleFilter = String(req.query.roleId || req.query.role || '').trim();
      const statusFilter = String(req.query.status || '').trim().toLowerCase();

      let list = db.users.map((u) => sanitizeUser(u, db));

      if (search) {
        list = list.filter(
          (u) =>
            u.fullName.toLowerCase().includes(search) ||
            (u.fullNameAr || '').toLowerCase().includes(search) ||
            u.username.toLowerCase().includes(search) ||
            u.email.toLowerCase().includes(search)
        );
      }

      if (roleFilter && roleFilter !== 'All') {
        const parsedRoleId = Number(roleFilter);
        if (Number.isInteger(parsedRoleId) && parsedRoleId > 0) {
          list = list.filter((u) => u.roleId === parsedRoleId);
        } else {
          list = list.filter((u) => u.roleName.toLowerCase() === roleFilter.toLowerCase());
        }
      }

      if (statusFilter === 'active') {
        list = list.filter((u) => u.isActive);
      } else if (statusFilter === 'inactive') {
        list = list.filter((u) => !u.isActive);
      }

      list.sort((a, b) => a.id - b.id);

      const usePagination = req.query.page !== undefined || req.query.paginate === 'true';
      if (usePagination) {
        const pageParam = req.query.page !== undefined ? Number(req.query.page) : 1;
        const pageSizeParam = req.query.pageSize !== undefined ? Number(req.query.pageSize) : 10;
        const pageSize =
          Number.isInteger(pageSizeParam) && pageSizeParam > 0 ? Math.min(pageSizeParam, 100) : 10;
        const requestedPage = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;

        const total = list.length;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        const safePage = Math.min(requestedPage, totalPages);
        const startIndex = (safePage - 1) * pageSize;
        const items = list.slice(startIndex, startIndex + pageSize);

        res.json({
          items,
          total,
          page: safePage,
          pageSize,
          totalPages,
          roles: db.roles
        });
      } else {
        res.json(list);
      }
    } catch (error) {
      console.error('Error retrieving users:', error);
      res.status(500).json({ message: 'Internal server error while retrieving users.' });
    }
  });

  app.get('/api/users/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ message: 'Invalid user ID supplied.' });
        return;
      }

      const db = loadDb();
      const user = db.users.find((u) => u.id === id);
      if (!user) {
        res.status(404).json({ message: `User with ID ${id} not found.` });
        return;
      }

      res.json(sanitizeUser(user, db));
    } catch (error) {
      console.error('Error retrieving user details:', error);
      res.status(500).json({ message: 'Internal server error while retrieving user details.' });
    }
  });

  // Story 10.9: Create User Account API (PMO Manager only)
  app.post('/api/users', (req, res) => {
    try {
      const { fullName, username, email, password, roleId, roleName, isActive } = req.body || {};

      if (!fullName || !String(fullName).trim()) {
        res.status(400).json({ message: 'Full name is required.' });
        return;
      }
      if (!username || !String(username).trim()) {
        res.status(400).json({ message: 'Username is required.' });
        return;
      }
      if (!email || !String(email).trim()) {
        res.status(400).json({ message: 'Email address is required.' });
        return;
      }
      const cleanEmail = String(email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        res.status(400).json({ message: 'Please provide a valid email address.' });
        return;
      }
      if (!password || String(password).length < 6) {
        res.status(400).json({ message: 'Password must be at least 6 characters long.' });
        return;
      }

      const db = loadDb();
      const cleanUsername = String(username).trim().toLowerCase();
      const duplicateUsername = db.users.find((u) => u.username.toLowerCase() === cleanUsername);
      if (duplicateUsername) {
        res.status(409).json({ message: 'Username is already in use by another account.' });
        return;
      }
      const duplicateEmail = db.users.find((u) => u.email.toLowerCase() === cleanEmail);
      if (duplicateEmail) {
        res.status(409).json({ message: 'Email address is already in use by another account.' });
        return;
      }

      let targetRole = null as RoleRecord | null;
      if (roleId !== undefined && roleId !== null && roleId !== '') {
        targetRole = db.roles.find((r) => r.id === Number(roleId)) || null;
      } else if (roleName) {
        targetRole =
          db.roles.find((r) => r.name.toLowerCase() === String(roleName).trim().toLowerCase()) ||
          null;
      }
      if (!targetRole) {
        res.status(400).json({ message: 'Selected role does not exist.' });
        return;
      }

      const nextId = db.users.reduce((max, u) => Math.max(max, u.id), 0) + 1;
      const created: UserRecord = {
        id: nextId,
        fullName: String(fullName).trim(),
        fullNameAr: req.body?.fullNameAr ? String(req.body.fullNameAr).trim() : undefined,
        username: String(username).trim(),
        email: String(email).trim(),
        passwordHash: hashPassword(String(password)),
        roleId: targetRole.id,
        isActive: isActive !== undefined ? Boolean(isActive) : true
      };

      db.users.push(created);
      saveDb(db);

      res.status(201).json(sanitizeUser(created, db));
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ message: 'Internal server error while creating user.' });
    }
  });

  // Story 10.9: Update User Account API (PMO Manager only)
  app.put('/api/users/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ message: 'Invalid user ID supplied.' });
        return;
      }

      const db = loadDb();
      const idx = db.users.findIndex((u) => u.id === id);
      if (idx === -1) {
        res.status(404).json({ message: `User with ID ${id} not found.` });
        return;
      }

      const existing = db.users[idx];
      const { fullName, username, email, password, roleId, roleName, isActive } = req.body || {};

      const nextFullName = fullName !== undefined ? String(fullName).trim() : existing.fullName;
      const nextUsername = username !== undefined ? String(username).trim() : existing.username;
      const nextEmail = email !== undefined ? String(email).trim() : existing.email;

      if (!nextFullName || !nextUsername || !nextEmail) {
        res.status(400).json({ message: 'Full name, username, and email address are required.' });
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail.toLowerCase())) {
        res.status(400).json({ message: 'Please provide a valid email address.' });
        return;
      }

      if (
        db.users.some(
          (u) => u.id !== id && u.username.toLowerCase() === nextUsername.toLowerCase()
        )
      ) {
        res.status(409).json({ message: 'Username is already in use by another account.' });
        return;
      }
      if (
        db.users.some((u) => u.id !== id && u.email.toLowerCase() === nextEmail.toLowerCase())
      ) {
        res.status(409).json({ message: 'Email address is already in use by another account.' });
        return;
      }

      let nextRoleId = existing.roleId;
      if (roleId !== undefined || roleName !== undefined) {
        const targetRole =
          roleId !== undefined && roleId !== null && roleId !== ''
            ? db.roles.find((r) => r.id === Number(roleId))
            : db.roles.find(
                (r) => r.name.toLowerCase() === String(roleName || '').trim().toLowerCase()
              );
        if (!targetRole) {
          res.status(400).json({ message: 'Selected role does not exist.' });
          return;
        }
        nextRoleId = targetRole.id;
      }

      let nextPasswordHash = existing.passwordHash;
      if (password !== undefined && password !== null && String(password) !== '') {
        if (String(password).length < 6) {
          res.status(400).json({ message: 'Password must be at least 6 characters long.' });
          return;
        }
        nextPasswordHash = hashPassword(String(password));
      }

      const nextIsActive = isActive !== undefined ? Boolean(isActive) : existing.isActive;
      const authUser = (req as any).authUser as AuthenticatedRequestUser | undefined;
      if (authUser && authUser.userId === id && !nextIsActive) {
        res.status(400).json({
          message: 'You cannot deactivate your own active administrator account.'
        });
        return;
      }

      db.users[idx] = {
        ...existing,
        fullName: nextFullName,
        fullNameAr: req.body?.fullNameAr !== undefined ? String(req.body.fullNameAr).trim() : existing.fullNameAr,
        username: nextUsername,
        email: nextEmail,
        roleId: nextRoleId,
        passwordHash: nextPasswordHash,
        isActive: nextIsActive
      };
      saveDb(db);

      res.json(sanitizeUser(db.users[idx], db));
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ message: 'Internal server error while updating user.' });
    }
  });

  // Story 10.11: Activate / Deactivate User Account Status API (PMO Manager only)
  app.patch('/api/users/:id/status', (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ message: 'Invalid user ID supplied.' });
        return;
      }

      const { isActive } = req.body || {};
      if (typeof isActive !== 'boolean') {
        res.status(400).json({ message: 'isActive boolean status is required.' });
        return;
      }

      const authUser = (req as any).authUser as AuthenticatedRequestUser | undefined;
      if (authUser && authUser.userId === id && !isActive) {
        res.status(400).json({
          message: 'You cannot deactivate your own active administrator account.'
        });
        return;
      }

      const db = loadDb();
      const idx = db.users.findIndex((u) => u.id === id);
      if (idx === -1) {
        res.status(404).json({ message: `User with ID ${id} not found.` });
        return;
      }

      db.users[idx] = {
        ...db.users[idx],
        isActive
      };
      saveDb(db);

      res.json(sanitizeUser(db.users[idx], db));
    } catch (error) {
      console.error('Error updating user status:', error);
      res.status(500).json({ message: 'Internal server error while updating user status.' });
    }
  });

  app.post('/api/auth/forgot-password', (req, res) => {
    const { identifier } = req.body;
    if (!identifier) {
      res.status(400).json({ message: 'Username or email is required' });
      return;
    }
    const clean = String(identifier).trim().toLowerCase();
    const db = loadDb();
    const user = db.users.find(
      (u) => (u.username.toLowerCase() === clean || u.email.toLowerCase() === clean) && u.isActive
    );
    if (!user) {
      res.status(404).json({ message: 'No active account found with this username or email.' });
      return;
    }

    const emailParts = user.email.split('@');
    const namePart = emailParts[0];
    const domainPart = emailParts[1] || 'domain.com';
    const maskedName =
      namePart.length > 2
        ? `${namePart[0]}${'*'.repeat(Math.min(namePart.length - 2, 5))}${namePart[namePart.length - 1]}`
        : `${namePart[0]}*`;
    const maskedEmail = `${maskedName}@${domainPart}`;

    const role = db.roles.find((r) => r.id === user.roleId);

    res.json({
      success: true,
      userId: user.id,
      username: user.username,
      fullName: user.fullName,
      fullNameAr: user.fullNameAr || user.fullName,
      maskedEmail,
      roleName: role?.name || 'Team Member'
    });
  });

  app.post('/api/auth/reset-password', (req, res) => {
    const { identifier, newPassword } = req.body;
    if (!identifier || !newPassword) {
      res.status(400).json({ message: 'Identifier and new password are required.' });
      return;
    }
    if (String(newPassword).length < 6) {
      res.status(400).json({ message: 'New password must be at least 6 characters long.' });
      return;
    }

    const clean = String(identifier).trim().toLowerCase();
    const db = loadDb();
    const user = db.users.find(
      (u) =>
        (u.username.toLowerCase() === clean ||
          u.email.toLowerCase() === clean ||
          String(u.id) === clean) &&
        u.isActive
    );
    if (!user) {
      res.status(404).json({ message: 'Account not found.' });
      return;
    }

    user.passwordHash = hashPassword(String(newPassword));
    saveDb(db);

    res.json({
      success: true,
      message: 'Password has been reset successfully. You can now sign in with your new password.',
      username: user.username
    });
  });

  app.put('/api/auth/profile', (req, res) => {
    const authUser = (req as any).authUser as AuthenticatedRequestUser;
    const { userId, fullName, email } = req.body;
    const targetUserId = userId ? Number(userId) : authUser.userId;

    if (authUser.userId !== targetUserId && authUser.roleName !== 'PMO Manager') {
      res.status(403).json({ message: 'Access denied. You can only update your own profile.' });
      return;
    }

    if (!fullName || !email) {
      res.status(400).json({ message: 'Full name and email are required.' });
      return;
    }

    const db = loadDb();
    const user = db.users.find((u) => u.id === targetUserId);
    if (!user) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const duplicate = db.users.find(
      (u) => u.id !== user.id && u.email.toLowerCase() === cleanEmail
    );
    if (duplicate) {
      res.status(409).json({ message: 'This email address is already in use by another account.' });
      return;
    }

    user.fullName = String(fullName).trim();
    user.email = String(email).trim();
    saveDb(db);

    const role = db.roles.find((r) => r.id === user.roleId);

    res.json({
      id: user.id,
      userId: user.id,
      fullName: user.fullName,
      fullNameAr: user.fullNameAr || user.fullName,
      username: user.username,
      email: user.email,
      role: role?.name || 'Team Member',
      roleName: role?.name || 'Team Member',
      roleId: user.roleId,
      isActive: user.isActive
    });
  });

  app.post('/api/auth/change-password', (req, res) => {
    const authUser = (req as any).authUser as AuthenticatedRequestUser;
    const { userId, currentPassword, newPassword } = req.body;
    const targetUserId = userId ? Number(userId) : authUser.userId;

    if (authUser.userId !== targetUserId && authUser.roleName !== 'PMO Manager') {
      res.status(403).json({ message: 'Access denied.' });
      return;
    }

    if (!currentPassword || !newPassword) {
      res.status(400).json({ message: 'Current password and new password are required.' });
      return;
    }

    const db = loadDb();
    const user = db.users.find((u) => u.id === targetUserId);
    if (!user) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    if (!verifyPassword(String(currentPassword), user.passwordHash)) {
      res.status(400).json({ message: 'The current password you entered is incorrect.' });
      return;
    }

    if (String(newPassword).length < 6) {
      res.status(400).json({ message: 'New password must be at least 6 characters long.' });
      return;
    }

    user.passwordHash = hashPassword(String(newPassword));
    saveDb(db);

    res.json({
      success: true,
      message: 'Your password has been changed successfully.'
    });
  });

  app.post('/api/reset-seed', (_req, res) => {
    const cloned = JSON.parse(JSON.stringify(INITIAL_SEED)) as DatabaseSchema;
    for (const u of cloned.users) {
      if (u.passwordHash && !u.passwordHash.startsWith('scrypt$')) {
        u.passwordHash = hashPassword(u.passwordHash);
      }
    }
    for (const p of cloned.projects) {
      recalculateProjectProgress(cloned, p.id);
    }
    saveDb(cloned);
    res.json({ message: 'Database reset to initial seed data.' });
  });

  // ==================== DASHBOARD SUMMARY ====================
  app.get('/api/dashboard', (_req, res) => {
    const db = loadDb();
    const soonThreshold = '2026-11-20';

    const parentActivities = db.activities.filter((a) => a.parentActivityId === null);
    const subtasks = db.activities.filter((a) => a.parentActivityId !== null);

    const totalDepartments = db.departments.length;
    const totalPortfolios = db.portfolios.length;
    const totalInitiatives = db.initiatives.length;
    const totalProjects = db.projects.length;
    const totalActivities = parentActivities.length;
    const totalWorkstreams = db.workstreams.length;
    const totalMilestones = db.milestones.length;
    const totalSubtasks = subtasks.length;
    const totalDependencies = db.dependencies.length;

    const activeProjects = db.projects.filter((p) => p.status === 'In Progress' || p.status === 'Active').length;
    const completedProjects = db.projects.filter((p) => p.status === 'Completed').length;
    const overdueActivities = db.activities.filter((a) => a.status !== 'Completed' && a.dueDate < REFERENCE_TODAY).length;

    const statusMap = new Map<string, number>();
    for (const p of db.projects) {
      statusMap.set(p.status, (statusMap.get(p.status) || 0) + 1);
    }
    const projectsByStatus = Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }));

    const initiativesByDepartment = db.departments.map((d) => ({
      departmentName: d.name,
      departmentNameAr: d.nameAr || d.name,
      count: db.initiatives.filter((i) => i.departmentId === d.id).length
    }));

    const enrichedProjects = enrichProjects(db);
    const projectsWithOverdueActivities = enrichedProjects.filter((p) => p.overdueActivityCount > 0);
    const projectsApproachingEndDate = enrichedProjects
      .filter((p) => p.status !== 'Completed' && p.endDate >= REFERENCE_TODAY && p.endDate <= soonThreshold)
      .sort((a, b) => a.endDate.localeCompare(b.endDate));

    const enrichedMilestones = enrichMilestones(db);
    const upcomingMilestones = enrichedMilestones
      .filter((m) => m.status !== 'Completed')
      .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate))
      .slice(0, 6);

    const actStatusMap = new Map<string, number>();
    for (const a of parentActivities) {
      actStatusMap.set(a.status, (actStatusMap.get(a.status) || 0) + 1);
    }
    const activitiesByStatus = Array.from(actStatusMap.entries()).map(([status, count]) => ({ status, count }));

    const activitiesByWorkstream = db.workstreams.map((w) => {
      const proj = db.projects.find((p) => p.id === w.projectId);
      return {
        workstreamName: w.name,
        workstreamNameAr: w.nameAr || w.name,
        projectName: proj ? proj.name : '',
        projectNameAr: proj ? (proj.nameAr || proj.name) : '',
        count: parentActivities.filter((a) => a.workstreamId === w.id).length
      };
    });

    const msStatusMap = new Map<string, number>();
    for (const m of db.milestones) {
      msStatusMap.set(m.status, (msStatusMap.get(m.status) || 0) + 1);
    }
    const milestonesByStatus = Array.from(msStatusMap.entries()).map(([status, count]) => ({ status, count }));

    res.json({
      totalDepartments,
      totalPortfolios,
      totalInitiatives,
      totalProjects,
      totalActivities,
      activeProjects,
      completedProjects,
      overdueActivities,
      projectsByStatus,
      initiativesByDepartment,
      totalWorkstreams,
      totalMilestones,
      totalSubtasks,
      totalDependencies,
      projectsWithOverdueActivities,
      upcomingMilestones,
      activitiesByStatus,
      activitiesByWorkstream,
      milestonesByStatus,
      projectsApproachingEndDate
    });
  });

  // ==================== DEPARTMENTS CRUD (Department Management Epic) ====================
  app.get('/api/departments', (req, res) => {
    try {
      const db = loadDb();
      const search = String(req.query.search || '').trim().toLowerCase();
      const isActiveParam = req.query.isActive;
      const shouldPaginate = req.query.page !== undefined || req.query.paginate === 'true';
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
      const pageSize = Math.max(1, Math.min(100, parseInt(String(req.query.pageSize || '10'), 10)));

      let list = db.departments.map((d) => {
        const mgrId = d.responsibleManagerId || d.managerId || null;
        const manager = mgrId ? db.users.find((u) => u.id === mgrId) : null;
        return {
          ...d,
          managerId: mgrId,
          responsibleManagerId: mgrId,
          responsibleManagerName: manager ? manager.fullName : null,
          responsibleManagerNameAr: manager ? (manager.fullNameAr || manager.fullName) : null,
          portfolioCount: db.portfolios.filter((p) => p.departmentId === d.id).length,
          initiativeCount: db.initiatives.filter((i) => i.departmentId === d.id).length
        };
      });

      if (search) {
        list = list.filter(
          (d) =>
            d.name.toLowerCase().includes(search) ||
            (d.nameAr || '').toLowerCase().includes(search) ||
            (d.description || '').toLowerCase().includes(search) ||
            (d.descriptionAr || '').toLowerCase().includes(search) ||
            (d.responsibleManagerName || '').toLowerCase().includes(search) ||
            (d.responsibleManagerNameAr || '').toLowerCase().includes(search)
        );
      }

      if (isActiveParam !== undefined && isActiveParam !== '' && isActiveParam !== 'All') {
        const boolVal = String(isActiveParam) === 'true';
        list = list.filter((d) => d.isActive === boolVal);
      }

      if (shouldPaginate) {
        const total = list.length;
        const totalPages = Math.ceil(total / pageSize) || 1;
        const startIndex = (page - 1) * pageSize;
        const paginatedItems = list.slice(startIndex, startIndex + pageSize);

        res.json({
          items: paginatedItems,
          total,
          page,
          pageSize,
          totalPages
        });
      } else {
        res.json(list);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
      res.status(500).json({ message: 'Internal server error while retrieving departments.' });
    }
  });

  app.get('/api/departments/:id', (req, res) => {
    try {
      const db = loadDb();
      const id = Number(req.params.id);
      const dept = db.departments.find((d) => d.id === id);
      if (!dept) {
        res.status(404).json({ message: `Department with ID ${id} not found.` });
        return;
      }

      const mgrId = dept.responsibleManagerId || dept.managerId || null;
      const manager = mgrId ? db.users.find((u) => u.id === mgrId) : null;

      const assocPortfolios = db.portfolios
        .filter((p) => p.departmentId === id)
        .map((p) => {
          const pOwner = db.users.find((u) => u.id === p.ownerId);
          return {
            id: p.id,
            name: p.name,
            nameAr: p.nameAr || p.name,
            description: p.description,
            descriptionAr: p.descriptionAr || p.description,
            status: p.status,
            startDate: p.startDate,
            endDate: p.endDate,
            targetDate: p.targetDate || p.endDate,
            ownerName: pOwner ? pOwner.fullName : null,
            ownerNameAr: pOwner ? (pOwner.fullNameAr || pOwner.fullName) : null,
            initiativeCount: db.initiatives.filter((i) => i.portfolioId === p.id).length
          };
        });

      const assocInitiatives = db.initiatives
        .filter((i) => i.departmentId === id)
        .map((i) => {
          const iOwner = db.users.find((u) => u.id === i.ownerId);
          const iPort = db.portfolios.find((p) => p.id === i.portfolioId);
          return {
            id: i.id,
            name: i.name,
            nameAr: i.nameAr || i.name,
            description: i.description,
            descriptionAr: i.descriptionAr || i.description,
            status: i.status,
            priority: i.priority,
            startDate: i.startDate,
            targetDate: i.targetDate,
            progressPercentage: i.progressPercentage,
            portfolioId: i.portfolioId,
            portfolioName: iPort ? iPort.name : null,
            portfolioNameAr: iPort ? (iPort.nameAr || iPort.name) : null,
            ownerName: iOwner ? iOwner.fullName : null,
            ownerNameAr: iOwner ? (iOwner.fullNameAr || iOwner.fullName) : null,
            projectCount: db.projects.filter((pr) => pr.initiativeId === i.id).length
          };
        });

      res.json({
        ...dept,
        managerId: mgrId,
        responsibleManagerId: mgrId,
        responsibleManagerName: manager ? manager.fullName : null,
        responsibleManagerNameAr: manager ? (manager.fullNameAr || manager.fullName) : null,
        portfolioCount: assocPortfolios.length,
        initiativeCount: assocInitiatives.length,
        associatedPortfolios: assocPortfolios,
        associatedInitiatives: assocInitiatives
      });
    } catch (error) {
      console.error('Error fetching department details:', error);
      res.status(500).json({ message: 'Internal server error while retrieving department.' });
    }
  });

  app.get('/api/departments/:id/relationships', (req, res) => {
    try {
      const db = loadDb();
      const id = Number(req.params.id);
      const dept = db.departments.find((d) => d.id === id);
      if (!dept) {
        res.status(404).json({ message: `Department with ID ${id} not found.` });
        return;
      }

      const portfolios = db.portfolios
        .filter((p) => p.departmentId === id)
        .map((p) => {
          const pOwner = db.users.find((u) => u.id === p.ownerId);
          return {
            id: p.id,
            name: p.name,
            nameAr: p.nameAr || p.name,
            description: p.description,
            descriptionAr: p.descriptionAr || p.description,
            status: p.status,
            startDate: p.startDate,
            endDate: p.endDate,
            targetDate: p.targetDate || p.endDate,
            ownerName: pOwner ? pOwner.fullName : null,
            ownerNameAr: pOwner ? (pOwner.fullNameAr || pOwner.fullName) : null,
            initiativeCount: db.initiatives.filter((i) => i.portfolioId === p.id).length
          };
        });

      const initiatives = db.initiatives
        .filter((i) => i.departmentId === id)
        .map((i) => {
          const iOwner = db.users.find((u) => u.id === i.ownerId);
          const iPort = db.portfolios.find((p) => p.id === i.portfolioId);
          return {
            id: i.id,
            name: i.name,
            nameAr: i.nameAr || i.name,
            description: i.description,
            descriptionAr: i.descriptionAr || i.description,
            status: i.status,
            priority: i.priority,
            startDate: i.startDate,
            targetDate: i.targetDate,
            progressPercentage: i.progressPercentage,
            portfolioId: i.portfolioId,
            portfolioName: iPort ? iPort.name : null,
            portfolioNameAr: iPort ? (iPort.nameAr || iPort.name) : null,
            ownerName: iOwner ? iOwner.fullName : null,
            ownerNameAr: iOwner ? (iOwner.fullNameAr || iOwner.fullName) : null,
            projectCount: db.projects.filter((pr) => pr.initiativeId === i.id).length
          };
        });

      res.json({
        department: {
          id: dept.id,
          name: dept.name,
          nameAr: dept.nameAr || dept.name,
          description: dept.description,
          descriptionAr: dept.descriptionAr || dept.description
        },
        portfolios,
        initiatives
      });
    } catch (error) {
      console.error('Error fetching department relationships:', error);
      res.status(500).json({ message: 'Internal server error while retrieving department relationships.' });
    }
  });

  app.post('/api/departments', (req, res) => {
    try {
      const db = loadDb();
      const { name, description, managerId, responsibleManagerId, isActive } = req.body;

      if (!name || !String(name).trim()) {
        res.status(400).json({ message: 'Department name is required.' });
        return;
      }

      const trimmedName = String(name).trim();

      // Duplicate name check (Story 3.4 AC 3)
      const duplicateExists = db.departments.some(
        (d) => d.name.trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (duplicateExists) {
        res.status(400).json({ message: `A department with the name "${trimmedName}" already exists.` });
        return;
      }

      // Responsible manager validation (Story 3.4 AC 4)
      let resolvedManagerId: number | null = null;
      const targetMgrId = responsibleManagerId !== undefined ? responsibleManagerId : managerId;
      if (targetMgrId !== undefined && targetMgrId !== null && targetMgrId !== '') {
        const parsedMgrId = Number(targetMgrId);
        if (!isNaN(parsedMgrId)) {
          const userExists = db.users.some((u) => u.id === parsedMgrId);
          if (!userExists) {
            res.status(400).json({ message: 'Selected responsible manager is invalid or does not exist.' });
            return;
          }
          resolvedManagerId = parsedMgrId;
        }
      }

      const nextId = db.departments.reduce((max, d) => Math.max(max, d.id), 0) + 1;
      const created: DepartmentRecord = {
        id: nextId,
        name: trimmedName,
        nameAr: req.body?.nameAr ? String(req.body.nameAr).trim() : undefined,
        description: String(description || '').trim(),
        descriptionAr: req.body?.descriptionAr ? String(req.body.descriptionAr).trim() : undefined,
        managerId: resolvedManagerId,
        responsibleManagerId: resolvedManagerId,
        isActive: isActive !== undefined ? Boolean(isActive) : true
      };

      db.departments.push(created);
      saveDb(db);

      const manager = resolvedManagerId ? db.users.find((u) => u.id === resolvedManagerId) : null;

      res.status(201).json({
        ...created,
        responsibleManagerName: manager ? manager.fullName : null,
        responsibleManagerNameAr: manager ? (manager.fullNameAr || manager.fullName) : null,
        portfolioCount: 0,
        initiativeCount: 0
      });
    } catch (error) {
      console.error('Error creating department:', error);
      res.status(500).json({ message: 'Internal server error while creating department.' });
    }
  });

  app.put('/api/departments/:id', (req, res) => {
    try {
      const db = loadDb();
      const id = Number(req.params.id);
      const idx = db.departments.findIndex((d) => d.id === id);
      if (idx === -1) {
        res.status(404).json({ message: `Department with ID ${id} not found.` });
        return;
      }

      const current = db.departments[idx];
      const { name, description, managerId, responsibleManagerId, isActive } = req.body;

      let trimmedName = current.name;
      if (name !== undefined) {
        if (!String(name).trim()) {
          res.status(400).json({ message: 'Department name cannot be empty.' });
          return;
        }
        trimmedName = String(name).trim();

        // Duplicate name check against other departments
        const duplicateExists = db.departments.some(
          (d) => d.id !== id && d.name.trim().toLowerCase() === trimmedName.toLowerCase()
        );
        if (duplicateExists) {
          res.status(400).json({ message: `Another department with the name "${trimmedName}" already exists.` });
          return;
        }
      }

      let resolvedManagerId = current.responsibleManagerId || current.managerId || null;
      const targetMgrId = responsibleManagerId !== undefined ? responsibleManagerId : managerId;
      if (targetMgrId !== undefined) {
        if (targetMgrId === null || targetMgrId === '') {
          resolvedManagerId = null;
        } else {
          const parsed = Number(targetMgrId);
          if (!isNaN(parsed)) {
            const userExists = db.users.some((u) => u.id === parsed);
            if (!userExists) {
              res.status(400).json({ message: 'Selected responsible manager is invalid or does not exist.' });
              return;
            }
            resolvedManagerId = parsed;
          }
        }
      }

      db.departments[idx] = {
        ...current,
        name: trimmedName,
        nameAr: req.body?.nameAr !== undefined ? String(req.body.nameAr).trim() : current.nameAr,
        description: description !== undefined ? String(description).trim() : current.description,
        descriptionAr: req.body?.descriptionAr !== undefined ? String(req.body.descriptionAr).trim() : current.descriptionAr,
        managerId: resolvedManagerId,
        responsibleManagerId: resolvedManagerId,
        isActive: isActive !== undefined ? Boolean(isActive) : current.isActive
      };

      saveDb(db);

      const d = db.departments[idx];
      const manager = resolvedManagerId ? db.users.find((u) => u.id === resolvedManagerId) : null;

      res.json({
        ...d,
        responsibleManagerName: manager ? manager.fullName : null,
        responsibleManagerNameAr: manager ? (manager.fullNameAr || manager.fullName) : null,
        portfolioCount: db.portfolios.filter((p) => p.departmentId === d.id).length,
        initiativeCount: db.initiatives.filter((i) => i.departmentId === d.id).length
      });
    } catch (error) {
      console.error('Error updating department:', error);
      res.status(500).json({ message: 'Internal server error while updating department.' });
    }
  });

  app.delete('/api/departments/:id', (req, res) => {
    try {
      const db = loadDb();
      const id = Number(req.params.id);
      const idx = db.departments.findIndex((d) => d.id === id);
      if (idx === -1) {
        res.status(404).json({ message: `Department with ID ${id} not found.` });
        return;
      }

      const dept = db.departments[idx];

      // Safe Department Deletion (Story 3.8):
      // Check whether department has associated portfolios or initiatives
      const associatedPortfolios = db.portfolios.filter((p) => p.departmentId === id);
      const associatedInitiatives = db.initiatives.filter((i) => i.departmentId === id);

      if (associatedPortfolios.length > 0 || associatedInitiatives.length > 0) {
        res.status(400).json({
          message: `Cannot delete department "${dept.name}" because it is currently associated with ${associatedPortfolios.length} portfolio(s) and ${associatedInitiatives.length} initiative(s). To protect organizational data integrity, please reassign or delete the associated records before removing this department.`,
          associatedPortfoliosCount: associatedPortfolios.length,
          associatedInitiativesCount: associatedInitiatives.length,
          associatedPortfolios: associatedPortfolios.map((p) => ({
            id: p.id,
            name: p.name,
            nameAr: p.nameAr || p.name,
            status: p.status
          })),
          associatedInitiatives: associatedInitiatives.map((i) => ({
            id: i.id,
            name: i.name,
            nameAr: i.nameAr || i.name,
            status: i.status
          }))
        });
        return;
      }

      // Safe deletion permitted: zero associated records
      db.departments.splice(idx, 1);
      saveDb(db);

      res.status(200).json({
        success: true,
        message: `Department "${dept.name}" (ID: ${id}) was successfully deleted.`
      });
    } catch (error) {
      console.error('Error deleting department safely:', error);
      res.status(500).json({ message: 'Internal server error while attempting safe department deletion.' });
    }
  });

  // ==================== PORTFOLIOS CRUD ====================
  // ==================== PORTFOLIOS CRUD (Portfolio Management Epic) ====================
  app.get('/api/portfolios', (req, res) => {
    try {
      const db = loadDb();
      const search = String(req.query.search || '').trim().toLowerCase();
      const status = String(req.query.status || '').trim();
      const departmentId = req.query.departmentId ? Number(req.query.departmentId) : null;
      const shouldPaginate = req.query.page !== undefined || req.query.paginate === 'true';
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
      const pageSize = Math.max(1, Math.min(100, parseInt(String(req.query.pageSize || '10'), 10)));

      let list = db.portfolios.map((p) => {
        const dept = db.departments.find((d) => d.id === p.departmentId);
        const owner = db.users.find((u) => u.id === p.ownerId);
        const tDate = p.targetDate || p.endDate;
        const sDate = p.startDate;
        return {
          ...p,
          targetDate: tDate,
          endDate: p.endDate || tDate,
          startDate: sDate,
          departmentName: dept ? dept.name : null,
          departmentNameAr: dept ? (dept.nameAr || dept.name) : null,
          ownerName: owner ? owner.fullName : null,
          ownerNameAr: owner ? (owner.fullNameAr || owner.fullName) : null,
          initiativeCount: db.initiatives.filter((i) => i.portfolioId === p.id).length
        };
      });

      if (search) {
        list = list.filter(
          (p) =>
            p.name.toLowerCase().includes(search) ||
            (p.nameAr || '').toLowerCase().includes(search) ||
            (p.description || '').toLowerCase().includes(search) ||
            (p.descriptionAr || '').toLowerCase().includes(search) ||
            (p.departmentName || '').toLowerCase().includes(search) ||
            (p.departmentNameAr || '').toLowerCase().includes(search) ||
            (p.ownerName || '').toLowerCase().includes(search) ||
            (p.ownerNameAr || '').toLowerCase().includes(search)
        );
      }
      if (status && status !== 'All') {
        list = list.filter((p) => p.status.toLowerCase() === status.toLowerCase());
      }
      if (departmentId) {
        list = list.filter((p) => p.departmentId === departmentId);
      }

      if (shouldPaginate) {
        const total = list.length;
        const totalPages = Math.ceil(total / pageSize) || 1;
        const startIndex = (page - 1) * pageSize;
        const paginatedItems = list.slice(startIndex, startIndex + pageSize);

        res.json({
          items: paginatedItems,
          total,
          page,
          pageSize,
          totalPages
        });
      } else {
        res.json(list);
      }
    } catch (error) {
      console.error('Error fetching portfolios:', error);
      res.status(500).json({ message: 'Internal server error while retrieving portfolios.' });
    }
  });

  app.get('/api/portfolios/:id', (req, res) => {
    try {
      const db = loadDb();
      const id = Number(req.params.id);
      const portfolio = db.portfolios.find((p) => p.id === id);
      if (!portfolio) {
        res.status(404).json({ message: `Portfolio with ID ${id} not found.` });
        return;
      }

      const dept = db.departments.find((d) => d.id === portfolio.departmentId);
      const owner = db.users.find((u) => u.id === portfolio.ownerId);
      const assocInitiatives = db.initiatives
        .filter((i) => i.portfolioId === id)
        .map((i) => {
          const iOwner = db.users.find((u) => u.id === i.ownerId);
          return {
            id: i.id,
            name: i.name,
            nameAr: i.nameAr || i.name,
            description: i.description,
            descriptionAr: i.descriptionAr || i.description,
            status: i.status,
            priority: i.priority,
            startDate: i.startDate,
            targetDate: i.targetDate,
            progressPercentage: i.progressPercentage,
            ownerName: iOwner ? iOwner.fullName : null,
            ownerNameAr: iOwner ? (iOwner.fullNameAr || iOwner.fullName) : null,
            projectCount: db.projects.filter((pr) => pr.initiativeId === i.id).length
          };
        });

      const tDate = portfolio.targetDate || portfolio.endDate;
      res.json({
        ...portfolio,
        targetDate: tDate,
        endDate: portfolio.endDate || tDate,
        departmentName: dept ? dept.name : null,
        departmentNameAr: dept ? (dept.nameAr || dept.name) : null,
        ownerName: owner ? owner.fullName : null,
        ownerNameAr: owner ? (owner.fullNameAr || owner.fullName) : null,
        initiativeCount: assocInitiatives.length,
        associatedInitiatives: assocInitiatives
      });
    } catch (error) {
      console.error('Error fetching portfolio details:', error);
      res.status(500).json({ message: 'Internal server error while retrieving portfolio.' });
    }
  });

  app.get('/api/portfolios/:id/initiatives', (req, res) => {
    try {
      const db = loadDb();
      const id = Number(req.params.id);
      const portfolio = db.portfolios.find((p) => p.id === id);
      if (!portfolio) {
        res.status(404).json({ message: `Portfolio with ID ${id} not found.` });
        return;
      }

      const initiatives = db.initiatives
        .filter((i) => i.portfolioId === id)
        .map((i) => {
          const iDept = db.departments.find((d) => d.id === i.departmentId);
          const iOwner = db.users.find((u) => u.id === i.ownerId);
          return {
            id: i.id,
            name: i.name,
            nameAr: i.nameAr || i.name,
            description: i.description,
            descriptionAr: i.descriptionAr || i.description,
            departmentId: i.departmentId,
            departmentName: iDept ? iDept.name : null,
            departmentNameAr: iDept ? (iDept.nameAr || iDept.name) : null,
            portfolioId: i.portfolioId,
            portfolioName: portfolio.name,
            portfolioNameAr: portfolio.nameAr || portfolio.name,
            ownerId: i.ownerId,
            ownerName: iOwner ? iOwner.fullName : null,
            ownerNameAr: iOwner ? (iOwner.fullNameAr || iOwner.fullName) : null,
            startDate: i.startDate,
            targetDate: i.targetDate,
            status: i.status,
            priority: i.priority,
            progressPercentage: i.progressPercentage,
            projectCount: db.projects.filter((pr) => pr.initiativeId === i.id).length
          };
        });

      res.json(initiatives);
    } catch (error) {
      console.error('Error fetching portfolio initiatives:', error);
      res.status(500).json({ message: 'Internal server error while retrieving portfolio initiatives.' });
    }
  });

  app.post('/api/portfolios', (req, res) => {
    try {
      const db = loadDb();
      const { name, description, departmentId, ownerId, startDate, targetDate, endDate, status } = req.body;

      if (!name || !String(name).trim()) {
        res.status(400).json({ message: 'Portfolio name is required.' });
        return;
      }

      const trimmedName = String(name).trim();

      let resolvedDeptId: number | null = null;
      if (departmentId !== undefined && departmentId !== null && departmentId !== '') {
        const parsedDeptId = Number(departmentId);
        if (!isNaN(parsedDeptId)) {
          const deptExists = db.departments.some((d) => d.id === parsedDeptId);
          if (!deptExists) {
            res.status(400).json({ message: 'Selected department does not exist.' });
            return;
          }
          resolvedDeptId = parsedDeptId;
        }
      }

      let resolvedOwnerId: number | null = null;
      if (ownerId !== undefined && ownerId !== null && ownerId !== '') {
        const parsedOwnerId = Number(ownerId);
        if (!isNaN(parsedOwnerId)) {
          const userExists = db.users.some((u) => u.id === parsedOwnerId);
          if (!userExists) {
            res.status(400).json({ message: 'Selected portfolio owner is invalid or does not exist.' });
            return;
          }
          resolvedOwnerId = parsedOwnerId;
        }
      }

      const sDate = startDate || '2026-01-01';
      const tDate = targetDate || endDate || '2026-12-31';

      if (new Date(sDate) > new Date(tDate)) {
        res.status(400).json({ message: 'Portfolio start date cannot be later than the target/end date.' });
        return;
      }

      const validStatuses = ['Active', 'Planning', 'On Hold', 'Completed', 'Archived'];
      const resolvedStatus = status && validStatuses.includes(status) ? status : 'Active';

      const nextId = db.portfolios.reduce((max, p) => Math.max(max, p.id), 0) + 1;
      const created: PortfolioRecord = {
        id: nextId,
        name: trimmedName,
        nameAr: req.body?.nameAr ? String(req.body.nameAr).trim() : undefined,
        description: String(description || '').trim(),
        descriptionAr: req.body?.descriptionAr ? String(req.body.descriptionAr).trim() : undefined,
        departmentId: resolvedDeptId,
        ownerId: resolvedOwnerId,
        startDate: sDate,
        endDate: tDate,
        targetDate: tDate,
        status: resolvedStatus
      };

      db.portfolios.push(created);
      saveDb(db);

      const dept = db.departments.find((d) => d.id === created.departmentId);
      const owner = db.users.find((u) => u.id === created.ownerId);

      res.status(201).json({
        ...created,
        targetDate: tDate,
        departmentName: dept ? dept.name : null,
        departmentNameAr: dept ? (dept.nameAr || dept.name) : null,
        ownerName: owner ? owner.fullName : null,
        ownerNameAr: owner ? (owner.fullNameAr || owner.fullName) : null,
        initiativeCount: 0,
        associatedInitiatives: []
      });
    } catch (error) {
      console.error('Error creating portfolio:', error);
      res.status(500).json({ message: 'Internal server error while creating portfolio.' });
    }
  });

  app.put('/api/portfolios/:id', (req, res) => {
    try {
      const db = loadDb();
      const id = Number(req.params.id);
      const idx = db.portfolios.findIndex((p) => p.id === id);
      if (idx === -1) {
        res.status(404).json({ message: `Portfolio with ID ${id} not found.` });
        return;
      }

      const current = db.portfolios[idx];
      const { name, description, departmentId, ownerId, startDate, targetDate, endDate, status } = req.body;

      let trimmedName = current.name;
      if (name !== undefined) {
        if (!String(name).trim()) {
          res.status(400).json({ message: 'Portfolio name cannot be empty.' });
          return;
        }
        trimmedName = String(name).trim();
      }

      let resolvedDeptId = current.departmentId;
      if (departmentId !== undefined) {
        if (departmentId === null || departmentId === '') {
          resolvedDeptId = null;
        } else {
          const parsed = Number(departmentId);
          if (!isNaN(parsed)) {
            const deptExists = db.departments.some((d) => d.id === parsed);
            if (!deptExists) {
              res.status(400).json({ message: 'Selected department does not exist.' });
              return;
            }
            resolvedDeptId = parsed;
          }
        }
      }

      let resolvedOwnerId = current.ownerId;
      if (ownerId !== undefined) {
        if (ownerId === null || ownerId === '') {
          resolvedOwnerId = null;
        } else {
          const parsed = Number(ownerId);
          if (!isNaN(parsed)) {
            const userExists = db.users.some((u) => u.id === parsed);
            if (!userExists) {
              res.status(400).json({ message: 'Selected portfolio owner is invalid or does not exist.' });
              return;
            }
            resolvedOwnerId = parsed;
          }
        }
      }

      const sDate = startDate !== undefined ? startDate : current.startDate;
      const tDate = targetDate !== undefined ? targetDate : (endDate !== undefined ? endDate : (current.targetDate || current.endDate));

      if (new Date(sDate) > new Date(tDate)) {
        res.status(400).json({ message: 'Portfolio start date cannot be later than the target/end date.' });
        return;
      }

      const validStatuses = ['Active', 'Planning', 'On Hold', 'Completed', 'Archived'];
      let resolvedStatus = current.status;
      if (status !== undefined && validStatuses.includes(status)) {
        resolvedStatus = status;
      }

      db.portfolios[idx] = {
        ...current,
        name: trimmedName,
        nameAr: req.body?.nameAr !== undefined ? String(req.body.nameAr).trim() : current.nameAr,
        description: description !== undefined ? String(description).trim() : current.description,
        descriptionAr: req.body?.descriptionAr !== undefined ? String(req.body.descriptionAr).trim() : current.descriptionAr,
        departmentId: resolvedDeptId,
        ownerId: resolvedOwnerId,
        startDate: sDate,
        endDate: tDate,
        targetDate: tDate,
        status: resolvedStatus
      };

      saveDb(db);

      const p = db.portfolios[idx];
      const dept = db.departments.find((d) => d.id === p.departmentId);
      const owner = db.users.find((u) => u.id === p.ownerId);
      const assocInitiatives = db.initiatives.filter((i) => i.portfolioId === p.id);

      res.json({
        ...p,
        targetDate: tDate,
        departmentName: dept ? dept.name : null,
        departmentNameAr: dept ? (dept.nameAr || dept.name) : null,
        ownerName: owner ? owner.fullName : null,
        ownerNameAr: owner ? (owner.fullNameAr || owner.fullName) : null,
        initiativeCount: assocInitiatives.length
      });
    } catch (error) {
      console.error('Error updating portfolio:', error);
      res.status(500).json({ message: 'Internal server error while updating portfolio.' });
    }
  });

  app.delete('/api/portfolios/:id', (req, res) => {
    try {
      const db = loadDb();
      const id = Number(req.params.id);
      const idx = db.portfolios.findIndex((p) => p.id === id);
      if (idx === -1) {
        res.status(404).json({ message: `Portfolio with ID ${id} not found.` });
        return;
      }

      const portfolio = db.portfolios[idx];

      // Safe Portfolio Deletion (Epic 02 - Story 2.8):
      // Prevent deletion if associated initiatives exist to preserve initiative data integrity
      const associatedInitiatives = db.initiatives.filter((i) => i.portfolioId === id);
      if (associatedInitiatives.length > 0) {
        res.status(400).json({
          message: `Cannot delete portfolio "${portfolio.name}" because it has ${associatedInitiatives.length} associated initiative(s). To protect initiative integrity, please reassign or delete the associated initiatives before removing this portfolio.`,
          associatedInitiativesCount: associatedInitiatives.length,
          associatedInitiatives: associatedInitiatives.map((i) => ({
            id: i.id,
            name: i.name,
            status: i.status
          }))
        });
        return;
      }

      // Safe deletion permitted: zero associated initiatives
      db.portfolios.splice(idx, 1);
      saveDb(db);

      res.status(200).json({
        success: true,
        message: `Portfolio "${portfolio.name}" (ID: ${id}) was successfully deleted.`
      });
    } catch (error) {
      console.error('Error deleting portfolio safely:', error);
      res.status(500).json({ message: 'Internal server error while attempting safe portfolio deletion.' });
    }
  });

  // ==================== INITIATIVES CRUD (Initiative Management Epic) ====================
  app.get('/api/initiatives', (req, res) => {
    try {
      const db = loadDb();
      const search = String(req.query.search || '').trim().toLowerCase();
      const status = String(req.query.status || '').trim();
      const priority = String(req.query.priority || '').trim();
      const portfolioId = req.query.portfolioId ? Number(req.query.portfolioId) : null;
      const departmentId = req.query.departmentId ? Number(req.query.departmentId) : null;

      let list = db.initiatives.map((i) => {
        const dept = db.departments.find((d) => d.id === i.departmentId);
        const port = db.portfolios.find((p) => p.id === i.portfolioId);
        const owner = db.users.find((u) => u.id === i.ownerId);
        const assocProjects = db.projects
          .filter((pr) => pr.initiativeId === i.id)
          .map((pr) => {
            const pm = db.users.find((u) => u.id === pr.projectManagerId);
            return {
              id: pr.id,
              name: pr.name,
              nameAr: pr.nameAr || pr.name,
              status: pr.status,
              priority: pr.priority,
              progressPercentage: calculateProjectProgress(pr.id, db),
              startDate: pr.startDate,
              endDate: pr.endDate,
              projectManagerName: pm ? pm.fullName : null,
              projectManagerNameAr: pm ? (pm.fullNameAr || pm.fullName) : null
            };
          });

        return {
          ...i,
          progressPercentage: calculateInitiativeProgress(i.id, db),
          departmentName: dept ? dept.name : null,
          departmentNameAr: dept ? (dept.nameAr || dept.name) : null,
          portfolioName: port ? port.name : null,
          portfolioNameAr: port ? (port.nameAr || port.name) : null,
          ownerName: owner ? owner.fullName : null,
          ownerNameAr: owner ? (owner.fullNameAr || owner.fullName) : null,
          projectCount: assocProjects.length,
          associatedProjects: assocProjects
        };
      });

      // Filter by search query (name or description EN/AR)
      if (search) {
        list = list.filter(
          (i) =>
            i.name.toLowerCase().includes(search) ||
            (i.nameAr || '').toLowerCase().includes(search) ||
            (i.description || '').toLowerCase().includes(search) ||
            (i.descriptionAr || '').toLowerCase().includes(search)
        );
      }
      // Filter by status
      if (status && status !== 'All') {
        list = list.filter((i) => i.status.toLowerCase() === status.toLowerCase());
      }
      // Filter by priority
      if (priority && priority !== 'All') {
        list = list.filter((i) => i.priority.toLowerCase() === priority.toLowerCase());
      }
      // Filter by portfolio
      if (portfolioId) {
        list = list.filter((i) => i.portfolioId === portfolioId);
      }
      // Filter by department
      if (departmentId) {
        list = list.filter((i) => i.departmentId === departmentId);
      }

      // Check pagination support (Story 1.2 & 1.6)
      const pageQuery = req.query.page;
      const pageSizeQuery = req.query.pageSize;
      const isPaginated = req.query.paginate === 'true' || Boolean(pageQuery);

      if (isPaginated) {
        const page = Math.max(1, Number(pageQuery) || 1);
        const pageSize = Math.max(1, Math.min(100, Number(pageSizeQuery) || 10));
        const total = list.length;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        const startIndex = (page - 1) * pageSize;
        const items = list.slice(startIndex, startIndex + pageSize);

        res.json({
          items,
          total,
          page,
          pageSize,
          totalPages
        });
        return;
      }

      // Default: Return raw list for backward compatibility
      res.json(list);
    } catch (error) {
      res.status(500).json({ message: 'Error retrieving initiatives registry.', error: String(error) });
    }
  });

  // Story 1.1 / 1.2: Get single initiative by ID with associated projects
  app.get('/api/initiatives/:id', (req, res) => {
    try {
      const db = loadDb();
      const id = Number(req.params.id);
      const initiative = db.initiatives.find((i) => i.id === id);
      if (!initiative) {
        res.status(404).json({ message: `Initiative with ID ${id} not found.` });
        return;
      }

      const dept = db.departments.find((d) => d.id === initiative.departmentId);
      const port = db.portfolios.find((p) => p.id === initiative.portfolioId);
      const owner = db.users.find((u) => u.id === initiative.ownerId);
      const assocProjects = db.projects
        .filter((pr) => pr.initiativeId === id)
        .map((pr) => {
          const pm = db.users.find((u) => u.id === pr.projectManagerId);
          return {
            id: pr.id,
            name: pr.name,
            nameAr: pr.nameAr || pr.name,
            description: pr.description,
            descriptionAr: pr.descriptionAr || pr.description,
            status: pr.status,
            priority: pr.priority,
            progressPercentage: calculateProjectProgress(pr.id, db),
            startDate: pr.startDate,
            endDate: pr.endDate,
            budget: pr.budget,
            projectManagerName: pm ? pm.fullName : null,
            projectManagerNameAr: pm ? (pm.fullNameAr || pm.fullName) : null
          };
        });

      res.json({
        ...initiative,
        progressPercentage: calculateInitiativeProgress(id, db),
        departmentName: dept ? dept.name : null,
        departmentNameAr: dept ? (dept.nameAr || dept.name) : null,
        portfolioName: port ? port.name : null,
        portfolioNameAr: port ? (port.nameAr || port.name) : null,
        ownerName: owner ? owner.fullName : null,
        ownerNameAr: owner ? (owner.fullNameAr || owner.fullName) : null,
        projectCount: assocProjects.length,
        associatedProjects: assocProjects
      });
    } catch (error) {
      res.status(500).json({ message: 'Error retrieving initiative details.', error: String(error) });
    }
  });

  // Story 1.1 / 1.4: Get associated projects for an initiative
  app.get('/api/initiatives/:id/projects', (req, res) => {
    try {
      const db = loadDb();
      const id = Number(req.params.id);
      const initiative = db.initiatives.find((i) => i.id === id);
      if (!initiative) {
        res.status(404).json({ message: 'Initiative not found.' });
        return;
      }
      const projects = db.projects
        .filter((pr) => pr.initiativeId === id)
        .map((pr) => {
          const pm = db.users.find((u) => u.id === pr.projectManagerId);
          return {
            ...pr,
            progressPercentage: calculateProjectProgress(pr.id, db),
            projectManagerName: pm ? pm.fullName : null,
            projectManagerNameAr: pm ? (pm.fullNameAr || pm.fullName) : null
          };
        });
      res.json(projects);
    } catch (error) {
      res.status(500).json({ message: 'Error retrieving associated projects.', error: String(error) });
    }
  });

  // Story 1.3 & 1.4: Create Initiative
  app.post('/api/initiatives', (req, res) => {
    try {
      const db = loadDb();
      const { name, description, departmentId, portfolioId, ownerId, startDate, targetDate, status, priority, progressPercentage } = req.body;

      // Validation 1: Required fields
      if (!name || !String(name).trim()) {
        res.status(400).json({ message: 'Initiative name is required.' });
        return;
      }
      if (!portfolioId) {
        res.status(400).json({ message: 'A parent portfolio must be selected.' });
        return;
      }

      // Validation 2: Verify portfolio exists
      const port = db.portfolios.find((p) => p.id === Number(portfolioId));
      if (!port) {
        res.status(400).json({ message: `Selected portfolio (ID: ${portfolioId}) does not exist.` });
        return;
      }

      // Validation 3: Verify department exists if provided
      let dept = null;
      if (departmentId) {
        dept = db.departments.find((d) => d.id === Number(departmentId));
        if (!dept) {
          res.status(400).json({ message: `Selected department (ID: ${departmentId}) does not exist.` });
          return;
        }
      }

      // Validation 4: Verify owner exists if provided
      let owner = null;
      if (ownerId) {
        owner = db.users.find((u) => u.id === Number(ownerId));
        if (!owner) {
          res.status(400).json({ message: `Assigned owner (ID: ${ownerId}) does not exist.` });
          return;
        }
      }

      // Validation 5: Date fields validation
      const sDate = startDate || '2026-01-15';
      const tDate = targetDate || '2026-10-30';
      if (sDate && tDate && new Date(tDate) < new Date(sDate)) {
        res.status(400).json({ message: 'Target date cannot be earlier than start date.' });
        return;
      }

      const nextId = db.initiatives.reduce((max, i) => Math.max(max, i.id), 0) + 1;
      const created: InitiativeRecord = {
        id: nextId,
        name: String(name).trim(),
        nameAr: req.body?.nameAr ? String(req.body.nameAr).trim() : undefined,
        description: String(description || '').trim(),
        descriptionAr: req.body?.descriptionAr ? String(req.body.descriptionAr).trim() : undefined,
        departmentId: departmentId ? Number(departmentId) : null,
        portfolioId: Number(portfolioId),
        ownerId: ownerId ? Number(ownerId) : null,
        startDate: sDate,
        targetDate: tDate,
        status: status || 'In Progress',
        priority: priority || 'Medium',
        progressPercentage: Math.max(0, Math.min(100, Number(progressPercentage ?? 0)))
      };

      db.initiatives.push(created);
      saveDb(db);

      res.status(201).json({
        ...created,
        departmentName: dept ? dept.name : null,
        departmentNameAr: dept ? (dept.nameAr || dept.name) : null,
        portfolioName: port ? port.name : null,
        portfolioNameAr: port ? (port.nameAr || port.name) : null,
        ownerName: owner ? owner.fullName : null,
        ownerNameAr: owner ? (owner.fullNameAr || owner.fullName) : null,
        projectCount: 0,
        associatedProjects: []
      });
    } catch (error) {
      res.status(500).json({ message: 'Error creating initiative.', error: String(error) });
    }
  });

  // Story 1.3 & 1.4: Update Initiative
  app.put('/api/initiatives/:id', (req, res) => {
    try {
      const db = loadDb();
      const id = Number(req.params.id);
      const idx = db.initiatives.findIndex((i) => i.id === id);
      if (idx === -1) {
        res.status(404).json({ message: 'Initiative not found.' });
        return;
      }

      const { name, description, departmentId, portfolioId, ownerId, startDate, targetDate, status, priority, progressPercentage } = req.body;

      if (name !== undefined && !String(name).trim()) {
        res.status(400).json({ message: 'Initiative name cannot be empty.' });
        return;
      }

      // Validate portfolio if updated
      const finalPortId = portfolioId !== undefined ? Number(portfolioId) : db.initiatives[idx].portfolioId;
      const port = db.portfolios.find((p) => p.id === finalPortId);
      if (!port) {
        res.status(400).json({ message: 'Selected portfolio does not exist.' });
        return;
      }

      // Validate department if updated
      const finalDeptId = departmentId !== undefined ? (departmentId ? Number(departmentId) : null) : db.initiatives[idx].departmentId;
      let dept = null;
      if (finalDeptId) {
        dept = db.departments.find((d) => d.id === finalDeptId);
        if (!dept) {
          res.status(400).json({ message: 'Selected department does not exist.' });
          return;
        }
      }

      // Validate owner if updated
      const finalOwnerId = ownerId !== undefined ? (ownerId ? Number(ownerId) : null) : db.initiatives[idx].ownerId;
      let owner = null;
      if (finalOwnerId) {
        owner = db.users.find((u) => u.id === finalOwnerId);
        if (!owner) {
          res.status(400).json({ message: 'Selected owner does not exist.' });
          return;
        }
      }

      // Date order validation
      const finalStartDate = startDate || db.initiatives[idx].startDate;
      const finalTargetDate = targetDate || db.initiatives[idx].targetDate;
      if (finalStartDate && finalTargetDate && new Date(finalTargetDate) < new Date(finalStartDate)) {
        res.status(400).json({ message: 'Target date cannot be earlier than start date.' });
        return;
      }

      db.initiatives[idx] = {
        ...db.initiatives[idx],
        name: name !== undefined ? String(name).trim() : db.initiatives[idx].name,
        nameAr: req.body?.nameAr !== undefined ? String(req.body.nameAr).trim() : db.initiatives[idx].nameAr,
        description: description !== undefined ? String(description).trim() : db.initiatives[idx].description,
        descriptionAr: req.body?.descriptionAr !== undefined ? String(req.body.descriptionAr).trim() : db.initiatives[idx].descriptionAr,
        departmentId: finalDeptId,
        portfolioId: finalPortId,
        ownerId: finalOwnerId,
        startDate: finalStartDate,
        targetDate: finalTargetDate,
        status: status || db.initiatives[idx].status,
        priority: priority || db.initiatives[idx].priority,
        progressPercentage: progressPercentage !== undefined ? Math.max(0, Math.min(100, Number(progressPercentage))) : db.initiatives[idx].progressPercentage
      };

      saveDb(db);
      const updated = db.initiatives[idx];
      const assocProjects = db.projects
        .filter((pr) => pr.initiativeId === updated.id)
        .map((pr) => {
          const pm = db.users.find((u) => u.id === pr.projectManagerId);
          return {
            ...pr,
            nameAr: pr.nameAr || pr.name,
            progressPercentage: calculateProjectProgress(pr.id, db),
            projectManagerName: pm ? pm.fullName : null,
            projectManagerNameAr: pm ? (pm.fullNameAr || pm.fullName) : null
          };
        });

      res.json({
        ...updated,
        departmentName: dept ? dept.name : null,
        departmentNameAr: dept ? (dept.nameAr || dept.name) : null,
        portfolioName: port ? port.name : null,
        portfolioNameAr: port ? (port.nameAr || port.name) : null,
        ownerName: owner ? owner.fullName : null,
        ownerNameAr: owner ? (owner.fullNameAr || owner.fullName) : null,
        projectCount: assocProjects.length,
        associatedProjects: assocProjects
      });
    } catch (error) {
      res.status(500).json({ message: 'Error updating initiative.', error: String(error) });
    }
  });

  // Story 1.7 & 1.8: Safe Initiative Deletion
  app.delete('/api/initiatives/:id', (req, res) => {
    try {
      const db = loadDb();
      const id = Number(req.params.id);
      const idx = db.initiatives.findIndex((i) => i.id === id);
      if (idx === -1) {
        res.status(404).json({ message: 'Initiative not found.' });
        return;
      }

      const initiativeName = db.initiatives[idx].name;

      // Story 1.8 Acceptance Criteria 3 & 4: Check whether the initiative has associated projects!
      const associatedProjects = db.projects.filter((pr) => pr.initiativeId === id);
      if (associatedProjects.length > 0) {
        res.status(400).json({
          message: `Cannot delete initiative "${initiativeName}" because it has ${associatedProjects.length} associated project(s). To protect project integrity, please reassign or delete the associated projects before removing this initiative.`,
          associatedProjectsCount: associatedProjects.length,
          associatedProjects: associatedProjects.map((p) => ({
            id: p.id,
            name: p.name,
            nameAr: p.nameAr || p.name,
            status: p.status
          }))
        });
        return;
      }

      // Safe deletion: No associated projects exist, proceed with deletion
      db.initiatives.splice(idx, 1);
      saveDb(db);

      res.json({
        success: true,
        message: `Initiative "${initiativeName}" (ID: ${id}) was successfully deleted.`
      });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting initiative from database.', error: String(error) });
    }
  });

  // ==================== PROJECTS CRUD (Epic 08: Project Management) ====================
  app.get('/api/projects', (req, res) => {
    try {
      const db = loadDb();
      const search = String(req.query.search || '').trim().toLowerCase();
      const rawStatus = req.query.status !== undefined ? String(req.query.status).trim() : '';
      const rawInitiativeId =
        req.query.initiativeId !== undefined ? String(req.query.initiativeId).trim() : '';

      let initiativeIdFilter: number | null = null;
      if (rawInitiativeId && rawInitiativeId !== 'All') {
        const parsed = Number(rawInitiativeId);
        if (!Number.isInteger(parsed) || parsed <= 0) {
          res.status(400).json({ message: 'Invalid initiative filter ID supplied.' });
          return;
        }
        initiativeIdFilter = parsed;
      }

      const validStatuses = ['Planned', 'In Progress', 'On Hold', 'Completed', 'Cancelled'];
      let statusFilter: string | null = null;
      if (rawStatus && rawStatus !== 'All') {
        const matched = validStatuses.find((s) => s.toLowerCase() === rawStatus.toLowerCase());
        if (!matched) {
          res.status(400).json({ message: 'Invalid project status filter supplied.' });
          return;
        }
        statusFilter = matched;
      }

      const shouldPaginate = req.query.page !== undefined || req.query.paginate === 'true';
      const parsedPage = parseInt(String(req.query.page || '1'), 10);
      const parsedPageSize = parseInt(String(req.query.pageSize || '10'), 10);
      const page = !isNaN(parsedPage) && parsedPage >= 1 ? parsedPage : 1;
      const pageSize = !isNaN(parsedPageSize) && parsedPageSize >= 1 ? Math.min(100, parsedPageSize) : 10;

      let list = enrichProjects(db).map((pr) => ({
        ...pr,
        ownerId: pr.projectManagerId,
        ownerName: pr.projectManagerName,
        ownerNameAr: pr.projectManagerNameAr,
        targetDate: pr.endDate
      }));

      if (search) {
        list = list.filter(
          (pr) =>
            pr.name.toLowerCase().includes(search) ||
            (pr.nameAr || '').toLowerCase().includes(search) ||
            (pr.description || '').toLowerCase().includes(search) ||
            (pr.descriptionAr || '').toLowerCase().includes(search)
        );
      }
      if (statusFilter !== null) {
        list = list.filter((pr) => pr.status.toLowerCase() === statusFilter.toLowerCase());
      }
      if (initiativeIdFilter !== null) {
        list = list.filter((pr) => pr.initiativeId === initiativeIdFilter);
      }

      if (shouldPaginate) {
        const total = list.length;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        const safePage = Math.min(page, totalPages);
        const startIndex = (safePage - 1) * pageSize;
        const items = list.slice(startIndex, startIndex + pageSize);

        res.json({
          items,
          total,
          page: safePage,
          pageSize,
          totalPages,
          filters: {
            initiatives: db.initiatives
              .map((i) => ({ id: i.id, name: i.name, nameAr: i.nameAr || i.name }))
              .sort((a, b) => a.name.localeCompare(b.name)),
            statuses: validStatuses
          }
        });
      } else {
        res.json(list);
      }
    } catch (error) {
      console.error('Error retrieving projects:', error);
      res.status(500).json({ message: 'Internal server error while retrieving projects.' });
    }
  });

  app.get('/api/projects/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ message: 'Invalid project ID supplied.' });
        return;
      }

      const db = loadDb();
      const enriched = enrichProjects(db).find((p) => p.id === id);
      if (!enriched) {
        res.status(404).json({ message: `Project with ID ${id} not found.` });
        return;
      }

      const assocActivities = db.activities
        .filter((a) => a.projectId === id)
        .map((a) => {
          const user = a.assignedUserId ? db.users.find((u) => u.id === a.assignedUserId) : null;
          const ws = a.workstreamId ? db.workstreams.find((w) => w.id === a.workstreamId) : null;
          const ms = a.milestoneId ? db.milestones.find((m) => m.id === a.milestoneId) : null;
          const parent = a.parentActivityId
            ? db.activities.find((p) => p.id === a.parentActivityId)
            : null;
          return {
            id: a.id,
            name: a.name,
            nameAr: a.nameAr || a.name,
            description: a.description || '',
            descriptionAr: a.descriptionAr || a.description || '',
            status: a.status,
            priority: a.priority || null,
            assignedUserId: a.assignedUserId,
            assignedUserName: user ? user.fullName : null,
            assignedUserNameAr: user ? (user.fullNameAr || user.fullName) : null,
            startDate: a.startDate,
            dueDate: a.dueDate,
            progressPercentage: a.progressPercentage ?? null,
            workstreamName: ws ? ws.name : null,
            workstreamNameAr: ws ? (ws.nameAr || ws.name) : null,
            milestoneName: ms ? ms.name : null,
            milestoneNameAr: ms ? (ms.nameAr || ms.name) : null,
            parentActivityId: a.parentActivityId,
            parentActivityName: parent ? parent.name : null,
            parentActivityNameAr: parent ? (parent.nameAr || parent.name) : null
          };
        })
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id - b.id);

      res.json({
        ...enriched,
        ownerId: enriched.projectManagerId,
        ownerName: enriched.projectManagerName,
        ownerNameAr: enriched.projectManagerNameAr,
        targetDate: enriched.endDate,
        activitiesCount: assocActivities.length,
        activities: assocActivities
      });
    } catch (error) {
      console.error('Error fetching project details:', error);
      res.status(500).json({ message: 'Internal server error while retrieving project details.' });
    }
  });

  app.post('/api/projects', (req, res) => {
    try {
      const db = loadDb();
      const {
        name,
        description,
        initiativeId,
        projectManagerId,
        ownerId,
        startDate,
        endDate,
        targetDate,
        status,
        priority,
        progressPercentage
      } = req.body;

      if (!name || !String(name).trim()) {
        res.status(400).json({ message: 'Project name is required.' });
        return;
      }

      if (initiativeId === undefined || initiativeId === null || initiativeId === '') {
        res.status(400).json({ message: 'Associated initiative is required.' });
        return;
      }

      const parsedInitId = Number(initiativeId);
      if (!Number.isInteger(parsedInitId) || parsedInitId <= 0) {
        res.status(400).json({ message: 'Invalid initiative ID supplied.' });
        return;
      }
      const initiativeExists = db.initiatives.some((i) => i.id === parsedInitId);
      if (!initiativeExists) {
        res.status(400).json({ message: 'Selected initiative does not exist.' });
        return;
      }

      const rawOwner = ownerId !== undefined ? ownerId : projectManagerId;
      let resolvedOwnerId: number | null = null;
      if (rawOwner !== undefined && rawOwner !== null && rawOwner !== '') {
        const parsedOwnerId = Number(rawOwner);
        if (!Number.isInteger(parsedOwnerId) || parsedOwnerId <= 0) {
          res.status(400).json({ message: 'Selected project owner is invalid.' });
          return;
        }
        const userExists = db.users.some((u) => u.id === parsedOwnerId);
        if (!userExists) {
          res.status(400).json({ message: 'Selected project owner does not exist.' });
          return;
        }
        resolvedOwnerId = parsedOwnerId;
      }

      const resolvedStartDate = String(startDate || '').trim();
      const resolvedEndDate = String(targetDate || endDate || '').trim();

      if (!/^\d{4}-\d{2}-\d{2}$/.test(resolvedStartDate) || !/^\d{4}-\d{2}-\d{2}$/.test(resolvedEndDate)) {
        res.status(400).json({ message: 'Valid start date and target date (YYYY-MM-DD) are required.' });
        return;
      }
      if (new Date(resolvedEndDate) < new Date(resolvedStartDate)) {
        res.status(400).json({ message: 'Target date cannot be earlier than start date.' });
        return;
      }

      const validStatuses = ['Planned', 'In Progress', 'On Hold', 'Completed', 'Cancelled'];
      const resolvedStatus = status ? String(status).trim() : 'Planned';
      if (!validStatuses.includes(resolvedStatus)) {
        res.status(400).json({ message: 'Invalid project status supplied.' });
        return;
      }

      const validPriorities = ['Low', 'Medium', 'High', 'Critical'];
      const resolvedPriority = priority ? String(priority).trim() : 'Medium';
      if (!validPriorities.includes(resolvedPriority)) {
        res.status(400).json({ message: 'Invalid project priority supplied.' });
        return;
      }

      const nextId = db.projects.reduce((max, pr) => Math.max(max, pr.id), 0) + 1;
      const created: ProjectRecord = {
        id: nextId,
        name: String(name).trim(),
        nameAr: req.body?.nameAr ? String(req.body.nameAr).trim() : undefined,
        description: String(description || '').trim(),
        descriptionAr: req.body?.descriptionAr ? String(req.body.descriptionAr).trim() : undefined,
        initiativeId: parsedInitId,
        projectManagerId: resolvedOwnerId,
        startDate: resolvedStartDate,
        endDate: resolvedEndDate,
        status: resolvedStatus,
        priority: resolvedPriority,
        progressPercentage:
          progressPercentage !== undefined ? Math.max(0, Math.min(100, Number(progressPercentage) || 0)) : 0
      };

      db.projects.push(created);
      saveDb(db);

      const full = enrichProjects(db).find((p) => p.id === created.id);
      res.status(201).json({
        ...full,
        ownerId: full?.projectManagerId ?? null,
        ownerName: full?.projectManagerName ?? null,
        ownerNameAr: full?.projectManagerNameAr ?? null,
        targetDate: full?.endDate ?? created.endDate
      });
    } catch (error) {
      console.error('Error creating project:', error);
      res.status(500).json({ message: 'Internal server error while creating project.' });
    }
  });

  app.put('/api/projects/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ message: 'Invalid project ID supplied.' });
        return;
      }

      const db = loadDb();
      const idx = db.projects.findIndex((pr) => pr.id === id);
      if (idx === -1) {
        res.status(404).json({ message: `Project with ID ${id} not found.` });
        return;
      }

      const {
        name,
        description,
        initiativeId,
        projectManagerId,
        ownerId,
        startDate,
        endDate,
        targetDate,
        status,
        priority,
        progressPercentage
      } = req.body;

      if (name !== undefined && !String(name).trim()) {
        res.status(400).json({ message: 'Project name cannot be empty.' });
        return;
      }

      let finalInitId = db.projects[idx].initiativeId;
      if (initiativeId !== undefined) {
        const parsedInitId = Number(initiativeId);
        if (!Number.isInteger(parsedInitId) || parsedInitId <= 0) {
          res.status(400).json({ message: 'Invalid initiative ID supplied.' });
          return;
        }
        if (!db.initiatives.some((i) => i.id === parsedInitId)) {
          res.status(400).json({ message: 'Selected initiative does not exist.' });
          return;
        }
        finalInitId = parsedInitId;
      }

      const rawOwner = ownerId !== undefined ? ownerId : projectManagerId;
      let finalOwnerId = db.projects[idx].projectManagerId;
      if (rawOwner !== undefined) {
        if (rawOwner === null || rawOwner === '') {
          finalOwnerId = null;
        } else {
          const parsedOwnerId = Number(rawOwner);
          if (!Number.isInteger(parsedOwnerId) || parsedOwnerId <= 0) {
            res.status(400).json({ message: 'Selected project owner is invalid.' });
            return;
          }
          if (!db.users.some((u) => u.id === parsedOwnerId)) {
            res.status(400).json({ message: 'Selected project owner does not exist.' });
            return;
          }
          finalOwnerId = parsedOwnerId;
        }
      }

      const finalStartDate = startDate !== undefined ? String(startDate).trim() : db.projects[idx].startDate;
      const incomingEnd = targetDate !== undefined ? targetDate : endDate;
      const finalEndDate = incomingEnd !== undefined ? String(incomingEnd).trim() : db.projects[idx].endDate;

      if (!/^\d{4}-\d{2}-\d{2}$/.test(finalStartDate) || !/^\d{4}-\d{2}-\d{2}$/.test(finalEndDate)) {
        res.status(400).json({ message: 'Valid start date and target date (YYYY-MM-DD) are required.' });
        return;
      }
      if (new Date(finalEndDate) < new Date(finalStartDate)) {
        res.status(400).json({ message: 'Target date cannot be earlier than start date.' });
        return;
      }

      const validStatuses = ['Planned', 'In Progress', 'On Hold', 'Completed', 'Cancelled'];
      const finalStatus = status !== undefined ? String(status).trim() : db.projects[idx].status;
      if (!validStatuses.includes(finalStatus)) {
        res.status(400).json({ message: 'Invalid project status supplied.' });
        return;
      }

      const validPriorities = ['Low', 'Medium', 'High', 'Critical'];
      const finalPriority = priority !== undefined ? String(priority).trim() : db.projects[idx].priority;
      if (!validPriorities.includes(finalPriority)) {
        res.status(400).json({ message: 'Invalid project priority supplied.' });
        return;
      }

      db.projects[idx] = {
        ...db.projects[idx],
        name: name !== undefined ? String(name).trim() : db.projects[idx].name,
        nameAr: req.body?.nameAr !== undefined ? String(req.body.nameAr).trim() : db.projects[idx].nameAr,
        description: description !== undefined ? String(description).trim() : db.projects[idx].description,
        descriptionAr: req.body?.descriptionAr !== undefined ? String(req.body.descriptionAr).trim() : db.projects[idx].descriptionAr,
        initiativeId: finalInitId,
        projectManagerId: finalOwnerId,
        startDate: finalStartDate,
        endDate: finalEndDate,
        status: finalStatus,
        priority: finalPriority,
        progressPercentage:
          progressPercentage !== undefined
            ? Math.max(0, Math.min(100, Number(progressPercentage) || 0))
            : db.projects[idx].progressPercentage
      };

      saveDb(db);
      const full = enrichProjects(db).find((p) => p.id === id);
      res.json({
        ...full,
        ownerId: full?.projectManagerId ?? null,
        ownerName: full?.projectManagerName ?? null,
        ownerNameAr: full?.projectManagerNameAr ?? null,
        targetDate: full?.endDate ?? db.projects[idx].endDate
      });
    } catch (error) {
      console.error('Error updating project:', error);
      res.status(500).json({ message: 'Internal server error while updating project.' });
    }
  });

  // Story 8.8: Safe Project Deletion
  app.delete('/api/projects/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ message: 'Invalid project ID supplied.' });
        return;
      }

      const db = loadDb();
      const idx = db.projects.findIndex((pr) => pr.id === id);
      if (idx === -1) {
        res.status(404).json({ message: `Project with ID ${id} not found.` });
        return;
      }

      const project = db.projects[idx];
      const associatedActivities = db.activities.filter((a) => a.projectId === id);

      if (associatedActivities.length > 0) {
        res.status(400).json({
          message: `Cannot delete project "${project.name}" because it has ${associatedActivities.length} associated activity record(s). Remove or reassign associated activities before deleting this project.`,
          associatedActivitiesCount: associatedActivities.length,
          associatedActivities: associatedActivities.map((a) => ({
            id: a.id,
            name: a.name,
            nameAr: a.nameAr || a.name,
            status: a.status
          }))
        });
        return;
      }

      db.workstreams = db.workstreams.filter((w) => w.projectId !== id);
      db.milestones = db.milestones.filter((m) => m.projectId !== id);
      db.projects.splice(idx, 1);
      saveDb(db);

      res.status(200).json({
        success: true,
        message: `Project "${project.name}" (ID: ${id}) was successfully deleted.`
      });
    } catch (error) {
      console.error('Error safely deleting project:', error);
      res.status(500).json({ message: 'Internal server error while deleting project.' });
    }
  });

  // ==================== PROGRESS TRACKING CRUD & SUMMARY (Epic 04) ====================
  app.get('/api/progress/summary', (req, res) => {
    try {
      const db = loadDb();

      // Calculated projects progress (only from actual activity records)
      const projectsWithMeta = db.projects.map((pr) => {
        const meta = calculateProjectProgressMeta(pr.id, db);
        return {
          id: pr.id,
          progress: meta.progressPercentage,
          hasProgressData: meta.hasProgressData,
          status: pr.status
        };
      });

      // Calculated initiatives progress (only from actual project records)
      const initiativesWithMeta = db.initiatives.map((i) => {
        const meta = calculateInitiativeProgressMeta(i.id, db);
        return {
          id: i.id,
          progress: meta.progressPercentage,
          hasProgressData: meta.hasProgressData,
          status: i.status
        };
      });

      const validProjects = projectsWithMeta.filter((p) => p.hasProgressData && p.progress !== null);
      const validInitiatives = initiativesWithMeta.filter((i) => i.hasProgressData && i.progress !== null);

      const avgProjectProgress =
        validProjects.length > 0
          ? Math.round(validProjects.reduce((s, p) => s + (p.progress as number), 0) / validProjects.length)
          : 0;

      const avgInitiativeProgress =
        validInitiatives.length > 0
          ? Math.round(validInitiatives.reduce((s, i) => s + (i.progress as number), 0) / validInitiatives.length)
          : 0;

      const overallPmoProgress =
        validInitiatives.length > 0 && validProjects.length > 0
          ? Math.round((avgInitiativeProgress + avgProjectProgress) / 2)
          : validInitiatives.length > 0
          ? avgInitiativeProgress
          : avgProjectProgress;

      const activities = db.activities.filter((a) => a.parentActivityId === null);
      const completedActivities = activities.filter(
        (a) => a.status === 'Completed' || Number(a.progressPercentage) === 100
      ).length;
      const inProgressActivities = activities.filter((a) => a.status === 'In Progress').length;
      const notStartedActivities = activities.filter((a) => a.status === 'Not Started').length;

      res.json({
        overallPmoProgress,
        initiatives: {
          total: db.initiatives.length,
          withData: validInitiatives.length,
          completed: initiativesWithMeta.filter((i) => i.progress === 100 || i.status === 'Completed').length,
          inProgress: initiativesWithMeta.filter((i) => i.progress !== null && i.progress > 0 && i.progress < 100).length,
          notStarted: initiativesWithMeta.filter((i) => (i.progress === 0 || i.progress === null) && i.status !== 'Completed').length,
          averageProgress: avgInitiativeProgress
        },
        projects: {
          total: db.projects.length,
          withData: validProjects.length,
          completed: projectsWithMeta.filter((p) => p.progress === 100 || p.status === 'Completed').length,
          inProgress: projectsWithMeta.filter((p) => p.progress !== null && p.progress > 0 && p.progress < 100).length,
          notStarted: projectsWithMeta.filter((p) => (p.progress === 0 || p.progress === null) && p.status !== 'Completed').length,
          averageProgress: avgProjectProgress
        },
        activities: {
          total: activities.length,
          completed: completedActivities,
          inProgress: inProgressActivities,
          notStarted: notStartedActivities
        }
      });
    } catch (error) {
      console.error('Error fetching progress summary:', error);
      res.status(500).json({ message: 'Internal server error while calculating progress summary.' });
    }
  });

  app.get('/api/progress/initiatives', (req, res) => {
    try {
      const db = loadDb();
      const search = String(req.query.search || '').trim().toLowerCase();
      const status = String(req.query.status || '').trim();
      const departmentId = req.query.departmentId ? Number(req.query.departmentId) : null;
      const portfolioId = req.query.portfolioId ? Number(req.query.portfolioId) : null;

      let list = db.initiatives.map((i) => {
        const initMeta = calculateInitiativeProgressMeta(i.id, db);
        const dept = db.departments.find((d) => d.id === i.departmentId);
        const port = db.portfolios.find((p) => p.id === i.portfolioId);
        const owner = db.users.find((u) => u.id === i.ownerId);

        const childProjects = db.projects
          .filter((pr) => pr.initiativeId === i.id)
          .map((pr) => {
            const pm = db.users.find((u) => u.id === pr.projectManagerId);
            const prMeta = calculateProjectProgressMeta(pr.id, db);
            const actList = db.activities.filter((a) => a.projectId === pr.id && a.parentActivityId === null);
            return {
              id: pr.id,
              name: pr.name,
              nameAr: pr.nameAr || pr.name,
              status: pr.status,
              priority: pr.priority,
              progressPercentage: prMeta.progressPercentage,
              hasProgressData: prMeta.hasProgressData,
              startDate: pr.startDate,
              endDate: pr.endDate,
              projectManagerName: pm ? pm.fullName : null,
              projectManagerNameAr: pm ? (pm.fullNameAr || pm.fullName) : null,
              activityCount: actList.length
            };
          });

        const completedCount = childProjects.filter(
          (p) => p.progressPercentage === 100 || p.status === 'Completed'
        ).length;

        let progressStatus = i.status || 'Not Started';
        if (initMeta.progressPercentage === 100) {
          progressStatus = 'Completed';
        } else if (initMeta.progressPercentage !== null && initMeta.progressPercentage > 0 && i.status === 'Draft') {
          progressStatus = 'In Progress';
        }

        return {
          id: i.id,
          name: i.name,
          nameAr: i.nameAr || i.name,
          description: i.description,
          descriptionAr: i.descriptionAr || i.description,
          departmentId: i.departmentId,
          departmentName: dept ? dept.name : null,
          departmentNameAr: dept ? (dept.nameAr || dept.name) : null,
          portfolioId: i.portfolioId,
          portfolioName: port ? port.name : null,
          portfolioNameAr: port ? (port.nameAr || port.name) : null,
          ownerId: i.ownerId,
          ownerName: owner ? owner.fullName : null,
          ownerNameAr: owner ? (owner.fullNameAr || owner.fullName) : null,
          status: progressStatus,
          priority: i.priority,
          startDate: i.startDate,
          targetDate: i.targetDate,
          progressPercentage: initMeta.progressPercentage,
          hasProgressData: initMeta.hasProgressData,
          projectCount: childProjects.length,
          completedProjectCount: completedCount,
          projects: childProjects
        };
      });

      if (search) {
        list = list.filter(
          (i) =>
            i.name.toLowerCase().includes(search) ||
            (i.nameAr || '').toLowerCase().includes(search) ||
            (i.description || '').toLowerCase().includes(search) ||
            (i.descriptionAr || '').toLowerCase().includes(search) ||
            (i.departmentName || '').toLowerCase().includes(search) ||
            (i.departmentNameAr || '').toLowerCase().includes(search) ||
            (i.portfolioName || '').toLowerCase().includes(search) ||
            (i.portfolioNameAr || '').toLowerCase().includes(search) ||
            (i.ownerName || '').toLowerCase().includes(search) ||
            (i.ownerNameAr || '').toLowerCase().includes(search)
        );
      }
      if (status && status !== 'All') {
        list = list.filter((i) => i.status.toLowerCase() === status.toLowerCase());
      }
      if (departmentId) {
        list = list.filter((i) => i.departmentId === departmentId);
      }
      if (portfolioId) {
        list = list.filter((i) => i.portfolioId === portfolioId);
      }

      res.json(list);
    } catch (error) {
      console.error('Error fetching initiative progress list:', error);
      res.status(500).json({ message: 'Internal server error while retrieving initiative progress.' });
    }
  });

  app.get('/api/progress/initiatives/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id) || id <= 0) {
        res.status(400).json({ message: 'Invalid initiative ID supplied.' });
        return;
      }

      const db = loadDb();
      const initiative = db.initiatives.find((i) => i.id === id);
      if (!initiative) {
        res.status(404).json({ message: `Initiative with ID ${id} not found.` });
        return;
      }

      const initMeta = calculateInitiativeProgressMeta(id, db);
      const dept = db.departments.find((d) => d.id === initiative.departmentId);
      const port = db.portfolios.find((p) => p.id === initiative.portfolioId);
      const owner = db.users.find((u) => u.id === initiative.ownerId);

      const childProjects = db.projects
        .filter((pr) => pr.initiativeId === id)
        .map((pr) => {
          const pm = db.users.find((u) => u.id === pr.projectManagerId);
          const prMeta = calculateProjectProgressMeta(pr.id, db);
          const allActs = db.activities.filter((a) => a.projectId === pr.id);
          const parentActs = allActs.filter((a) => a.parentActivityId === null);
          const activities = parentActs.length > 0 ? parentActs : allActs;
          return {
            id: pr.id,
            name: pr.name,
            nameAr: pr.nameAr || pr.name,
            status: pr.status,
            priority: pr.priority,
            progressPercentage: prMeta.progressPercentage,
            hasProgressData: prMeta.hasProgressData,
            startDate: pr.startDate,
            endDate: pr.endDate,
            projectManagerName: pm ? pm.fullName : null,
            projectManagerNameAr: pm ? (pm.fullNameAr || pm.fullName) : null,
            activityCount: activities.length,
            completedActivityCount: activities.filter(
              (a) => a.status === 'Completed' || Number(a.progressPercentage) === 100
            ).length
          };
        });

      res.json({
        id: initiative.id,
        name: initiative.name,
        nameAr: initiative.nameAr || initiative.name,
        description: initiative.description,
        descriptionAr: initiative.descriptionAr || initiative.description,
        departmentName: dept ? dept.name : null,
        departmentNameAr: dept ? (dept.nameAr || dept.name) : null,
        portfolioName: port ? port.name : null,
        portfolioNameAr: port ? (port.nameAr || port.name) : null,
        ownerName: owner ? owner.fullName : null,
        ownerNameAr: owner ? (owner.fullNameAr || owner.fullName) : null,
        status: initMeta.progressPercentage === 100 ? 'Completed' : (initiative.status || 'Not Started'),
        priority: initiative.priority,
        startDate: initiative.startDate,
        targetDate: initiative.targetDate,
        progressPercentage: initMeta.progressPercentage,
        hasProgressData: initMeta.hasProgressData,
        projectCount: childProjects.length,
        completedProjectCount: childProjects.filter(
          (p) => p.progressPercentage === 100 || p.status === 'Completed'
        ).length,
        projects: childProjects
      });
    } catch (error) {
      console.error('Error fetching single initiative progress:', error);
      res.status(500).json({ message: 'Internal server error while retrieving initiative progress.' });
    }
  });

  app.get('/api/progress/projects', (req, res) => {
    try {
      const db = loadDb();
      const search = String(req.query.search || '').trim().toLowerCase();
      const status = String(req.query.status || '').trim();
      const initiativeId = req.query.initiativeId ? Number(req.query.initiativeId) : null;

      let list = db.projects.map((pr) => {
        const prMeta = calculateProjectProgressMeta(pr.id, db);
        const init = db.initiatives.find((i) => i.id === pr.initiativeId);
        const port = init ? db.portfolios.find((p) => p.id === init.portfolioId) : null;
        const dept = init ? db.departments.find((d) => d.id === init.departmentId) : null;
        const pm = db.users.find((u) => u.id === pr.projectManagerId);

        const allActs = db.activities.filter((a) => a.projectId === pr.id);
        const parentActs = allActs.filter((a) => a.parentActivityId === null);
        const activities = parentActs.length > 0 ? parentActs : allActs;
        const completedActs = activities.filter(
          (a) => a.status === 'Completed' || Number(a.progressPercentage) === 100
        ).length;

        let progressStatus = pr.status || 'Not Started';
        if (prMeta.progressPercentage === 100) {
          progressStatus = 'Completed';
        } else if (prMeta.progressPercentage !== null && prMeta.progressPercentage > 0 && pr.status === 'Planned') {
          progressStatus = 'In Progress';
        }

        return {
          id: pr.id,
          name: pr.name,
          nameAr: pr.nameAr || pr.name,
          description: pr.description,
          descriptionAr: pr.descriptionAr || pr.description,
          initiativeId: pr.initiativeId,
          initiativeName: init ? init.name : null,
          initiativeNameAr: init ? (init.nameAr || init.name) : null,
          portfolioName: port ? port.name : null,
          portfolioNameAr: port ? (port.nameAr || port.name) : null,
          departmentName: dept ? dept.name : null,
          departmentNameAr: dept ? (dept.nameAr || dept.name) : null,
          projectManagerId: pr.projectManagerId,
          projectManagerName: pm ? pm.fullName : null,
          projectManagerNameAr: pm ? (pm.fullNameAr || pm.fullName) : null,
          status: progressStatus,
          priority: pr.priority,
          startDate: pr.startDate,
          endDate: pr.endDate,
          progressPercentage: prMeta.progressPercentage,
          hasProgressData: prMeta.hasProgressData,
          activityCount: activities.length,
          completedActivityCount: completedActs
        };
      });

      if (search) {
        list = list.filter(
          (pr) =>
            pr.name.toLowerCase().includes(search) ||
            (pr.nameAr || '').toLowerCase().includes(search) ||
            (pr.description || '').toLowerCase().includes(search) ||
            (pr.descriptionAr || '').toLowerCase().includes(search) ||
            (pr.initiativeName || '').toLowerCase().includes(search) ||
            (pr.initiativeNameAr || '').toLowerCase().includes(search) ||
            (pr.projectManagerName || '').toLowerCase().includes(search) ||
            (pr.projectManagerNameAr || '').toLowerCase().includes(search)
        );
      }
      if (status && status !== 'All') {
        list = list.filter((pr) => pr.status.toLowerCase() === status.toLowerCase());
      }
      if (initiativeId) {
        list = list.filter((pr) => pr.initiativeId === initiativeId);
      }

      res.json(list);
    } catch (error) {
      console.error('Error fetching project progress list:', error);
      res.status(500).json({ message: 'Internal server error while retrieving project progress.' });
    }
  });

  app.get('/api/progress/projects/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id) || id <= 0) {
        res.status(400).json({ message: 'Invalid project ID supplied.' });
        return;
      }

      const db = loadDb();
      const project = db.projects.find((p) => p.id === id);
      if (!project) {
        res.status(404).json({ message: `Project with ID ${id} not found.` });
        return;
      }

      const prMeta = calculateProjectProgressMeta(id, db);
      const init = db.initiatives.find((i) => i.id === project.initiativeId);
      const pm = db.users.find((u) => u.id === project.projectManagerId);

      const allActs = db.activities.filter((a) => a.projectId === id);
      const parentActs = allActs.filter((a) => a.parentActivityId === null);
      const sourceActs = parentActs.length > 0 ? parentActs : allActs;

      const activities = sourceActs.map((a) => {
        const assigned = db.users.find((u) => u.id === a.assignedUserId);
        const ws = db.workstreams.find((w) => w.id === a.workstreamId);
        const numericProgress =
          a.progressPercentage !== undefined && a.progressPercentage !== null && !isNaN(Number(a.progressPercentage))
            ? Math.min(100, Math.max(0, Number(a.progressPercentage)))
            : null;
        return {
          id: a.id,
          name: a.name,
          nameAr: a.nameAr || a.name,
          description: a.description,
          descriptionAr: a.descriptionAr || a.description,
          status: a.status,
          priority: a.priority,
          progressPercentage: numericProgress,
          startDate: a.startDate,
          dueDate: a.dueDate,
          assignedUserName: assigned ? assigned.fullName : null,
          assignedUserNameAr: assigned ? (assigned.fullNameAr || assigned.fullName) : null,
          workstreamName: ws ? ws.name : null,
          workstreamNameAr: ws ? (ws.nameAr || ws.name) : null
        };
      });

      res.json({
        id: project.id,
        name: project.name,
        nameAr: project.nameAr || project.name,
        description: project.description,
        descriptionAr: project.descriptionAr || project.description,
        initiativeName: init ? init.name : null,
        initiativeNameAr: init ? (init.nameAr || init.name) : null,
        projectManagerName: pm ? pm.fullName : null,
        projectManagerNameAr: pm ? (pm.fullNameAr || pm.fullName) : null,
        status: prMeta.progressPercentage === 100 ? 'Completed' : (project.status || 'Not Started'),
        priority: project.priority,
        startDate: project.startDate,
        endDate: project.endDate,
        progressPercentage: prMeta.progressPercentage,
        hasProgressData: prMeta.hasProgressData,
        activityCount: activities.length,
        completedActivityCount: activities.filter(
          (a) => a.progressPercentage === 100 || a.status === 'Completed'
        ).length,
        activities
      });
    } catch (error) {
      console.error('Error fetching single project progress:', error);
      res.status(500).json({ message: 'Internal server error while retrieving project progress.' });
    }
  });

  // ==================== OVERDUE ACTIVITY MONITORING (Epic 05) ====================
  app.get('/api/overdue-activities', (req, res) => {
    try {
      const db = loadDb();
      const currentDateStr = getCurrentIsoDate();
      const search = String(req.query.search || '').trim().toLowerCase();
      const rawProjectId = req.query.projectId !== undefined ? String(req.query.projectId).trim() : '';
      const rawAssignedUserId =
        req.query.assignedUserId !== undefined ? String(req.query.assignedUserId).trim() : '';

      let projectIdFilter: number | null = null;
      if (rawProjectId && rawProjectId !== 'All') {
        const parsed = Number(rawProjectId);
        if (!Number.isInteger(parsed) || parsed <= 0) {
          res.status(400).json({ message: 'Invalid project filter ID supplied.' });
          return;
        }
        projectIdFilter = parsed;
      }

      let assignedUserFilter: number | 'unassigned' | null = null;
      if (rawAssignedUserId && rawAssignedUserId !== 'All') {
        if (rawAssignedUserId.toLowerCase() === 'unassigned') {
          assignedUserFilter = 'unassigned';
        } else {
          const parsed = Number(rawAssignedUserId);
          if (!Number.isInteger(parsed) || parsed <= 0) {
            res.status(400).json({ message: 'Invalid assigned user filter ID supplied.' });
            return;
          }
          assignedUserFilter = parsed;
        }
      }

      const parsedPage = parseInt(String(req.query.page || '1'), 10);
      const parsedPageSize = parseInt(String(req.query.pageSize || '10'), 10);
      const page = !isNaN(parsedPage) && parsedPage >= 1 ? parsedPage : 1;
      const pageSize = !isNaN(parsedPageSize) && parsedPageSize >= 1 ? Math.min(100, parsedPageSize) : 10;

      const buildOverdueDto = (a: ActivityRecord) => {
        const proj = db.projects.find((pr) => pr.id === a.projectId);
        const init = proj ? db.initiatives.find((i) => i.id === proj.initiativeId) : null;
        const ws = a.workstreamId ? db.workstreams.find((w) => w.id === a.workstreamId) : null;
        const ms = a.milestoneId ? db.milestones.find((m) => m.id === a.milestoneId) : null;
        const parent = a.parentActivityId
          ? db.activities.find((p) => p.id === a.parentActivityId)
          : null;
        const user = a.assignedUserId ? db.users.find((u) => u.id === a.assignedUserId) : null;

        return {
          id: a.id,
          name: a.name,
          nameAr: a.nameAr || a.name,
          description: a.description || '',
          descriptionAr: a.descriptionAr || a.description || '',
          projectId: a.projectId,
          projectName: proj ? proj.name : null,
          projectNameAr: proj ? (proj.nameAr || proj.name) : null,
          initiativeId: init ? init.id : null,
          initiativeName: init ? init.name : null,
          initiativeNameAr: init ? (init.nameAr || init.name) : null,
          workstreamId: a.workstreamId,
          workstreamName: ws ? ws.name : null,
          workstreamNameAr: ws ? (ws.nameAr || ws.name) : null,
          milestoneId: a.milestoneId,
          milestoneName: ms ? ms.name : null,
          milestoneNameAr: ms ? (ms.nameAr || ms.name) : null,
          parentActivityId: a.parentActivityId,
          parentActivityName: parent ? parent.name : null,
          parentActivityNameAr: parent ? (parent.nameAr || parent.name) : null,
          assignedUserId: a.assignedUserId,
          assignedUserName: user ? user.fullName : null,
          assignedUserNameAr: user ? (user.fullNameAr || user.fullName) : null,
          startDate: a.startDate,
          dueDate: a.dueDate,
          status: a.status,
          priority: a.priority || null,
          progressPercentage: a.progressPercentage ?? null,
          isOverdue: true,
          daysOverdue: calculateDaysOverdue(a.dueDate, currentDateStr),
          evaluatedDate: currentDateStr
        };
      };

      // Evaluate all currently overdue activities from DB
      const allOverdue = db.activities
        .filter((a) => isActivityOverdue(a, currentDateStr))
        .map(buildOverdueDto)
        .sort((a, b) => {
          if (b.daysOverdue !== a.daysOverdue) return b.daysOverdue - a.daysOverdue;
          if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
          return a.id - b.id;
        });

      // Build distinct filter options from all overdue activities
      const projectMap = new Map<number, { name: string; nameAr: string }>();
      const userMap = new Map<number, { fullName: string; fullNameAr: string }>();
      let hasUnassigned = false;

      allOverdue.forEach((act) => {
        if (act.projectId && act.projectName) {
          projectMap.set(act.projectId, { name: act.projectName, nameAr: act.projectNameAr || act.projectName });
        }
        if (act.assignedUserId && act.assignedUserName) {
          userMap.set(act.assignedUserId, { fullName: act.assignedUserName, fullNameAr: act.assignedUserNameAr || act.assignedUserName });
        } else {
          hasUnassigned = true;
        }
      });

      const summary = {
        totalOverdue: allOverdue.length,
        criticalCount: allOverdue.filter((a) => String(a.priority || '').toLowerCase() === 'critical').length,
        highCount: allOverdue.filter((a) => String(a.priority || '').toLowerCase() === 'high').length,
        unassignedCount: allOverdue.filter((a) => !a.assignedUserId).length
      };

      // Apply search and filters
      let filtered = allOverdue;
      if (search) {
        filtered = filtered.filter(
          (a) => a.name.toLowerCase().includes(search) || (a.nameAr || '').toLowerCase().includes(search)
        );
      }
      if (projectIdFilter !== null) {
        filtered = filtered.filter((a) => a.projectId === projectIdFilter);
      }
      if (assignedUserFilter === 'unassigned') {
        filtered = filtered.filter((a) => a.assignedUserId === null || a.assignedUserId === undefined);
      } else if (assignedUserFilter !== null) {
        filtered = filtered.filter((a) => a.assignedUserId === assignedUserFilter);
      }

      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(page, totalPages);
      const startIndex = (safePage - 1) * pageSize;
      const items = filtered.slice(startIndex, startIndex + pageSize);

      res.json({
        items,
        total,
        page: safePage,
        pageSize,
        totalPages,
        evaluatedDate: currentDateStr,
        summary,
        filters: {
          projects: Array.from(projectMap.entries())
            .map(([id, val]) => ({ id, name: val.name, nameAr: val.nameAr }))
            .sort((a, b) => a.name.localeCompare(b.name)),
          assignedUsers: Array.from(userMap.entries())
            .map(([id, val]) => ({ id, fullName: val.fullName, fullNameAr: val.fullNameAr }))
            .sort((a, b) => a.fullName.localeCompare(b.fullName)),
          hasUnassigned
        }
      });
    } catch (error) {
      console.error('Error fetching overdue activities:', error);
      res.status(500).json({ message: 'Internal server error while retrieving overdue activities.' });
    }
  });

  app.get('/api/overdue-activities/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ message: 'Invalid activity ID supplied.' });
        return;
      }

      const db = loadDb();
      const activity = db.activities.find((a) => a.id === id);
      if (!activity) {
        res.status(404).json({ message: `Activity with ID ${id} not found.` });
        return;
      }

      const currentDateStr = getCurrentIsoDate();
      const overdue = isActivityOverdue(activity, currentDateStr);
      const proj = db.projects.find((pr) => pr.id === activity.projectId);
      const init = proj ? db.initiatives.find((i) => i.id === proj.initiativeId) : null;
      const ws = activity.workstreamId ? db.workstreams.find((w) => w.id === activity.workstreamId) : null;
      const ms = activity.milestoneId ? db.milestones.find((m) => m.id === activity.milestoneId) : null;
      const parent = activity.parentActivityId
        ? db.activities.find((p) => p.id === activity.parentActivityId)
        : null;
      const user = activity.assignedUserId
        ? db.users.find((u) => u.id === activity.assignedUserId)
        : null;

      res.json({
        id: activity.id,
        name: activity.name,
        nameAr: activity.nameAr || activity.name,
        description: activity.description || '',
        descriptionAr: activity.descriptionAr || activity.description || '',
        projectId: activity.projectId,
        projectName: proj ? proj.name : null,
        projectNameAr: proj ? (proj.nameAr || proj.name) : null,
        initiativeId: init ? init.id : null,
        initiativeName: init ? init.name : null,
        initiativeNameAr: init ? (init.nameAr || init.name) : null,
        workstreamId: activity.workstreamId,
        workstreamName: ws ? ws.name : null,
        workstreamNameAr: ws ? (ws.nameAr || ws.name) : null,
        milestoneId: activity.milestoneId,
        milestoneName: ms ? ms.name : null,
        milestoneNameAr: ms ? (ms.nameAr || ms.name) : null,
        parentActivityId: activity.parentActivityId,
        parentActivityName: parent ? parent.name : null,
        parentActivityNameAr: parent ? (parent.nameAr || parent.name) : null,
        assignedUserId: activity.assignedUserId,
        assignedUserName: user ? user.fullName : null,
        assignedUserNameAr: user ? (user.fullNameAr || user.fullName) : null,
        startDate: activity.startDate,
        dueDate: activity.dueDate,
        status: activity.status,
        priority: activity.priority || null,
        progressPercentage: activity.progressPercentage ?? null,
        isOverdue: overdue,
        daysOverdue: overdue ? calculateDaysOverdue(activity.dueDate, currentDateStr) : 0,
        evaluatedDate: currentDateStr
      });
    } catch (error) {
      console.error('Error fetching overdue activity details:', error);
      res.status(500).json({ message: 'Internal server error while retrieving overdue activity details.' });
    }
  });

  // ==================== ACTIVITY SEARCH & DETAILS (Epic 06) ====================
  app.get('/api/activity-search', (req, res) => {
    try {
      const db = loadDb();
      const currentDateStr = getCurrentIsoDate();
      const search = String(req.query.search || '').trim().toLowerCase();
      const rawProjectId = req.query.projectId !== undefined ? String(req.query.projectId).trim() : '';
      const rawStatus = req.query.status !== undefined ? String(req.query.status).trim() : '';

      let projectIdFilter: number | null = null;
      if (rawProjectId && rawProjectId !== 'All') {
        const parsed = Number(rawProjectId);
        if (!Number.isInteger(parsed) || parsed <= 0) {
          res.status(400).json({ message: 'Invalid project filter ID supplied.' });
          return;
        }
        projectIdFilter = parsed;
      }

      const validStatuses = ['Not Started', 'In Progress', 'Completed', 'Delayed', 'On Hold'];
      let statusFilter: string | null = null;
      if (rawStatus && rawStatus !== 'All') {
        const matched = validStatuses.find((s) => s.toLowerCase() === rawStatus.toLowerCase());
        if (!matched) {
          res.status(400).json({ message: 'Invalid activity status filter supplied.' });
          return;
        }
        statusFilter = matched;
      }

      const parsedPage = parseInt(String(req.query.page || '1'), 10);
      const parsedPageSize = parseInt(String(req.query.pageSize || '10'), 10);
      const page = !isNaN(parsedPage) && parsedPage >= 1 ? parsedPage : 1;
      const pageSize = !isNaN(parsedPageSize) && parsedPageSize >= 1 ? Math.min(100, parsedPageSize) : 10;

      const buildActivityDto = (a: ActivityRecord) => {
        const proj = db.projects.find((pr) => pr.id === a.projectId);
        const init = proj ? db.initiatives.find((i) => i.id === proj.initiativeId) : null;
        const ws = a.workstreamId ? db.workstreams.find((w) => w.id === a.workstreamId) : null;
        const ms = a.milestoneId ? db.milestones.find((m) => m.id === a.milestoneId) : null;
        const parent = a.parentActivityId
          ? db.activities.find((p) => p.id === a.parentActivityId)
          : null;
        const user = a.assignedUserId ? db.users.find((u) => u.id === a.assignedUserId) : null;

        return {
          id: a.id,
          name: a.name,
          nameAr: a.nameAr || a.name,
          description: a.description || '',
          descriptionAr: a.descriptionAr || a.description || '',
          projectId: a.projectId,
          projectName: proj ? proj.name : null,
          projectNameAr: proj ? (proj.nameAr || proj.name) : null,
          initiativeId: init ? init.id : null,
          initiativeName: init ? init.name : null,
          initiativeNameAr: init ? (init.nameAr || init.name) : null,
          workstreamId: a.workstreamId,
          workstreamName: ws ? ws.name : null,
          workstreamNameAr: ws ? (ws.nameAr || ws.name) : null,
          milestoneId: a.milestoneId,
          milestoneName: ms ? ms.name : null,
          milestoneNameAr: ms ? (ms.nameAr || ms.name) : null,
          parentActivityId: a.parentActivityId,
          parentActivityName: parent ? parent.name : null,
          parentActivityNameAr: parent ? (parent.nameAr || parent.name) : null,
          assignedUserId: a.assignedUserId,
          assignedUserName: user ? user.fullName : null,
          assignedUserNameAr: user ? (user.fullNameAr || user.fullName) : null,
          startDate: a.startDate,
          dueDate: a.dueDate,
          status: a.status,
          priority: a.priority || null,
          progressPercentage: a.progressPercentage ?? null,
          isOverdue: isActivityOverdue(a, currentDateStr)
        };
      };

      const allMapped = db.activities
        .map(buildActivityDto)
        .sort((a, b) => {
          if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
          return a.id - b.id;
        });

      const availableStatuses = Array.from(new Set(allMapped.map((a) => a.status).filter(Boolean)));
      const availableProjects = db.projects
        .map((p) => ({ id: p.id, name: p.name, nameAr: p.nameAr || p.name }))
        .sort((a, b) => a.name.localeCompare(b.name));

      let filtered = allMapped;
      if (search) {
        filtered = filtered.filter(
          (a) => a.name.toLowerCase().includes(search) || (a.nameAr || '').toLowerCase().includes(search)
        );
      }
      if (projectIdFilter !== null) {
        filtered = filtered.filter((a) => a.projectId === projectIdFilter);
      }
      if (statusFilter !== null) {
        filtered = filtered.filter((a) => a.status.toLowerCase() === statusFilter.toLowerCase());
      }

      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(page, totalPages);
      const startIndex = (safePage - 1) * pageSize;
      const items = filtered.slice(startIndex, startIndex + pageSize);

      res.json({
        items,
        total,
        page: safePage,
        pageSize,
        totalPages,
        filters: {
          projects: availableProjects,
          statuses: availableStatuses
        }
      });
    } catch (error) {
      console.error('Error searching activities:', error);
      res.status(500).json({ message: 'Internal server error while searching activities.' });
    }
  });

  app.get('/api/activity-search/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ message: 'Invalid activity ID supplied.' });
        return;
      }

      const db = loadDb();
      const activity = db.activities.find((a) => a.id === id);
      if (!activity) {
        res.status(404).json({ message: `Activity with ID ${id} not found.` });
        return;
      }

      const currentDateStr = getCurrentIsoDate();
      const proj = db.projects.find((pr) => pr.id === activity.projectId);
      const init = proj ? db.initiatives.find((i) => i.id === proj.initiativeId) : null;
      const ws = activity.workstreamId ? db.workstreams.find((w) => w.id === activity.workstreamId) : null;
      const ms = activity.milestoneId ? db.milestones.find((m) => m.id === activity.milestoneId) : null;
      const parent = activity.parentActivityId
        ? db.activities.find((p) => p.id === activity.parentActivityId)
        : null;
      const user = activity.assignedUserId
        ? db.users.find((u) => u.id === activity.assignedUserId)
        : null;
      const subtaskCount = db.activities.filter((sub) => sub.parentActivityId === activity.id).length;

      res.json({
        id: activity.id,
        name: activity.name,
        nameAr: activity.nameAr || activity.name,
        description: activity.description || '',
        descriptionAr: activity.descriptionAr || activity.description || '',
        projectId: activity.projectId,
        projectName: proj ? proj.name : null,
        projectNameAr: proj ? (proj.nameAr || proj.name) : null,
        initiativeId: init ? init.id : null,
        initiativeName: init ? init.name : null,
        initiativeNameAr: init ? (init.nameAr || init.name) : null,
        workstreamId: activity.workstreamId,
        workstreamName: ws ? ws.name : null,
        workstreamNameAr: ws ? (ws.nameAr || ws.name) : null,
        milestoneId: activity.milestoneId,
        milestoneName: ms ? ms.name : null,
        milestoneNameAr: ms ? (ms.nameAr || ms.name) : null,
        parentActivityId: activity.parentActivityId,
        parentActivityName: parent ? parent.name : null,
        parentActivityNameAr: parent ? (parent.nameAr || parent.name) : null,
        assignedUserId: activity.assignedUserId,
        assignedUserName: user ? user.fullName : null,
        assignedUserNameAr: user ? (user.fullNameAr || user.fullName) : null,
        startDate: activity.startDate,
        dueDate: activity.dueDate,
        status: activity.status,
        priority: activity.priority || null,
        progressPercentage: activity.progressPercentage ?? null,
        isOverdue: isActivityOverdue(activity, currentDateStr),
        subtaskCount
      });
    } catch (error) {
      console.error('Error fetching activity search details:', error);
      res.status(500).json({ message: 'Internal server error while retrieving activity details.' });
    }
  });

  // ==================== PMO DASHBOARD (Epic 07) ====================
  app.get('/api/pmo-dashboard', (_req, res) => {
    try {
      const db = loadDb();
      const currentDateStr = getCurrentIsoDate();

      // Reuse Epic 04 progress calculation helpers directly (zero duplicated calculation logic)
      const initiativesProgress = db.initiatives.map((i) => {
        const meta = calculateInitiativeProgressMeta(i.id, db);
        const port = db.portfolios.find((p) => p.id === i.portfolioId);
        const dept = db.departments.find((d) => d.id === i.departmentId);
        const owner = db.users.find((u) => u.id === i.ownerId);
        const projectCount = db.projects.filter((pr) => pr.initiativeId === i.id).length;

        return {
          id: i.id,
          name: i.name,
          nameAr: i.nameAr || i.name,
          status: meta.progressPercentage === 100 ? 'Completed' : i.status,
          priority: i.priority,
          portfolioName: port ? port.name : null,
          portfolioNameAr: port ? (port.nameAr || port.name) : null,
          departmentName: dept ? dept.name : null,
          departmentNameAr: dept ? (dept.nameAr || dept.name) : null,
          ownerName: owner ? owner.fullName : null,
          ownerNameAr: owner ? (owner.fullNameAr || owner.fullName) : null,
          projectCount,
          progressPercentage: meta.progressPercentage,
          hasProgressData: meta.hasProgressData
        };
      });

      const projectsProgress = db.projects.map((pr) => {
        const meta = calculateProjectProgressMeta(pr.id, db);
        const init = db.initiatives.find((i) => i.id === pr.initiativeId);
        const pm = db.users.find((u) => u.id === pr.projectManagerId);
        const allActs = db.activities.filter((a) => a.projectId === pr.id);
        const parentActs = allActs.filter((a) => a.parentActivityId === null);
        const activityCount = parentActs.length > 0 ? parentActs.length : allActs.length;

        return {
          id: pr.id,
          name: pr.name,
          nameAr: pr.nameAr || pr.name,
          status: meta.progressPercentage === 100 ? 'Completed' : pr.status,
          priority: pr.priority,
          initiativeId: pr.initiativeId,
          initiativeName: init ? init.name : null,
          initiativeNameAr: init ? (init.nameAr || init.name) : null,
          projectManagerName: pm ? pm.fullName : null,
          projectManagerNameAr: pm ? (pm.fullNameAr || pm.fullName) : null,
          activityCount,
          endDate: pr.endDate,
          progressPercentage: meta.progressPercentage,
          hasProgressData: meta.hasProgressData
        };
      });

      const validInitProgress = initiativesProgress.filter(
        (i) => i.hasProgressData && i.progressPercentage !== null
      );
      const validProjProgress = projectsProgress.filter(
        (p) => p.hasProgressData && p.progressPercentage !== null
      );

      const avgInitiativeProgress =
        validInitProgress.length > 0
          ? Math.round(
              validInitProgress.reduce((s, i) => s + (i.progressPercentage as number), 0) /
                validInitProgress.length
            )
          : null;

      const avgProjectProgress =
        validProjProgress.length > 0
          ? Math.round(
              validProjProgress.reduce((s, p) => s + (p.progressPercentage as number), 0) /
                validProjProgress.length
            )
          : null;

      const overallPmoProgress =
        avgInitiativeProgress !== null && avgProjectProgress !== null
          ? Math.round((avgInitiativeProgress + avgProjectProgress) / 2)
          : avgInitiativeProgress !== null
          ? avgInitiativeProgress
          : avgProjectProgress;

      // Reuse Epic 05 overdue activity evaluation helpers directly (excludes completed activities)
      const overdueItems = db.activities
        .filter((a) => isActivityOverdue(a, currentDateStr))
        .map((a) => {
          const proj = db.projects.find((pr) => pr.id === a.projectId);
          const user = a.assignedUserId ? db.users.find((u) => u.id === a.assignedUserId) : null;
          return {
            id: a.id,
            name: a.name,
            nameAr: a.nameAr || a.name,
            projectId: a.projectId,
            projectName: proj ? proj.name : null,
            projectNameAr: proj ? (proj.nameAr || proj.name) : null,
            assignedUserName: user ? user.fullName : null,
            assignedUserNameAr: user ? (user.fullNameAr || user.fullName) : null,
            dueDate: a.dueDate,
            status: a.status,
            priority: a.priority || null,
            daysOverdue: calculateDaysOverdue(a.dueDate, currentDateStr)
          };
        })
        .sort((a, b) => {
          if (b.daysOverdue !== a.daysOverdue) return b.daysOverdue - a.daysOverdue;
          return a.dueDate.localeCompare(b.dueDate);
        });

      const completedActivitiesCount = db.activities.filter(
        (a) => String(a.status || '').trim().toLowerCase() === 'completed'
      ).length;
      const inProgressActivitiesCount = db.activities.filter(
        (a) => String(a.status || '').trim().toLowerCase() === 'in progress'
      ).length;
      const notStartedActivitiesCount = db.activities.filter(
        (a) => String(a.status || '').trim().toLowerCase() === 'not started'
      ).length;

      res.json({
        evaluatedDate: currentDateStr,
        summary: {
          departments: {
            total: db.departments.length
          },
          portfolios: {
            total: db.portfolios.length,
            active: db.portfolios.filter((p) => p.status === 'Active').length,
            planning: db.portfolios.filter((p) => p.status === 'Planning').length,
            onHold: db.portfolios.filter((p) => p.status === 'On Hold').length,
            completed: db.portfolios.filter((p) => p.status === 'Completed').length
          },
          initiatives: {
            total: db.initiatives.length,
            inProgress: initiativesProgress.filter((i) => i.status === 'In Progress').length,
            completed: initiativesProgress.filter((i) => i.status === 'Completed').length,
            onHold: initiativesProgress.filter((i) => i.status === 'On Hold').length,
            draftOrNotStarted: initiativesProgress.filter(
              (i) => i.status === 'Draft' || i.status === 'Not Started'
            ).length,
            withProgressData: validInitProgress.length,
            averageProgress: avgInitiativeProgress
          },
          projects: {
            total: db.projects.length,
            inProgress: projectsProgress.filter((p) => p.status === 'In Progress').length,
            completed: projectsProgress.filter((p) => p.status === 'Completed').length,
            planned: projectsProgress.filter((p) => p.status === 'Planned').length,
            onHold: projectsProgress.filter((p) => p.status === 'On Hold').length,
            withProgressData: validProjProgress.length,
            averageProgress: avgProjectProgress
          },
          activities: {
            total: db.activities.length,
            completed: completedActivitiesCount,
            inProgress: inProgressActivitiesCount,
            notStarted: notStartedActivitiesCount,
            overdue: overdueItems.length
          }
        },
        progressOverview: {
          overallPmoProgress,
          averageInitiativeProgress: avgInitiativeProgress,
          averageProjectProgress: avgProjectProgress,
          initiatives: initiativesProgress,
          projects: projectsProgress
        },
        overdueSummary: {
          totalOverdue: overdueItems.length,
          criticalCount: overdueItems.filter(
            (a) => String(a.priority || '').toLowerCase() === 'critical'
          ).length,
          highCount: overdueItems.filter(
            (a) => String(a.priority || '').toLowerCase() === 'high'
          ).length,
          topOverdue: overdueItems.slice(0, 5)
        }
      });
    } catch (error) {
      console.error('Error fetching PMO dashboard data:', error);
      res.status(500).json({ message: 'Internal server error while retrieving PMO dashboard summary.' });
    }
  });

  // ==================== WORKSTREAMS CRUD ====================
  app.get('/api/workstreams', (req, res) => {
    const db = loadDb();
    const projectId = req.query.projectId ? Number(req.query.projectId) : null;
    const status = String(req.query.status || '').trim();
    const search = String(req.query.search || '').trim().toLowerCase();

    let list = db.workstreams.map((w) => {
      const proj = db.projects.find((p) => p.id === w.projectId);
      const owner = db.users.find((u) => u.id === w.ownerId);
      return {
        ...w,
        projectName: proj ? proj.name : null,
        projectNameAr: proj ? (proj.nameAr || proj.name) : null,
        ownerName: owner ? owner.fullName : null,
        ownerNameAr: owner ? (owner.fullNameAr || owner.fullName) : null,
        activityCount: db.activities.filter((a) => a.workstreamId === w.id && a.parentActivityId === null).length,
        milestoneCount: db.milestones.filter((m) => m.workstreamId === w.id).length
      };
    });

    if (projectId) list = list.filter((w) => w.projectId === projectId);
    if (status && status !== 'All') list = list.filter((w) => w.status === status);
    if (search) {
      list = list.filter(
        (w) =>
          w.name.toLowerCase().includes(search) ||
          (w.nameAr || '').toLowerCase().includes(search) ||
          (w.description || '').toLowerCase().includes(search) ||
          (w.descriptionAr || '').toLowerCase().includes(search)
      );
    }

    res.json(list);
  });

  app.post('/api/workstreams', (req, res) => {
    const db = loadDb();
    const { name, description, projectId, ownerId, startDate, endDate, status, progressPercentage } = req.body;
    if (!name || !String(name).trim() || !projectId) {
      res.status(400).json({ message: 'Workstream name and project are required.' });
      return;
    }
    const nextId = db.workstreams.reduce((max, w) => Math.max(max, w.id), 0) + 1;
    const created: WorkstreamRecord = {
      id: nextId,
      name: String(name).trim(),
      nameAr: req.body?.nameAr ? String(req.body.nameAr).trim() : undefined,
      description: String(description || '').trim(),
      descriptionAr: req.body?.descriptionAr ? String(req.body.descriptionAr).trim() : undefined,
      projectId: Number(projectId),
      ownerId: ownerId ? Number(ownerId) : null,
      startDate: startDate || '2026-02-01',
      endDate: endDate || '2026-08-30',
      status: status || 'In Progress',
      progressPercentage: Number(progressPercentage ?? 0)
    };
    db.workstreams.push(created);
    saveDb(db);
    const proj = db.projects.find((p) => p.id === created.projectId);
    const owner = db.users.find((u) => u.id === created.ownerId);
    res.status(201).json({
      ...created,
      projectName: proj ? proj.name : null,
      projectNameAr: proj ? (proj.nameAr || proj.name) : null,
      ownerName: owner ? owner.fullName : null,
      ownerNameAr: owner ? (owner.fullNameAr || owner.fullName) : null,
      activityCount: 0,
      milestoneCount: 0
    });
  });

  app.put('/api/workstreams/:id', (req, res) => {
    const db = loadDb();
    const id = Number(req.params.id);
    const idx = db.workstreams.findIndex((w) => w.id === id);
    if (idx === -1) {
      res.status(404).json({ message: 'Workstream not found.' });
      return;
    }
    const { name, description, projectId, ownerId, startDate, endDate, status, progressPercentage } = req.body;
    db.workstreams[idx] = {
      ...db.workstreams[idx],
      name: String(name || db.workstreams[idx].name).trim(),
      nameAr: req.body?.nameAr !== undefined ? String(req.body.nameAr).trim() : db.workstreams[idx].nameAr,
      description: description !== undefined ? String(description).trim() : db.workstreams[idx].description,
      descriptionAr: req.body?.descriptionAr !== undefined ? String(req.body.descriptionAr).trim() : db.workstreams[idx].descriptionAr,
      projectId: projectId ? Number(projectId) : db.workstreams[idx].projectId,
      ownerId: ownerId !== undefined ? (ownerId ? Number(ownerId) : null) : db.workstreams[idx].ownerId,
      startDate: startDate || db.workstreams[idx].startDate,
      endDate: endDate || db.workstreams[idx].endDate,
      status: status || db.workstreams[idx].status,
      progressPercentage: progressPercentage !== undefined ? Number(progressPercentage) : db.workstreams[idx].progressPercentage
    };
    saveDb(db);
    const w = db.workstreams[idx];
    const proj = db.projects.find((p) => p.id === w.projectId);
    const owner = db.users.find((u) => u.id === w.ownerId);
    res.json({
      ...w,
      projectName: proj ? proj.name : null,
      projectNameAr: proj ? (proj.nameAr || proj.name) : null,
      ownerName: owner ? owner.fullName : null,
      ownerNameAr: owner ? (owner.fullNameAr || owner.fullName) : null,
      activityCount: db.activities.filter((a) => a.workstreamId === w.id && a.parentActivityId === null).length,
      milestoneCount: db.milestones.filter((m) => m.workstreamId === w.id).length
    });
  });

  app.delete('/api/workstreams/:id', (req, res) => {
    const db = loadDb();
    const id = Number(req.params.id);
    const idx = db.workstreams.findIndex((w) => w.id === id);
    if (idx === -1) {
      res.status(404).json({ message: 'Workstream not found.' });
      return;
    }
    db.activities.forEach((a) => {
      if (a.workstreamId === id) a.workstreamId = null;
    });
    db.milestones.forEach((m) => {
      if (m.workstreamId === id) m.workstreamId = null;
    });
    db.workstreams.splice(idx, 1);
    saveDb(db);
    res.status(204).send();
  });

  // ==================== MILESTONES CRUD ====================
  app.get('/api/milestones', (req, res) => {
    const db = loadDb();
    const projectId = req.query.projectId ? Number(req.query.projectId) : null;
    const workstreamId = req.query.workstreamId ? Number(req.query.workstreamId) : null;
    const status = String(req.query.status || '').trim();
    const search = String(req.query.search || '').trim().toLowerCase();

    let list = enrichMilestones(db);

    if (projectId) list = list.filter((m) => m.projectId === projectId);
    if (workstreamId) list = list.filter((m) => m.workstreamId === workstreamId);
    if (status && status !== 'All') list = list.filter((m) => m.status === status);
    if (search) {
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(search) ||
          (m.nameAr || '').toLowerCase().includes(search) ||
          (m.description || '').toLowerCase().includes(search) ||
          (m.descriptionAr || '').toLowerCase().includes(search)
      );
    }

    list.sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));
    res.json(list);
  });

  app.post('/api/milestones', (req, res) => {
    const db = loadDb();
    const { name, description, projectId, workstreamId, ownerId, plannedDate, actualDate, status } = req.body;
    if (!name || !String(name).trim() || !projectId) {
      res.status(400).json({ message: 'Milestone name and project are required.' });
      return;
    }
    const nextId = db.milestones.reduce((max, m) => Math.max(max, m.id), 0) + 1;
    const created: MilestoneRecord = {
      id: nextId,
      name: String(name).trim(),
      nameAr: req.body?.nameAr ? String(req.body.nameAr).trim() : undefined,
      description: String(description || '').trim(),
      descriptionAr: req.body?.descriptionAr ? String(req.body.descriptionAr).trim() : undefined,
      projectId: Number(projectId),
      workstreamId: workstreamId ? Number(workstreamId) : null,
      ownerId: ownerId ? Number(ownerId) : null,
      plannedDate: plannedDate || '2026-10-30',
      actualDate: actualDate ? String(actualDate) : null,
      status: (status || 'Planned') as MilestoneRecord['status']
    };
    db.milestones.push(created);
    saveDb(db);
    const full = enrichMilestones(db).find((m) => m.id === created.id);
    res.status(201).json(full);
  });

  app.put('/api/milestones/:id', (req, res) => {
    const db = loadDb();
    const id = Number(req.params.id);
    const idx = db.milestones.findIndex((m) => m.id === id);
    if (idx === -1) {
      res.status(404).json({ message: 'Milestone not found.' });
      return;
    }
    const { name, description, projectId, workstreamId, ownerId, plannedDate, actualDate, status } = req.body;
    db.milestones[idx] = {
      ...db.milestones[idx],
      name: String(name || db.milestones[idx].name).trim(),
      nameAr: req.body?.nameAr !== undefined ? String(req.body.nameAr).trim() : db.milestones[idx].nameAr,
      description: description !== undefined ? String(description).trim() : db.milestones[idx].description,
      descriptionAr: req.body?.descriptionAr !== undefined ? String(req.body.descriptionAr).trim() : db.milestones[idx].descriptionAr,
      projectId: projectId ? Number(projectId) : db.milestones[idx].projectId,
      workstreamId: workstreamId !== undefined ? (workstreamId ? Number(workstreamId) : null) : db.milestones[idx].workstreamId,
      ownerId: ownerId !== undefined ? (ownerId ? Number(ownerId) : null) : db.milestones[idx].ownerId,
      plannedDate: plannedDate || db.milestones[idx].plannedDate,
      actualDate: actualDate !== undefined ? (actualDate ? String(actualDate) : null) : db.milestones[idx].actualDate,
      status: (status || db.milestones[idx].status) as MilestoneRecord['status']
    };
    saveDb(db);
    const full = enrichMilestones(db).find((m) => m.id === id);
    res.json(full);
  });

  app.delete('/api/milestones/:id', (req, res) => {
    const db = loadDb();
    const id = Number(req.params.id);
    const idx = db.milestones.findIndex((m) => m.id === id);
    if (idx === -1) {
      res.status(404).json({ message: 'Milestone not found.' });
      return;
    }
    db.activities.forEach((a) => {
      if (a.milestoneId === id) a.milestoneId = null;
    });
    db.milestones.splice(idx, 1);
    saveDb(db);
    res.status(204).send();
  });

  // ==================== ACTIVITY MANAGEMENT (EPIC 09) ====================
  const VALID_ACTIVITY_STATUSES = ['Not Started', 'In Progress', 'Completed'] as const;
  const VALID_ACTIVITY_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;

  const isValidIsoDate = (dateStr: string): boolean => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
    const parsed = new Date(`${dateStr}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return false;
    return parsed.toISOString().slice(0, 10) === dateStr;
  };

  // Story 9.2: Retrieve activities associated with a specific project (with pagination)
  app.get('/api/projects/:id/activities', (req, res) => {
    try {
      const projectId = Number(req.params.id);
      if (!Number.isInteger(projectId) || projectId <= 0) {
        res.status(400).json({ message: 'Invalid project ID supplied.' });
        return;
      }

      const db = loadDb();
      const project = db.projects.find((p) => p.id === projectId);
      if (!project) {
        res.status(404).json({ message: `Project with ID ${projectId} not found.` });
        return;
      }

      const init = db.initiatives.find((i) => i.id === project.initiativeId);
      const list = enrichActivities(db)
        .filter((a) => a.projectId === projectId)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id - b.id);

      const pageParam = req.query.page !== undefined ? Number(req.query.page) : 1;
      const pageSizeParam = req.query.pageSize !== undefined ? Number(req.query.pageSize) : 10;
      const pageSize = Number.isInteger(pageSizeParam) && pageSizeParam > 0 ? Math.min(pageSizeParam, 100) : 10;
      const requestedPage = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;

      const total = list.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(requestedPage, totalPages);
      const startIndex = (safePage - 1) * pageSize;
      const items = list.slice(startIndex, startIndex + pageSize);

      res.json({
        project: {
          id: project.id,
          name: project.name,
          nameAr: project.nameAr || project.name,
          status: project.status,
          startDate: project.startDate,
          endDate: project.endDate,
          initiativeName: init ? init.name : null,
          initiativeNameAr: init ? (init.nameAr || init.name) : null
        },
        items,
        total,
        page: safePage,
        pageSize,
        totalPages
      });
    } catch (error) {
      console.error('Error retrieving project activities:', error);
      res.status(500).json({ message: 'Internal server error while retrieving project activities.' });
    }
  });

  app.get('/api/activities', (req, res) => {
    try {
      const db = loadDb();
      const search = String(req.query.search || '').trim().toLowerCase();
      const status = String(req.query.status || '').trim();
      const projectId = req.query.projectId ? Number(req.query.projectId) : null;
      const workstreamId = req.query.workstreamId ? Number(req.query.workstreamId) : null;
      const milestoneId = req.query.milestoneId ? Number(req.query.milestoneId) : null;
      const assignedUserId = req.query.assignedUserId ? Number(req.query.assignedUserId) : null;
      const priority = String(req.query.priority || '').trim();

      let list = enrichActivities(db);

      if (search) {
        list = list.filter(
          (a) =>
            a.name.toLowerCase().includes(search) ||
            (a.nameAr || '').toLowerCase().includes(search) ||
            (a.description || '').toLowerCase().includes(search) ||
            (a.descriptionAr || '').toLowerCase().includes(search)
        );
      }
      if (status && status !== 'All') list = list.filter((a) => a.status === status);
      if (projectId) list = list.filter((a) => a.projectId === projectId);
      if (workstreamId) list = list.filter((a) => a.workstreamId === workstreamId);
      if (milestoneId) list = list.filter((a) => a.milestoneId === milestoneId);
      if (assignedUserId) list = list.filter((a) => a.assignedUserId === assignedUserId);
      if (priority && priority !== 'All') list = list.filter((a) => a.priority === priority);

      res.json(list);
    } catch (error) {
      console.error('Error retrieving activities:', error);
      res.status(500).json({ message: 'Internal server error while retrieving activities.' });
    }
  });

  const findResourceScheduleConflicts = (
    db: DatabaseSchema,
    params: {
      excludeActivityId?: number | null;
      parentActivityId?: number | null;
      assignedUserId: number | null;
      startDate: string;
      dueDate: string;
    }
  ) => {
    const { excludeActivityId, parentActivityId, assignedUserId, startDate, dueDate } = params;
    if (!assignedUserId || !isValidIsoDate(startDate) || !isValidIsoDate(dueDate) || dueDate < startDate) {
      return [];
    }

    return db.activities
      .filter((a) => {
        if (excludeActivityId && a.id === excludeActivityId) return false;
        if (a.assignedUserId !== assignedUserId) return false;
        if (excludeActivityId && a.parentActivityId === excludeActivityId) return false;
        if (parentActivityId && a.id === parentActivityId) return false;
        if (!isValidIsoDate(a.startDate) || !isValidIsoDate(a.dueDate)) return false;
        return startDate <= a.dueDate && dueDate >= a.startDate;
      })
      .map((a) => {
        const proj = db.projects.find((p) => p.id === a.projectId) || null;
        return {
          id: a.id,
          name: a.name,
          nameAr: a.nameAr || a.name,
          projectId: a.projectId,
          projectName: proj ? proj.name : null,
          projectNameAr: proj ? proj.nameAr || proj.name : null,
          startDate: a.startDate,
          dueDate: a.dueDate,
          status: a.status
        };
      });
  };

  // TC07: Live check for overlapping activity schedules assigned to the same team member
  app.get('/api/activities/check-conflicts', (req, res) => {
    try {
      const rawUserId = req.query.assignedUserId;
      const startDate = String(req.query.startDate || '').trim();
      const dueDate = String(req.query.dueDate || '').trim();
      const excludeActivityId = req.query.excludeActivityId ? Number(req.query.excludeActivityId) : null;
      const parentActivityId = req.query.parentActivityId ? Number(req.query.parentActivityId) : null;

      if (!rawUserId || rawUserId === '' || !isValidIsoDate(startDate) || !isValidIsoDate(dueDate) || dueDate < startDate) {
        res.json({ hasConflict: false, conflicts: [] });
        return;
      }

      const assignedUserId = Number(rawUserId);
      if (!Number.isInteger(assignedUserId) || assignedUserId <= 0) {
        res.json({ hasConflict: false, conflicts: [] });
        return;
      }

      const db = loadDb();
      const assignedUser = db.users.find((u) => u.id === assignedUserId) || null;
      const conflicts = findResourceScheduleConflicts(db, {
        excludeActivityId: excludeActivityId && Number.isInteger(excludeActivityId) ? excludeActivityId : null,
        parentActivityId: parentActivityId && Number.isInteger(parentActivityId) ? parentActivityId : null,
        assignedUserId,
        startDate,
        dueDate
      });

      res.json({
        hasConflict: conflicts.length > 0,
        assignedUserName: assignedUser ? assignedUser.fullName : null,
        assignedUserNameAr: assignedUser ? assignedUser.fullNameAr || assignedUser.fullName : null,
        conflicts
      });
    } catch (error) {
      console.error('Error checking activity schedule conflicts:', error);
      res.status(500).json({ message: 'Internal server error while checking schedule conflicts.' });
    }
  });

  // Story 9.12: Retrieve complete details for a single activity
  app.get('/api/activities/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ message: 'Invalid activity ID supplied.' });
        return;
      }

      const db = loadDb();
      const activity = enrichActivities(db).find((a) => a.id === id);
      if (!activity) {
        res.status(404).json({ message: `Activity with ID ${id} not found.` });
        return;
      }

      const proj = db.projects.find((p) => p.id === activity.projectId) || null;
      const assignedUser = activity.assignedUserId
        ? db.users.find((u) => u.id === activity.assignedUserId) || null
        : null;
      const assignedRole = assignedUser
        ? db.roles.find((r) => r.id === assignedUser.roleId) || null
        : null;

      res.json({
        ...activity,
        project: proj
          ? {
              id: proj.id,
              name: proj.name,
              nameAr: proj.nameAr || proj.name,
              status: proj.status,
              startDate: proj.startDate,
              endDate: proj.endDate
            }
          : null,
        assignedUser: assignedUser
          ? {
              id: assignedUser.id,
              fullName: assignedUser.fullName,
              fullNameAr: assignedUser.fullNameAr || assignedUser.fullName,
              email: assignedUser.email,
              roleName: assignedRole ? assignedRole.name : null
            }
          : null
      });
    } catch (error) {
      console.error('Error fetching activity details:', error);
      res.status(500).json({ message: 'Internal server error while retrieving activity details.' });
    }
  });

  // Story 9.4: Create a new activity with full validation
  app.post('/api/activities', (req, res) => {
    try {
      const db = loadDb();
      const {
        name,
        description,
        projectId,
        workstreamId,
        milestoneId,
        parentActivityId,
        assignedUserId,
        startDate,
        dueDate,
        status,
        priority,
        progressPercentage
      } = req.body;

      if (!name || !String(name).trim()) {
        res.status(400).json({ message: 'Activity name is required.' });
        return;
      }

      if (projectId === undefined || projectId === null || projectId === '') {
        res.status(400).json({ message: 'Associated project is required.' });
        return;
      }
      const parsedProjectId = Number(projectId);
      if (!Number.isInteger(parsedProjectId) || parsedProjectId <= 0) {
        res.status(400).json({ message: 'Invalid project ID supplied.' });
        return;
      }
      if (!db.projects.some((p) => p.id === parsedProjectId)) {
        res.status(400).json({ message: 'Selected project does not exist.' });
        return;
      }

      let resolvedAssignedUserId: number | null = null;
      if (assignedUserId !== undefined && assignedUserId !== null && assignedUserId !== '') {
        const parsedUserId = Number(assignedUserId);
        if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
          res.status(400).json({ message: 'Selected assigned user is invalid.' });
          return;
        }
        if (!db.users.some((u) => u.id === parsedUserId)) {
          res.status(400).json({ message: 'Selected assigned user does not exist.' });
          return;
        }
        resolvedAssignedUserId = parsedUserId;
      }

      const resolvedStartDate = String(startDate || '').trim();
      const resolvedDueDate = String(dueDate || '').trim();
      if (!isValidIsoDate(resolvedStartDate) || !isValidIsoDate(resolvedDueDate)) {
        res.status(400).json({ message: 'Valid start date and due date (YYYY-MM-DD) are required.' });
        return;
      }
      if (resolvedDueDate < resolvedStartDate) {
        res.status(400).json({ message: 'Due date cannot be earlier than start date.' });
        return;
      }

      const resolvedStatus = status ? String(status).trim() : 'Not Started';
      if (!VALID_ACTIVITY_STATUSES.includes(resolvedStatus as any)) {
        res.status(400).json({ message: 'Invalid activity status supplied.' });
        return;
      }

      const resolvedPriority = priority ? String(priority).trim() : 'Medium';
      if (!VALID_ACTIVITY_PRIORITIES.includes(resolvedPriority as any)) {
        res.status(400).json({ message: 'Invalid activity priority supplied.' });
        return;
      }

      const hasExplicitProgress =
        progressPercentage !== undefined && progressPercentage !== null && progressPercentage !== '';
      let resolvedProgress: number;
      if (hasExplicitProgress) {
        const parsedProgress = Number(progressPercentage);
        if (!Number.isFinite(parsedProgress) || parsedProgress < 0 || parsedProgress > 100) {
          res.status(400).json({ message: 'Completion percentage must be between 0 and 100.' });
          return;
        }
        const rounded = Math.round(parsedProgress);
        resolvedProgress =
          resolvedStatus === 'Completed'
            ? 100
            : resolvedStatus === 'Not Started'
            ? 0
            : rounded;
      } else {
        resolvedProgress =
          resolvedStatus === 'Completed' ? 100 : resolvedStatus === 'Not Started' ? 0 : 50;
      }

      const resolvedParentActivityId = parentActivityId ? Number(parentActivityId) : null;
      const scheduleConflicts = findResourceScheduleConflicts(db, {
        parentActivityId: resolvedParentActivityId,
        assignedUserId: resolvedAssignedUserId,
        startDate: resolvedStartDate,
        dueDate: resolvedDueDate
      });

      if (scheduleConflicts.length > 0) {
        const assignedUser = db.users.find((u) => u.id === resolvedAssignedUserId);
        const first = scheduleConflicts[0];
        const userEn = assignedUser ? assignedUser.fullName : 'the selected team member';
        const userAr = assignedUser ? assignedUser.fullNameAr || assignedUser.fullName : 'المستخدم المحدد';
        res.status(409).json({
          code: 'SCHEDULE_CONFLICT',
          message: `Scheduling conflict: ${userEn} is already assigned to "${first.name}" (${first.startDate} to ${first.dueDate}) during this period.`,
          messageAr: `تعارض في الجدول الزمني: ${userAr} مكلف مسبقاً بالنشاط "${first.nameAr}" خلال الفترة (${first.startDate} إلى ${first.dueDate}).`,
          conflicts: scheduleConflicts
        });
        return;
      }

      const nextId = db.activities.reduce((max, a) => Math.max(max, a.id), 0) + 1;
      const created: ActivityRecord = {
        id: nextId,
        name: String(name).trim(),
        nameAr: req.body?.nameAr ? String(req.body.nameAr).trim() : undefined,
        description: String(description || '').trim(),
        descriptionAr: req.body?.descriptionAr ? String(req.body.descriptionAr).trim() : undefined,
        projectId: parsedProjectId,
        workstreamId: workstreamId ? Number(workstreamId) : null,
        milestoneId: milestoneId ? Number(milestoneId) : null,
        parentActivityId: parentActivityId ? Number(parentActivityId) : null,
        assignedUserId: resolvedAssignedUserId,
        startDate: resolvedStartDate,
        dueDate: resolvedDueDate,
        status: resolvedStatus as ActivityRecord['status'],
        priority: resolvedPriority,
        progressPercentage: resolvedProgress
      };

      db.activities.push(created);
      recalculateProjectProgress(db, created.projectId);
      saveDb(db);

      const full = enrichActivities(db).find((a) => a.id === created.id);
      res.status(201).json(full);
    } catch (error) {
      console.error('Error creating activity:', error);
      res.status(500).json({ message: 'Internal server error while creating activity.' });
    }
  });

  // Story 9.6: Update an existing activity with full validation
  app.put('/api/activities/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ message: 'Invalid activity ID supplied.' });
        return;
      }

      const db = loadDb();
      const idx = db.activities.findIndex((a) => a.id === id);
      if (idx === -1) {
        res.status(404).json({ message: `Activity with ID ${id} not found.` });
        return;
      }

      const existing = db.activities[idx];
      const {
        name,
        description,
        projectId,
        workstreamId,
        milestoneId,
        parentActivityId,
        assignedUserId,
        startDate,
        dueDate,
        status,
        priority,
        progressPercentage
      } = req.body;

      const nextName = name !== undefined ? String(name).trim() : existing.name;
      if (!nextName) {
        res.status(400).json({ message: 'Activity name is required.' });
        return;
      }

      let nextProjectId = existing.projectId;
      if (projectId !== undefined && projectId !== null && projectId !== '') {
        const parsedProjectId = Number(projectId);
        if (!Number.isInteger(parsedProjectId) || parsedProjectId <= 0) {
          res.status(400).json({ message: 'Invalid project ID supplied.' });
          return;
        }
        if (!db.projects.some((p) => p.id === parsedProjectId)) {
          res.status(400).json({ message: 'Selected project does not exist.' });
          return;
        }
        nextProjectId = parsedProjectId;
      } else if (projectId === '' || projectId === null) {
        res.status(400).json({ message: 'Associated project is required.' });
        return;
      }

      let nextAssignedUserId = existing.assignedUserId;
      if (assignedUserId !== undefined) {
        if (assignedUserId === null || assignedUserId === '') {
          nextAssignedUserId = null;
        } else {
          const parsedUserId = Number(assignedUserId);
          if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
            res.status(400).json({ message: 'Selected assigned user is invalid.' });
            return;
          }
          if (!db.users.some((u) => u.id === parsedUserId)) {
            res.status(400).json({ message: 'Selected assigned user does not exist.' });
            return;
          }
          nextAssignedUserId = parsedUserId;
        }
      }

      const nextStartDate = startDate !== undefined ? String(startDate).trim() : existing.startDate;
      const nextDueDate = dueDate !== undefined ? String(dueDate).trim() : existing.dueDate;
      if (!isValidIsoDate(nextStartDate) || !isValidIsoDate(nextDueDate)) {
        res.status(400).json({ message: 'Valid start date and due date (YYYY-MM-DD) are required.' });
        return;
      }
      if (nextDueDate < nextStartDate) {
        res.status(400).json({ message: 'Due date cannot be earlier than start date.' });
        return;
      }

      const nextStatus = status !== undefined ? String(status).trim() : existing.status;
      if (!VALID_ACTIVITY_STATUSES.includes(nextStatus as any)) {
        res.status(400).json({ message: 'Invalid activity status supplied.' });
        return;
      }

      const nextPriority = priority !== undefined ? String(priority).trim() : existing.priority;
      if (!VALID_ACTIVITY_PRIORITIES.includes(nextPriority as any)) {
        res.status(400).json({ message: 'Invalid activity priority supplied.' });
        return;
      }

      const hasExplicitProgress =
        progressPercentage !== undefined && progressPercentage !== null && progressPercentage !== '';
      let nextProgress: number;
      if (hasExplicitProgress) {
        const parsedProgress = Number(progressPercentage);
        if (!Number.isFinite(parsedProgress) || parsedProgress < 0 || parsedProgress > 100) {
          res.status(400).json({ message: 'Completion percentage must be between 0 and 100.' });
          return;
        }
        const rounded = Math.round(parsedProgress);
        nextProgress =
          nextStatus === 'Completed'
            ? 100
            : nextStatus === 'Not Started'
            ? 0
            : rounded;
      } else {
        nextProgress =
          nextStatus === 'Completed'
            ? 100
            : nextStatus === 'Not Started'
            ? 0
            : existing.progressPercentage > 0 && existing.progressPercentage < 100
            ? existing.progressPercentage
            : 50;
      }

      const nextParentActivityId =
        parentActivityId !== undefined
          ? parentActivityId
            ? Number(parentActivityId)
            : null
          : existing.parentActivityId;

      const schedulingOrAssigneeChanged =
        nextAssignedUserId !== existing.assignedUserId ||
        nextStartDate !== existing.startDate ||
        nextDueDate !== existing.dueDate;

      if (schedulingOrAssigneeChanged && nextAssignedUserId) {
        const scheduleConflicts = findResourceScheduleConflicts(db, {
          excludeActivityId: id,
          parentActivityId: nextParentActivityId,
          assignedUserId: nextAssignedUserId,
          startDate: nextStartDate,
          dueDate: nextDueDate
        });

        if (scheduleConflicts.length > 0) {
          const assignedUser = db.users.find((u) => u.id === nextAssignedUserId);
          const first = scheduleConflicts[0];
          const userEn = assignedUser ? assignedUser.fullName : 'the selected team member';
          const userAr = assignedUser ? assignedUser.fullNameAr || assignedUser.fullName : 'المستخدم المحدد';
          res.status(409).json({
            code: 'SCHEDULE_CONFLICT',
            message: `Scheduling conflict: ${userEn} is already assigned to "${first.name}" (${first.startDate} to ${first.dueDate}) during this period.`,
            messageAr: `تعارض في الجدول الزمني: ${userAr} مكلف مسبقاً بالنشاط "${first.nameAr}" خلال الفترة (${first.startDate} إلى ${first.dueDate}).`,
            conflicts: scheduleConflicts
          });
          return;
        }
      }

      const oldProjectId = existing.projectId;
      db.activities[idx] = {
        ...existing,
        name: nextName,
        nameAr: req.body?.nameAr !== undefined ? String(req.body.nameAr).trim() : existing.nameAr,
        description: description !== undefined ? String(description).trim() : existing.description,
        descriptionAr: req.body?.descriptionAr !== undefined ? String(req.body.descriptionAr).trim() : existing.descriptionAr,
        projectId: nextProjectId,
        workstreamId:
          workstreamId !== undefined ? (workstreamId ? Number(workstreamId) : null) : existing.workstreamId,
        milestoneId:
          milestoneId !== undefined ? (milestoneId ? Number(milestoneId) : null) : existing.milestoneId,
        parentActivityId: nextParentActivityId,
        assignedUserId: nextAssignedUserId,
        startDate: nextStartDate,
        dueDate: nextDueDate,
        status: nextStatus as ActivityRecord['status'],
        priority: nextPriority,
        progressPercentage: nextProgress
      };

      if (oldProjectId !== nextProjectId) {
        recalculateProjectProgress(db, oldProjectId);
      }
      recalculateProjectProgress(db, nextProjectId);
      saveDb(db);

      const full = enrichActivities(db).find((a) => a.id === id);
      res.json(full);
    } catch (error) {
      console.error('Error updating activity:', error);
      res.status(500).json({ message: 'Internal server error while updating activity.' });
    }
  });

  // Story 9.8: Dedicated Activity Status Update API
  app.patch('/api/activities/:id/status', (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ message: 'Invalid activity ID supplied.' });
        return;
      }

      const db = loadDb();
      const idx = db.activities.findIndex((a) => a.id === id);
      if (idx === -1) {
        res.status(404).json({ message: `Activity with ID ${id} not found.` });
        return;
      }

      const rawStatus = req.body?.status;
      const nextStatus = rawStatus !== undefined && rawStatus !== null ? String(rawStatus).trim() : '';
      if (!VALID_ACTIVITY_STATUSES.includes(nextStatus as any)) {
        res.status(400).json({
          message: `Invalid activity status. Allowed values: ${VALID_ACTIVITY_STATUSES.join(', ')}.`
        });
        return;
      }

      const existing = db.activities[idx];
      const nextProgress =
        nextStatus === 'Completed'
          ? 100
          : nextStatus === 'Not Started'
          ? 0
          : existing.progressPercentage > 0 && existing.progressPercentage < 100
          ? existing.progressPercentage
          : 50;

      db.activities[idx] = {
        ...existing,
        status: nextStatus as ActivityRecord['status'],
        progressPercentage: nextProgress
      };

      recalculateProjectProgress(db, existing.projectId);
      saveDb(db);

      const full = enrichActivities(db).find((a) => a.id === id);
      res.json(full);
    } catch (error) {
      console.error('Error updating activity status:', error);
      res.status(500).json({ message: 'Internal server error while updating activity status.' });
    }
  });

  // Story 9.10: Safe Activity Deletion API
  app.delete('/api/activities/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ message: 'Invalid activity ID supplied.' });
        return;
      }

      const db = loadDb();
      const idx = db.activities.findIndex((a) => a.id === id);
      if (idx === -1) {
        res.status(404).json({ message: `Activity with ID ${id} not found.` });
        return;
      }

      const target = db.activities[idx];
      const projectId = target.projectId;
      const childIds = db.activities.filter((a) => a.parentActivityId === id).map((a) => a.id);
      const allRemoved = [id, ...childIds];

      db.dependencies = db.dependencies.filter(
        (d) => !allRemoved.includes(d.predecessorTaskId) && !allRemoved.includes(d.successorTaskId)
      );
      db.activities = db.activities.filter((a) => !allRemoved.includes(a.id));

      recalculateProjectProgress(db, projectId);
      saveDb(db);

      res.json({
        success: true,
        id,
        deletedCount: allRemoved.length,
        message: `Activity "${target.name}" deleted successfully.`
      });
    } catch (error) {
      console.error('Error deleting activity:', error);
      res.status(500).json({ message: 'Internal server error while deleting activity.' });
    }
  });

  // ==================== PROJECT PLANNING & SCHEDULING (EPIC 11) ====================
  const computeCalendarSpanDays = (startStr: string, endStr: string): number | null => {
    if (!isValidIsoDate(startStr) || !isValidIsoDate(endStr) || endStr < startStr) {
      return null;
    }
    const startMs = new Date(`${startStr}T00:00:00Z`).getTime();
    const endMs = new Date(`${endStr}T00:00:00Z`).getTime();
    return Math.max(1, Math.round((endMs - startMs) / 86400000) + 1);
  };

  const buildProjectSchedulePayload = (db: DatabaseSchema, projectId: number, lang: 'en' | 'ar' = 'en') => {
    const project = db.projects.find((p) => p.id === projectId)!;
    const init = db.initiatives.find((i) => i.id === project.initiativeId) || null;
    const port = init ? db.portfolios.find((p) => p.id === init.portfolioId) || null : null;
    const dept = init ? db.departments.find((d) => d.id === init.departmentId) || null : null;
    const pm = project.projectManagerId
      ? db.users.find((u) => u.id === project.projectManagerId) || null
      : null;

    const projectStart = String(project.startDate || '').trim();
    const projectTarget = String(project.endDate || '').trim();
    const hasValidProjectDates =
      isValidIsoDate(projectStart) && isValidIsoDate(projectTarget) && projectTarget >= projectStart;

    const projectActivities = enrichActivities(db)
      .filter((a) => a.projectId === projectId)
      .map((a) => {
        const actStart = String(a.startDate || '').trim();
        const actDue = String(a.dueDate || '').trim();
        const hasValidStart = isValidIsoDate(actStart);
        const hasValidDue = isValidIsoDate(actDue);
        const hasMissingDates = !hasValidStart || !hasValidDue;
        const hasInvalidDateOrder = hasValidStart && hasValidDue && actDue < actStart;
        const startsBeforeProject =
          hasValidStart && isValidIsoDate(projectStart) && actStart < projectStart;
        const endsAfterProject =
          hasValidDue && isValidIsoDate(projectTarget) && actDue > projectTarget;

        const conflicts: string[] = [];
        const conflictMessages: string[] = [];

        if (hasMissingDates) {
          conflicts.push('missing_dates');
          conflictMessages.push(
            lang === 'ar'
              ? 'النشاط يفتقد إلى تاريخ بدء أو تاريخ استحقاق مخطط صالح.'
              : 'Activity is missing a valid planned start date or due date.'
          );
        }
        if (hasInvalidDateOrder) {
          conflicts.push('due_before_start');
          conflictMessages.push(
            lang === 'ar'
              ? `تاريخ استحقاق النشاط (${actDue}) أسبق من تاريخ بدئه (${actStart}).`
              : `Activity due date (${actDue}) is earlier than its start date (${actStart}).`
          );
        }
        if (startsBeforeProject) {
          conflicts.push('starts_before_project');
          conflictMessages.push(
            lang === 'ar'
              ? `يبدأ النشاط (${actStart}) قبل تاريخ البدء المخطط للمشروع (${projectStart}).`
              : `Activity starts (${actStart}) before project planned start date (${projectStart}).`
          );
        }
        if (endsAfterProject) {
          conflicts.push('ends_after_project');
          conflictMessages.push(
            lang === 'ar'
              ? `يتجاوز تاريخ استحقاق النشاط (${actDue}) التاريخ المستهدف للمشروع (${projectTarget}).`
              : `Activity due date (${actDue}) exceeds project target date (${projectTarget}).`
          );
        }

        let timelineRelation:
          | 'within_timeline'
          | 'starts_before_project'
          | 'ends_after_project'
          | 'outside_both'
          | 'invalid_order'
          | 'missing_dates' = 'within_timeline';

        if (hasMissingDates) {
          timelineRelation = 'missing_dates';
        } else if (hasInvalidDateOrder) {
          timelineRelation = 'invalid_order';
        } else if (startsBeforeProject && endsAfterProject) {
          timelineRelation = 'outside_both';
        } else if (startsBeforeProject) {
          timelineRelation = 'starts_before_project';
        } else if (endsAfterProject) {
          timelineRelation = 'ends_after_project';
        }

        const isWithinProjectTimeline = conflicts.length === 0;

        return {
          ...a,
          durationDays: computeCalendarSpanDays(actStart, actDue),
          hasMissingDates,
          hasInvalidDateOrder,
          startsBeforeProject,
          endsAfterProject,
          isWithinProjectTimeline,
          timelineRelation,
          conflicts,
          conflictMessages
        };
      });

    // Chronological ordering: startDate asc (missing dates placed last), then dueDate asc, then id asc
    projectActivities.sort((a, b) => {
      const aHasStart = isValidIsoDate(String(a.startDate || '').trim());
      const bHasStart = isValidIsoDate(String(b.startDate || '').trim());
      if (aHasStart !== bHasStart) return aHasStart ? -1 : 1;
      if (aHasStart && bHasStart && a.startDate !== b.startDate) {
        return a.startDate.localeCompare(b.startDate);
      }

      const aHasDue = isValidIsoDate(String(a.dueDate || '').trim());
      const bHasDue = isValidIsoDate(String(b.dueDate || '').trim());
      if (aHasDue !== bHasDue) return aHasDue ? -1 : 1;
      if (aHasDue && bHasDue && a.dueDate !== b.dueDate) {
        return a.dueDate.localeCompare(b.dueDate);
      }

      return a.id - b.id;
    });

    const validStarts = projectActivities
      .map((a) => String(a.startDate || '').trim())
      .filter((d) => isValidIsoDate(d))
      .sort();
    const validDues = projectActivities
      .map((a) => String(a.dueDate || '').trim())
      .filter((d) => isValidIsoDate(d))
      .sort();

    const conflictItems = projectActivities
      .filter((a) => !a.isWithinProjectTimeline)
      .map((a) => ({
        activityId: a.id,
        activityName: a.name,
        activityNameAr: a.nameAr || a.name,
        startDate: a.startDate,
        dueDate: a.dueDate,
        status: a.status,
        timelineRelation: a.timelineRelation,
        codes: a.conflicts,
        messages: a.conflictMessages
      }));

    return {
      project: {
        id: project.id,
        name: project.name,
        nameAr: project.nameAr || project.name,
        description: project.description,
        descriptionAr: project.descriptionAr || project.description,
        status: project.status,
        priority: project.priority,
        initiativeId: project.initiativeId,
        initiativeName: init ? init.name : null,
        initiativeNameAr: init ? (init.nameAr || init.name) : null,
        portfolioName: port ? port.name : null,
        portfolioNameAr: port ? (port.nameAr || port.name) : null,
        departmentName: dept ? dept.name : null,
        departmentNameAr: dept ? (dept.nameAr || dept.name) : null,
        projectManagerId: project.projectManagerId,
        projectManagerName: pm ? pm.fullName : null,
        projectManagerNameAr: pm ? (pm.fullNameAr || pm.fullName) : null,
        startDate: project.startDate,
        endDate: project.endDate,
        targetDate: project.endDate,
        progressPercentage: calculateProjectProgress(project.id, db),
        durationDays: computeCalendarSpanDays(projectStart, projectTarget)
      },
      activities: projectActivities,
      summary: {
        totalActivities: projectActivities.length,
        scheduledActivities: projectActivities.filter((a) => !a.hasMissingDates).length,
        missingDateActivities: projectActivities.filter((a) => a.hasMissingDates).length,
        conflictingActivities: conflictItems.length,
        hasConflicts: conflictItems.length > 0,
        earliestActivityStart: validStarts.length > 0 ? validStarts[0] : null,
        latestActivityDue: validDues.length > 0 ? validDues[validDues.length - 1] : null,
        projectDurationDays: computeCalendarSpanDays(projectStart, projectTarget),
        projectDateError: !hasValidProjectDates
      },
      conflicts: conflictItems
    };
  };

  // Story 11.2 / 11.6 / 11.10: Retrieve Project Schedule with chronological activities & date relationships
  app.get('/api/projects/:id/schedule', (req, res) => {
    try {
      const projectId = Number(req.params.id);
      if (!Number.isInteger(projectId) || projectId <= 0) {
        res.status(400).json({ message: 'Invalid project ID supplied.' });
        return;
      }

      const db = loadDb();
      const project = db.projects.find((p) => p.id === projectId);
      if (!project) {
        res.status(404).json({ message: `Project with ID ${projectId} not found.` });
        return;
      }

      const reqLang = req.query.lang === 'ar' ? 'ar' : 'en';
      res.json(buildProjectSchedulePayload(db, projectId, reqLang));
    } catch (error) {
      console.error('Error retrieving project schedule:', error);
      res.status(500).json({ message: 'Internal server error while retrieving project schedule.' });
    }
  });

  // Story 11.4: Update Project Planned Start & Target Dates with validation and conflict detection
  app.put('/api/projects/:id/schedule', (req, res) => {
    try {
      const projectId = Number(req.params.id);
      if (!Number.isInteger(projectId) || projectId <= 0) {
        res.status(400).json({ message: 'Invalid project ID supplied.' });
        return;
      }

      const db = loadDb();
      const idx = db.projects.findIndex((p) => p.id === projectId);
      if (idx === -1) {
        res.status(404).json({ message: `Project with ID ${projectId} not found.` });
        return;
      }

      const rawStart = req.body.startDate;
      const rawTarget = req.body.targetDate !== undefined ? req.body.targetDate : req.body.endDate;

      const nextStartDate =
        rawStart !== undefined ? String(rawStart).trim() : db.projects[idx].startDate;
      const nextTargetDate =
        rawTarget !== undefined ? String(rawTarget).trim() : db.projects[idx].endDate;

      const fieldErrors: { startDate?: string; targetDate?: string } = {};
      if (!isValidIsoDate(nextStartDate)) {
        fieldErrors.startDate = 'Valid planned start date (YYYY-MM-DD) is required.';
      }
      if (!isValidIsoDate(nextTargetDate)) {
        fieldErrors.targetDate = 'Valid planned target date (YYYY-MM-DD) is required.';
      }
      if (!fieldErrors.startDate && !fieldErrors.targetDate && nextTargetDate < nextStartDate) {
        fieldErrors.targetDate = 'Project target date cannot be earlier than planned start date.';
      }

      if (Object.keys(fieldErrors).length > 0) {
        res.status(400).json({
          message:
            fieldErrors.targetDate ||
            fieldErrors.startDate ||
            'Invalid project planning dates supplied.',
          fieldErrors
        });
        return;
      }

      db.projects[idx] = {
        ...db.projects[idx],
        startDate: nextStartDate,
        endDate: nextTargetDate
      };
      saveDb(db);

      const reqLang = req.body?.lang === 'ar' || req.query.lang === 'ar' ? 'ar' : 'en';
      const payload = buildProjectSchedulePayload(db, projectId, reqLang);
      const warnings = payload.conflicts.map(
        (c) => `${reqLang === 'ar' ? (c.activityNameAr || c.activityName) : c.activityName}: ${c.messages.join(' ')}`
      );

      res.json({
        ...payload,
        warnings
      });
    } catch (error) {
      console.error('Error updating project schedule dates:', error);
      res.status(500).json({ message: 'Internal server error while updating project schedule.' });
    }
  });

  // Story 11.8: Update Activity Schedule Dates with strict project timeline & date relationship validation
  app.put('/api/projects/:id/schedule/activities/:activityId', (req, res) => {
    try {
      const projectId = Number(req.params.id);
      const activityId = Number(req.params.activityId);
      if (!Number.isInteger(projectId) || projectId <= 0) {
        res.status(400).json({ message: 'Invalid project ID supplied.' });
        return;
      }
      if (!Number.isInteger(activityId) || activityId <= 0) {
        res.status(400).json({ message: 'Invalid activity ID supplied.' });
        return;
      }

      const db = loadDb();
      const project = db.projects.find((p) => p.id === projectId);
      if (!project) {
        res.status(404).json({ message: `Project with ID ${projectId} not found.` });
        return;
      }

      const actIdx = db.activities.findIndex((a) => a.id === activityId);
      if (actIdx === -1) {
        res.status(404).json({ message: `Activity with ID ${activityId} not found.` });
        return;
      }
      if (db.activities[actIdx].projectId !== projectId) {
        res.status(400).json({
          message: `Activity ${activityId} does not belong to project ${projectId}.`
        });
        return;
      }

      const existing = db.activities[actIdx];
      const nextStartDate =
        req.body.startDate !== undefined ? String(req.body.startDate).trim() : existing.startDate;
      const nextDueDate =
        req.body.dueDate !== undefined ? String(req.body.dueDate).trim() : existing.dueDate;

      const fieldErrors: { startDate?: string; dueDate?: string } = {};
      if (!isValidIsoDate(nextStartDate)) {
        fieldErrors.startDate = 'Valid activity start date (YYYY-MM-DD) is required.';
      }
      if (!isValidIsoDate(nextDueDate)) {
        fieldErrors.dueDate = 'Valid activity due date (YYYY-MM-DD) is required.';
      }
      if (!fieldErrors.startDate && !fieldErrors.dueDate && nextDueDate < nextStartDate) {
        fieldErrors.dueDate = 'Activity due date cannot be earlier than activity start date.';
      }

      if (
        !fieldErrors.startDate &&
        isValidIsoDate(project.startDate) &&
        nextStartDate < project.startDate
      ) {
        fieldErrors.startDate = `Activity start date (${nextStartDate}) falls before the project planned start date (${project.startDate}).`;
      }
      if (
        !fieldErrors.dueDate &&
        isValidIsoDate(project.endDate) &&
        nextDueDate > project.endDate
      ) {
        fieldErrors.dueDate = `Activity due date (${nextDueDate}) exceeds the project planned target date (${project.endDate}).`;
      }

      if (Object.keys(fieldErrors).length > 0) {
        res.status(400).json({
          message:
            fieldErrors.startDate ||
            fieldErrors.dueDate ||
            'Invalid activity schedule date relationship.',
          fieldErrors,
          projectWindow: {
            startDate: project.startDate,
            targetDate: project.endDate
          }
        });
        return;
      }

      db.activities[actIdx] = {
        ...existing,
        startDate: nextStartDate,
        dueDate: nextDueDate
      };
      recalculateProjectProgress(db, projectId);
      saveDb(db);

      const reqLang = req.body?.lang === 'ar' || req.query.lang === 'ar' ? 'ar' : 'en';
      const schedule = buildProjectSchedulePayload(db, projectId, reqLang);
      const updatedActivity = schedule.activities.find((a: any) => a.id === activityId) || null;
      res.json({
        activity: updatedActivity,
        schedule
      });
    } catch (error) {
      console.error('Error updating activity schedule dates:', error);
      res.status(500).json({ message: 'Internal server error while updating activity schedule.' });
    }
  });

  // ==================== TASK DEPENDENCIES CRUD ====================
  app.get('/api/dependencies', (req, res) => {
    const db = loadDb();
    const projectId = req.query.projectId ? Number(req.query.projectId) : null;
    res.json(enrichDependencies(db, projectId));
  });

  app.post('/api/dependencies', (req, res) => {
    const db = loadDb();
    const predId = Number(req.body.predecessorTaskId);
    const succId = Number(req.body.successorTaskId);
    const depType = String(req.body.dependencyType || 'FinishToStart');

    if (!predId || !succId) {
      res.status(400).json({ message: 'Both predecessor and successor tasks are required.' });
      return;
    }
    if (predId === succId) {
      res.status(400).json({ message: 'Invalid dependency: A task cannot depend on itself.' });
      return;
    }
    const pred = db.activities.find((a) => a.id === predId);
    const succ = db.activities.find((a) => a.id === succId);
    if (!pred || !succ) {
      res.status(404).json({ message: 'Predecessor or successor task not found.' });
      return;
    }
    if (
      db.dependencies.some(
        (d) => d.predecessorTaskId === predId && d.successorTaskId === succId
      )
    ) {
      res.status(400).json({ message: 'This dependency relationship already exists.' });
      return;
    }
    if (
      db.dependencies.some(
        (d) => d.predecessorTaskId === succId && d.successorTaskId === predId
      )
    ) {
      res.status(400).json({
        message: 'Invalid dependency: Circular relationship detected between these two tasks.'
      });
      return;
    }

    const nextId = db.dependencies.reduce((max, d) => Math.max(max, d.id), 0) + 1;
    const created: TaskDependencyRecord = {
      id: nextId,
      predecessorTaskId: predId,
      successorTaskId: succId,
      dependencyType: depType
    };
    db.dependencies.push(created);
    saveDb(db);

    const enriched = enrichDependencies(db).find((d) => d.id === created.id);
    res.status(201).json(enriched);
  });

  app.delete('/api/dependencies/:id', (req, res) => {
    const db = loadDb();
    const id = Number(req.params.id);
    const idx = db.dependencies.findIndex((d) => d.id === id);
    if (idx === -1) {
      res.status(404).json({ message: 'Dependency not found.' });
      return;
    }
    db.dependencies.splice(idx, 1);
    saveDb(db);
    res.status(204).send();
  });

  // ==================== STRATEGIC PLANNING MODULE (strategic_planning) ====================

  // Helper to enrich strategic initiatives with relational titles and total budget
  function enrichStrategicInitiatives(db: DatabaseSchema) {
    return (db.strategicInitiatives || []).map((init) => {
      const plan = (db.strategicPlans || []).find((p) => p.id === init.planId);
      const dept = (db.departments || []).find((d) => d.id === init.departmentId);
      const planGoal = plan ? plan.goals.find((g) => g.id === init.goalId) : null;
      const planPerspective = planGoal && plan ? plan.perspectives.find((p) => p.id === planGoal.perspectiveId) : null;

      const linkedActivities = (db.strategicActivities || []).filter((a) => a.initiativeId === init.id);
      const totalActivitiesBudget = linkedActivities.reduce((acc, a) => acc + (Number(a.activityValue) || 0), 0);

      return {
        ...init,
        planTitle: plan ? plan.titleAr : '',
        planTitleEn: plan ? plan.titleEn : '',
        departmentName: dept ? (dept.nameAr || dept.name) : '',
        departmentNameEn: dept ? dept.name : '',
        departmentNameAr: dept ? (dept.nameAr || dept.name) : '',
        goalTitle: planGoal ? planGoal.title : '',
        goalTitleEn: planGoal ? (planGoal.titleEn || planGoal.title) : '',
        perspectiveName: planPerspective ? planPerspective.name : '',
        perspectiveNameEn: planPerspective ? (planPerspective.nameEn || planPerspective.name) : '',
        totalActivitiesBudget,
        activitiesCount: linkedActivities.length
      };
    });
  }

  // Helper to enrich strategic activities
  function enrichStrategicActivities(db: DatabaseSchema) {
    return (db.strategicActivities || []).map((act) => {
      const init = (db.strategicInitiatives || []).find((i) => i.id === act.initiativeId);
      const dept = (db.departments || []).find((d) => d.id === act.departmentId);
      return {
        ...act,
        initiativeTitle: init ? init.title : '',
        initiativeTitleEn: init ? (init.titleEn || init.title) : '',
        departmentName: dept ? (dept.nameAr || dept.name) : '',
        departmentNameEn: dept ? dept.name : '',
        departmentNameAr: dept ? (dept.nameAr || dept.name) : ''
      };
    });
  }

  // --- 1. STRATEGIC PLANS ---
  app.get('/api/strategic-planning/plans', (_req, res) => {
    const db = loadDb();
    const plans = (db.strategicPlans || []).map((p) => {
      const inits = (db.strategicInitiatives || []).filter((i) => i.planId === p.id);
      return {
        ...p,
        initiativesCount: inits.length
      };
    });
    res.json(plans);
  });

  app.get('/api/strategic-planning/plans/:id', (req, res) => {
    const db = loadDb();
    const id = Number(req.params.id);
    const plan = (db.strategicPlans || []).find((p) => p.id === id);
    if (!plan) {
      res.status(404).json({ message: 'Strategic plan not found' });
      return;
    }
    const inits = (db.strategicInitiatives || []).filter((i) => i.planId === plan.id);
    res.json({
      ...plan,
      initiativesCount: inits.length
    });
  });

  app.post('/api/strategic-planning/plans', (req, res) => {
    const db = loadDb();
    const body = req.body;
    if (!body.titleAr && !body.titleEn) {
      res.status(400).json({ message: 'Strategic plan title is required' });
      return;
    }

    const nextId = (db.strategicPlans || []).reduce((max, p) => Math.max(max, p.id), 0) + 1;
    const now = new Date().toISOString();

    const newPlan: StrategicPlanRecord = {
      id: nextId,
      titleAr: String(body.titleAr || body.titleEn || '').trim(),
      titleEn: String(body.titleEn || body.titleAr || '').trim(),
      cycle: String(body.cycle || '2026 - 2030'),
      yearsRange: Array.isArray(body.yearsRange) && body.yearsRange.length > 0 ? body.yearsRange : ['2026', '2027', '2028', '2029', '2030'],
      planType: String(body.planType || 'خطة خمسية استراتيجية'),
      planTypeEn: body.planTypeEn ? String(body.planTypeEn) : undefined,
      vision: String(body.vision || ''),
      visionEn: body.visionEn !== undefined ? String(body.visionEn) : undefined,
      mission: String(body.mission || ''),
      missionEn: body.missionEn !== undefined ? String(body.missionEn) : undefined,
      description: String(body.description || ''),
      descriptionEn: body.descriptionEn !== undefined ? String(body.descriptionEn) : undefined,
      strategicIssues: Array.isArray(body.strategicIssues) ? body.strategicIssues : [],
      strategicIssuesEn: Array.isArray(body.strategicIssuesEn) ? body.strategicIssuesEn : undefined,
      values: Array.isArray(body.values) ? body.values : [],
      valuesEn: Array.isArray(body.valuesEn) ? body.valuesEn : undefined,
      perspectives: Array.isArray(body.perspectives) ? body.perspectives : [],
      goals: Array.isArray(body.goals) ? body.goals : [],
      seminarCard: body.seminarCard || {},
      status: body.status === 'Approved' ? 'Approved' : 'Draft',
      createdAt: now,
      updatedAt: now
    };

    if (!db.strategicPlans) db.strategicPlans = [];
    db.strategicPlans.push(newPlan);
    saveDb(db);

    res.status(201).json(newPlan);
  });

  app.put('/api/strategic-planning/plans/:id', (req, res) => {
    const db = loadDb();
    const id = Number(req.params.id);
    const idx = (db.strategicPlans || []).findIndex((p) => p.id === id);
    if (idx === -1) {
      res.status(404).json({ message: 'Strategic plan not found' });
      return;
    }

    const body = req.body;
    const now = new Date().toISOString();

    db.strategicPlans[idx] = {
      ...db.strategicPlans[idx],
      titleAr: body.titleAr !== undefined ? String(body.titleAr).trim() : db.strategicPlans[idx].titleAr,
      titleEn: body.titleEn !== undefined ? String(body.titleEn).trim() : db.strategicPlans[idx].titleEn,
      cycle: body.cycle !== undefined ? String(body.cycle) : db.strategicPlans[idx].cycle,
      yearsRange: Array.isArray(body.yearsRange) ? body.yearsRange : db.strategicPlans[idx].yearsRange,
      planType: body.planType !== undefined ? String(body.planType) : db.strategicPlans[idx].planType,
      planTypeEn: body.planTypeEn !== undefined ? String(body.planTypeEn) : db.strategicPlans[idx].planTypeEn,
      vision: body.vision !== undefined ? String(body.vision) : db.strategicPlans[idx].vision,
      visionEn: body.visionEn !== undefined ? String(body.visionEn) : db.strategicPlans[idx].visionEn,
      mission: body.mission !== undefined ? String(body.mission) : db.strategicPlans[idx].mission,
      missionEn: body.missionEn !== undefined ? String(body.missionEn) : db.strategicPlans[idx].missionEn,
      description: body.description !== undefined ? String(body.description) : db.strategicPlans[idx].description,
      descriptionEn: body.descriptionEn !== undefined ? String(body.descriptionEn) : db.strategicPlans[idx].descriptionEn,
      strategicIssues: Array.isArray(body.strategicIssues) ? body.strategicIssues : db.strategicPlans[idx].strategicIssues,
      strategicIssuesEn: Array.isArray(body.strategicIssuesEn) ? body.strategicIssuesEn : db.strategicPlans[idx].strategicIssuesEn,
      values: Array.isArray(body.values) ? body.values : db.strategicPlans[idx].values,
      valuesEn: Array.isArray(body.valuesEn) ? body.valuesEn : db.strategicPlans[idx].valuesEn,
      perspectives: Array.isArray(body.perspectives) ? body.perspectives : db.strategicPlans[idx].perspectives,
      goals: Array.isArray(body.goals) ? body.goals : db.strategicPlans[idx].goals,
      seminarCard: body.seminarCard ? { ...db.strategicPlans[idx].seminarCard, ...body.seminarCard } : db.strategicPlans[idx].seminarCard,
      status: body.status || db.strategicPlans[idx].status,
      updatedAt: now
    };

    saveDb(db);
    res.json(db.strategicPlans[idx]);
  });

  app.delete('/api/strategic-planning/plans/:id', (req, res) => {
    const db = loadDb();
    const id = Number(req.params.id);
    const idx = (db.strategicPlans || []).findIndex((p) => p.id === id);
    if (idx === -1) {
      res.status(404).json({ message: 'Strategic plan not found' });
      return;
    }

    db.strategicPlans.splice(idx, 1);
    saveDb(db);
    res.status(204).send();
  });

  // --- 2. STRATEGIC INITIATIVES & PROGRAMS ---
  app.get('/api/strategic-planning/initiatives', (req, res) => {
    const db = loadDb();
    let list = enrichStrategicInitiatives(db);
    if (req.query.planId) {
      list = list.filter((i) => i.planId === Number(req.query.planId));
    }
    res.json(list);
  });

  app.get('/api/strategic-planning/initiatives/:id', (req, res) => {
    const db = loadDb();
    const id = Number(req.params.id);
    const list = enrichStrategicInitiatives(db);
    const init = list.find((i) => i.id === id);
    if (!init) {
      res.status(404).json({ message: 'Initiative not found' });
      return;
    }
    res.json(init);
  });

  app.post('/api/strategic-planning/initiatives', (req, res) => {
    const db = loadDb();
    const body = req.body;
    if (!body.title || !body.planId) {
      res.status(400).json({ message: 'Initiative title and linked strategic plan are required' });
      return;
    }

    const nextId = (db.strategicInitiatives || []).reduce((max, i) => Math.max(max, i.id), 0) + 1;
    const now = new Date().toISOString();

    const plan = (db.strategicPlans || []).find((p) => p.id === Number(body.planId));

    const newInit: StrategicInitiativeRecord = {
      id: nextId,
      title: String(body.title || body.titleEn || '').trim(),
      titleEn: body.titleEn ? String(body.titleEn).trim() : undefined,
      code: body.code ? String(body.code).trim() : `INIT-${new Date().getFullYear()}-${String(nextId).padStart(3, '0')}`,
      domains: Array.isArray(body.domains) ? body.domains : [],
      domainsEn: Array.isArray(body.domainsEn) ? body.domainsEn : undefined,
      planId: Number(body.planId),
      departmentId: Number(body.departmentId) || 1,
      section: String(body.section || 'قسم التخطيط الاستراتيجي'),
      sectionEn: body.sectionEn ? String(body.sectionEn) : undefined,
      planType: String(body.planType || (plan ? plan.planType : 'خطة خمسية استراتيجية')),
      planTypeEn: body.planTypeEn ? String(body.planTypeEn) : (plan?.planTypeEn || undefined),
      indicator: String(body.indicator || ''),
      indicatorEn: body.indicatorEn !== undefined ? String(body.indicatorEn) : undefined,
      goalId: String(body.goalId || ''),
      organizationUnit: String(body.organizationUnit || 'الصندوق الثقافي'),
      organizationUnitEn: body.organizationUnitEn ? String(body.organizationUnitEn) : undefined,
      cycle: String(body.cycle || (plan ? plan.cycle : '2026 - 2030')),
      years: Array.isArray(body.years) ? body.years : ['2026'],
      startDate: String(body.startDate || '2026-01-01'),
      endDate: String(body.endDate || '2026-12-31'),
      status: body.status === 'Approved' ? 'Approved' : 'Draft',
      createdAt: now,
      updatedAt: now
    };

    if (!db.strategicInitiatives) db.strategicInitiatives = [];
    db.strategicInitiatives.push(newInit);
    saveDb(db);

    const enriched = enrichStrategicInitiatives(db).find((i) => i.id === newInit.id);
    res.status(201).json(enriched || newInit);
  });

  app.put('/api/strategic-planning/initiatives/:id', (req, res) => {
    const db = loadDb();
    const id = Number(req.params.id);
    const idx = (db.strategicInitiatives || []).findIndex((i) => i.id === id);
    if (idx === -1) {
      res.status(404).json({ message: 'Initiative not found' });
      return;
    }

    const body = req.body;
    const now = new Date().toISOString();

    db.strategicInitiatives[idx] = {
      ...db.strategicInitiatives[idx],
      title: body.title !== undefined ? String(body.title).trim() : db.strategicInitiatives[idx].title,
      titleEn: body.titleEn !== undefined ? String(body.titleEn).trim() : db.strategicInitiatives[idx].titleEn,
      code: body.code !== undefined ? String(body.code).trim() : db.strategicInitiatives[idx].code,
      domains: Array.isArray(body.domains) ? body.domains : db.strategicInitiatives[idx].domains,
      domainsEn: Array.isArray(body.domainsEn) ? body.domainsEn : db.strategicInitiatives[idx].domainsEn,
      planId: body.planId !== undefined ? Number(body.planId) : db.strategicInitiatives[idx].planId,
      departmentId: body.departmentId !== undefined ? Number(body.departmentId) : db.strategicInitiatives[idx].departmentId,
      section: body.section !== undefined ? String(body.section) : db.strategicInitiatives[idx].section,
      sectionEn: body.sectionEn !== undefined ? String(body.sectionEn) : db.strategicInitiatives[idx].sectionEn,
      planType: body.planType !== undefined ? String(body.planType) : db.strategicInitiatives[idx].planType,
      planTypeEn: body.planTypeEn !== undefined ? String(body.planTypeEn) : db.strategicInitiatives[idx].planTypeEn,
      indicator: body.indicator !== undefined ? String(body.indicator) : db.strategicInitiatives[idx].indicator,
      indicatorEn: body.indicatorEn !== undefined ? String(body.indicatorEn) : db.strategicInitiatives[idx].indicatorEn,
      goalId: body.goalId !== undefined ? String(body.goalId) : db.strategicInitiatives[idx].goalId,
      organizationUnit: body.organizationUnit !== undefined ? String(body.organizationUnit) : db.strategicInitiatives[idx].organizationUnit,
      organizationUnitEn: body.organizationUnitEn !== undefined ? String(body.organizationUnitEn) : db.strategicInitiatives[idx].organizationUnitEn,
      cycle: body.cycle !== undefined ? String(body.cycle) : db.strategicInitiatives[idx].cycle,
      years: Array.isArray(body.years) ? body.years : db.strategicInitiatives[idx].years,
      startDate: body.startDate !== undefined ? String(body.startDate) : db.strategicInitiatives[idx].startDate,
      endDate: body.endDate !== undefined ? String(body.endDate) : db.strategicInitiatives[idx].endDate,
      status: body.status || db.strategicInitiatives[idx].status,
      updatedAt: now
    };

    saveDb(db);
    const enriched = enrichStrategicInitiatives(db).find((i) => i.id === id);
    res.json(enriched || db.strategicInitiatives[idx]);
  });

  // Duplicate Initiative action (نسخ المبادرة)
  app.post('/api/strategic-planning/initiatives/:id/duplicate', (req, res) => {
    const db = loadDb();
    const id = Number(req.params.id);
    const source = (db.strategicInitiatives || []).find((i) => i.id === id);
    if (!source) {
      res.status(404).json({ message: 'Source initiative not found' });
      return;
    }

    const nextId = (db.strategicInitiatives || []).reduce((max, i) => Math.max(max, i.id), 0) + 1;
    const now = new Date().toISOString();

    const duplicated: StrategicInitiativeRecord = {
      ...JSON.parse(JSON.stringify(source)),
      id: nextId,
      title: `${source.title} (نسخة)`,
      titleEn: source.titleEn ? `${source.titleEn} (Copy)` : undefined,
      code: `INIT-${new Date().getFullYear()}-${String(nextId).padStart(3, '0')}`,
      status: 'Draft',
      createdAt: now,
      updatedAt: now
    };

    db.strategicInitiatives.push(duplicated);
    saveDb(db);

    const enriched = enrichStrategicInitiatives(db).find((i) => i.id === nextId);
    res.status(201).json(enriched || duplicated);
  });

  // Workflow Approval for Initiative (تعميد)
  app.post('/api/strategic-planning/initiatives/:id/approve', (req, res) => {
    const db = loadDb();
    const id = Number(req.params.id);
    const idx = (db.strategicInitiatives || []).findIndex((i) => i.id === id);
    if (idx === -1) {
      res.status(404).json({ message: 'Initiative not found' });
      return;
    }

    db.strategicInitiatives[idx].status = 'Approved';
    db.strategicInitiatives[idx].updatedAt = new Date().toISOString();
    saveDb(db);

    const enriched = enrichStrategicInitiatives(db).find((i) => i.id === id);
    res.json(enriched || db.strategicInitiatives[idx]);
  });

  app.delete('/api/strategic-planning/initiatives/:id', (req, res) => {
    const db = loadDb();
    const id = Number(req.params.id);
    const idx = (db.strategicInitiatives || []).findIndex((i) => i.id === id);
    if (idx === -1) {
      res.status(404).json({ message: 'Initiative not found' });
      return;
    }

    db.strategicInitiatives.splice(idx, 1);
    saveDb(db);
    res.status(204).send();
  });

  // --- 3. STRATEGIC ACTIVITIES ---
  app.get('/api/strategic-planning/activities', (req, res) => {
    const db = loadDb();
    let list = enrichStrategicActivities(db);
    if (req.query.initiativeId) {
      list = list.filter((a) => a.initiativeId === Number(req.query.initiativeId));
    }
    res.json(list);
  });

  app.get('/api/strategic-planning/activities/:id', (req, res) => {
    const db = loadDb();
    const id = Number(req.params.id);
    const list = enrichStrategicActivities(db);
    const act = list.find((a) => a.id === id);
    if (!act) {
      res.status(404).json({ message: 'Activity not found' });
      return;
    }
    res.json(act);
  });

  app.post('/api/strategic-planning/activities', (req, res) => {
    const db = loadDb();
    const body = req.body;
    if (!body.name || !body.initiativeId) {
      res.status(400).json({ message: 'Activity name and linked initiative/program are required' });
      return;
    }

    const nextId = (db.strategicActivities || []).reduce((max, a) => Math.max(max, a.id), 0) + 1;
    const now = new Date().toISOString();

    const authorName = body.authorName || 'إلينا فانس';
    const authorRole = body.authorRole || 'مدير التخطيط الاستراتيجي';

    const initialChatter: ChatterMessage[] = [
      {
        id: `c_${Date.now()}`,
        type: 'audit_log',
        author: authorName,
        authorEn: body.authorNameEn || 'Elena Vance',
        authorRole,
        authorRoleEn: body.authorRoleEn || 'Strategic Planning Director',
        content: 'تم إنشاء النشاط بحالة مسودة.',
        contentEn: 'Activity created in Draft status.',
        timestamp: new Date().toLocaleString('ar-SA')
      }
    ];

    const newAct: StrategicActivityRecord = {
      id: nextId,
      name: String(body.name || body.nameEn || '').trim(),
      nameEn: body.nameEn ? String(body.nameEn).trim() : undefined,
      source: String(body.source || 'أساس'),
      sourceEn: body.sourceEn ? String(body.sourceEn) : undefined,
      domains: Array.isArray(body.domains) ? body.domains : [],
      domainsEn: Array.isArray(body.domainsEn) ? body.domainsEn : undefined,
      indicator: String(body.indicator || ''),
      indicatorEn: body.indicatorEn !== undefined ? String(body.indicatorEn) : undefined,
      initiativeId: Number(body.initiativeId),
      departmentId: Number(body.departmentId) || 1,
      section: String(body.section || 'قسم التخطيط والمتابعة'),
      sectionEn: body.sectionEn ? String(body.sectionEn) : undefined,
      startDate: String(body.startDate || '2026-03-01'),
      endDate: String(body.endDate || '2026-08-31'),
      targetValue: Number(body.targetValue) || 0,
      activityValue: Number(body.activityValue) || 0,
      isDevelopmentalProject: Boolean(body.isDevelopmentalProject),
      isExecutiveBodyActivity: body.isExecutiveBodyActivity !== undefined ? Boolean(body.isExecutiveBodyActivity) : true,
      status: body.status === 'Approved' ? 'Approved' : 'Draft',
      chatter: initialChatter,
      createdAt: now,
      updatedAt: now
    };

    if (!db.strategicActivities) db.strategicActivities = [];
    db.strategicActivities.push(newAct);
    saveDb(db);

    const enriched = enrichStrategicActivities(db).find((a) => a.id === newAct.id);
    res.status(201).json(enriched || newAct);
  });

  app.put('/api/strategic-planning/activities/:id', (req, res) => {
    const db = loadDb();
    const id = Number(req.params.id);
    const idx = (db.strategicActivities || []).findIndex((a) => a.id === id);
    if (idx === -1) {
      res.status(404).json({ message: 'Activity not found' });
      return;
    }

    const body = req.body;
    const now = new Date().toISOString();

    db.strategicActivities[idx] = {
      ...db.strategicActivities[idx],
      name: body.name !== undefined ? String(body.name).trim() : db.strategicActivities[idx].name,
      nameEn: body.nameEn !== undefined ? String(body.nameEn).trim() : db.strategicActivities[idx].nameEn,
      source: body.source !== undefined ? String(body.source) : db.strategicActivities[idx].source,
      sourceEn: body.sourceEn !== undefined ? String(body.sourceEn) : db.strategicActivities[idx].sourceEn,
      domains: Array.isArray(body.domains) ? body.domains : db.strategicActivities[idx].domains,
      domainsEn: Array.isArray(body.domainsEn) ? body.domainsEn : db.strategicActivities[idx].domainsEn,
      indicator: body.indicator !== undefined ? String(body.indicator) : db.strategicActivities[idx].indicator,
      indicatorEn: body.indicatorEn !== undefined ? String(body.indicatorEn) : db.strategicActivities[idx].indicatorEn,
      initiativeId: body.initiativeId !== undefined ? Number(body.initiativeId) : db.strategicActivities[idx].initiativeId,
      departmentId: body.departmentId !== undefined ? Number(body.departmentId) : db.strategicActivities[idx].departmentId,
      section: body.section !== undefined ? String(body.section) : db.strategicActivities[idx].section,
      sectionEn: body.sectionEn !== undefined ? String(body.sectionEn) : db.strategicActivities[idx].sectionEn,
      startDate: body.startDate !== undefined ? String(body.startDate) : db.strategicActivities[idx].startDate,
      endDate: body.endDate !== undefined ? String(body.endDate) : db.strategicActivities[idx].endDate,
      targetValue: body.targetValue !== undefined ? Number(body.targetValue) : db.strategicActivities[idx].targetValue,
      activityValue: body.activityValue !== undefined ? Number(body.activityValue) : db.strategicActivities[idx].activityValue,
      isDevelopmentalProject: body.isDevelopmentalProject !== undefined ? Boolean(body.isDevelopmentalProject) : db.strategicActivities[idx].isDevelopmentalProject,
      isExecutiveBodyActivity: body.isExecutiveBodyActivity !== undefined ? Boolean(body.isExecutiveBodyActivity) : db.strategicActivities[idx].isExecutiveBodyActivity,
      status: body.status || db.strategicActivities[idx].status,
      updatedAt: now
    };

    saveDb(db);
    const enriched = enrichStrategicActivities(db).find((a) => a.id === id);
    res.json(enriched || db.strategicActivities[idx]);
  });

  // Duplicate Activity action (نسخ نشاط)
  app.post('/api/strategic-planning/activities/:id/duplicate', (req, res) => {
    const db = loadDb();
    const id = Number(req.params.id);
    const source = (db.strategicActivities || []).find((a) => a.id === id);
    if (!source) {
      res.status(404).json({ message: 'Source activity not found' });
      return;
    }

    const nextId = (db.strategicActivities || []).reduce((max, a) => Math.max(max, a.id), 0) + 1;
    const now = new Date().toISOString();

    const duplicated: StrategicActivityRecord = {
      ...JSON.parse(JSON.stringify(source)),
      id: nextId,
      name: `${source.name} (نسخة)`,
      nameEn: source.nameEn ? `${source.nameEn} (Copy)` : undefined,
      status: 'Draft',
      chatter: [
        {
          id: `c_${Date.now()}`,
          type: 'audit_log',
          author: 'النظام',
          authorEn: 'System',
          authorRole: 'النظام',
          authorRoleEn: 'System',
          content: `نسخ مطابق للنشاط #${source.id} بحالة مسودة.`,
          contentEn: `Duplicated from activity #${source.id} in Draft status.`,
          timestamp: new Date().toLocaleString('ar-SA')
        }
      ],
      createdAt: now,
      updatedAt: now
    };

    db.strategicActivities.push(duplicated);
    saveDb(db);

    const enriched = enrichStrategicActivities(db).find((a) => a.id === nextId);
    res.status(201).json(enriched || duplicated);
  });

  // Workflow Approval for Activity (تعميد)
  app.post('/api/strategic-planning/activities/:id/approve', (req, res) => {
    const db = loadDb();
    const id = Number(req.params.id);
    const idx = (db.strategicActivities || []).findIndex((a) => a.id === id);
    if (idx === -1) {
      res.status(404).json({ message: 'Activity not found' });
      return;
    }

    db.strategicActivities[idx].status = 'Approved';
    db.strategicActivities[idx].updatedAt = new Date().toISOString();

    const author = req.body.author || 'إيلينا فانس';
    const authorEn = req.body.authorEn || 'Elena Vance';
    db.strategicActivities[idx].chatter.unshift({
      id: `c_${Date.now()}`,
      type: 'audit_log',
      author,
      authorEn,
      authorRole: 'مدير مكتب إدارة المشاريع',
      authorRoleEn: 'PMO Manager',
      content: 'تم تعميد واعتماد النشاط رسمياً ونقله إلى حالة "معتمد".',
      contentEn: 'Activity formally approved and moved to "Approved" status.',
      timestamp: new Date().toLocaleString('ar-SA')
    });

    saveDb(db);

    const enriched = enrichStrategicActivities(db).find((a) => a.id === id);
    res.json(enriched || db.strategicActivities[idx]);
  });

  // Chatter & Social Logging (رسالة، ملاحظة داخلية، سجل نشاط)
  app.post('/api/strategic-planning/activities/:id/chatter', (req, res) => {
    const db = loadDb();
    const id = Number(req.params.id);
    const idx = (db.strategicActivities || []).findIndex((a) => a.id === id);
    if (idx === -1) {
      res.status(404).json({ message: 'Activity not found' });
      return;
    }

    const { type, author, authorEn, authorRole, authorRoleEn, content, contentEn } = req.body;
    if (!content || !content.trim()) {
      res.status(400).json({ message: 'Message content is required' });
      return;
    }

    const message: ChatterMessage = {
      id: `c_${Date.now()}`,
      type: type === 'internal_note' ? 'internal_note' : type === 'audit_log' ? 'audit_log' : 'message',
      author: author || 'مستخدم النظام',
      authorEn: authorEn || author || 'System User',
      authorRole: authorRole || 'فريق العمل',
      authorRoleEn: authorRoleEn || authorRole || 'Team Member',
      content: String(content).trim(),
      contentEn: contentEn ? String(contentEn).trim() : String(content).trim(),
      timestamp: new Date().toLocaleString('ar-SA')
    };

    if (!db.strategicActivities[idx].chatter) {
      db.strategicActivities[idx].chatter = [];
    }

    db.strategicActivities[idx].chatter.unshift(message);
    db.strategicActivities[idx].updatedAt = new Date().toISOString();
    saveDb(db);

    res.status(201).json(message);
  });

  app.delete('/api/strategic-planning/activities/:id', (req, res) => {
    const db = loadDb();
    const id = Number(req.params.id);
    const idx = (db.strategicActivities || []).findIndex((a) => a.id === id);
    if (idx === -1) {
      res.status(404).json({ message: 'Activity not found' });
      return;
    }

    db.strategicActivities.splice(idx, 1);
    saveDb(db);
    res.status(204).send();
  });

  // ==================== ADMIN SETTINGS & SCREEN/FIELD CUSTOMIZATION STUDIO ====================
  // Get all settings (screen visibility, labels, schemas)
  app.get('/api/admin/settings', (_req, res) => {
    const db = loadDb();
    if (!db.systemSettings) {
      db.systemSettings = JSON.parse(JSON.stringify(INITIAL_SYSTEM_SETTINGS));
      saveDb(db);
    }
    res.json(db.systemSettings);
  });

  // Update system settings (visibility, role permissions, labels, schemas)
  app.put('/api/admin/settings', (req, res) => {
    const db = loadDb();
    const { menuVisibility, screenRolePermissions, screenLabels, screenSchemas, updatedBy } = req.body;

    if (!db.systemSettings) {
      db.systemSettings = JSON.parse(JSON.stringify(INITIAL_SYSTEM_SETTINGS));
    }

    if (menuVisibility && typeof menuVisibility === 'object') {
      db.systemSettings.menuVisibility = {
        ...db.systemSettings.menuVisibility,
        ...menuVisibility
      };
    }
    if (screenRolePermissions && typeof screenRolePermissions === 'object') {
      const sanitizedRolePermissions: Record<string, string[]> = {
        ...(db.systemSettings.screenRolePermissions || {})
      };
      for (const [screenId, rolesList] of Object.entries(screenRolePermissions)) {
        if (screenId === 'admin-settings' || screenId === 'role-permissions' || screenId === 'users') {
          continue;
        }
        if (Array.isArray(rolesList)) {
          sanitizedRolePermissions[screenId] = Array.from(
            new Set(rolesList.map((r) => String(r).trim()).filter(Boolean))
          );
        }
      }
      db.systemSettings.screenRolePermissions = sanitizedRolePermissions;
    }
    if (screenLabels && typeof screenLabels === 'object') {
      db.systemSettings.screenLabels = {
        ...db.systemSettings.screenLabels,
        ...screenLabels
      };
    }
    if (screenSchemas && typeof screenSchemas === 'object') {
      db.systemSettings.screenSchemas = {
        ...db.systemSettings.screenSchemas,
        ...screenSchemas
      };
    }

    db.systemSettings.lastUpdatedBy = updatedBy || 'Hamada El Daley';
    db.systemSettings.lastUpdatedAt = new Date().toISOString();

    saveDb(db);
    res.json(db.systemSettings);
  });

  // Reset system settings to defaults
  app.post('/api/admin/settings/reset', (_req, res) => {
    const db = loadDb();
    db.systemSettings = JSON.parse(JSON.stringify(INITIAL_SYSTEM_SETTINGS));
    db.systemSettings.lastUpdatedBy = 'Hamada El Daley';
    db.systemSettings.lastUpdatedAt = new Date().toISOString();
    saveDb(db);
    res.json(db.systemSettings);
  });

  // Add new field to a specific screen
  app.post('/api/admin/screens/:screenId/fields', (req, res) => {
    const db = loadDb();
    const { screenId } = req.params;
    const fieldData = req.body;

    if (!db.systemSettings) {
      db.systemSettings = JSON.parse(JSON.stringify(INITIAL_SYSTEM_SETTINGS));
    }

    if (!db.systemSettings.screenSchemas[screenId]) {
      res.status(404).json({ message: `Screen schema '${screenId}' not found.` });
      return;
    }

    const key = fieldData.key ? String(fieldData.key).trim() : `cf_${Date.now()}`;
    const newField: ScreenFieldConfig = {
      key,
      labelAr: fieldData.labelAr || 'حقل جديد',
      labelEn: fieldData.labelEn || 'New Field',
      type: fieldData.type || 'text',
      required: Boolean(fieldData.required),
      visible: fieldData.visible !== false,
      isCustom: true,
      options: Array.isArray(fieldData.options)
        ? fieldData.options
        : (fieldData.options ? String(fieldData.options).split(',').map((s: string) => s.trim()).filter(Boolean) : []),
      placeholder: fieldData.placeholder || '',
      defaultValue: fieldData.defaultValue !== undefined ? fieldData.defaultValue : '',
      helpText: fieldData.helpText || ''
    };

    const existingIdx = db.systemSettings.screenSchemas[screenId].fields.findIndex((f) => f.key === key);
    if (existingIdx !== -1) {
      db.systemSettings.screenSchemas[screenId].fields[existingIdx] = newField;
    } else {
      db.systemSettings.screenSchemas[screenId].fields.push(newField);
    }

    db.systemSettings.lastUpdatedBy = req.body.updatedBy || 'Hamada El Daley';
    db.systemSettings.lastUpdatedAt = new Date().toISOString();
    saveDb(db);

    res.status(201).json(db.systemSettings.screenSchemas[screenId]);
  });

  // Update a field configuration (label, required, visible, etc.)
  app.put('/api/admin/screens/:screenId/fields/:fieldKey', (req, res) => {
    const db = loadDb();
    const { screenId, fieldKey } = req.params;
    const updates = req.body;

    if (!db.systemSettings?.screenSchemas[screenId]) {
      res.status(404).json({ message: `Screen '${screenId}' not found.` });
      return;
    }

    const fieldIdx = db.systemSettings.screenSchemas[screenId].fields.findIndex((f) => f.key === fieldKey);
    if (fieldIdx === -1) {
      res.status(404).json({ message: `Field '${fieldKey}' not found.` });
      return;
    }

    const current = db.systemSettings.screenSchemas[screenId].fields[fieldIdx];
    db.systemSettings.screenSchemas[screenId].fields[fieldIdx] = {
      ...current,
      ...updates,
      key: current.key // keep key invariant
    };

    db.systemSettings.lastUpdatedBy = req.body.updatedBy || 'Hamada El Daley';
    db.systemSettings.lastUpdatedAt = new Date().toISOString();
    saveDb(db);

    res.json(db.systemSettings.screenSchemas[screenId].fields[fieldIdx]);
  });

  // Delete a custom field or hide a system field
  app.delete('/api/admin/screens/:screenId/fields/:fieldKey', (req, res) => {
    const db = loadDb();
    const { screenId, fieldKey } = req.params;

    if (!db.systemSettings) {
      db.systemSettings = JSON.parse(JSON.stringify(INITIAL_SYSTEM_SETTINGS));
    }
    if (!db.systemSettings.screenSchemas) {
      db.systemSettings.screenSchemas = JSON.parse(JSON.stringify(DEFAULT_SCREEN_SCHEMAS));
    }

    if (!db.systemSettings.screenSchemas[screenId]) {
      if (DEFAULT_SCREEN_SCHEMAS[screenId]) {
        db.systemSettings.screenSchemas[screenId] = JSON.parse(JSON.stringify(DEFAULT_SCREEN_SCHEMAS[screenId]));
      } else {
        res.status(404).json({ message: `Screen '${screenId}' not found.` });
        return;
      }
    }

    const fieldIdx = db.systemSettings.screenSchemas[screenId].fields.findIndex((f) => f.key === fieldKey);
    if (fieldIdx !== -1) {
      // Completely delete the whole field from the screen schema
      db.systemSettings.screenSchemas[screenId].fields.splice(fieldIdx, 1);
    }

    db.systemSettings.lastUpdatedBy = 'Hamada El Daley';
    db.systemSettings.lastUpdatedAt = new Date().toISOString();
    saveDb(db);

    res.json(db.systemSettings.screenSchemas[screenId]);
  });

  // Reset fields for a specific screen to default
  app.post('/api/admin/screens/:screenId/reset', (req, res) => {
    const db = loadDb();
    const { screenId } = req.params;

    if (!db.systemSettings) {
      db.systemSettings = JSON.parse(JSON.stringify(INITIAL_SYSTEM_SETTINGS));
    }

    if (DEFAULT_SCREEN_SCHEMAS[screenId]) {
      db.systemSettings.screenSchemas[screenId] = JSON.parse(
        JSON.stringify(DEFAULT_SCREEN_SCHEMAS[screenId])
      );
      db.systemSettings.lastUpdatedBy = 'Hamada El Daley';
      db.systemSettings.lastUpdatedAt = new Date().toISOString();
      saveDb(db);
      res.json(db.systemSettings.screenSchemas[screenId]);
    } else {
      res.status(404).json({ message: `Screen schema '${screenId}' not found.` });
    }
  });

  // ==================== ADMIN-ONLY DIRECT MICROSOFT SQL SERVER DATABASE CONNECTION ====================
  const buildMergedSqlServerConfig = (
    body: any,
    existing: SqlServerConnectionConfig
  ): SqlServerConnectionConfig => {
    const parsedFromString =
      typeof body?.connectionString === 'string' && body.connectionString.trim()
        ? parseSqlServerConnectionString(body.connectionString)
        : {};

    const incomingHostRaw = String(
      body?.host ?? parsedFromString.host ?? existing.host ?? '(localdb)\\MSSQLLocalDB'
    ).trim();
    const incomingPortRaw = body?.port ?? parsedFromString.port ?? existing.port ?? 1433;

    // Preserve LocalDB + Windows Auth if unmodified frontend submits its default placeholder host=localhost & port=3306
    const isUnmodifiedLocalDbFormSubmission =
      !parsedFromString.host &&
      body?.authMode === undefined &&
      body?.trustedConnection === undefined &&
      incomingHostRaw.toLowerCase() === 'localhost' &&
      Number(incomingPortRaw) === 3306 &&
      existing.authMode === 'windows' &&
      /^\(localdb\)/i.test(existing.host);

    const { host: nextHost, port: nextPort } = isUnmodifiedLocalDbFormSubmission
      ? { host: existing.host, port: existing.port || 1433 }
      : normalizeSqlServerTarget(incomingHostRaw || existing.host, incomingPortRaw);

    let nextDatabase =
      String(
        body?.database ?? parsedFromString.database ?? existing.database ?? 'PMO Agile'
      ).trim() || 'PMO Agile';
    if (nextDatabase === 'pmo_portfolio_db' && existing.database === 'PMO Agile') {
      nextDatabase = 'PMO Agile';
    }

    const resolvedAuthMode: 'windows' | 'sql' =
      body?.authMode === 'sql' || body?.trustedConnection === false
        ? 'sql'
        : body?.authMode === 'windows' || body?.trustedConnection === true
        ? 'windows'
        : parsedFromString.authMode !== undefined
        ? parsedFromString.authMode
        : existing.authMode === 'sql' && !/^\(localdb\)/i.test(nextHost)
        ? 'sql'
        : 'windows';

    const incomingUsername = String(
      body?.username ?? parsedFromString.username ?? existing.username ?? ''
    ).trim();
    const nextUsername =
      resolvedAuthMode === 'windows'
        ? ''
        : incomingUsername === 'Windows Authentication'
        ? ''
        : incomingUsername;

    let nextPassword = existing.password;
    if (typeof parsedFromString.password === 'string') {
      nextPassword = parsedFromString.password;
    }
    if (body?.password !== undefined && body?.password !== null && body?.password !== '__UNCHANGED__') {
      nextPassword = String(body.password);
    }

    return {
      ...existing,
      host: nextHost,
      port: nextPort,
      database: nextDatabase,
      username: nextUsername,
      password: resolvedAuthMode === 'windows' ? '' : nextPassword,
      authMode: resolvedAuthMode,
      trustedConnection: resolvedAuthMode === 'windows',
      ssl:
        body?.ssl !== undefined
          ? Boolean(body.ssl)
          : parsedFromString.ssl !== undefined
          ? Boolean(parsedFromString.ssl)
          : Boolean(existing.ssl),
      autoSync: body?.autoSync !== undefined ? Boolean(body.autoSync) : existing.autoSync !== false,
      autoCreateSchema:
        body?.autoCreateSchema !== undefined
          ? Boolean(body.autoCreateSchema)
          : existing.autoCreateSchema !== false
    };
  };

  app.get('/api/admin/database/config', async (_req, res) => {
    const cfg = loadSqlServerConfig();
    let liveStatus = null;
    if (cfg.enabled) {
      liveStatus = await testSqlServerConnection(cfg);
      if (liveStatus.connected) {
        cfg.serverVersion = liveStatus.serverVersion;
        cfg.lastError = null;
      } else {
        cfg.lastError = liveStatus.message;
      }
      saveSqlServerConfig(cfg);
    }

    res.json({
      config: toPublicSqlServerConfig(cfg),
      expectedTables: CORE_SQL_TABLES,
      liveStatus
    });
  });

  app.post('/api/admin/database/test', async (req, res) => {
    const existing = loadSqlServerConfig();
    const candidate = buildMergedSqlServerConfig(req.body, existing);
    const result = await testSqlServerConnection(candidate);
    res.status(result.connected ? 200 : 400).json(result);
  });

  app.post('/api/admin/database/connect', async (req, res) => {
    const existing = loadSqlServerConfig();
    const nextCfg = buildMergedSqlServerConfig(req.body, existing);
    const initialTest = await testSqlServerConnection(nextCfg);

    if (!initialTest.connected) {
      nextCfg.lastError = initialTest.message;
      saveSqlServerConfig(nextCfg);
      res.status(400).json({
        success: false,
        message: initialTest.message,
        testResult: initialTest,
        config: toPublicSqlServerConfig(nextCfg)
      });
      return;
    }

    try {
      const syncMode = String(req.body?.initialSyncMode || 'auto'); // 'auto' | 'push' | 'pull' | 'schema-only'
      if (!initialTest.databaseExists || nextCfg.autoCreateSchema) {
        await initializeSqlServerSchema(nextCfg);
      }

      const currentDb = loadDb();
      let rowCounts: Record<string, number> = initialTest.tableRowCounts || {};
      const remoteHasProjects = Number(initialTest.tableRowCounts?.['Projects'] || 0) > 0;

      if (syncMode === 'pull' && remoteHasProjects) {
        const pulled = await pullDbFromSqlServer(nextCfg, currentDb);
        saveDb(pulled.db, true);
        rowCounts = pulled.rowCounts;
      } else if (syncMode === 'push' || (syncMode === 'auto' && !remoteHasProjects)) {
        const pushed = await pushDbToSqlServer(nextCfg, currentDb);
        rowCounts = pushed.rowCounts;
      } else if (syncMode === 'auto' && remoteHasProjects) {
        const pulled = await pullDbFromSqlServer(nextCfg, currentDb);
        saveDb(pulled.db, true);
        rowCounts = pulled.rowCounts;
      }

      nextCfg.enabled = true;
      nextCfg.lastConnectedAt = new Date().toISOString();
      nextCfg.lastSyncAt = new Date().toISOString();
      nextCfg.serverVersion = initialTest.serverVersion;
      nextCfg.lastError = null;
      saveSqlServerConfig(nextCfg);
      syncDotnetAppsettings(nextCfg);

      const postTest = await testSqlServerConnection(nextCfg);
      res.json({
        success: true,
        message: `Connected directly to SQL Server (${nextCfg.host} / ${nextCfg.database}).`,
        config: toPublicSqlServerConfig(nextCfg),
        testResult: postTest,
        rowCounts
      });
    } catch (err: any) {
      nextCfg.lastError = err?.message || 'Failed to initialize or sync SQL Server database.';
      saveSqlServerConfig(nextCfg);
      res.status(500).json({
        success: false,
        message: nextCfg.lastError,
        config: toPublicSqlServerConfig(nextCfg)
      });
    }
  });

  app.post('/api/admin/database/disconnect', (_req, res) => {
    const cfg = loadSqlServerConfig();
    cfg.enabled = false;
    cfg.lastError = null;
    saveSqlServerConfig(cfg);
    res.json({
      success: true,
      message: 'Direct SQL Server live sync disconnected. Saved configuration remains stored.',
      config: toPublicSqlServerConfig(cfg)
    });
  });

  app.post('/api/admin/database/sync', async (req, res) => {
    const existing = loadSqlServerConfig();
    const targetCfg = req.body?.host ? buildMergedSqlServerConfig(req.body, existing) : existing;
    const action = String(req.body?.action || 'push'); // 'init-schema' | 'push' | 'pull'

    const check = await testSqlServerConnection(targetCfg);
    if (!check.connected) {
      res.status(400).json({
        success: false,
        message: check.message,
        testResult: check
      });
      return;
    }

    try {
      await initializeSqlServerSchema(targetCfg);
      const currentDb = loadDb();
      let rowCounts: Record<string, number> = {};

      if (action === 'pull') {
        const pulled = await pullDbFromSqlServer(targetCfg, currentDb);
        saveDb(pulled.db, true);
        rowCounts = pulled.rowCounts;
      } else if (action === 'push') {
        const pushed = await pushDbToSqlServer(targetCfg, currentDb);
        rowCounts = pushed.rowCounts;
      } else {
        const post = await testSqlServerConnection(targetCfg);
        rowCounts = post.tableRowCounts;
      }

      targetCfg.lastConnectedAt = new Date().toISOString();
      targetCfg.lastSyncAt = new Date().toISOString();
      targetCfg.serverVersion = check.serverVersion;
      targetCfg.lastError = null;
      saveSqlServerConfig(targetCfg);
      syncDotnetAppsettings(targetCfg);

      const postStatus = await testSqlServerConnection(targetCfg);
      res.json({
        success: true,
        action,
        message:
          action === 'pull'
            ? 'Pulled live data directly from SQL Server into NEXORA PMO.'
            : action === 'push'
            ? 'Synchronized all NEXORA PMO tables directly to SQL Server.'
            : 'SQL Server database and PMO schema verified/initialized successfully.',
        config: toPublicSqlServerConfig(targetCfg),
        testResult: postStatus,
        rowCounts
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err?.message || 'SQL Server operation failed.'
      });
    }
  });

  // ==================== PMO MANAGEMENT ENTERPRISE MODULE APIS ====================
  const getPmoEnrichedProjects = (db: DatabaseSchema, deptFilter?: number | null) => {
    let projs = db.projects;
    if (deptFilter) {
      projs = projs.filter((p) => {
        const init = db.initiatives.find((i) => i.id === p.initiativeId);
        return init && init.departmentId === deptFilter;
      });
    }

    const goalMapping: Record<number, { id: string; title: string; titleAr: string }> = {
      1: { id: 'g5', title: 'Automate Funding & Grant Lifecycle 100%', titleAr: 'أتمتة دورة حياة التمويل والمنح بنسبة 100%' },
      2: { id: 'g4', title: 'Raise Beneficiary Satisfaction Index > 90%', titleAr: 'رفع مؤشر رضا المستفيدين والشركاء إلى أكثر من 90%' },
      3: { id: 'g1', title: 'Diversify Funding Sources & Elevate Portfolio ROI', titleAr: 'تنويع مصادر التمويل ورفع العائد الاستثماري للمحافظ' },
      4: { id: 'g2', title: 'Rationalize Operational Expenditures & Credit Quality', titleAr: 'ترشيد النفقات التشغيلية وضمان الاستدامة الائتمانية' },
      5: { id: 'g6', title: 'Enforce Enterprise Governance & Risk Management', titleAr: 'تطبيق أعلى معايير الحوكمة وإدارة المخاطر المؤسسية' },
      6: { id: 'g3', title: 'Expand Support for Creative Culture Startups', titleAr: 'توسيع نطاق الدعم للشركات الناشئة في القطاع الثقافي' },
      7: { id: 'g7', title: 'Build Specialized Competencies in Investment Appraisal', titleAr: 'بناء كفاءات تخصصية في الاستثمار والتقييم الثقافي' }
    };

    const departmentArNames: Record<number, string> = {
      1: 'تقنية المعلومات والحلول الرقمية',
      2: 'الإدارة المالية والحوكمة',
      3: 'الموارد البشرية ورأس المال البشري',
      4: 'العمليات وسلاسل الإمداد',
      5: 'التسويق والشراكات المؤسسية'
    };

    const projectArNames: Record<number, string> = {
      1: 'تنفيذ بوابة المستفيد والخدمات الذاتية',
      2: 'تكامل منصة مكتب الدعم الفني وتذاكر العمليات',
      3: 'تحديث منصة معالجة البيانات وبحيرة التحليلات',
      4: 'محرك المطابقة الآلية للمطالبات المالية والفواتير',
      5: 'نشر أجهزة الباركود وتتبع الأصول في المراكز اللوجستية',
      6: 'توحيد وسوم التحليلات الرقمية وتجربة المستخدم',
      7: 'أتمتة خطط التدريب والتهيئة للموظفين الجدد'
    };

    const projectBudgets: Record<number, { allocated: number; spent: number }> = {
      1: { allocated: 4500000, spent: 2835000 },
      2: { allocated: 2200000, spent: 1320000 },
      3: { allocated: 5800000, spent: 4060000 },
      4: { allocated: 3100000, spent: 3100000 },
      5: { allocated: 6200000, spent: 3410000 },
      6: { allocated: 1500000, spent: 0 },
      7: { allocated: 1800000, spent: 180000 }
    };

    return projs.map((pr) => {
      const init = db.initiatives.find((i) => i.id === pr.initiativeId);
      const port = init ? db.portfolios.find((p) => p.id === init.portfolioId) : null;
      const dept = init ? db.departments.find((d) => d.id === init.departmentId) : null;
      const pm = db.users.find((u) => u.id === pr.projectManagerId);
      const projActivities = db.activities.filter((a) => a.projectId === pr.id);
      const parentActivities = projActivities.filter((a) => a.parentActivityId === null);
      const overdueActivities = projActivities.filter(
        (a) => a.status !== 'Completed' && a.dueDate < REFERENCE_TODAY
      );

      const plannedProgress = pr.status === 'Completed' ? 100 : (pr.id === 6 ? 20 : Math.min(100, pr.progressPercentage + (overdueActivities.length > 0 ? 14 : 5)));
      const variance = pr.progressPercentage - plannedProgress;

      // Cascading Health Alerts
      let healthStatus: 'On Track' | 'At Risk' | 'Delayed' | 'Completed' = 'On Track';
      let riskLevel: 'Low' | 'Medium' | 'High' | 'Critical' = 'Low';

      if (pr.status === 'Completed') {
        healthStatus = 'Completed';
        riskLevel = 'Low';
      } else if (overdueActivities.length >= 2 || pr.endDate < REFERENCE_TODAY || variance <= -15) {
        healthStatus = 'Delayed';
        riskLevel = 'Critical';
      } else if (overdueActivities.length === 1 || variance < -5 || pr.priority === 'Critical') {
        healthStatus = 'At Risk';
        riskLevel = 'High';
      } else if (pr.status === 'On Hold') {
        healthStatus = 'At Risk';
        riskLevel = 'Medium';
      } else {
        healthStatus = 'On Track';
        riskLevel = 'Low';
      }

      const budget = projectBudgets[pr.id] || { allocated: 3000000, spent: 1500000 };
      const goal = goalMapping[pr.id] || { id: 'g1', title: 'Strategic Goal', titleAr: 'هدف استراتيجي مؤسسي' };

      return {
        id: pr.id,
        name: pr.name,
        nameAr: pr.nameAr || projectArNames[pr.id] || pr.name,
        description: pr.description,
        descriptionAr: pr.descriptionAr || pr.description,
        departmentId: dept ? dept.id : 1,
        departmentName: dept ? dept.name : 'Information Technology',
        departmentNameAr: dept ? (dept.nameAr || departmentArNames[dept.id] || dept.name) : 'تقنية المعلومات والحلول الرقمية',
        portfolioId: port ? port.id : 1,
        portfolioName: port ? port.name : 'Digital Transformation Portfolio',
        portfolioNameAr: port ? (port.nameAr || port.name) : 'محفظة التحول الرقمي',
        initiativeId: pr.initiativeId,
        initiativeName: init ? init.name : 'Strategic Initiative',
        initiativeNameAr: init ? (init.nameAr || init.name) : 'مبادرة استراتيجية',
        strategicGoalId: goal.id,
        strategicGoalTitle: goal.title,
        strategicGoalTitleAr: goal.titleAr,
        clientOrganization: 'Cultural Development Fund',
        clientOrganizationAr: 'الصندوق الثقافي',
        projectManagerId: pr.projectManagerId,
        projectManagerName: pm ? pm.fullName : 'Marcus Sterling',
        projectManagerNameAr: pm ? (pm.fullNameAr || pm.fullName) : 'ماركوس ستيرلينغ',
        startDate: pr.startDate,
        endDate: pr.endDate,
        status: pr.status,
        healthStatus,
        riskLevel,
        priority: pr.priority,
        actualProgressPercentage: pr.progressPercentage,
        plannedProgressPercentage: plannedProgress,
        variancePercentage: variance,
        availableBudget: budget.allocated,
        spentBudget: budget.spent,
        workstreamCount: db.workstreams.filter((w) => w.projectId === pr.id).length,
        milestoneCount: db.milestones.filter((m) => m.projectId === pr.id).length,
        activityCount: parentActivities.length,
        overdueActivityCount: overdueActivities.length,
        delayFlags: overdueActivities.length + (pr.endDate < REFERENCE_TODAY && pr.status !== 'Completed' ? 1 : 0),
        isDelayed: overdueActivities.length > 0 || (pr.endDate < REFERENCE_TODAY && pr.status !== 'Completed'),
        openTasksCount: projActivities.filter((a) => a.status !== 'Completed').length,
        siteLocation: pr.id === 5 ? 'Regional Logistics Hub, Riyadh' : (pr.id === 4 ? 'Corporate HQ, Floor 4' : 'Cloud Workspace, DC-01'),
        siteLocationAr: pr.id === 5 ? 'المركز اللوجستي الإقليمي، الرياض' : (pr.id === 4 ? 'المقر الرئيسي، الطابق الرابع' : 'مركز البيانات السحابي 01'),
        siteCoordinates: pr.id === 5 ? { lat: 24.7136, lng: 46.6753 } : { lat: 24.7743, lng: 46.7386 }
      };
    });
  };

  // 1. PMO Executive Dashboard
  app.get('/api/pmo/executive-dashboard', (req, res) => {
    const db = loadDb();
    const deptFilter = req.query.departmentId ? Number(req.query.departmentId) : null;
    const enrichedProjects = getPmoEnrichedProjects(db, deptFilter);

    const totalProjects = enrichedProjects.length;
    const totalInitiatives = db.initiatives.length;
    const totalDepartments = db.departments.length;

    const actualProgressPercentage = totalProjects > 0
      ? Math.round(enrichedProjects.reduce((acc, p) => acc + p.actualProgressPercentage, 0) / totalProjects)
      : 0;
    const plannedProgressPercentage = totalProjects > 0
      ? Math.round(enrichedProjects.reduce((acc, p) => acc + p.plannedProgressPercentage, 0) / totalProjects)
      : 0;

    const delayFlagsCount = enrichedProjects.reduce((acc, p) => acc + p.delayFlags, 0);
    const overdueProjectsCount = enrichedProjects.filter((p) => p.isDelayed).length;
    const pendingApprovalsCount = db.strategicActivities.filter((a) => a.status === 'Draft').length + 2;
    const highRiskProjectsCount = enrichedProjects.filter((p) => p.riskLevel === 'High' || p.riskLevel === 'Critical').length;
    const openRisksAndIssuesRatio = `${highRiskProjectsCount + delayFlagsCount} / 12 (${Math.round(((highRiskProjectsCount + delayFlagsCount) / 12) * 100)}%)`;

    const healthDistribution = {
      onTrack: enrichedProjects.filter((p) => p.healthStatus === 'On Track').length,
      atRisk: enrichedProjects.filter((p) => p.healthStatus === 'At Risk').length,
      delayed: enrichedProjects.filter((p) => p.healthStatus === 'Delayed').length,
      completed: enrichedProjects.filter((p) => p.healthStatus === 'Completed').length
    };

    const openItemsByType = {
      milestones: db.milestones.filter((m) => m.status !== 'Completed').length,
      tasks: db.activities.filter((a) => a.status !== 'Completed').length,
      workstreams: db.workstreams.filter((w) => w.status !== 'Completed').length
    };

    const enrichedMilestones = enrichMilestones(db);
    const upcomingMilestones30Days = enrichedMilestones
      .filter((m) => m.status !== 'Completed')
      .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate))
      .slice(0, 6)
      .map((m) => ({
        id: m.id,
        name: m.name,
        nameAr: m.nameAr || m.name,
        projectName: m.projectName || 'Enterprise Project',
        projectNameAr: m.projectNameAr || m.projectName || 'مشروع مؤسسي',
        dueDate: m.plannedDate,
        ownerName: m.ownerName || 'Project Manager',
        ownerNameAr: m.ownerNameAr || m.ownerName || 'مدير المشروع',
        status: m.status,
        isDelayed: m.isDelayed
      }));

    res.json({
      kpis: {
        totalProjects,
        totalInitiatives,
        totalDepartments,
        actualProgressPercentage,
        plannedProgressPercentage,
        delayFlagsCount,
        overdueProjectsCount,
        pendingApprovalsCount,
        highRiskProjectsCount,
        openRisksAndIssuesRatio,
        healthDistribution,
        openItemsByType,
        upcomingMilestones30Days
      },
      projects: enrichedProjects
    });
  });

  // 2. Department Kanban View
  app.get('/api/pmo/department-kanban', (_req, res) => {
    const db = loadDb();
    const enrichedProjects = getPmoEnrichedProjects(db);

    const deptLeads: Record<number, { name: string; nameAr: string; role: string }> = {
      1: { name: 'Elena Vance', nameAr: 'إيلينا فانس', role: 'Chief Information Officer' },
      2: { name: 'Marcus Sterling', nameAr: 'ماركوس ستيرلينغ', role: 'Head of Financial Governance' },
      3: { name: 'Clara Chen', nameAr: 'كلارا تشين', role: 'Director of Human Capital' },
      4: { name: 'David Alverez', nameAr: 'ديفيد ألفاريز', role: 'VP of Supply Chain & Operations' },
      5: { name: 'Sophia Patel', nameAr: 'صوفيا باتيل', role: 'Chief Marketing Officer' }
    };

    const groups = db.departments.map((dept) => {
      const deptProjects = enrichedProjects.filter((p) => p.departmentId === dept.id);
      const lead = deptLeads[dept.id] || { name: 'Department Director', nameAr: 'مدير الإدارة', role: 'Director' };

      const initiativesCount = db.initiatives.filter((i) => i.departmentId === dept.id).length;
      const projectsCount = deptProjects.length;
      const workstreamsCount = deptProjects.reduce((acc, p) => acc + p.workstreamCount, 0);
      const milestonesCount = deptProjects.reduce((acc, p) => acc + p.milestoneCount, 0);
      const tasksCount = deptProjects.reduce((acc, p) => acc + p.activityCount, 0);
      const overdueItemsCount = deptProjects.reduce((acc, p) => acc + p.overdueActivityCount, 0);
      const totalBudget = deptProjects.reduce((acc, p) => acc + p.availableBudget, 0);

      const progressPercentage = deptProjects.length > 0
        ? Math.round(deptProjects.reduce((acc, p) => acc + p.actualProgressPercentage, 0) / deptProjects.length)
        : 65;

      let healthStatus: 'On Track' | 'At Risk' | 'Delayed' | 'Completed' = 'On Track';
      if (overdueItemsCount >= 2) healthStatus = 'Delayed';
      else if (overdueItemsCount === 1) healthStatus = 'At Risk';
      else if (progressPercentage === 100) healthStatus = 'Completed';

      return {
        id: dept.id,
        name: dept.name,
        nameAr: dept.nameAr || (dept.id === 1 ? 'تقنية المعلومات والحلول الرقمية'
          : dept.id === 2 ? 'الإدارة المالية والحوكمة'
          : dept.id === 3 ? 'الموارد البشرية ورأس المال البشري'
          : dept.id === 4 ? 'العمليات وسلاسل الإمداد'
          : 'التسويق والشراكات المؤسسية'),
        code: `DEPT-0${dept.id}`,
        leadName: lead.name,
        leadNameAr: lead.nameAr,
        leadRole: lead.role,
        healthStatus,
        progressPercentage,
        metrics: {
          initiativesCount,
          projectsCount,
          milestonesCount,
          tasksCount,
          workstreamsCount,
          overdueItemsCount
        },
        totalBudget,
        allocatedProjects: deptProjects
      };
    });

    res.json(groups);
  });

  // 3. Single-Page Projects & High-Risk Initiatives
  app.get('/api/pmo/single-page-projects', (_req, res) => {
    const db = loadDb();
    const enrichedProjects = getPmoEnrichedProjects(db);
    res.json(enrichedProjects);
  });

  app.get('/api/pmo/high-risk-initiatives', (_req, res) => {
    const db = loadDb();
    const enrichedProjects = getPmoEnrichedProjects(db);

    const enrichedInits = db.initiatives.map((init) => {
      const linkedProjects = enrichedProjects.filter((p) => p.initiativeId === init.id);
      const port = db.portfolios.find((p) => p.id === init.portfolioId);
      const dept = db.departments.find((d) => d.id === init.departmentId);

      const totalBudget = linkedProjects.reduce((acc, p) => acc + p.availableBudget, 0) || 5000000;
      const spentBudget = linkedProjects.reduce((acc, p) => acc + p.spentBudget, 0) || 3000000;
      const overdueTasksCount = linkedProjects.reduce((acc, p) => acc + p.overdueActivityCount, 0);
      const delayFlagsCount = linkedProjects.reduce((acc, p) => acc + p.delayFlags, 0);

      // Cascading rollup progress
      const actualProgress = linkedProjects.length > 0
        ? Math.round(linkedProjects.reduce((acc, p) => acc + p.actualProgressPercentage, 0) / linkedProjects.length)
        : init.progressPercentage;
      const plannedProgress = Math.min(100, actualProgress + (overdueTasksCount > 0 ? 12 : 5));
      const variance = actualProgress - plannedProgress;

      let healthStatus: 'On Track' | 'At Risk' | 'Delayed' | 'Completed' = 'On Track';
      let riskLevel: 'Low' | 'Medium' | 'High' | 'Critical' = 'Low';

      if (delayFlagsCount >= 2 || variance <= -12) {
        healthStatus = 'Delayed';
        riskLevel = 'Critical';
      } else if (delayFlagsCount === 1 || variance < -5) {
        healthStatus = 'At Risk';
        riskLevel = 'High';
      } else {
        healthStatus = 'On Track';
        riskLevel = 'Low';
      }

      const initArNames: Record<number, string> = {
        1: 'مبادرة الخدمات الذاتية الرقمية للمستفيدين',
        2: 'مبادرة ترحيل وتحديث البنية السحابية',
        3: 'مبادرة الرقابة المالية وأتمتة الخزينة',
        4: 'مبادرة المستودعات الذكية وتتبع المخزون',
        5: 'مبادرة تحليلات تجربة العميل وهوية العلامة',
        6: 'أكاديمية القيادة وتطوير الكفاءات المؤسسية'
      };

      return {
        id: init.id,
        name: init.name,
        nameAr: init.nameAr || initArNames[init.id] || init.name,
        description: init.description,
        descriptionAr: init.descriptionAr || init.description,
        departmentId: init.departmentId,
        departmentName: dept ? dept.name : 'Information Technology',
        departmentNameAr: dept ? (dept.nameAr || dept.name) : 'تقنية المعلومات والحلول الرقمية',
        portfolioId: init.portfolioId,
        portfolioName: port ? port.name : 'Digital Transformation',
        portfolioNameAr: port ? (port.nameAr || port.name) : 'محفظة التحول الرقمي',
        strategicGoalId: linkedProjects[0]?.strategicGoalId || 'g1',
        strategicGoalTitle: linkedProjects[0]?.strategicGoalTitle || 'Strategic Goal',
        strategicGoalTitleAr: linkedProjects[0]?.strategicGoalTitleAr || 'هدف استراتيجي مؤسسي',
        clientOrganization: 'Cultural Development Fund',
        clientOrganizationAr: 'الصندوق الثقافي',
        startDate: init.startDate,
        targetDate: init.targetDate,
        status: init.status,
        priority: init.priority,
        actualProgressPercentage: actualProgress,
        plannedProgressPercentage: plannedProgress,
        variancePercentage: variance,
        totalBudget,
        spentBudget,
        healthStatus,
        riskLevel,
        linkedProjectsCount: linkedProjects.length,
        overdueTasksCount,
        delayFlagsCount
      };
    });

    res.json(enrichedInits);
  });

  // 4. Master Tasks & Workstreams Management
  app.get('/api/pmo/master-tasks', (_req, res) => {
    const db = loadDb();
    const enrichedProjects = getPmoEnrichedProjects(db);

    const items: any[] = [];

    // Add Workstreams as Master Tasks
    db.workstreams.forEach((ws) => {
      const proj = enrichedProjects.find((p) => p.id === ws.projectId);
      const owner = db.users.find((u) => u.id === (ws.ownerId || 2));
      const isOverdue = ws.status !== 'Completed' && ws.endDate < REFERENCE_TODAY;
      const planned = ws.status === 'Completed' ? 100 : Math.min(100, ws.progressPercentage + (isOverdue ? 20 : 5));
      const variance = ws.progressPercentage - planned;

      items.push({
        id: ws.id,
        uniqueKey: `ws-${ws.id}`,
        title: ws.name,
        titleAr: ws.nameAr || ws.name,
        description: ws.description,
        descriptionAr: ws.descriptionAr || ws.description,
        itemType: 'Workstream',
        projectId: ws.projectId,
        projectName: proj ? proj.name : 'Project',
        projectNameAr: proj ? proj.nameAr : 'المشروع',
        departmentId: proj ? proj.departmentId : 1,
        departmentName: proj ? proj.departmentName : 'IT',
        departmentNameAr: proj ? proj.departmentNameAr : 'تقنية المعلومات',
        assigneeId: ws.ownerId || 2,
        assigneeName: owner ? owner.fullName : 'Marcus Sterling',
        assigneeNameAr: owner ? (owner.fullNameAr || owner.fullName) : 'ماركوس ستيرلينغ',
        startDate: ws.startDate,
        dueDate: ws.endDate,
        plannedProgress: planned,
        actualProgress: ws.progressPercentage,
        variancePercentage: variance,
        baselineHealth: variance >= 0 ? 'Ahead' : (variance > -10 ? 'On Track' : 'Behind'),
        approvalStatus: 'Approved',
        priorityStars: 3,
        isStarred: ws.id === 1 || ws.id === 3,
        stage: ws.status === 'Completed' ? 'Completed' : (ws.progressPercentage > 50 ? 'Execution' : 'Planning'),
        nextActivityReminder: isOverdue ? 'Overdue milestone check needed' : 'Deliverable review scheduled',
        nextActivityReminderAr: isOverdue ? 'مطلوب فحص المعلم المتأخر' : 'تمت جدولة مراجعة المخرجات',
        locationName: 'HQ Digital Office',
        locationNameAr: 'المقر الرئيسي - المكتب الرقمي',
        coordinates: { lat: 24.7136, lng: 46.6753 }
      });
    });

    // Add Milestones as Master Tasks
    db.milestones.forEach((ms) => {
      const proj = enrichedProjects.find((p) => p.id === ms.projectId);
      const owner = db.users.find((u) => u.id === (ms.ownerId || 3));
      const isOverdue = ms.status !== 'Completed' && ms.plannedDate < REFERENCE_TODAY;
      const planned = ms.status === 'Completed' ? 100 : (isOverdue ? 100 : 70);
      const actual = ms.status === 'Completed' ? 100 : (ms.status === 'In Progress' ? 50 : 0);
      const variance = actual - planned;

      items.push({
        id: ms.id,
        uniqueKey: `ms-${ms.id}`,
        title: ms.name,
        titleAr: ms.nameAr || ms.name,
        description: ms.description,
        descriptionAr: ms.descriptionAr || ms.description,
        itemType: 'Milestone',
        projectId: ms.projectId,
        projectName: proj ? proj.name : 'Project',
        projectNameAr: proj ? proj.nameAr : 'المشروع',
        departmentId: proj ? proj.departmentId : 1,
        departmentName: proj ? proj.departmentName : 'IT',
        departmentNameAr: proj ? proj.departmentNameAr : 'تقنية المعلومات',
        assigneeId: ms.ownerId || 3,
        assigneeName: owner ? owner.fullName : 'Clara Chen',
        assigneeNameAr: owner ? (owner.fullNameAr || owner.fullName) : 'كلارا تشين',
        startDate: '2026-02-01',
        dueDate: ms.plannedDate,
        plannedProgress: planned,
        actualProgress: actual,
        variancePercentage: variance,
        baselineHealth: ms.status === 'Completed' ? 'Ahead' : (isOverdue ? 'Critical Delay' : 'On Track'),
        approvalStatus: ms.status === 'Completed' ? 'Approved' : 'Pending Review',
        priorityStars: 2,
        isStarred: ms.id === 2,
        stage: ms.status === 'Completed' ? 'Completed' : 'Review',
        nextActivityReminder: isOverdue ? 'Escalate gate review' : 'Prepare sign-off documents',
        nextActivityReminderAr: isOverdue ? 'تصعيد مراجعة البوابة' : 'تجهيز مستندات الاعتماد',
        locationName: 'Steering Committee Chamber',
        locationNameAr: 'قاعة اللجنة التوجيهية',
        coordinates: { lat: 24.7743, lng: 46.7386 }
      });
    });

    // Add Activities as Master Tasks
    db.activities.forEach((act) => {
      const proj = enrichedProjects.find((p) => p.id === act.projectId);
      const owner = db.users.find((u) => u.id === (act.assignedUserId || 4));
      const isOverdue = act.status !== 'Completed' && act.dueDate < REFERENCE_TODAY;
      const planned = act.status === 'Completed' ? 100 : Math.min(100, act.progressPercentage + (isOverdue ? 25 : 5));
      const variance = act.progressPercentage - planned;

      items.push({
        id: act.id,
        uniqueKey: `act-${act.id}`,
        title: act.name,
        titleAr: act.nameAr || act.name,
        description: act.description,
        descriptionAr: act.descriptionAr || act.description,
        itemType: 'Activity',
        projectId: act.projectId,
        projectName: proj ? proj.name : 'Project',
        projectNameAr: proj ? proj.nameAr : 'المشروع',
        departmentId: proj ? proj.departmentId : 1,
        departmentName: proj ? proj.departmentName : 'IT',
        departmentNameAr: proj ? proj.departmentNameAr : 'تقنية المعلومات',
        assigneeId: act.assignedUserId || 4,
        assigneeName: owner ? owner.fullName : 'David Alverez',
        assigneeNameAr: owner ? (owner.fullNameAr || owner.fullName) : 'ديفيد ألفاريز',
        startDate: act.startDate,
        dueDate: act.dueDate,
        plannedProgress: planned,
        actualProgress: act.progressPercentage,
        variancePercentage: variance,
        baselineHealth: variance >= 0 ? 'Ahead' : (variance > -10 ? 'On Track' : 'Behind'),
        approvalStatus: act.status === 'Completed' ? 'Approved' : 'Draft',
        priorityStars: act.priority === 'Critical' ? 3 : (act.priority === 'High' ? 2 : 1),
        isStarred: act.id === 1 || act.id === 5,
        stage: act.status === 'Completed' ? 'Completed' : 'Execution',
        nextActivityReminder: isOverdue ? 'Overdue reminder sent' : 'Next sprint checkpoint',
        nextActivityReminderAr: isOverdue ? 'تم إرسال تنبيه التأخر' : 'نقطة التحقق التالية للمرحلة',
        locationName: 'Development Lab B',
        locationNameAr: 'مختبر التطوير ب',
        coordinates: { lat: 24.7200, lng: 46.6800 }
      });
    });

    res.json(items);
  });

  // 5. Export PowerPoint Presentation API
  app.post('/api/pmo/export-ppt', (req, res) => {
    const db = loadDb();
    const enrichedProjects = getPmoEnrichedProjects(db);
    const reqLang: 'en' | 'ar' = req.body?.lang === 'ar' || req.query.lang === 'ar' ? 'ar' : 'en';

    const slides =
      reqLang === 'ar'
        ? [
            {
              slideNumber: 1,
              title: 'الإيجاز التنفيذي ومراجعة المحفظة الاستراتيجية لمكتب إدارة المشاريع',
              subtitle: 'الصندوق الثقافي · تقرير الأداء الربعي ومؤشرات الصحة العامة',
              date: new Date().toLocaleDateString('ar-SA'),
              presentedBy: 'مكتب إدارة المشاريع · حمادة الدالي'
            },
            {
              slideNumber: 2,
              title: 'ملخص مؤشرات الأداء التنفيذية وحالة الصحة العامة',
              kpis: [
                { label: 'إجمالي المشاريع المؤسسية', value: enrichedProjects.length },
                { label: 'المبادرات النشطة', value: db.initiatives.length },
                { label: 'متوسط التقدم الفعلي', value: '58%' },
                { label: 'مستهدف التقدم المخطط', value: '66%' },
                { label: 'تنبيهات التأخير النشطة', value: '4 تنبيهات' }
              ]
            },
            {
              slideNumber: 3,
              title: 'تحليل المخاطر المتسلسل وتفاصيل المشاريع عالية المخاطر',
              criticalProjects: enrichedProjects
                .filter((p) => p.riskLevel === 'Critical' || p.riskLevel === 'High')
                .map((p) => ({
                  name: p.nameAr || p.name,
                  department: p.departmentNameAr || p.departmentName,
                  status: p.healthStatus === 'Delayed' ? 'متأخر' : p.healthStatus === 'At Risk' ? 'معرض للخطر' : 'على المسار',
                  variance: `${p.variancePercentage}%`,
                  delayCause: p.isDelayed ? 'معلم تسليم متأخر في دورة التنفيذ' : 'اختناق في الموارد'
                }))
            },
            {
              slideNumber: 4,
              title: 'الربط العلائقي بين الأهداف الاستراتيجية ومشاريع المكتب والأثر المتوقع',
              strategicLinkages: enrichedProjects.slice(0, 4).map((p) => ({
                project: p.nameAr || p.name,
                goal: p.strategicGoalTitleAr || p.strategicGoalTitle,
                budgetAllocated: `${(p.availableBudget / 1000000).toFixed(1)} مليون ريال`,
                health: p.healthStatus === 'Completed' ? 'مكتمل' : p.healthStatus === 'Delayed' ? 'متأخر' : p.healthStatus === 'At Risk' ? 'معرض للخطر' : 'على المسار'
              }))
            }
          ]
        : [
            {
              slideNumber: 1,
              title: 'Enterprise PMO Executive Briefing & Strategic Portfolio Review',
              subtitle: 'Cultural Development Fund · Quarterly Delivery Performance & Health Report',
              date: new Date().toLocaleDateString('en-US'),
              presentedBy: 'PMO Management Office · Hamada El Daley'
            },
            {
              slideNumber: 2,
              title: 'Executive KPI Summary & High-Level Health Status',
              kpis: [
                { label: 'Total Enterprise Projects', value: enrichedProjects.length },
                { label: 'Active Initiatives', value: db.initiatives.length },
                { label: 'Overall Actual Progress', value: '58%' },
                { label: 'Planned Progress Target', value: '66%' },
                { label: 'Active Delay Flags', value: '4 Flags' }
              ]
            },
            {
              slideNumber: 3,
              title: 'Cascading Risk Analysis & High-Risk Portfolio Breakdown',
              criticalProjects: enrichedProjects
                .filter((p) => p.riskLevel === 'Critical' || p.riskLevel === 'High')
                .map((p) => ({
                  name: p.name,
                  department: p.departmentName,
                  status: p.healthStatus,
                  variance: `${p.variancePercentage}%`,
                  delayCause: p.isDelayed ? 'Overdue delivery milestone in execution cycle' : 'Resource bottleneck'
                }))
            },
            {
              slideNumber: 4,
              title: 'Strategic Goals ➔ PMO Project Relational Mapping & Impact',
              strategicLinkages: enrichedProjects.slice(0, 4).map((p) => ({
                project: p.name,
                goal: p.strategicGoalTitle,
                budgetAllocated: `${(p.availableBudget / 1000000).toFixed(1)}M SAR`,
                health: p.healthStatus
              }))
            }
          ];

    res.json({
      success: true,
      filename: `${reqLang === 'ar' ? 'العرض_التنفيذي_لمكتب_المشاريع' : 'PMO_Executive_Presentation'}_${new Date().toISOString().slice(0, 10)}.pptx`,
      slidesCount: slides.length,
      slides
    });
  });

  // ==================== SWAGGER / OPENAPI DOCUMENTATION ====================
  const sendSwaggerSpec = (req: express.Request, res: express.Response) => {
    const forwardedProto = req.headers['x-forwarded-proto'];
    const protocol =
      typeof forwardedProto === 'string' && forwardedProto.trim()
        ? forwardedProto.split(',')[0].trim()
        : req.protocol || 'http';
    const host = req.get('host') || `localhost:${PORT}`;
    res.json(buildOpenApiSpec(`${protocol}://${host}`));
  };

  app.get('/swagger/v1/swagger.json', sendSwaggerSpec);
  app.get('/api-docs.json', sendSwaggerSpec);
  app.get('/api-docs', (_req, res) => {
    res.redirect('/swagger');
  });

  app.use(
    '/swagger',
    swaggerUi.serve,
    swaggerUi.setup(null, {
      explorer: true,
      swaggerOptions: {
        url: '/swagger/v1/swagger.json',
        persistAuthorization: true,
        docExpansion: 'list',
        displayRequestDuration: true
      },
      customSiteTitle: 'NEXORA PMO — Swagger API'
    })
  );

  // ==================== VITE MIDDLEWARE ====================

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NEXORA PMO running on http://localhost:${PORT}`);
    console.log(`Swagger API UI running on http://localhost:${PORT}/swagger`);
    console.log(`OpenAPI JSON spec running on http://localhost:${PORT}/swagger/v1/swagger.json`);
  });
}

startServer();
