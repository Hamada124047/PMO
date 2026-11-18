export type Language = 'en' | 'ar';

export const translations = {
  en: {
    // Brand & Auth
    brandTitle: 'NEXORA PMO',
    systemSubtitle: 'Enterprise Portfolio, Program & Strategic Project Management',
    signInTitle: 'Sign in to PMO Workspace',
    signInDesc: 'Access portfolios, initiatives, projects, workstreams, milestones, and Gantt schedules.',
    usernameOrEmail: 'Username or Email',
    passwordLabel: 'Password',
    signInButton: 'Sign In to Workspace',
    signingIn: 'Signing in...',
    quickDemoAccounts: 'Quick Role Demo Accounts',
    pmoManagerRole: 'PMO Manager',
    projectManagerRole: 'Project Manager',
    teamMemberRole: 'Team Member',
    fullAccessDesc: 'Full Hierarchy & CRUD',
    planningAccessDesc: 'Project & WBS Planning',
    taskExecutionDesc: 'Task & Subtask Execution',
    logout: 'Sign Out',
    createNewAccount: 'Create New Account',
    savedAccountsTab: 'Saved Accounts',
    createAccountTab: 'Create Account',
    manualSignInTab: 'Sign In with Password',
    savedAccountsDesc: 'Click your profile icon to log in immediately.',
    clickToEnter: 'Click to enter',
    entering: 'Entering...',
    createAccountTitle: 'Create New User Account',
    createAccountDesc: 'Register a new user to immediately access the PMO workspace.',
    fullNameLabel: 'Full Name',
    usernameLabel: 'Username',
    emailLabel: 'Email Address',
    roleLabel: 'Assigned Role',
    createAccountButton: 'Create Account & Enter',
    creatingAccount: 'Creating Account...',
    alreadyHaveAccount: 'Already have an account?',
    orChooseSaved: 'or select a saved account',
    searchAccountsPlaceholder: 'Search saved accounts...',
    forgotPassword: 'Forgot Password?',
    forgotPasswordTitle: 'Recover Account Password',
    forgotPasswordDesc: 'Verify your username or email address to safely reset your password.',
    verifyAccountButton: 'Verify Account',
    verifyingAccount: 'Verifying Account...',
    newPasswordLabel: 'New Password',
    confirmPasswordLabel: 'Confirm New Password',
    resetPasswordButton: 'Reset Password',
    resettingPassword: 'Resetting Password...',
    backToSignIn: 'Back to Sign In',
    passwordResetSuccess: 'Password reset successfully! You can now log in with your new password.',
    personalProfile: 'Personal Profile',
    personalProfileDesc: 'Manage your personal user details and security credentials.',
    profileTab: 'Profile Details',
    securityTab: 'Security & Password',
    currentPasswordLabel: 'Current Password',
    updateProfileButton: 'Save Profile Changes',
    updatingProfile: 'Saving Profile...',
    changePasswordButton: 'Change Password',
    changingPassword: 'Updating Password...',
    profileUpdatedSuccess: 'Profile updated successfully.',
    passwordChangedSuccess: 'Password changed successfully.',

    // Top Bar & Navigation
    navDashboard: 'Dashboard',
    navWorkspace: 'Project Workspace',
    navHierarchy: 'PMO Hierarchy',
    navMoreEntities: 'Directory',

    // Sidebar / Directory Sections
    secCorePlanning: 'Planning & Execution',
    secPmoRegistry: 'PMO Registry & Hierarchy',
    departments: 'Departments',
    portfolios: 'Portfolios',
    initiatives: 'Initiatives',
    projects: 'Projects',
    workstreams: 'Workstreams',
    milestones: 'Milestones',
    activities: 'Activities & Subtasks',
    hierarchyExplorer: 'Hierarchy Explorer',
    projectWorkspace: 'Project Workspace',

    // Singular & Plural Entity Labels
    department: 'Department',
    portfolio: 'Portfolio',
    initiative: 'Initiative',
    project: 'Project',
    workstream: 'Workstream',
    milestone: 'Milestone',
    activity: 'Activity',
    subtask: 'Subtask',
    subtasks: 'Subtasks',

    // Common Actions & Filters
    createNew: 'Create New',
    edit: 'Edit',
    delete: 'Delete',
    editRecord: 'Edit',
    saveChanges: 'Save Changes',
    createRecord: 'Create Record',
    cancel: 'Cancel',
    searchPlaceholder: 'Search by name, owner, department, or description...',
    statusFilterLabel: 'Status',
    allStatuses: 'All',
    clearFilters: 'Reset',
    openWorkspace: 'Open Workspace',
    drillDown: 'Drill Down',
    actions: 'Actions',
    noRecordsFound: 'No matching records found.',

    // Dashboard & Hierarchy
    execDashboardTitle: 'Executive PMO & Planning Overview',
    execDashboardSub: 'Real-time portfolio health, workstream rollups, milestone checkpoints, and task execution telemetry.',
    kpiDepartments: 'Active Departments',
    kpiPortfolios: 'Portfolios',
    kpiInitiatives: 'Strategic Initiatives',
    kpiProjects: 'Active Projects',
    kpiWorkstreams: 'Project Workstreams',
    kpiMilestones: 'Milestones Completed',
    kpiActivities: 'Activities & Subtasks',
    kpiOverdue: 'Overdue Tasks',
    projectProgressTitle: 'Project Execution & Rollup Progress',
    milestoneRadarTitle: 'Milestone Checkpoints & Delivery Radar',
    workstreamBreakdownTitle: 'Workstream Progress Breakdown',
    statusDistTitle: 'Status Distribution Across PMO',
    overdueAlertsTitle: 'Schedule Alerts & Blocked Dependencies',
    viewInWorkspace: 'Inspect in Workspace',
    noOverdueTasks: 'All scheduled activities are currently on track.',
    hierarchySubtitle: 'Drill down through Department → Portfolio → Initiative → Project → Workstreams, Milestones & Activities.',
    expandAll: 'Expand All',
    collapseAll: 'Collapse All',
    activePortfoliosCount: 'Portfolios',
    initiativesCount: 'Initiatives',
    projectsCount: 'Projects',
    progressTracking: 'Progress Tracking',
    progressTrackingSubtitle: 'Monitor live completion percentages calculated from related project and activity records.',
    overdueActivities: 'Overdue Activities',
    overdueActivitiesSubtitle: 'Identify and monitor incomplete activities that have passed their planned due date.',
    activitySearch: 'Activity Search',
    activitySearchSubtitle: 'Find and review activities across projects using name search, project, and status filters.',
    pmoDashboard: 'PMO Dashboard',
    pmoDashboardSubtitle: 'Central executive view of portfolios, initiatives, projects, calculated progress, and overdue activities.',

    // Project Workspace Tabs
    tabOverview: 'Overview',
    tabWorkstreams: 'Workstreams',
    tabMilestones: 'Milestones',
    tabActivities: 'Activities & Subtasks',
    tabGantt: 'Gantt Schedule',
    tabCalendar: 'Calendar',
    tabBoard: 'Kanban Board',
    switchActiveProject: 'Active Project',
    projectManager: 'Project Manager',
    scheduleWindow: 'Schedule Window',
    overallProgress: 'Overall Progress',
    tracksLabel: 'Tracks',
    completedLabel: 'Completed',
    tasksLabel: 'Tasks',
    overdueLabel: 'Overdue',
    addWorkstream: 'Add Workstream',
    addMilestone: 'Add Milestone',
    newWorkstream: 'New Workstream',
    newMilestone: 'New Milestone',
    newParentActivity: 'New Activity',
    addSubtask: 'Subtask',
    workstreamExecSummary: 'Workstream Execution Summary',
    milestoneCheckpointsTitle: 'Project Milestones (Diamond Checkpoints)',
    workstreamRollupHint: 'Workstream progress automatically rolls up from assigned parent activities.',
    milestoneHint: 'Key delivery checkpoints visually distinguished from standard tasks with ◆ diamond markers.',
    allWorkstreams: 'All Workstreams',
    allMilestones: 'All Milestones',
    allPriorities: 'All Priorities',
    allAssignees: 'All Assignees',
    sortByDueDate: 'Sort: Due Date',
    sortByPriority: 'Sort: Priority',
    sortByStatus: 'Sort: Status',
    sortByProgress: 'Sort: Progress %',
    autoCalculatedSubtasks: 'Auto-calculated from subtasks',
    dependsOn: 'Depends on',
    noDependencies: 'Independent',
    dependenciesManagerTitle: 'Task Dependencies (Predecessor → Successor)',
    dependenciesManagerDesc: 'Define Finish-to-Start relationships between activities. Self-dependencies and circular relationships are prevented.',
    predecessorLabel: 'Predecessor Task (Must finish first)',
    successorLabel: 'Successor Task (Depends on predecessor)',
    selectPredecessor: 'Select Predecessor...',
    selectSuccessor: 'Select Successor...',
    linkDependency: 'Link Dependency',
    removeDependency: 'Remove',
    ganttTitle: 'Project Gantt Schedule',
    ganttSubtitle: 'Timeline of Workstreams, Parent Activities, Subtasks, ◆ Milestones, and Predecessor Dependencies.',
    wbsHeader: 'Workstream / Activity / Milestone',
    calendarTitle: 'Project Planning Calendar',
    prevMonth: 'Prev Month',
    nextMonth: 'Next Month',
    activeWindowBtn: 'Oct 2026 (Active Window)',
    duePrefix: 'Due:',
    startPrefix: 'Start:',

    // Section Subtitles & Table Headers
    deptSubtitle: 'Manage organizational departments and governance units.',
    portfolioSubtitle: 'Strategic portfolios grouping multi-department initiatives.',
    initiativeSubtitle: 'Strategic initiatives linked to portfolios and departments.',
    projectSubtitle: 'Execution projects with workstreams, milestones, and automatic rollup.',
    workstreamSubtitle: 'Project execution tracks with automatic activity progress calculation.',
    milestoneSubtitle: 'Key project delivery checkpoints and target vs. actual tracking.',
    activitySubtitle: 'Project activities, hierarchical subtasks, and predecessor dependencies.',
    modalDesc: 'All fields are validated and persisted directly to the database.',

    // Form & Column Labels
    name: 'Name',
    nameLabel: 'Name',
    description: 'Description',
    descriptionLabel: 'Description',
    status: 'Status',
    priority: 'Priority',
     priorityLabel: 'Priority',
    progress: 'Progress',
    progressPercent: 'Progress (%)',
    progressLabel: 'Progress (%)',
    owner: 'Owner',
    ownerLabel: 'Owner',
    portfolioOwner: 'Portfolio Owner',
    workstreamOwner: 'Workstream Owner',
    assignedUser: 'Assigned User',
    assignedUserLabel: 'Assigned User',
    startDate: 'Start Date',
    startDateLabel: 'Start Date',
    endDate: 'End Date',
    endDateLabel: 'End Date',
    targetDate: 'Target Date',
    targetDateLabel: 'Target Date',
    dueDate: 'Due Date',
    dueDateLabel: 'Due Date',
    plannedDate: 'Planned Date',
    plannedDateLabel: 'Planned Date',
    actualDate: 'Actual Date',
    actualDateOptional: 'Actual Date (Optional)',
    actualDateLabel: 'Actual Date',
    timeline: 'Timeline',
    departmentIsActive: 'Department is Active',
    deptIsActive: 'Department is Active',
    departmentLabel: 'Department',
    portfolioLabel: 'Portfolio',
    parentInitiative: 'Parent Initiative',
    initiativeLabel: 'Parent Initiative',
    projectLabel: 'Project',
    workstreamOptional: 'Workstream (Optional)',
    milestoneOptional: 'Milestone (Optional)',
    milestoneStatus: 'Milestone Status',
    taskStatus: 'Task Status',
    parentActivityForSubtask: 'Parent Activity (For Subtask)',
    parentActivityLabel: 'Parent Activity (For Subtask)',
    topLevelActivityNoParent: 'Top-Level Activity (No Parent)',
    topLevelActivityOption: 'Top-Level Activity (No Parent)',
    noneProjectLevel: 'None (Project-Level)',
    noneOption: 'None',
    unassigned: 'Unassigned',
    unassignedOption: 'Unassigned',
    enterpriseWide: 'Enterprise-Wide',
    enterpriseWideOption: 'Enterprise-Wide',

    // Strategic Planning Module
    strategicPlanningModule: 'Strategic Planning',
    strategicPlanningSubtitle: 'Strategic Plans, Initiatives, Programs, and Execution Activities',
    strategicPlans: 'Strategic Plans',
    strategicInitiativesTab: 'Initiatives & Programs',
    strategicActivitiesTab: 'Strategic Activities',
    perspectivesReport: 'Perspectives Report',
    goalsReport: 'Goals Report',
    initiativesReport: 'Initiatives Link',
    programsCount: 'Programs',
    pmoProjectsLink: 'PMO Projects',
    workflowDraft: 'Draft',
    workflowApproved: 'Approved',
    actionApprove: 'Approve & Validate',
    actionDuplicateInitiative: 'Duplicate Initiative',
    actionDuplicateActivity: 'Duplicate Activity',
    actionNewRow: 'Add Row',
    tabPerspectives: 'Perspectives',
    tabGoals: 'Strategic Goals',
    tabSeminarCard: 'Seminar / Card Details',
    colPerspectiveName: 'Perspective',
    colPerspectiveWeight: 'Perspective Weight (%)',
    colGoalPerspective: 'Linked Perspective',
    colGoalTitle: 'Strategic Goal',
    colGoalWeight: 'Goal Weight (%)',
    secGeneralInfo: 'General Information',
    secTimeframe: 'Timeframe',
    secChatter: 'Communication & Audit Log',
    sendMessage: 'Send Message',
    logNote: 'Internal Note',
    activityLog: 'Activity History',
    developmentalProject: 'Developmental Project',
    executiveBodyActivity: 'Executive Body Activity',
    indicatorTargetValue: 'Indicator Target Value',
    activityValue: 'Activity Budget / Value (SAR)'
  },
  ar: {
    // Brand & Auth
    brandTitle: 'نكسورا لإدارة المشاريع',
    systemSubtitle: 'النظام المؤسسي المتكامل لإدارة المحافظ والمبادرات والمشاريع الاستراتيجية',
    signInTitle: 'تسجيل الدخول إلى مساحة عمل إدارة المشاريع',
    signInDesc: 'إدارة المحافظ والمبادرات والمشاريع ومسارات العمل والمعالم ومخططات جانت الزمنية.',
    usernameOrEmail: 'اسم المستخدم أو البريد الإلكتروني',
    passwordLabel: 'كلمة المرور',
    signInButton: 'تسجيل الدخول للنظام',
    signingIn: 'جاري تسجيل الدخول...',
    quickDemoAccounts: 'حسابات تجريبية سريعة حسب الصلاحية',
    pmoManagerRole: 'مدير مكتب إدارة المشاريع',
    projectManagerRole: 'مدير مشروع',
    teamMemberRole: 'عضو فريق العمل',
    fullAccessDesc: 'صلاحيات كاملة للهيكل والإدارة',
    planningAccessDesc: 'تخطيط المشاريع ومسارات العمل',
    taskExecutionDesc: 'تنفيذ المهام والمهام الفرعية',
    logout: 'تسجيل الخروج',
    createNewAccount: 'إنشاء حساب جديد',
    savedAccountsTab: 'الحسابات المحفوظة',
    createAccountTab: 'إنشاء حساب جديد',
    manualSignInTab: 'تسجيل بالرمز السري',
    savedAccountsDesc: 'اضغط على أيقونة أو بطاقة الحساب للدخول فوراً.',
    clickToEnter: 'اضغط للدخول',
    entering: 'جاري الدخول...',
    createAccountTitle: 'إنشاء حساب مستخدم جديد',
    createAccountDesc: 'أنشئ حساباً جديداً بدور وظيفي للوصول الفوري إلى مساحة العمل.',
    fullNameLabel: 'الاسم الكامل',
    usernameLabel: 'اسم المستخدم',
    emailLabel: 'البريد الإلكتروني',
    roleLabel: 'الدور الوظيفي',
    createAccountButton: 'إنشاء الحساب والدخول فوراً',
    creatingAccount: 'جاري إنشاء الحساب...',
    alreadyHaveAccount: 'هل لديك حساب بالفعل؟',
    orChooseSaved: 'أو اختر حساباً محفوظاً',
    searchAccountsPlaceholder: 'بحث في الحسابات المحفوظة...',
    forgotPassword: 'نسيت كلمة المرور؟',
    forgotPasswordTitle: 'استعادة كلمة مرور الحساب',
    forgotPasswordDesc: 'تحقق من اسم المستخدم أو البريد الإلكتروني لإعادة تعيين كلمة المرور بأمان.',
    verifyAccountButton: 'التحقق من وجود الحساب',
    verifyingAccount: 'جاري التحقق...',
    newPasswordLabel: 'كلمة المرور الجديدة',
    confirmPasswordLabel: 'تأكيد كلمة المرور الجديدة',
    resetPasswordButton: 'إعادة تعيين كلمة المرور',
    resettingPassword: 'جاري التعيين...',
    backToSignIn: 'العودة لتسجيل الدخول',
    passwordResetSuccess: 'تمت إعادة تعيين كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.',
    personalProfile: 'الملف الشخصي',
    personalProfileDesc: 'إدارة وتحديث بياناتك الشخصية وبيانات تسجيل الدخول وكلمة المرور.',
    profileTab: 'البيانات الشخصية',
    securityTab: 'الأمان وكلمة المرور',
    currentPasswordLabel: 'كلمة المرور الحالية',
    updateProfileButton: 'حفظ بيانات الملف الشخصي',
    updatingProfile: 'جاري الحفظ...',
    changePasswordButton: 'تحديث كلمة المرور',
    changingPassword: 'جاري تحديث كلمة المرور...',
    profileUpdatedSuccess: 'تم تحديث بيانات الملف الشخصي بنجاح.',
    passwordChangedSuccess: 'تم تغيير كلمة المرور بنجاح.',

    // Top Bar & Navigation
    navDashboard: 'لوحة القيادة',
    navWorkspace: 'مساحة عمل المشروع',
    navHierarchy: 'الهيكل التنظيمي',
    navMoreEntities: 'السجلات',

    // Sidebar / Directory Sections
    secCorePlanning: 'التخطيط والتنفيذ والرقابة',
    secPmoRegistry: 'سجلات مكتب إدارة المشاريع',
    departments: 'الإدارات والأقسام',
    portfolios: 'المحافظ الاستراتيجية',
    initiatives: 'المبادرات',
    projects: 'المشاريع',
    workstreams: 'مسارات العمل',
    milestones: 'المعالم الرئيسية',
    activities: 'الأنشطة والمهام الفرعية',
    hierarchyExplorer: 'مستكشف الهيكل الهرمي',
    projectWorkspace: 'مساحة تخطيط المشروع',

    // Singular & Plural Entity Labels
    department: 'الإدارة',
    portfolio: 'المحفظة',
    initiative: 'المبادرة',
    project: 'المشروع',
    workstream: 'مسار العمل',
    milestone: 'المعلم الرئيسي',
    activity: 'النشاط',
    subtask: 'مهمة فرعية',
    subtasks: 'مهام فرعية',

    // Common Actions & Filters
    createNew: 'إضافة جديد',
    edit: 'تعديل',
    delete: 'حذف',
    editRecord: 'تعديل',
    saveChanges: 'حفظ التعديلات',
    createRecord: 'إنشاء السجل',
    cancel: 'إلغاء',
    searchPlaceholder: 'ابحث بالاسم، المسؤول، الإدارة، أو الوصف...',
    statusFilterLabel: 'الحالة',
    allStatuses: 'الكل',
    clearFilters: 'إعادة ضبط',
    openWorkspace: 'فتح مساحة التخطيط',
    drillDown: 'استعراض التفاصيل',
    actions: 'الإجراءات',
    noRecordsFound: 'لا توجد سجلات مطابقة للبحث.',

    // Dashboard & Hierarchy
    execDashboardTitle: 'لوحة القيادة التنفيذية والتخطيط والرقابة',
    execDashboardSub: 'مؤشرات أداء المحافظ، تقدم مسارات العمل، المعالم الرئيسية، ومتابعة تنفيذ الأنشطة والمهام.',
    kpiDepartments: 'الإدارات النشطة',
    kpiPortfolios: 'المحافظ',
    kpiInitiatives: 'المبادرات الاستراتيجية',
    kpiProjects: 'المشاريع النشطة',
    kpiWorkstreams: 'مسارات العمل',
    kpiMilestones: 'المعالم المكتملة',
    kpiActivities: 'الأنشطة والمهام الفرعية',
    kpiOverdue: 'المهام المتأخرة',
    projectProgressTitle: 'تقدم تنفيذ المشاريع ونسب الإنجاز التراكمية',
    milestoneRadarTitle: 'رادار المعالم الرئيسية ونقاط التسليم',
    workstreamBreakdownTitle: 'تحليل إنجاز مسارات العمل',
    statusDistTitle: 'توزيع حالات المشاريع والمهام',
    overdueAlertsTitle: 'تنبيهات الجدول الزمني والاعتماديات المتأخرة',
    viewInWorkspace: 'فتح في مساحة المشروع',
    noOverdueTasks: 'جميع الأنشطة المجدولة تسير وفق الخطة الزمنية.',
    hierarchySubtitle: 'تصفح التسلسل الهرمي: الإدارة ← المحفظة ← المبادرة ← المشروع ← مسارات العمل والمعالم والأنشطة.',
    expandAll: 'توسيع الكل',
    collapseAll: 'طي الكل',
    activePortfoliosCount: 'محافظ',
    initiativesCount: 'مبادرات',
    projectsCount: 'مشاريع',
    progressTracking: 'تتبع الإنجاز',
    progressTrackingSubtitle: 'متابعة حية ومحدثة لنسب الإنجاز المحتسبة تلقائياً بناءً على بيانات المشاريع والأنشطة الفعلية.',
    overdueActivities: 'الأنشطة المتأخرة',
    overdueActivitiesSubtitle: 'متابعة ورصد الأنشطة غير المكتملة التي تجاوزت تاريخ الاستحقاق المخطط لها.',
    activitySearch: 'البحث عن الأنشطة',
    activitySearchSubtitle: 'البحث السريع واستعراض الأنشطة عبر المشاريع حسب الاسم والمشروع والحالة.',
    pmoDashboard: 'لوحة تحكم مكتب المشاريع',
    pmoDashboardSubtitle: 'نظرة مركزية شاملة للمحافظ والمبادرات والمشاريع ونسب الإنجاز والأنشطة المتأخرة.',

    // Project Workspace Tabs
    tabOverview: 'نظرة عامة',
    tabWorkstreams: 'مسارات العمل',
    tabMilestones: 'المعالم الرئيسية',
    tabActivities: 'الأنشطة والمهام الفرعية',
    tabGantt: 'مخطط جانت',
    tabCalendar: 'التقويم الشهري',
    tabBoard: 'لوحة كانبان',
    switchActiveProject: 'المشروع النشط',
    projectManager: 'مدير المشروع',
    scheduleWindow: 'النطاق الزمني',
    overallProgress: 'نسبة الإنجاز الكلية',
    tracksLabel: 'مسارات',
    completedLabel: 'مكتمل',
    tasksLabel: 'مهام',
    overdueLabel: 'متأخرة',
    addWorkstream: 'إضافة مسار عمل',
    addMilestone: 'إضافة معلم رئيسي',
    newWorkstream: 'مسار عمل جديد',
    newMilestone: 'معلم رئيسي جديد',
    newParentActivity: 'نشاط رئيسي جديد',
    addSubtask: 'مهمة فرعية',
    workstreamExecSummary: 'ملخص تنفيذ مسارات العمل',
    milestoneCheckpointsTitle: 'المعالم الرئيسية للمشروع (نقاط التحقق ◆)',
    workstreamRollupHint: 'يتم احتساب نسبة إنجاز مسار العمل تلقائياً بناءً على الأنشطة المرتبطة به.',
    milestoneHint: 'نقاط تسليم رئيسية مميزة بعلامة المعين ◆ لتمييزها عن المهام الاعتيادية.',
    allWorkstreams: 'جميع مسارات العمل',
    allMilestones: 'جميع المعالم',
    allPriorities: 'جميع الأولويات',
    allAssignees: 'جميع المكلفين',
    sortByDueDate: 'ترتيب: تاريخ الاستحقاق',
    sortByPriority: 'ترتيب: الأولوية',
    sortByStatus: 'ترتيب: الحالة',
    sortByProgress: 'ترتيب: نسبة الإنجاز',
    autoCalculatedSubtasks: 'محسوب تلقائياً من المهام الفرعية',
    dependsOn: 'يعتمد على',
    noDependencies: 'مستقل',
    dependenciesManagerTitle: 'إدارة اعتماديات المهام (السابق ← اللاحق)',
    dependenciesManagerDesc: 'تحديد علاقات الانتهاء للبدء بين المهام مع منع الاعتماد الذاتي أو الدائري.',
    predecessorLabel: 'المهمة السابقة (يجب إنجازها أولاً)',
    successorLabel: 'المهمة اللاحقة (تعتمد على السابقة)',
    selectPredecessor: 'اختر المهمة السابقة...',
    selectSuccessor: 'اختر المهمة اللاحقة...',
    linkDependency: 'ربط الاعتمادية',
    removeDependency: 'إزالة',
    ganttTitle: 'مخطط جانت الزمني للمشروع',
    ganttSubtitle: 'يعرض الجدول الزمني لمسارات العمل، الأنشطة الرئيسية، المهام الفرعية، المعالم ◆، والاعتماديات.',
    wbsHeader: 'مسار العمل / النشاط / المعلم',
    calendarTitle: 'تقويم تخطيط المشروع',
    prevMonth: 'الشهر السابق',
    nextMonth: 'الشهر التالي',
    activeWindowBtn: 'أكتوبر 2026 (النطاق النشط)',
    duePrefix: 'استحقاق:',
    startPrefix: 'بدء:',

    // Section Subtitles & Table Headers
    deptSubtitle: 'إدارة الأقسام والوحدات التنظيمية في المؤسسة.',
    portfolioSubtitle: 'المحافظ الاستراتيجية التي تجمع المبادرات عبر الإدارات.',
    initiativeSubtitle: 'المبادرات الاستراتيجية المرتبطة بالمحافظ والإدارات.',
    projectSubtitle: 'المشاريع التنفيذية مع مسارات العمل والمعالم وحساب التقدم التلقائي.',
    workstreamSubtitle: 'مسارات العمل التنفيذية داخل المشاريع مع احتساب التقدم تلقائياً.',
    milestoneSubtitle: 'نقاط التحقق والمعالم الرئيسية للمشاريع ومقارنة التاريخ المخطط بالفعلي.',
    activitySubtitle: 'الأنشطة الرئيسية والمهام الفرعية وعلاقات الاعتمادية.',
    modalDesc: 'يتم التحقق من جميع الحقول وحفظها مباشرة في قاعدة البيانات.',

    // Form & Column Labels
    name: 'الاسم',
    nameLabel: 'الاسم',
    description: 'الوصف',
    descriptionLabel: 'الوصف',
    status: 'الحالة',
    priority: 'الأولوية',
    priorityLabel: 'الأولوية',
    progress: 'نسبة الإنجاز',
    progressPercent: 'نسبة الإنجاز (%)',
    progressLabel: 'نسبة الإنجاز (%)',
    owner: 'المالك / المسؤول',
    ownerLabel: 'المالك / المسؤول',
    portfolioOwner: 'مدير المحفظة',
    workstreamOwner: 'مسؤول مسار العمل',
    assignedUser: 'الموظف المكلف',
    assignedUserLabel: 'الموظف المكلف',
    startDate: 'تاريخ البدء',
    startDateLabel: 'تاريخ البدء',
    endDate: 'تاريخ الانتهاء',
    endDateLabel: 'تاريخ الانتهاء',
    targetDate: 'التاريخ المستهدف',
    targetDateLabel: 'التاريخ المستهدف',
    dueDate: 'تاريخ الاستحقاق',
    dueDateLabel: 'تاريخ الاستحقاق',
    plannedDate: 'التاريخ المخطط',
    plannedDateLabel: 'التاريخ المخطط',
    actualDate: 'التاريخ الفعلي',
    actualDateOptional: 'التاريخ الفعلي (اختياري)',
    actualDateLabel: 'التاريخ الفعلي',
    timeline: 'الجدول الزمني',
    departmentIsActive: 'الإدارة نشطة',
    deptIsActive: 'الإدارة نشطة',
    departmentLabel: 'الإدارة',
    portfolioLabel: 'المحفظة',
    parentInitiative: 'المبادرة الأم',
    initiativeLabel: 'المبادرة الأم',
    projectLabel: 'المشروع',
    workstreamOptional: 'مسار العمل (اختياري)',
    milestoneOptional: 'المعلم الرئيسي (اختياري)',
    milestoneStatus: 'حالة المعلم',
    taskStatus: 'حالة المهمة',
    parentActivityForSubtask: 'النشاط الأب (للمهمة الفرعية)',
    parentActivityLabel: 'النشاط الأب (للمهمة الفرعية)',
    topLevelActivityNoParent: 'نشاط رئيسي (بدون نشاط أب)',
    topLevelActivityOption: 'نشاط رئيسي (بدون نشاط أب)',
    noneProjectLevel: 'بدون (على مستوى المشروع)',
    noneOption: 'بدون',
    unassigned: 'غير معين',
    unassignedOption: 'غير معين',
    enterpriseWide: 'على مستوى المؤسسة',
    enterpriseWideOption: 'على مستوى المؤسسة',

    // وحدة التخطيط الاستراتيجي
    strategicPlanningModule: 'التخطيط الاستراتيجي',
    strategicPlanningSubtitle: 'الخطط الاستراتيجية، المبادرات والبرامج، والأنشطة التنفيذية',
    strategicPlans: 'الخطط الاستراتيجية',
    strategicInitiativesTab: 'المبادرات والبرامج',
    strategicActivitiesTab: 'الأنشطة',
    perspectivesReport: 'تقرير المناظير',
    goalsReport: 'تقرير الأهداف',
    initiativesReport: 'المبادرات المرتبطة',
    programsCount: 'البرامج',
    pmoProjectsLink: 'مشاريع مكتب إدارة المشاريع',
    workflowDraft: 'مسودة',
    workflowApproved: 'مقبول',
    actionApprove: 'تعميد',
    actionDuplicateInitiative: 'نسخ المبادرة',
    actionDuplicateActivity: 'نسخ نشاط',
    actionNewRow: 'إضافة بند',
    tabPerspectives: 'المناظير',
    tabGoals: 'الأهداف الاستراتيجية',
    tabSeminarCard: 'بطاقة الندوة',
    colPerspectiveName: 'المنظور',
    colPerspectiveWeight: 'وزن المنظور (%)',
    colGoalPerspective: 'المنظور المرتبط',
    colGoalTitle: 'الهدف الاستراتيجي',
    colGoalWeight: 'وزن الهدف (%)',
    secGeneralInfo: 'معلومات عامة',
    secTimeframe: 'المدة الزمنية',
    secChatter: 'سجل التواصل وتوثيق العمليات',
    sendMessage: 'إرسال رسالة',
    logNote: 'ملاحظة داخلية',
    activityLog: 'سجل النشاط',
    developmentalProject: 'مشروع تنموي',
    executiveBodyActivity: 'نشاط الهيئة التنفيذية',
    indicatorTargetValue: 'مستهدف المؤشر',
    activityValue: 'قيمة النشاط (ريال سعودي)'
  }
};

export function pickLocalized(
  lang: Language,
  enVal?: string | null,
  arVal?: string | null,
  fallback = ''
): string {
  if (lang === 'ar') {
    return (arVal && arVal.trim()) || (enVal && enVal.trim()) || fallback;
  }
  return (enVal && enVal.trim()) || (arVal && arVal.trim()) || fallback;
}

export function translateStatus(status: string, lang: Language): string {
  if (lang === 'en') {
    const arToEn: Record<string, string> = {
      'نشط': 'Active',
      'غير نشط': 'Inactive',
      'قيد التخطيط': 'Planning',
      'مخطط': 'Planned',
      'قيد التنفيذ': 'In Progress',
      'معلق': 'On Hold',
      'مكتمل': 'Completed',
      'ملغى': 'Cancelled',
      'لم يبدأ': 'Not Started',
      'متأخر': 'Delayed',
      'مسودة': 'Draft',
      'مقبول': 'Approved',
      'مؤرشف': 'Archived'
    };
    return arToEn[status] || status;
  }
  const map: Record<string, string> = {
    'Active': 'نشط',
    'Inactive': 'غير نشط',
    'Planning': 'قيد التخطيط',
    'Planned': 'مخطط',
    'In Progress': 'قيد التنفيذ',
    'On Hold': 'معلق',
    'Completed': 'مكتمل',
    'Cancelled': 'ملغى',
    'Not Started': 'لم يبدأ',
    'Delayed': 'متأخر',
    'Draft': 'مسودة',
    'Approved': 'مقبول',
    'Archived': 'مؤرشف'
  };
  return map[status] || status;
}

export function translatePriority(priority: string, lang: Language): string {
  if (lang === 'en') {
    const arToEn: Record<string, string> = {
      'منخفضة': 'Low',
      'متوسطة': 'Medium',
      'عالية': 'High',
      'حرجة': 'Critical'
    };
    return arToEn[priority] || priority;
  }
  const map: Record<string, string> = {
    'Low': 'منخفضة',
    'Medium': 'متوسطة',
    'High': 'عالية',
    'Critical': 'حرجة'
  };
  return map[priority] || priority;
}

export function translateRole(role: string, lang: Language): string {
  if (lang === 'en') {
    const arToEn: Record<string, string> = {
      'مدير مكتب إدارة المشاريع': 'PMO Manager',
      'مدير مشروع': 'Project Manager',
      'عضو فريق': 'Team Member',
      'عضو فريق العمل': 'Team Member'
    };
    return arToEn[role] || role;
  }
  const map: Record<string, string> = {
    'PMO Manager': 'مدير مكتب إدارة المشاريع',
    'Project Manager': 'مدير مشروع',
    'Team Member': 'عضو فريق',
    'Team Member ': 'عضو فريق'
  };
  return map[role] || role;
}

export function translateRoleDescription(
  roleName: string,
  lang: Language,
  fallbackEn?: string,
  fallbackAr?: string
): string {
  if (lang === 'ar') {
    if (fallbackAr && fallbackAr.trim()) return fallbackAr;
    const map: Record<string, string> = {
      'PMO Manager': 'إشراف كامل على الإدارات والمحافظ والمبادرات والمشاريع والحوكمة.',
      'Project Manager': 'إدارة المبادرات والمشاريع المكلف بها والجداول الزمنية وتوزيع المهام.',
      'Team Member': 'تنفيذ أنشطة ومهام المشاريع وتحديث نسب التقدم وحالة الإنجاز.'
    };
    return map[roleName] || fallbackEn || '';
  }
  if (fallbackEn && fallbackEn.trim()) return fallbackEn;
  const enMap: Record<string, string> = {
    'PMO Manager': 'Full oversight of departments, portfolios, initiatives, projects, and governance.',
    'Project Manager': 'Manages assigned initiatives, projects, schedules, and task allocations.',
    'Team Member': 'Executes project activities/tasks and updates task progress and status.'
  };
  return enMap[roleName] || '';
}

export function translateOptionLabel(opt: string, lang: Language): string {
  const clean = String(opt || '').trim();
  if (!clean) return '';
  if (lang === 'en') {
    const arToEn: Record<string, string> = {
      'خطة خمسية استراتيجية': 'Five-Year Strategic Plan',
      'خطة ثلاثية متوسطة المدى': 'Three-Year Medium-Term Plan',
      'خطة تحول سنوية': 'Annual Transformation Plan',
      'خطة طوارئ واستجابة': 'Emergency & Response Plan',
      'المسار الذهبي': 'Golden Track',
      'المسار الفضي': 'Silver Track',
      'المسار الاستراتيجي': 'Strategic Track',
      'الصندوق الثقافي': 'Cultural Development Fund',
      'أساس': 'Base System',
      'خيار أول': 'Option 1',
      'خيار ثان': 'Option 2',
      'خيار ثالث': 'Option 3',
      'خيار افتراضي': 'Default Option'
    };
    return arToEn[clean] || translateStatus(translatePriority(clean, 'en'), 'en');
  }
  const enToAr: Record<string, string> = {
    'Five-Year Strategic Plan': 'خطة خمسية استراتيجية',
    'Three-Year Medium-Term Plan': 'خطة ثلاثية متوسطة المدى',
    'Annual Transformation Plan': 'خطة تحول سنوية',
    'Emergency & Response Plan': 'خطة طوارئ واستجابة',
    'Golden Track': 'المسار الذهبي',
    'Silver Track': 'المسار الفضي',
    'Strategic Track': 'المسار الاستراتيجي',
    'Cultural Development Fund': 'الصندوق الثقافي',
    'Base System': 'أساس',
    'Option 1': 'خيار أول',
    'Option 2': 'خيار ثان',
    'Option 3': 'خيار ثالث',
    'Default Option': 'خيار افتراضي'
  };
  if (enToAr[clean]) return enToAr[clean];
  const st = translateStatus(clean, 'ar');
  if (st !== clean) return st;
  const pr = translatePriority(clean, 'ar');
  if (pr !== clean) return pr;
  return clean;
}

export function translateLeadRole(role: string, lang: Language): string {
  if (lang === 'en') return role;
  const map: Record<string, string> = {
    'Chief Information Officer': 'رئيس تقنية المعلومات',
    'Head of Financial Governance': 'رئيس الحوكمة المالية',
    'Director of Human Capital': 'مدير رأس المال البشري',
    'VP of Supply Chain & Operations': 'نائب الرئيس للعمليات وسلاسل الإمداد',
    'Chief Marketing Officer': 'رئيس التسويق المؤسسي',
    'Director': 'مدير الإدارة'
  };
  return map[role] || role;
}

export function translateHealthStatus(status: string, lang: Language): string {
  if (lang === 'en') return status;
  const map: Record<string, string> = {
    'On Track': 'على المسار',
    'At Risk': 'في خطر',
    'Delayed': 'متأخر',
    'Completed': 'مكتمل'
  };
  return map[status] || status;
}

export function translateApprovalStatus(status: string, lang: Language): string {
  if (lang === 'en') return status;
  const map: Record<string, string> = {
    'Approved': 'معتمد',
    'Pending Review': 'قيد المراجعة',
    'Draft': 'مسودة',
    'Rejected': 'مرفوض'
  };
  return map[status] || status;
}

export function translateStage(stage: string, lang: Language): string {
  if (lang === 'en') return stage;
  const map: Record<string, string> = {
    'Planning': 'التخطيط',
    'Execution': 'التنفيذ',
    'Review': 'المراجعة',
    'Completed': 'مكتمل'
  };
  return map[stage] || stage;
}

export function translateItemType(type: string, lang: Language): string {
  if (lang === 'en') return type;
  const map: Record<string, string> = {
    'Workstream': 'مسار عمل',
    'Milestone': 'معلم رئيسي',
    'Activity': 'نشاط'
  };
  return map[type] || type;
}

export function translateBaselineHealth(health: string, lang: Language): string {
  if (lang === 'en') return health;
  const map: Record<string, string> = {
    'Ahead': 'متقدم',
    'On Track': 'على المسار',
    'Behind': 'متأخر عن الجدول',
    'Critical Delay': 'تأخر حرج'
  };
  return map[health] || health;
}

export function translateConflictMessage(
  code: string,
  lang: Language,
  data?: { startDate?: string; dueDate?: string; projectStart?: string; projectTarget?: string }
): string {
  const s = data?.startDate || '';
  const d = data?.dueDate || '';
  const ps = data?.projectStart || '';
  const pt = data?.projectTarget || '';
  if (lang === 'ar') {
    switch (code) {
      case 'missing_dates':
        return 'النشاط يفتقد إلى تاريخ بدء أو تاريخ استحقاق مخطط صالح.';
      case 'due_before_start':
        return `تاريخ استحقاق النشاط (${d}) يسبق تاريخ بدئه (${s}).`;
      case 'starts_before_project':
        return `يبدأ النشاط (${s}) قبل تاريخ البدء المخطط للمشروع (${ps}).`;
      case 'ends_after_project':
        return `يتجاوز تاريخ استحقاق النشاط (${d}) التاريخ المستهدف للمشروع (${pt}).`;
      default:
        return code;
    }
  }
  switch (code) {
    case 'missing_dates':
      return 'Activity is missing a valid planned start date or due date.';
    case 'due_before_start':
      return `Activity due date (${d}) is earlier than its start date (${s}).`;
    case 'starts_before_project':
      return `Activity starts (${s}) before project planned start date (${ps}).`;
    case 'ends_after_project':
      return `Activity due date (${d}) exceeds project target date (${pt}).`;
    default:
      return code;
  }
}

