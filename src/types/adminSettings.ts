export type FieldInputType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'boolean';

export interface ScreenFieldConfig {
  key: string;
  labelAr: string;
  labelEn: string;
  type: FieldInputType;
  required: boolean;
  visible: boolean; // if false, field is hidden from forms and views
  isCustom?: boolean; // if true, was added by admin
  options?: string[]; // for select
  optionsEn?: string[];
  placeholder?: string;
  placeholderEn?: string;
  defaultValue?: any;
  defaultValueEn?: any;
  helpText?: string;
}

export interface ScreenSchemaConfig {
  screenId: string;
  nameAr: string;
  nameEn: string;
  category: 'strategic' | 'pmo';
  fields: ScreenFieldConfig[];
}

export interface ScreenVisibilityItem {
  id: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  visible: boolean;
  category: 'core' | 'strategic' | 'registry';
  adminOnly?: boolean;
}

export interface AdminSystemSettings {
  menuVisibility: Record<string, boolean>;
  screenRolePermissions?: Record<string, string[]>;
  screenLabels: Record<string, { ar: string; en: string }>;
  screenSchemas: Record<string, ScreenSchemaConfig>;
  lastUpdatedBy?: string;
  lastUpdatedAt?: string;
}

export const DEFAULT_SYSTEM_ROLES = [
  'PMO Manager',
  'Project Manager',
  'Team Member'
] as const;

export const DEFAULT_SCREEN_VISIBILITY: ScreenVisibilityItem[] = [
  {
    id: 'strategic-planning',
    nameAr: 'التخطيط الاستراتيجي',
    nameEn: 'Strategic Planning',
    descriptionAr: 'الخطط الاستراتيجية، المبادرات والبرامج، والأنشطة وسجل المتابعة',
    descriptionEn: 'Strategic plans, initiatives & programs, activities with chatter',
    visible: true,
    category: 'strategic'
  },
  {
    id: 'pmo-management',
    nameAr: 'إدارة مكتب المشاريع',
    nameEn: 'PMO Management',
    descriptionAr: 'لوحة القيادة التنفيذية، كانبان الإدارات، المشاريع والمبادرات الحرجة، ومسارات العمل',
    descriptionEn: 'Executive dashboard, department kanban, high-risk projects & initiatives, master workstreams',
    visible: true,
    category: 'core'
  },
  {
    id: 'pmo-dashboard',
    nameAr: 'لوحة تحكم مكتب المشاريع',
    nameEn: 'PMO Dashboard',
    descriptionAr: 'ملخص الأداء التنفيذي ومؤشرات المحافظ والمشاريع والأنشطة المتأخرة',
    descriptionEn: 'Executive portfolio & project KPI summary and overdue telemetry',
    visible: true,
    category: 'core'
  },
  {
    id: 'progress-tracking',
    nameAr: 'تتبع الإنجاز',
    nameEn: 'Progress Tracking',
    descriptionAr: 'مراقبة نسب الإنجاز على مستوى المبادرات والمشاريع التنفيذية',
    descriptionEn: 'Initiative and project completion progress monitoring',
    visible: true,
    category: 'core'
  },
  {
    id: 'overdue-activities',
    nameAr: 'الأنشطة المتأخرة',
    nameEn: 'Overdue Activities',
    descriptionAr: 'رصد الأنشطة المتأخرة عن مواعيد استحقاقها وإجراءات المعالجة',
    descriptionEn: 'Identify past-due activities and escalate recovery actions',
    visible: true,
    category: 'core'
  },
  {
    id: 'activity-search',
    nameAr: 'البحث عن الأنشطة',
    nameEn: 'Activity Search',
    descriptionAr: 'البحث المتقدم والتصفية عبر كافة أنشطة المشاريع والمكلفين',
    descriptionEn: 'Cross-project activity search, filtering, and quick inspection',
    visible: true,
    category: 'core'
  },
  {
    id: 'departments',
    nameAr: '01. الإدارات',
    nameEn: '01. Departments',
    descriptionAr: 'هيكل الإدارات التنظيمية في المؤسسة',
    descriptionEn: 'Organizational departments structure',
    visible: true,
    category: 'registry'
  },
  {
    id: 'portfolios',
    nameAr: '02. محافظ الأعمال',
    nameEn: '02. Portfolios',
    descriptionAr: 'محافظ الأعمال والمشاريع المؤسسية',
    descriptionEn: 'Enterprise business & program portfolios',
    visible: true,
    category: 'registry'
  },
  {
    id: 'initiatives',
    nameAr: '03. المبادرات',
    nameEn: '03. Initiatives',
    descriptionAr: 'مبادرات مكتب إدارة المشاريع',
    descriptionEn: 'PMO Strategic Initiatives registry',
    visible: true,
    category: 'registry'
  },
  {
    id: 'projects',
    nameAr: '04. المشاريع',
    nameEn: '04. Projects',
    descriptionAr: 'المشاريع التنفيذية وجداولها الزمنية والميزانيات',
    descriptionEn: 'Execution projects, budgets and timelines',
    visible: true,
    category: 'registry'
  },
  {
    id: 'project-workspace',
    nameAr: 'مساحة عمل المشروع',
    nameEn: 'Project Workspace',
    descriptionAr: 'مساحة العمل المتكاملة للمشاريع (هيكل تقسيم العمل، كانبان، المعالم، المخاطر، التقارير)',
    descriptionEn: 'Project Workspace (WBS, Kanban, Milestones, Risks, Reports)',
    visible: true,
    category: 'core'
  },
  {
    id: 'dashboard',
    nameAr: 'لوحة القيادة والمؤشرات',
    nameEn: 'Executive Dashboard',
    descriptionAr: 'مؤشرات الأداء الرئيسية والرسوم البيانية والحالة العامة للمشاريع',
    descriptionEn: 'Executive KPI analytics, progress gauges, and portfolio status',
    visible: true,
    category: 'core'
  },
  {
    id: 'hierarchy',
    nameAr: 'شجرة الهيكل التنظيمي',
    nameEn: 'Hierarchy Explorer',
    descriptionAr: 'مستكشف العلاقات الهرمية من الإدارة إلى المهام الفرعية',
    descriptionEn: 'Interactive tree from departments down to subtasks',
    visible: true,
    category: 'core'
  },
  {
    id: 'workstreams',
    nameAr: '05. مسارات العمل',
    nameEn: '05. Workstreams',
    descriptionAr: 'مسارات العمل والفرق المسؤولة',
    descriptionEn: 'Execution workstreams and tracks',
    visible: false,
    category: 'registry'
  },
  {
    id: 'milestones',
    nameAr: '06. المعالم الرئيسية',
    nameEn: '06. Milestones',
    descriptionAr: 'المعالم والمحطات الزمنية الحرجة',
    descriptionEn: 'Critical project milestones and delivery gates',
    visible: false,
    category: 'registry'
  },
  {
    id: 'activities',
    nameAr: '07. إدارة الأنشطة',
    nameEn: '07. Activities',
    descriptionAr: 'سجل الأنشطة والمهام المرتبطة بالمشاريع وتكليفاتها وحالاتها',
    descriptionEn: 'Project activities, assignments, statuses, and delivery dates',
    visible: true,
    category: 'registry'
  },
  {
    id: 'users',
    nameAr: '08. المستخدمون والأدوار',
    nameEn: '08. Users & Roles',
    descriptionAr: 'إدارة حسابات المستخدمين وتعيين الأدوار والصلاحيات وتفعيل الحسابات',
    descriptionEn: 'Manage user accounts, role assignments, and account activation status',
    visible: true,
    category: 'core',
    adminOnly: true
  },
  {
    id: 'scheduling',
    nameAr: '09. جدولة المشاريع',
    nameEn: '09. Project Scheduling',
    descriptionAr: 'تخطيط الجداول الزمنية للمشاريع وترتيب الأنشطة والتحقق من تعارض التواريخ',
    descriptionEn: 'Project timelines, chronological activity schedules, and date validation',
    visible: true,
    category: 'core'
  }
];

export const DEFAULT_SCREEN_ROLE_PERMISSIONS: Record<string, string[]> =
  DEFAULT_SCREEN_VISIBILITY.reduce((acc, item) => {
    if (!item.adminOnly) {
      acc[item.id] = [...DEFAULT_SYSTEM_ROLES];
    }
    return acc;
  }, {} as Record<string, string[]>);

export const DEFAULT_SCREEN_SCHEMAS: Record<string, ScreenSchemaConfig> = {
  'strategic-plans': {
    screenId: 'strategic-plans',
    nameAr: 'الخطط الاستراتيجية',
    nameEn: 'Strategic Plans',
    category: 'strategic',
    fields: [
      { key: 'titleAr', labelAr: 'اسم الخطة الاستراتيجية', labelEn: 'Strategic Plan Title', type: 'text', required: true, visible: true },
      { key: 'titleEn', labelAr: 'اسم الخطة بالإنجليزية', labelEn: 'Secondary Plan Title', type: 'text', required: false, visible: true },
      { key: 'cycle', labelAr: 'الدورة الزمنية', labelEn: 'Cycle / Period', type: 'select', required: true, visible: true, options: ['2024 - 2026', '2025 - 2027', '2026 - 2030', '2030 - 2035'] },
      { key: 'yearsRange', labelAr: 'السنوات المشمولة', labelEn: 'Years Range', type: 'text', required: true, visible: true },
      {
        key: 'planType',
        labelAr: 'نوع الخطة',
        labelEn: 'Plan Type',
        type: 'select',
        required: true,
        visible: true,
        options: ['خطة خمسية استراتيجية', 'خطة ثلاثية متوسطة المدى', 'خطة تحول سنوية', 'خطة طوارئ واستجابة'],
        optionsEn: ['Five-Year Strategic Plan', 'Three-Year Medium-Term Plan', 'Annual Transformation Plan', 'Emergency & Response Plan']
      },
      { key: 'vision', labelAr: 'الرؤية', labelEn: 'Vision', type: 'textarea', required: false, visible: true },
      { key: 'mission', labelAr: 'الرسالة', labelEn: 'Mission', type: 'textarea', required: false, visible: true },
      { key: 'description', labelAr: 'الوصف والملخص التنفيذي', labelEn: 'Description & Executive Summary', type: 'textarea', required: false, visible: true },
      { key: 'strategicIssues', labelAr: 'القضايا الاستراتيجية', labelEn: 'Strategic Issues', type: 'text', required: false, visible: true },
      { key: 'values', labelAr: 'القيم المؤسسية', labelEn: 'Institutional Values', type: 'text', required: false, visible: true }
    ]
  },
  'strategic-initiatives': {
    screenId: 'strategic-initiatives',
    nameAr: 'المبادرات والبرامج',
    nameEn: 'Initiatives & Programs',
    category: 'strategic',
    fields: [
      { key: 'title', labelAr: 'إسم المبادرة / البرنامج', labelEn: 'Initiative Title', type: 'text', required: true, visible: true },
      { key: 'domains', labelAr: 'المجالات', labelEn: 'Domains / Sectors', type: 'text', required: false, visible: true },
      { key: 'planId', labelAr: 'الخطة الإستراتيجية المرتبطة', labelEn: 'Linked Strategic Plan', type: 'select', required: true, visible: true },
      { key: 'departmentId', labelAr: 'الإدارة المسؤولة', labelEn: 'Department', type: 'select', required: true, visible: true },
      { key: 'section', labelAr: 'القسم / الوحدة', labelEn: 'Section / Division', type: 'text', required: false, visible: true },
      { key: 'planType', labelAr: 'نوع الخطة', labelEn: 'Plan Type', type: 'text', required: false, visible: true },
      { key: 'indicator', labelAr: 'مؤشر الأداء', labelEn: 'KPI Indicator', type: 'text', required: false, visible: true },
      { key: 'goalId', labelAr: 'الهدف الاستراتيجي', labelEn: 'Strategic Goal', type: 'select', required: true, visible: true },
      { key: 'organizationUnit', labelAr: 'المنظمة / الكيان', labelEn: 'Organization Unit', type: 'text', required: false, visible: true, defaultValue: 'الصندوق الثقافي', defaultValueEn: 'Cultural Development Fund' },
      { key: 'cycle', labelAr: 'الدورة', labelEn: 'Cycle', type: 'text', required: false, visible: true },
      { key: 'startDate', labelAr: 'تاريخ البدء', labelEn: 'Start Date', type: 'date', required: false, visible: true },
      { key: 'endDate', labelAr: 'تاريخ الانتهاء', labelEn: 'End Date', type: 'date', required: false, visible: true }
    ]
  },
  'strategic-activities': {
    screenId: 'strategic-activities',
    nameAr: 'الأنشطة الاستراتيجية',
    nameEn: 'Strategic Activities',
    category: 'strategic',
    fields: [
      { key: 'name', labelAr: 'النشاط', labelEn: 'Activity Name', type: 'text', required: true, visible: true },
      { key: 'source', labelAr: 'المصدر', labelEn: 'Source', type: 'text', required: false, visible: true, defaultValue: 'أساس', defaultValueEn: 'Base System' },
      { key: 'domains', labelAr: 'المجالات', labelEn: 'Domains', type: 'text', required: false, visible: true },
      { key: 'indicator', labelAr: 'المؤشر المرتبط', labelEn: 'KPI Indicator', type: 'text', required: false, visible: true },
      { key: 'initiativeId', labelAr: 'البرامج / المبادرة', labelEn: 'Parent Program / Initiative', type: 'select', required: true, visible: true },
      { key: 'departmentId', labelAr: 'الإدارة', labelEn: 'Department', type: 'select', required: true, visible: true },
      { key: 'section', labelAr: 'القسم', labelEn: 'Section', type: 'text', required: false, visible: true },
      { key: 'startDate', labelAr: 'تاريخ البدء', labelEn: 'Start Date', type: 'date', required: false, visible: true },
      { key: 'endDate', labelAr: 'تاريخ الانتهاء', labelEn: 'End Date', type: 'date', required: false, visible: true },
      { key: 'targetValue', labelAr: 'مستهدف المؤشر', labelEn: 'Indicator Target Value', type: 'number', required: false, visible: true, defaultValue: 0 },
      { key: 'activityValue', labelAr: 'قيمة النشاط والميزانية', labelEn: 'Activity Budget (SAR)', type: 'number', required: false, visible: true, defaultValue: 0 },
      { key: 'isDevelopmentalProject', labelAr: 'مشروع تنموي', labelEn: 'Developmental Project Flag', type: 'boolean', required: false, visible: true, defaultValue: false },
      { key: 'isExecutiveBodyActivity', labelAr: 'نشاط الهيئة التنفيذية', labelEn: 'Executive Body Activity Flag', type: 'boolean', required: false, visible: true, defaultValue: false }
    ]
  },
  'projects': {
    screenId: 'projects',
    nameAr: 'المشاريع التنفيذية',
    nameEn: 'Projects',
    category: 'pmo',
    fields: [
      { key: 'name', labelAr: 'اسم المشروع', labelEn: 'Project Name', type: 'text', required: true, visible: true },
      { key: 'description', labelAr: 'وصف المشروع ونطاق العمل', labelEn: 'Description & Scope', type: 'textarea', required: false, visible: true },
      { key: 'departmentId', labelAr: 'الإدارة التابعة', labelEn: 'Department', type: 'select', required: true, visible: true },
      { key: 'portfolioId', labelAr: 'محفظة الأعمال', labelEn: 'Portfolio', type: 'select', required: true, visible: true },
      { key: 'initiativeId', labelAr: 'المبادرة الاستراتيجية', labelEn: 'Initiative', type: 'select', required: true, visible: true },
      { key: 'startDate', labelAr: 'تاريخ البداية المخطط', labelEn: 'Planned Start Date', type: 'date', required: true, visible: true },
      { key: 'endDate', labelAr: 'تاريخ النهاية المخطط', labelEn: 'Planned End Date', type: 'date', required: true, visible: true },
      { key: 'status', labelAr: 'حالة المشروع', labelEn: 'Project Status', type: 'select', required: true, visible: true, options: ['Draft', 'Active', 'In Progress', 'Completed', 'On Hold', 'Cancelled'] },
      { key: 'priority', labelAr: 'الأولوية', labelEn: 'Priority', type: 'select', required: true, visible: true, options: ['Low', 'Medium', 'High', 'Critical'] },
      { key: 'budget', labelAr: 'الميزانية المعتمدة', labelEn: 'Allocated Budget (SAR)', type: 'number', required: false, visible: true }
    ]
  },
  'portfolios': {
    screenId: 'portfolios',
    nameAr: 'محافظ الأعمال',
    nameEn: 'Portfolios',
    category: 'pmo',
    fields: [
      { key: 'name', labelAr: 'اسم المحفظة', labelEn: 'Portfolio Name', type: 'text', required: true, visible: true },
      { key: 'description', labelAr: 'وصف وأهداف المحفظة', labelEn: 'Description', type: 'textarea', required: false, visible: true },
      { key: 'departmentId', labelAr: 'الإدارة المسؤولة', labelEn: 'Department', type: 'select', required: true, visible: true },
      { key: 'startDate', labelAr: 'تاريخ الانطلاق', labelEn: 'Start Date', type: 'date', required: true, visible: true },
      { key: 'endDate', labelAr: 'تاريخ الإغلاق', labelEn: 'End Date', type: 'date', required: true, visible: true },
      { key: 'status', labelAr: 'الحالة', labelEn: 'Status', type: 'select', required: true, visible: true, options: ['Active', 'Draft', 'Archived'] }
    ]
  },
  'departments': {
    screenId: 'departments',
    nameAr: 'الإدارات التنظيمية',
    nameEn: 'Departments',
    category: 'pmo',
    fields: [
      { key: 'name', labelAr: 'اسم الإدارة', labelEn: 'Department Name', type: 'text', required: true, visible: true },
      { key: 'description', labelAr: 'الوصف والمهام الرئيسية', labelEn: 'Description & Mandate', type: 'textarea', required: false, visible: true }
    ]
  }
};
