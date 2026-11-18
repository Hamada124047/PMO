import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from './apiClient';
import {
  LayoutDashboard,
  Kanban,
  FileSpreadsheet,
  CheckSquare,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  AlertCircle,
  Clock,
  Calendar,
  Building2,
  FolderKanban,
  CheckCircle2,
  FileText,
  Download,
  Filter,
  Search,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Compass,
  Layers,
  Star,
  Eye,
  MapPin,
  CalendarDays,
  BarChart3,
  PieChart as PieChartIcon,
  SlidersHorizontal,
  Table as TableIcon,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  ArrowUpRight,
  DollarSign,
  User,
  Users,
  X,
  Printer,
  Sparkles
} from 'lucide-react';
import {
  PmoViewType,
  MasterTaskViewMode,
  SinglePageViewMode,
  ProjectHealth,
  RiskLevel,
  PmoProjectEnriched,
  PmoInitiativeEnriched,
  DepartmentKanbanGroup,
  MasterTaskItem,
  PmoExecutiveDashboardKpis
} from './types/pmoManagement';
import {
  Language,
  pickLocalized,
  translateStatus,
  translateLeadRole,
  translateItemType,
  translateBaselineHealth,
  translateApprovalStatus,
  translateStage
} from './i18n';

interface PmoManagementViewProps {
  lang: Language;
  onNavigateToStrategicPlanning?: () => void;
  showBanner: (type: 'success' | 'error', text: string) => void;
  initialView?: PmoViewType;
  filterProjectId?: number | null;
}

export function PmoManagementView({
  lang,
  onNavigateToStrategicPlanning,
  showBanner,
  initialView = 'dashboard',
  filterProjectId = null
}: PmoManagementViewProps) {
  const isAr = lang === 'ar';

  // Navigation & View Mode State
  const [activeView, setActiveView] = useState<PmoViewType>(initialView);
  const [masterTaskViewMode, setMasterTaskViewMode] = useState<MasterTaskViewMode>('list');
  const [singlePageViewMode, setSinglePageViewMode] = useState<SinglePageViewMode>('projects');

  // Filter States
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState<string>('all');
  const [topTabNavFilter, setTopTabNavFilter] = useState<'all' | 'executive' | 'budgeting' | 'departments'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [healthFilter, setHealthFilter] = useState<string>('all');
  const [selectedTaskProjectFilter, setSelectedTaskProjectFilter] = useState<number | null>(filterProjectId);

  // Data Loading States
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [dashboardData, setDashboardData] = useState<{
    kpis: PmoExecutiveDashboardKpis;
    projects: PmoProjectEnriched[];
  } | null>(null);
  const [kanbanDepartments, setKanbanDepartments] = useState<DepartmentKanbanGroup[]>([]);
  const [singleProjects, setSingleProjects] = useState<PmoProjectEnriched[]>([]);
  const [highRiskInitiatives, setHighRiskInitiatives] = useState<PmoInitiativeEnriched[]>([]);
  const [masterTasks, setMasterTasks] = useState<MasterTaskItem[]>([]);

  // Selection & PowerPoint Export Modal
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);
  const [exportModalOpen, setExportModalOpen] = useState<boolean>(false);
  const [exportPptData, setExportPptData] = useState<any>(null);
  const [isExportingPpt, setIsExportingPpt] = useState<boolean>(false);
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0);

  // Detail Drawer / Modal for quick project inspection
  const [inspectingProject, setInspectingProject] = useState<PmoProjectEnriched | null>(null);

  // Fetch all PMO Suite Data
  const fetchAllPmoData = async () => {
    try {
      setRefreshing(true);
      const [dashRes, kanbanRes, singleRes, riskRes, tasksRes] = await Promise.all([
        apiFetch('/api/pmo/executive-dashboard'),
        apiFetch('/api/pmo/department-kanban'),
        apiFetch('/api/pmo/single-page-projects'),
        apiFetch('/api/pmo/high-risk-initiatives'),
        apiFetch('/api/pmo/master-tasks')
      ]);

      if (dashRes.ok) setDashboardData(await dashRes.json());
      if (kanbanRes.ok) setKanbanDepartments(await kanbanRes.json());
      if (singleRes.ok) setSingleProjects(await singleRes.json());
      if (riskRes.ok) setHighRiskInitiatives(await riskRes.json());
      if (tasksRes.ok) setMasterTasks(await tasksRes.json());
    } catch (err) {
      console.error('Failed to fetch PMO data:', err);
      showBanner('error', isAr ? 'فشل تحميل بيانات إدارة المشاريع' : 'Failed to fetch PMO suite data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAllPmoData();
  }, []);

  // Handle PowerPoint Export
  const handleOpenExportPpt = async () => {
    setIsExportingPpt(true);
    try {
      const res = await apiFetch('/api/pmo/export-ppt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedProjectIds,
          departmentFilter: selectedDepartmentFilter,
          lang
        })
      });
      if (res.ok) {
        const data = await res.json();
        setExportPptData(data);
        setActiveSlideIndex(0);
        setExportModalOpen(true);
      } else {
        showBanner('error', isAr ? 'تعذر توليد تقرير العرض التقديمي' : 'Could not generate executive presentation');
      }
    } catch (e) {
      showBanner('error', isAr ? 'خطأ في تصدير العرض التقديمي' : 'Error generating PowerPoint deck');
    } finally {
      setIsExportingPpt(false);
    }
  };

  const handleDownloadPptReport = () => {
    if (!exportPptData) return;
    const blob = new Blob([JSON.stringify(exportPptData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download =
      exportPptData.filename ||
      (isAr ? 'العرض_التنفيذي_لمكتب_المشاريع.json' : 'PMO_Executive_Presentation.json');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showBanner(
      'success',
      isAr ? 'تم تحميل ملف بيانات العرض التقديمي التنفيذي بنجاح' : 'Executive Presentation deck downloaded successfully'
    );
  };

  // Star Task Handler
  const toggleStarTask = (uniqueKey: string) => {
    setMasterTasks((prev) =>
      prev.map((t) => (t.uniqueKey === uniqueKey ? { ...t, isStarred: !t.isStarred } : t))
    );
  };

  // Change Task Priority
  const changeTaskPriority = (uniqueKey: string, newStars: 1 | 2 | 3) => {
    setMasterTasks((prev) =>
      prev.map((t) => (t.uniqueKey === uniqueKey ? { ...t, priorityStars: newStars } : t))
    );
    showBanner('success', isAr ? 'تم تحديث أولوية المهمة' : 'Task priority rating updated');
  };

  // Filtered Projects for Executive Dashboard Grid
  const filteredDashboardProjects = useMemo(() => {
    if (!dashboardData) return [];
    return dashboardData.projects.filter((p) => {
      // Department filter
      if (selectedDepartmentFilter !== 'all' && String(p.departmentId) !== selectedDepartmentFilter) {
        return false;
      }
      // Top Nav category filter
      if (topTabNavFilter === 'executive' && p.riskLevel !== 'High' && p.riskLevel !== 'Critical') {
        return false;
      }
      if (topTabNavFilter === 'budgeting' && p.availableBudget <= 0) {
        return false;
      }
      // Health filter
      if (healthFilter !== 'all' && p.healthStatus !== healthFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q) || (p.nameAr && p.nameAr.toLowerCase().includes(q));
        const matchDept =
          p.departmentName.toLowerCase().includes(q) ||
          (p.departmentNameAr && p.departmentNameAr.toLowerCase().includes(q));
        const matchPm =
          p.projectManagerName.toLowerCase().includes(q) ||
          (p.projectManagerNameAr && p.projectManagerNameAr.toLowerCase().includes(q));
        const matchGoal =
          (p.strategicGoalTitle || '').toLowerCase().includes(q) ||
          (p.strategicGoalTitleAr || '').toLowerCase().includes(q);
        if (!matchName && !matchDept && !matchPm && !matchGoal) return false;
      }
      return true;
    });
  }, [dashboardData, selectedDepartmentFilter, topTabNavFilter, healthFilter, searchQuery]);

  // Filtered Single Page Projects
  const filteredSingleProjects = useMemo(() => {
    return singleProjects.filter((p) => {
      if (selectedDepartmentFilter !== 'all' && String(p.departmentId) !== selectedDepartmentFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q) || (p.nameAr && p.nameAr.toLowerCase().includes(q));
        const matchDept =
          p.departmentName.toLowerCase().includes(q) ||
          (p.departmentNameAr && p.departmentNameAr.toLowerCase().includes(q));
        const matchPm =
          p.projectManagerName.toLowerCase().includes(q) ||
          (p.projectManagerNameAr && p.projectManagerNameAr.toLowerCase().includes(q));
        if (!matchName && !matchDept && !matchPm) return false;
      }
      return true;
    });
  }, [singleProjects, selectedDepartmentFilter, searchQuery]);

  // Filtered High-Risk Initiatives
  const filteredHighRiskInitiatives = useMemo(() => {
    return highRiskInitiatives.filter((init) => {
      if (selectedDepartmentFilter !== 'all' && String(init.departmentId) !== selectedDepartmentFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = init.name.toLowerCase().includes(q) || (init.nameAr && init.nameAr.toLowerCase().includes(q));
        const matchDept =
          init.departmentName.toLowerCase().includes(q) ||
          (init.departmentNameAr && init.departmentNameAr.toLowerCase().includes(q));
        if (!matchName && !matchDept) return false;
      }
      return true;
    });
  }, [highRiskInitiatives, selectedDepartmentFilter, searchQuery]);

  // Filtered Master Tasks
  const filteredMasterTasks = useMemo(() => {
    return masterTasks.filter((t) => {
      if (selectedTaskProjectFilter !== null && t.projectId !== selectedTaskProjectFilter) {
        return false;
      }
      if (selectedDepartmentFilter !== 'all' && String(t.departmentId) !== selectedDepartmentFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q) || (t.titleAr && t.titleAr.toLowerCase().includes(q));
        const matchProj =
          t.projectName.toLowerCase().includes(q) ||
          (t.projectNameAr && t.projectNameAr.toLowerCase().includes(q));
        const matchAssignee =
          t.assigneeName.toLowerCase().includes(q) ||
          (t.assigneeNameAr && t.assigneeNameAr.toLowerCase().includes(q));
        if (!matchTitle && !matchProj && !matchAssignee) return false;
      }
      return true;
    });
  }, [masterTasks, selectedTaskProjectFilter, selectedDepartmentFilter, searchQuery]);

  // Color helper for Health Badges
  const getHealthBadge = (health: ProjectHealth) => {
    switch (health) {
      case 'On Track':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            {isAr ? 'في المسار السليم' : 'On Track'}
          </span>
        );
      case 'At Risk':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertCircle className="w-3 h-3 text-amber-600" />
            {isAr ? 'معرض للمخاطر' : 'At Risk'}
          </span>
        );
      case 'Delayed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            {isAr ? 'متأخر' : 'Delayed'}
          </span>
        );
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <CheckCircle2 className="w-3 h-3 text-blue-600" />
            {isAr ? 'مكتمل' : 'Completed'}
          </span>
        );
      default:
        return null;
    }
  };

  // Color helper for Risk Level
  const getRiskBadge = (risk: RiskLevel) => {
    switch (risk) {
      case 'Critical':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <ShieldAlert className="w-3 h-3 text-rose-600" />
            {isAr ? 'حرج' : 'Critical'}
          </span>
        );
      case 'High':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            {isAr ? 'مرتفع' : 'High'}
          </span>
        );
      case 'Medium':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            {isAr ? 'متوسط' : 'Medium'}
          </span>
        );
      case 'Low':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {isAr ? 'منخفض' : 'Low'}
          </span>
        );
    }
  };

  // Currency formatter
  const formatSar = (val: number) => {
    if (val >= 1000000) {
      return `${(val / 1000000).toFixed(1)}M ${isAr ? 'ريال' : 'SAR'}`;
    }
    if (val >= 1000) {
      return `${(val / 1000).toFixed(0)}K ${isAr ? 'ريال' : 'SAR'}`;
    }
    return `${val.toLocaleString()} ${isAr ? 'ريال' : 'SAR'}`;
  };

  // Select / Unselect all projects
  const handleToggleSelectAllProjects = () => {
    if (selectedProjectIds.length === filteredSingleProjects.length) {
      setSelectedProjectIds([]);
    } else {
      setSelectedProjectIds(filteredSingleProjects.map((p) => p.id));
    }
  };

  const handleToggleProjectSelection = (id: number) => {
    setSelectedProjectIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Switch to tasks view for a specific project
  const handleViewTasksForProject = (projectId: number) => {
    setSelectedTaskProjectFilter(projectId);
    setActiveView('master-tasks');
    showBanner('success', isAr ? 'تم الانتقال إلى مسارات العمل والمهام المرتبطة بالمشروع' : 'Navigated to Master Tasks & Workstreams for selected project');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 pb-12">
      {/* =========================================================================
          MODULE HEADER & STRATEGIC SUITE TOP RIBBON
         ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 end-0 w-96 h-96 bg-gradient-to-bl from-blue-50 via-indigo-50/30 to-transparent -z-0 pointer-events-none rounded-bl-full opacity-60"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2.5 text-xs text-blue-600 font-semibold mb-2">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                {isAr ? 'وحدة إدارة المشاريع المؤسسية' : 'Enterprise PMO Suite'}
              </span>
              <span>•</span>
              <span className="text-slate-500">
                {isAr ? 'الصندوق الثقافي - المملكة العربية السعودية' : 'Cultural Development Fund · KSA'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display text-slate-900 tracking-tight flex items-center gap-3">
              <FolderKanban className="w-8 h-8 text-blue-600 shrink-0" />
              <span>
                {isAr ? 'مكتب إدارة المشاريع الاستراتيجية' : 'Project Management Office'}
              </span>
            </h1>
            <p className="text-sm text-slate-500 mt-1 max-w-3xl">
              {isAr
                ? 'نظام القيادة المتكامل لمتابعة الأداء الاستراتيجي، ترحيل المؤشرات والميزانيات، التنبيه التلقائي للمخاطر وتنسيق خطط الإدارات والمسارات التنفيذية.'
                : 'Enterprise executive dashboard, cross-department kanban, single-page projects with risk rollups, and master workstream management.'}
            </p>
          </div>

          {/* Action Ribbon */}
          <div className="flex flex-wrap items-center gap-3">
            {onNavigateToStrategicPlanning && (
              <button
                type="button"
                onClick={onNavigateToStrategicPlanning}
                className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all flex items-center gap-2 shadow-xs cursor-pointer hover:border-slate-300"
              >
                <Compass className="w-4 h-4 text-amber-500" />
                <span>{isAr ? 'العودة للتخطيط الاستراتيجي' : 'Strategic Planning Suite'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenExportPpt}
              disabled={isExportingPpt}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isExportingPpt ? (isAr ? 'جار التوليد...' : 'Generating...') : (isAr ? 'تصدير عرض تقديمي' : 'Export PowerPoint')}</span>
            </button>

            <button
              type="button"
              onClick={fetchAllPmoData}
              disabled={refreshing}
              className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer shadow-xs"
              title={isAr ? 'تحديث البيانات' : 'Refresh Data'}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* 4 CORE MODULE VIEWS SELECTOR TABS */}
        <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1.5 rounded-xl">
            {/* View 1: Executive Dashboard */}
            <button
              type="button"
              onClick={() => setActiveView('dashboard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeView === 'dashboard'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>{isAr ? '1. لوحة القيادة التنفيذية' : '1. Executive Dashboard'}</span>
            </button>

            {/* View 2: Department Kanban */}
            <button
              type="button"
              onClick={() => setActiveView('kanban')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeView === 'kanban'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Kanban className="w-4 h-4" />
              <span>{isAr ? '2. لوحة الإدارات والقطاعات' : '2. Department Kanban View'}</span>
            </button>

            {/* View 3: Single-Page Projects & High Risk Initiatives */}
            <button
              type="button"
              onClick={() => setActiveView('single-page-projects')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeView === 'single-page-projects'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{isAr ? '3. المشاريع والمبادرات الحرجة' : '3. Single-Page & High-Risk'}</span>
            </button>

            {/* View 4: Master Tasks & Workstreams */}
            <button
              type="button"
              onClick={() => setActiveView('master-tasks')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeView === 'master-tasks'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              <span>{isAr ? '4. مسارات العمل والمهام المركزية' : '4. Master Tasks & Workstreams'}</span>
            </button>
          </div>

          {/* Quick Filter: Department */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
              {isAr ? 'تصفية حسب الإدارة:' : 'Filter Department:'}
            </span>
            <select
              value={selectedDepartmentFilter}
              onChange={(e) => setSelectedDepartmentFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">{isAr ? 'جميع الإدارات والقطاعات' : 'All Departments'}</option>
              {kanbanDepartments.map((dept) => (
                <option key={dept.id} value={String(dept.id)}>
                  {isAr ? dept.nameAr : dept.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* =========================================================================
          VIEW 1: PMO EXECUTIVE DASHBOARD
         ========================================================================= */}
      {activeView === 'dashboard' && dashboardData && (
        <div className="space-y-6">
          {/* Top Navigation & Category Filter Ribbon */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2">
                {isAr ? 'فلاتر القيادة:' : 'Executive Nav:'}
              </span>
              <button
                type="button"
                onClick={() => setTopTabNavFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  topTabNavFilter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {isAr ? 'المكتب الشامل' : 'PMO Office'}
              </button>
              <button
                type="button"
                onClick={() => setTopTabNavFilter('executive')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  topTabNavFilter === 'executive'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {isAr ? 'الإدارة التنفيذية والحرجة' : 'Executive Management'}
              </button>
              <button
                type="button"
                onClick={() => setTopTabNavFilter('budgeting')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  topTabNavFilter === 'budgeting'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {isAr ? 'الميزانيات والاعتمادات' : 'Budgeting'}
              </button>
            </div>

            {/* Health Filter Pills */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-medium">
                {isAr ? 'حالة المشاريع:' : 'Health:'}
              </span>
              {['all', 'On Track', 'At Risk', 'Delayed', 'Completed'].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHealthFilter(h)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    healthFilter === h
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {h === 'all'
                    ? isAr
                      ? 'الكل'
                      : 'All'
                    : h === 'On Track'
                    ? isAr
                      ? 'سليم'
                      : 'On Track'
                    : h === 'At Risk'
                    ? isAr
                      ? 'بمخاطر'
                      : 'At Risk'
                    : h === 'Delayed'
                    ? isAr
                      ? 'متأخر'
                      : 'Delayed'
                    : isAr
                    ? 'مكتمل'
                    : 'Done'}
                </button>
              ))}
            </div>
          </div>

          {/* 10 KPI SUMMARY CARDS (TOP RIBBON) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-10 gap-3">
            {/* 1. Total Projects */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
              <div className="text-[11px] font-medium text-slate-500 truncate">
                {isAr ? 'إجمالي المشاريع' : 'Total Projects'}
              </div>
              <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                {dashboardData.kpis.totalProjects}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">{isAr ? 'مشروع نشط' : 'Active projects'}</div>
            </div>

            {/* 2. Initiatives */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
              <div className="text-[11px] font-medium text-slate-500 truncate">
                {isAr ? 'المبادرات' : 'Initiatives'}
              </div>
              <div className="text-2xl font-bold font-mono text-blue-600 mt-1">
                {dashboardData.kpis.totalInitiatives}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">{isAr ? 'مبادرة استراتيجية' : 'Strategic'}</div>
            </div>

            {/* 3. Departments */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
              <div className="text-[11px] font-medium text-slate-500 truncate">
                {isAr ? 'الإدارات' : 'Departments'}
              </div>
              <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                {dashboardData.kpis.totalDepartments}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">{isAr ? 'قطاع تنظيمي' : 'Org units'}</div>
            </div>

            {/* 4. Actual Progress % */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
              <div className="text-[11px] font-medium text-slate-500 truncate">
                {isAr ? 'الإنجاز الفعلي' : 'Actual Progress'}
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-600 mt-1">
                {dashboardData.kpis.actualProgressPercentage}%
              </div>
              <div className="text-[10px] text-emerald-600/80 mt-0.5">{isAr ? 'المحقق حالياً' : 'Completed rate'}</div>
            </div>

            {/* 5. Planned Progress % */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
              <div className="text-[11px] font-medium text-slate-500 truncate">
                {isAr ? 'الإنجاز المخطط' : 'Planned Progress'}
              </div>
              <div className="text-2xl font-bold font-mono text-slate-700 mt-1">
                {dashboardData.kpis.plannedProgressPercentage}%
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">{isAr ? 'المستهدف الزمني' : 'Baseline target'}</div>
            </div>

            {/* 6. Delay Flags */}
            <div className="bg-white border border-rose-200/80 rounded-xl p-3.5 shadow-xs bg-rose-50/20">
              <div className="text-[11px] font-medium text-rose-700 truncate">
                {isAr ? 'إشارات التأخير' : 'Delay Flags'}
              </div>
              <div className="text-2xl font-bold font-mono text-rose-600 mt-1">
                {dashboardData.kpis.delayFlagsCount}
              </div>
              <div className="text-[10px] text-rose-500 mt-0.5">{isAr ? 'تتطلب تدخلاً' : 'Requires action'}</div>
            </div>

            {/* 7. Overdue Projects */}
            <div className="bg-white border border-amber-200/80 rounded-xl p-3.5 shadow-xs bg-amber-50/20">
              <div className="text-[11px] font-medium text-amber-700 truncate">
                {isAr ? 'مشاريع متأخرة' : 'Overdue Projs'}
              </div>
              <div className="text-2xl font-bold font-mono text-amber-600 mt-1">
                {dashboardData.kpis.overdueProjectsCount}
              </div>
              <div className="text-[10px] text-amber-600 mt-0.5">{isAr ? 'خلف الجدول' : 'Behind schedule'}</div>
            </div>

            {/* 8. Pending Approvals */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
              <div className="text-[11px] font-medium text-slate-500 truncate">
                {isAr ? 'اعتمادات معلقة' : 'Pending Appr.'}
              </div>
              <div className="text-2xl font-bold font-mono text-indigo-600 mt-1">
                {dashboardData.kpis.pendingApprovalsCount}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">{isAr ? 'بانتظار التعميد' : 'Need validation'}</div>
            </div>

            {/* 9. High Risk Projects */}
            <div className="bg-white border border-red-200/90 rounded-xl p-3.5 shadow-xs bg-red-50/30">
              <div className="text-[11px] font-medium text-red-700 truncate">
                {isAr ? 'عالية الخطورة' : 'High Risk'}
              </div>
              <div className="text-2xl font-bold font-mono text-red-600 mt-1">
                {dashboardData.kpis.highRiskProjectsCount}
              </div>
              <div className="text-[10px] text-red-500 mt-0.5">{isAr ? 'حرجة استراتيجياً' : 'Critical triage'}</div>
            </div>

            {/* 10. Open Risks & Issues Ratio */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
              <div className="text-[11px] font-medium text-slate-500 truncate">
                {isAr ? 'نسبة المخاطر' : 'Risks Ratio'}
              </div>
              <div className="text-lg font-bold font-mono text-slate-800 mt-1.5 truncate">
                {dashboardData.kpis.openRisksAndIssuesRatio}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">{isAr ? 'مفتوحة / معالجة' : 'Open / Total'}</div>
            </div>
          </div>

          {/* VISUAL ANALYTICS SECTION: DONUT CHART, BAR CHART & UPCOMING MILESTONES */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart 1: Project Health Status Donut */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <PieChartIcon className="w-4 h-4 text-blue-600" />
                    <span>{isAr ? 'حالة سلامة المشاريع' : 'Project Health Status'}</span>
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    {dashboardData.kpis.totalProjects} {isAr ? 'مشروع' : 'Projects'}
                  </span>
                </div>

                {/* Donut Chart Visual SVG */}
                <div className="py-6 flex items-center justify-center">
                  <div className="relative w-44 h-44">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      {/* Background Circle */}
                      <circle cx="50" cy="50" r="38" fill="transparent" stroke="#f1f5f9" strokeWidth="16" />
                      {/* On Track Slice (emerald) */}
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        fill="transparent"
                        stroke="#10b981"
                        strokeWidth="16"
                        strokeDasharray={`${(dashboardData.kpis.healthDistribution.onTrack / dashboardData.kpis.totalProjects) * 238.76} 238.76`}
                        strokeDashoffset="0"
                      />
                      {/* At Risk Slice (amber) */}
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        fill="transparent"
                        stroke="#f59e0b"
                        strokeWidth="16"
                        strokeDasharray={`${(dashboardData.kpis.healthDistribution.atRisk / dashboardData.kpis.totalProjects) * 238.76} 238.76`}
                        strokeDashoffset={`-${(dashboardData.kpis.healthDistribution.onTrack / dashboardData.kpis.totalProjects) * 238.76}`}
                      />
                      {/* Delayed Slice (rose) */}
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        fill="transparent"
                        stroke="#f43f5e"
                        strokeWidth="16"
                        strokeDasharray={`${(dashboardData.kpis.healthDistribution.delayed / dashboardData.kpis.totalProjects) * 238.76} 238.76`}
                        strokeDashoffset={`-${((dashboardData.kpis.healthDistribution.onTrack + dashboardData.kpis.healthDistribution.atRisk) / dashboardData.kpis.totalProjects) * 238.76}`}
                      />
                      {/* Completed Slice (blue) */}
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        fill="transparent"
                        stroke="#3b82f6"
                        strokeWidth="16"
                        strokeDasharray={`${(dashboardData.kpis.healthDistribution.completed / dashboardData.kpis.totalProjects) * 238.76} 238.76`}
                        strokeDashoffset={`-${((dashboardData.kpis.healthDistribution.onTrack + dashboardData.kpis.healthDistribution.atRisk + dashboardData.kpis.healthDistribution.delayed) / dashboardData.kpis.totalProjects) * 238.76}`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold font-mono text-slate-800">
                        {Math.round(
                          (dashboardData.kpis.healthDistribution.onTrack / dashboardData.kpis.totalProjects) * 100
                        )}
                        %
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {isAr ? 'سليمة' : 'On Track'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/60 text-emerald-800">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <span>{isAr ? 'في المسار' : 'On Track'}</span>
                  </span>
                  <span className="font-mono font-bold">{dashboardData.kpis.healthDistribution.onTrack}</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50/60 text-amber-800">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    <span>{isAr ? 'معرض للخطر' : 'At Risk'}</span>
                  </span>
                  <span className="font-mono font-bold">{dashboardData.kpis.healthDistribution.atRisk}</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-rose-50/60 text-rose-800">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                    <span>{isAr ? 'متأخرة' : 'Delayed'}</span>
                  </span>
                  <span className="font-mono font-bold">{dashboardData.kpis.healthDistribution.delayed}</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50/60 text-blue-800">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                    <span>{isAr ? 'مكتملة' : 'Completed'}</span>
                  </span>
                  <span className="font-mono font-bold">{dashboardData.kpis.healthDistribution.completed}</span>
                </div>
              </div>
            </div>

            {/* Chart 2: Open Items by Type Bar Chart */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-600" />
                    <span>{isAr ? 'العناصر المفتوحة حسب النوع' : 'Open Items by Type'}</span>
                  </h3>
                  <span className="text-[11px] text-slate-400">{isAr ? 'معالم، مهام، مسارات' : 'WBS breakdown'}</span>
                </div>

                <div className="py-6 space-y-4">
                  {/* Milestones bar */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                        <span>{isAr ? 'المعالم الرئيسية' : 'Milestones'}</span>
                      </span>
                      <span className="font-mono font-bold text-slate-900">
                        {dashboardData.kpis.openItemsByType.milestones} {isAr ? 'عنصر' : 'items'}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-indigo-500 h-3 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(
                            100,
                            (dashboardData.kpis.openItemsByType.milestones /
                              (dashboardData.kpis.openItemsByType.tasks + 10)) *
                              100
                          )}%`
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* Tasks bar */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        <span>{isAr ? 'المهام والأنشطة التنفيذية' : 'Tasks & Activities'}</span>
                      </span>
                      <span className="font-mono font-bold text-slate-900">
                        {dashboardData.kpis.openItemsByType.tasks} {isAr ? 'عنصر' : 'items'}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-blue-500 h-3 rounded-full transition-all duration-500"
                        style={{ width: '85%' }}
                      ></div>
                    </div>
                  </div>

                  {/* Workstreams bar */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span>{isAr ? 'مسارات العمل' : 'Workstreams'}</span>
                      </span>
                      <span className="font-mono font-bold text-slate-900">
                        {dashboardData.kpis.openItemsByType.workstreams} {isAr ? 'مسار' : 'tracks'}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-3 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(
                            100,
                            (dashboardData.kpis.openItemsByType.workstreams / 15) * 100
                          )}%`
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-500 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-blue-500 shrink-0" />
                <span>
                  {isAr
                    ? 'يتم تحديث حزم العمل والمحطات الزمنية فورياً وفق إنجاز الفرق الميدانية.'
                    : 'Work packages and gates update in real time from field activity logs.'}
                </span>
              </div>
            </div>

            {/* List 3: Upcoming Milestones (30 Days) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-amber-600" />
                    <span>{isAr ? 'المعالم القادمة (خلال 30 يوماً)' : 'Upcoming Milestones (30 Days)'}</span>
                  </h3>
                  <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                    {dashboardData.kpis.upcomingMilestones30Days.length} {isAr ? 'معلم' : 'Due'}
                  </span>
                </div>

                <div className="py-2 space-y-2.5 max-h-64 overflow-y-auto">
                  {dashboardData.kpis.upcomingMilestones30Days.map((m) => (
                    <div
                      key={m.id}
                      className="p-3 rounded-xl border border-slate-100 hover:border-slate-300 hover:bg-slate-50/70 transition-all flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 truncate">
                          {pickLocalized(lang, m.name, m.nameAr)}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <span className="truncate">{pickLocalized(lang, m.projectName, m.projectNameAr)}</span>
                          <span>•</span>
                          <span className="text-slate-400">{pickLocalized(lang, m.ownerName, m.ownerNameAr)}</span>
                        </div>
                      </div>

                      <div className="text-end shrink-0">
                        <span className="font-mono text-[11px] font-bold text-amber-700 block">
                          {m.dueDate}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                            m.status === 'Completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : m.isDelayed
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {translateStatus(m.status, lang)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>{isAr ? 'إجمالي المعالم الحرجة' : 'Critical gate reviews'}</span>
                <button
                  type="button"
                  onClick={() => setActiveView('master-tasks')}
                  className="text-blue-600 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>{isAr ? 'عرض الكل' : 'View all'}</span>
                  <ChevronRight className={`w-3.5 h-3.5 ${isAr ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {/* PROJECTS DATA GRID (EXECUTIVE VIEW) */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <FolderKanban className="w-4 h-4 text-blue-600" />
                  <span>{isAr ? 'سجل مشاريع المكتب والمؤشرات التفصيلية' : 'PMO Projects Master Performance Grid'}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isAr
                    ? 'جدول تفصيلي لنسب الإنجاز الفعلي والمخطط، انحرافات الجدول، إشارات التأخير، ومدراء المشاريع.'
                    : 'Detailed project metrics: planned vs actual progress, variance %, delay flags, and manager accountability.'}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={isAr ? 'بحث في المشاريع...' : 'Search projects...'}
                    className="ps-8 pe-3 py-1.5 bg-slate-50 border border-slate-200 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 text-start">{isAr ? 'المشروع' : 'Project Name'}</th>
                    <th className="py-3 px-3 text-start">{isAr ? 'الإدارة / القطاع' : 'Department'}</th>
                    <th className="py-3 px-3 text-start">{isAr ? 'المبادرة الاستراتيجية' : 'Strategic Initiative'}</th>
                    <th className="py-3 px-3 text-start">{isAr ? 'مدير المشروع' : 'Project Manager'}</th>
                    <th className="py-3 px-3 text-center">{isAr ? 'الحالة الصحية' : 'Health Status'}</th>
                    <th className="py-3 px-3 text-center">{isAr ? 'الإنجاز الفعلي' : 'Actual %'}</th>
                    <th className="py-3 px-3 text-center">{isAr ? 'المخطط' : 'Planned %'}</th>
                    <th className="py-3 px-3 text-center">{isAr ? 'الانحراف' : 'Variance %'}</th>
                    <th className="py-3 px-3 text-center">{isAr ? 'العناصر المتأخرة' : 'Overdue Items'}</th>
                    <th className="py-3 px-4 text-end">{isAr ? 'تاريخ الانتهاء / الإشارات' : 'End Date / Delay Flags'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDashboardProjects.map((proj) => (
                    <tr
                      key={proj.id}
                      onClick={() => setInspectingProject(proj)}
                      className="hover:bg-blue-50/30 transition-colors cursor-pointer group"
                    >
                      {/* Name */}
                      <td className="py-3.5 px-4 font-semibold text-slate-900 group-hover:text-blue-600">
                        <div className="flex items-center gap-2">
                          <FolderKanban className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span>{isAr ? proj.nameAr || proj.name : proj.name}</span>
                        </div>
                      </td>

                      {/* Department */}
                      <td className="py-3.5 px-3 text-slate-600">
                        {isAr ? proj.departmentNameAr || proj.departmentName : proj.departmentName}
                      </td>

                      {/* Initiative */}
                      <td className="py-3.5 px-3 text-slate-500">
                        <span
                          className="truncate max-w-[180px] inline-block"
                          title={pickLocalized(lang, proj.initiativeName, proj.initiativeNameAr)}
                        >
                          {pickLocalized(lang, proj.initiativeName, proj.initiativeNameAr)}
                        </span>
                      </td>

                      {/* Project Manager */}
                      <td className="py-3.5 px-3 text-slate-700">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] inline-flex items-center justify-center shrink-0">
                            {pickLocalized(lang, proj.projectManagerName, proj.projectManagerNameAr).slice(0, 2).toUpperCase()}
                          </span>
                          <span className="truncate">
                            {pickLocalized(lang, proj.projectManagerName, proj.projectManagerNameAr)}
                          </span>
                        </div>
                      </td>

                      {/* Health Status */}
                      <td className="py-3.5 px-3 text-center">{getHealthBadge(proj.healthStatus)}</td>

                      {/* Actual Progress */}
                      <td className="py-3.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5 font-mono font-bold text-slate-800">
                          <span>{proj.actualProgressPercentage}%</span>
                          <div className="w-12 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-blue-600 h-1.5 rounded-full"
                              style={{ width: `${proj.actualProgressPercentage}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>

                      {/* Planned Progress */}
                      <td className="py-3.5 px-3 text-center font-mono text-slate-500">
                        {proj.plannedProgressPercentage}%
                      </td>

                      {/* Variance % */}
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`font-mono font-bold inline-flex items-center gap-0.5 ${
                            proj.variancePercentage >= 0
                              ? 'text-emerald-600'
                              : proj.variancePercentage > -10
                              ? 'text-amber-600'
                              : 'text-rose-600'
                          }`}
                        >
                          {proj.variancePercentage >= 0 ? '+' : ''}
                          {proj.variancePercentage}%
                        </span>
                      </td>

                      {/* Overdue Items Count */}
                      <td className="py-3.5 px-3 text-center font-mono">
                        {proj.overdueActivityCount > 0 ? (
                          <span className="px-2 py-0.5 rounded font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            {proj.overdueActivityCount}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>

                      {/* End Date / Delay Flags */}
                      <td className="py-3.5 px-4 text-end">
                        <div className="flex items-center justify-end gap-2 font-mono text-slate-600">
                          <span>{proj.endDate}</span>
                          {proj.delayFlags > 0 && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-0.5"
                              title={isAr ? `${proj.delayFlags} إشارات تأخير حرجة` : `${proj.delayFlags} critical delay flags`}
                            >
                              <AlertTriangle className="w-2.5 h-2.5" />
                              <span>{proj.delayFlags}</span>
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 2: DEPARTMENT KANBAN VIEW
         ========================================================================= */}
      {activeView === 'kanban' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Kanban className="w-5 h-5 text-blue-600" />
                <span>{isAr ? 'لوحة متابعة الإدارات والقطاعات التنظيمية' : 'Department Kanban & Executive Board'}</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {isAr
                  ? 'عرض أعمدة الإدارات، مسؤولي القطاع، نسبة الإنجاز المجمعة، بطاقات المشاريع، ومؤشرات التنبيه.'
                  : 'Column grouping by Department: Lead name, health badge, progress gauge %, and metric pill badges.'}
              </p>
            </div>

            <div className="text-xs text-slate-500 font-mono">
              {kanbanDepartments.length} {isAr ? 'إدارات تنظيمية' : 'Departments loaded'}
            </div>
          </div>

          {/* Kanban Columns Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
            {kanbanDepartments
              .filter(
                (dept) =>
                  selectedDepartmentFilter === 'all' || String(dept.id) === selectedDepartmentFilter
              )
              .map((dept) => (
                <div
                  key={dept.id}
                  className="bg-slate-50/80 border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 hover:border-slate-300 transition-all"
                >
                  {/* Kanban Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                          {dept.code}
                        </span>
                        <h3 className="font-bold text-slate-900 text-sm truncate">
                          {pickLocalized(lang, dept.name, dept.nameAr)}
                        </h3>
                      </div>

                      {/* Lead Name & Avatar */}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-[10px] inline-flex items-center justify-center shrink-0">
                          {pickLocalized(lang, dept.leadName, dept.leadNameAr).slice(0, 2).toUpperCase()}
                        </span>
                        <div className="text-xs text-slate-600 truncate">
                          <span className="font-semibold text-slate-800">
                            {pickLocalized(lang, dept.leadName, dept.leadNameAr)}
                          </span>
                          <span className="text-slate-400 ms-1 text-[11px]">
                            ({translateLeadRole(dept.leadRole, lang)})
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">{getHealthBadge(dept.healthStatus)}</div>
                  </div>

                  {/* Progress Gauge % */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">
                        {isAr ? 'معدل إنجاز القطاع' : 'Department Progress Gauge'}
                      </span>
                      <span className="font-mono font-bold text-slate-800">{dept.progressPercentage}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          dept.progressPercentage >= 60
                            ? 'bg-emerald-500'
                            : dept.progressPercentage >= 30
                            ? 'bg-blue-500'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${dept.progressPercentage}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Metric Pill Badges: Initiatives, Projects, Milestones, Tasks, Workstreams */}
                  <div className="grid grid-cols-3 gap-1.5 text-[11px] pt-1">
                    <div className="p-2 rounded-lg bg-white border border-slate-200/80 text-center">
                      <div className="text-slate-400 text-[10px] truncate">{isAr ? 'مبادرات' : 'Initiatives'}</div>
                      <div className="font-mono font-bold text-slate-800 mt-0.5">
                        {dept.metrics.initiativesCount}
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-white border border-slate-200/80 text-center">
                      <div className="text-slate-400 text-[10px] truncate">{isAr ? 'مشاريع' : 'Projects'}</div>
                      <div className="font-mono font-bold text-blue-600 mt-0.5">
                        {dept.metrics.projectsCount}
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-white border border-slate-200/80 text-center">
                      <div className="text-slate-400 text-[10px] truncate">{isAr ? 'معالم' : 'Milestones'}</div>
                      <div className="font-mono font-bold text-indigo-600 mt-0.5">
                        {dept.metrics.milestonesCount}
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-white border border-slate-200/80 text-center">
                      <div className="text-slate-400 text-[10px] truncate">{isAr ? 'مهام' : 'Tasks'}</div>
                      <div className="font-mono font-bold text-slate-800 mt-0.5">
                        {dept.metrics.tasksCount}
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-white border border-slate-200/80 text-center">
                      <div className="text-slate-400 text-[10px] truncate">{isAr ? 'مسارات' : 'Workstreams'}</div>
                      <div className="font-mono font-bold text-slate-800 mt-0.5">
                        {dept.metrics.workstreamsCount}
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-white border border-slate-200/80 text-center">
                      <div className="text-slate-400 text-[10px] truncate">{isAr ? 'الميزانية' : 'Budget'}</div>
                      <div className="font-mono font-bold text-slate-700 mt-0.5 text-[10px]">
                        {formatSar(dept.totalBudget)}
                      </div>
                    </div>
                  </div>

                  {/* Overdue Items Alert */}
                  {dept.metrics.overdueItemsCount > 0 ? (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        <span>
                          {dept.metrics.overdueItemsCount} {isAr ? 'عناصر متأخرة' : 'Overdue Items Alert'}
                        </span>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-rose-600">{isAr ? 'عاجل' : 'Alert'}</span>
                    </div>
                  ) : (
                    <div className="p-2 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-800 text-[11px] flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{isAr ? 'لا توجد عناصر متأخرة في هذه الإدارة' : 'No overdue items reported'}</span>
                    </div>
                  )}

                  {/* Project Cards inside this Department */}
                  <div className="space-y-2 pt-2">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      {isAr ? 'المشاريع الجارية بالقطاع:' : 'Active Sector Projects:'}
                    </div>

                    {dept.allocatedProjects.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => setInspectingProject(p)}
                        className="bg-white border border-slate-200 rounded-xl p-3 hover:border-blue-400 hover:shadow-xs transition-all cursor-pointer group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-semibold text-slate-800 text-xs group-hover:text-blue-600 truncate">
                            {isAr ? p.nameAr || p.name : p.name}
                          </div>
                          {getHealthBadge(p.healthStatus)}
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                          <span>{pickLocalized(lang, p.projectManagerName, p.projectManagerNameAr)}</span>
                          <span className="font-mono font-bold text-slate-800">
                            {p.actualProgressPercentage}%
                          </span>
                        </div>

                        <div className="w-full bg-slate-100 rounded-full h-1 mt-1 overflow-hidden">
                          <div
                            className="bg-blue-600 h-1 rounded-full"
                            style={{ width: `${p.actualProgressPercentage}%` }}
                          ></div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 pt-1 border-t border-slate-50">
                          <span>{formatSar(p.availableBudget)}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewTasksForProject(p.id);
                            }}
                            className="text-blue-600 hover:underline font-semibold flex items-center gap-0.5"
                          >
                            <span>{isAr ? 'المهام' : 'Tasks'}</span>
                            <ArrowUpRight className={`w-3 h-3 ${isAr ? '-scale-x-100' : ''}`} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 3: SINGLE-PAGE PROJECTS & HIGH-RISK INITIATIVES
         ========================================================================= */}
      {activeView === 'single-page-projects' && (
        <div className="space-y-6">
          {/* Top Filter Tabs: Single Page Projects vs High Risk Initiatives */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSinglePageViewMode('projects')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  singlePageViewMode === 'projects'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>{isAr ? 'قائمة المشاريع ذات الصفحة الواحدة' : 'Single Page Projects List'}</span>
                <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-black/20 text-white">
                  {singleProjects.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSinglePageViewMode('high-risk-initiatives')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  singlePageViewMode === 'high-risk-initiatives'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                <span>{isAr ? 'المبادرات عالية الخطورة' : 'High Risk Initiatives'}</span>
                <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-black/20 text-white">
                  {highRiskInitiatives.length}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isAr ? 'بحث سريع...' : 'Quick search...'}
                  className="ps-8 pe-3 py-1.5 bg-slate-50 border border-slate-200 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
                />
              </div>

              {selectedProjectIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleOpenExportPpt}
                  className="px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>
                    {isAr
                      ? `تصدير المحدد (${selectedProjectIds.length})`
                      : `Export Selected (${selectedProjectIds.length})`}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* TABLE: SINGLE PAGE PROJECTS LIST */}
          {singlePageViewMode === 'projects' && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start border-collapse">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-3 text-center w-10">
                        <input
                          type="checkbox"
                          checked={
                            selectedProjectIds.length === filteredSingleProjects.length &&
                            filteredSingleProjects.length > 0
                          }
                          onChange={handleToggleSelectAllProjects}
                          className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </th>
                      <th className="py-3 px-3 text-start">{isAr ? 'اسم المشروع' : 'Project Name'}</th>
                      <th className="py-3 px-3 text-start">{isAr ? 'العميل / المنظمة' : 'Client / Organization'}</th>
                      <th className="py-3 px-3 text-start">{isAr ? 'الإدارة' : 'Department'}</th>
                      <th className="py-3 px-3 text-start">{isAr ? 'المبادرة المرتبطة' : 'Strategic Initiative'}</th>
                      <th className="py-3 px-3 text-center">{isAr ? 'نسبة الإنجاز' : 'Progress %'}</th>
                      <th className="py-3 px-3 text-center">{isAr ? 'الانحراف' : 'Variance %'}</th>
                      <th className="py-3 px-3 text-center">{isAr ? 'الحالة الصحية' : 'Health Badge'}</th>
                      <th className="py-3 px-3 text-center">{isAr ? 'مستوى الخطورة' : 'Risk Level'}</th>
                      <th className="py-3 px-3 text-center">{isAr ? 'المهام المفتوحة' : 'Open Tasks'}</th>
                      <th className="py-3 px-3 text-end">{isAr ? 'الميزانية المتاحة' : 'Available Budget'}</th>
                      <th className="py-3 px-3 text-start">{isAr ? 'مدير المشروع' : 'Project Manager'}</th>
                      <th className="py-3 px-3 text-center">{isAr ? 'إجراء سريع' : 'Quick Action'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSingleProjects.map((p) => {
                      const isSelected = selectedProjectIds.includes(p.id);
                      return (
                        <tr
                          key={p.id}
                          className={`hover:bg-blue-50/40 transition-colors ${
                            isSelected ? 'bg-blue-50/60' : ''
                          }`}
                        >
                          <td className="py-3 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleProjectSelection(p.id)}
                              className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>

                          {/* Name */}
                          <td className="py-3 px-3 font-semibold text-slate-900">
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                              <span>{isAr ? p.nameAr || p.name : p.name}</span>
                            </div>
                          </td>

                          {/* Client / Organization (Cultural Development Fund) */}
                          <td className="py-3 px-3 text-slate-600">
                            <span className="px-2 py-0.5 rounded bg-slate-100 font-medium text-[11px] text-slate-700">
                              {isAr ? p.clientOrganizationAr || p.clientOrganization : p.clientOrganization}
                            </span>
                          </td>

                          {/* Department */}
                          <td className="py-3 px-3 text-slate-600">
                            {pickLocalized(lang, p.departmentName, p.departmentNameAr)}
                          </td>

                          {/* Initiative Link */}
                          <td
                            className="py-3 px-3 text-slate-500 max-w-[150px] truncate"
                            title={pickLocalized(lang, p.initiativeName, p.initiativeNameAr)}
                          >
                            {pickLocalized(lang, p.initiativeName, p.initiativeNameAr)}
                          </td>

                          {/* Progress % */}
                          <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">
                            {p.actualProgressPercentage}%
                          </td>

                          {/* Variance % */}
                          <td className="py-3 px-3 text-center font-mono font-bold">
                            <span
                              className={
                                p.variancePercentage >= 0
                                  ? 'text-emerald-600'
                                  : p.variancePercentage > -10
                                  ? 'text-amber-600'
                                  : 'text-rose-600'
                              }
                            >
                              {p.variancePercentage >= 0 ? '+' : ''}
                              {p.variancePercentage}%
                            </span>
                          </td>

                          {/* Health Status Badge */}
                          <td className="py-3 px-3 text-center">{getHealthBadge(p.healthStatus)}</td>

                          {/* Risk Level Badge */}
                          <td className="py-3 px-3 text-center">{getRiskBadge(p.riskLevel)}</td>

                          {/* Open Tasks Count */}
                          <td className="py-3 px-3 text-center font-mono text-slate-700">
                            {p.openTasksCount}
                          </td>

                          {/* Available Budget */}
                          <td className="py-3 px-3 text-end font-mono font-bold text-slate-800">
                            {formatSar(p.availableBudget)}
                          </td>

                          {/* PM */}
                          <td className="py-3 px-3 text-slate-700">
                            {pickLocalized(lang, p.projectManagerName, p.projectManagerNameAr)}
                          </td>

                          {/* Action: View Tasks */}
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleViewTasksForProject(p.id)}
                              className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-semibold transition-colors flex items-center justify-center gap-1 mx-auto cursor-pointer"
                            >
                              <CheckSquare className="w-3 h-3 text-blue-600" />
                              <span>{isAr ? 'عرض المهام' : 'View Tasks'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TABLE: HIGH RISK INITIATIVES */}
          {singlePageViewMode === 'high-risk-initiatives' && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 bg-red-50/40 border-b border-red-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-600" />
                  <div>
                    <h3 className="font-bold text-red-950 text-sm">
                      {isAr ? 'المبادرات الاستراتيجية المعرضة للمخاطر الحرجة' : 'High Risk & Delayed Strategic Initiatives'}
                    </h3>
                    <p className="text-[11px] text-red-700">
                      {isAr
                        ? 'تجميع الميزانيات ونسب الإنجاز المتأخرة المنعكسة تلقائياً من مشاريع ومهام المبادرة.'
                        : 'Budget and progress rolled up from projects, triggering cascading risk alerts.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4 text-start">{isAr ? 'المبادرة الاستراتيجية' : 'Initiative Name'}</th>
                      <th className="py-3 px-3 text-start">{isAr ? 'الإدارة' : 'Department'}</th>
                      <th className="py-3 px-3 text-center">{isAr ? 'المشاريع المرتبطة' : 'Linked Projects'}</th>
                      <th className="py-3 px-3 text-center">{isAr ? 'الإنجاز الفعلي' : 'Actual %'}</th>
                      <th className="py-3 px-3 text-center">{isAr ? 'المخطط' : 'Planned %'}</th>
                      <th className="py-3 px-3 text-center">{isAr ? 'الانحراف' : 'Variance %'}</th>
                      <th className="py-3 px-3 text-center">{isAr ? 'إشارات التأخير' : 'Delay Flags'}</th>
                      <th className="py-3 px-3 text-center">{isAr ? 'مستوى الخطورة' : 'Risk Level'}</th>
                      <th className="py-3 px-3 text-end">{isAr ? 'الميزانية الكلية' : 'Total Budget'}</th>
                      <th className="py-3 px-4 text-center">{isAr ? 'الحالة الصحية' : 'Health Badge'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredHighRiskInitiatives.map((init) => (
                      <tr key={init.id} className="hover:bg-red-50/20 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            <Compass className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>{isAr ? init.nameAr || init.name : init.name}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-slate-600">
                          {pickLocalized(lang, init.departmentName, init.departmentNameAr)}
                        </td>

                        <td className="py-3.5 px-3 text-center font-mono font-bold text-blue-600">
                          {init.linkedProjectsCount}
                        </td>

                        <td className="py-3.5 px-3 text-center font-mono font-bold text-slate-800">
                          {init.actualProgressPercentage}%
                        </td>

                        <td className="py-3.5 px-3 text-center font-mono text-slate-500">
                          {init.plannedProgressPercentage}%
                        </td>

                        <td className="py-3.5 px-3 text-center font-mono font-bold text-rose-600">
                          {init.variancePercentage}%
                        </td>

                        <td className="py-3.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded font-mono font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            {init.delayFlagsCount}
                          </span>
                        </td>

                        <td className="py-3.5 px-3 text-center">{getRiskBadge(init.riskLevel)}</td>

                        <td className="py-3.5 px-3 text-end font-mono font-bold text-slate-800">
                          {formatSar(init.totalBudget)}
                        </td>

                        <td className="py-3.5 px-4 text-center">{getHealthBadge(init.healthStatus)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          VIEW 4: MASTER TASKS & WORKSTREAMS MANAGEMENT
         ========================================================================= */}
      {activeView === 'master-tasks' && (
        <div className="space-y-6">
          {/* Toolbar Views: List, Kanban, Gantt, Calendar, Map, Pivot, Dashboard */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1.5 rounded-xl">
              {/* List */}
              <button
                type="button"
                onClick={() => setMasterTaskViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  masterTaskViewMode === 'list'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>{isAr ? 'قائمة' : 'List'}</span>
              </button>

              {/* Kanban */}
              <button
                type="button"
                onClick={() => setMasterTaskViewMode('kanban')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  masterTaskViewMode === 'kanban'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Kanban className="w-3.5 h-3.5" />
                <span>{isAr ? 'لوحة المراحل' : 'Kanban'}</span>
              </button>

              {/* Gantt */}
              <button
                type="button"
                onClick={() => setMasterTaskViewMode('gantt')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  masterTaskViewMode === 'gantt'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>{isAr ? 'الجدول الزمني' : 'Gantt'}</span>
              </button>

              {/* Calendar */}
              <button
                type="button"
                onClick={() => setMasterTaskViewMode('calendar')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  masterTaskViewMode === 'calendar'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{isAr ? 'التقويم' : 'Calendar'}</span>
              </button>

              {/* Map */}
              <button
                type="button"
                onClick={() => setMasterTaskViewMode('map')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  masterTaskViewMode === 'map'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>{isAr ? 'الخريطة' : 'Map'}</span>
              </button>

              {/* Pivot */}
              <button
                type="button"
                onClick={() => setMasterTaskViewMode('pivot')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  masterTaskViewMode === 'pivot'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>{isAr ? 'الجدول المحوري' : 'Pivot'}</span>
              </button>

              {/* Dashboard */}
              <button
                type="button"
                onClick={() => setMasterTaskViewMode('dashboard')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  masterTaskViewMode === 'dashboard'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>{isAr ? 'لوحة المؤشرات' : 'Dashboard'}</span>
              </button>
            </div>

            {/* Quick Project Filter */}
            <div className="flex items-center gap-2">
              {selectedTaskProjectFilter !== null && (
                <button
                  type="button"
                  onClick={() => setSelectedTaskProjectFilter(null)}
                  className="px-2.5 py-1 rounded-lg bg-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-300 flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  <span>{isAr ? 'إلغاء حصر المشروع' : 'Clear project filter'}</span>
                </button>
              )}

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isAr ? 'بحث في المهام والمسارات...' : 'Search tasks & workstreams...'}
                  className="ps-8 pe-3 py-1.5 bg-slate-50 border border-slate-200 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 w-52"
                />
              </div>
            </div>
          </div>

          {/* LIST VIEW (DATA GRID) */}
          {masterTaskViewMode === 'list' && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start border-collapse">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-3 text-center w-8">★</th>
                      <th className="py-3 px-4 text-start">{isAr ? 'عنوان البند / المهمة' : 'Task / Workstream Title'}</th>
                      <th className="py-3 px-3 text-start">{isAr ? 'المشروع الأب' : 'Parent Project'}</th>
                      <th className="py-3 px-3 text-center">{isAr ? 'نوع البند' : 'Item Type'}</th>
                      <th className="py-3 px-3 text-center">{isAr ? 'نسبة الإنجاز' : 'Progress %'}</th>
                      <th className="py-3 px-3 text-center">{isAr ? 'الانحراف' : 'Variance %'}</th>
                      <th className="py-3 px-3 text-center">{isAr ? 'سلامة خط الأساس' : 'Baseline Health'}</th>
                      <th className="py-3 px-3 text-center">{isAr ? 'حالة الاعتماد' : 'Approval Status'}</th>
                      <th className="py-3 px-3 text-start">{isAr ? 'الإدارة' : 'Department'}</th>
                      <th className="py-3 px-3 text-start">{isAr ? 'المسؤول' : 'Assignee'}</th>
                      <th className="py-3 px-3 text-center">{isAr ? 'الأولوية (1-3)' : 'Priority (1-3)'}</th>
                      <th className="py-3 px-3 text-center">{isAr ? 'المرحلة' : 'Stage'}</th>
                      <th className="py-3 px-4 text-end">{isAr ? 'الموعد / التذكير القادم' : 'Due / Next Activity Reminder'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredMasterTasks.map((t) => (
                      <tr key={t.uniqueKey} className="hover:bg-blue-50/40 transition-colors">
                        {/* Star Icon */}
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleStarTask(t.uniqueKey)}
                            className="cursor-pointer text-slate-300 hover:text-amber-400"
                          >
                            <Star
                              className={`w-4 h-4 ${
                                t.isStarred ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                              }`}
                            />
                          </button>
                        </td>

                        {/* Title */}
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            <span>{isAr ? t.titleAr || t.title : t.title}</span>
                          </div>
                        </td>

                        {/* Parent Project */}
                        <td className="py-3 px-3 text-slate-600">
                          <button
                            type="button"
                            onClick={() => setSelectedTaskProjectFilter(t.projectId)}
                            className="hover:text-blue-600 hover:underline text-start cursor-pointer truncate max-w-[140px] block"
                            title={pickLocalized(lang, t.projectName, t.projectNameAr)}
                          >
                            {pickLocalized(lang, t.projectName, t.projectNameAr)}
                          </button>
                        </td>

                        {/* Item Type */}
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              t.itemType === 'Workstream'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : t.itemType === 'Milestone'
                                ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                : 'bg-blue-100 text-blue-800 border border-blue-200'
                            }`}
                          >
                            {translateItemType(t.itemType, lang)}
                          </span>
                        </td>

                        {/* Progress % */}
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">
                          {t.actualProgress}%
                        </td>

                        {/* Variance % */}
                        <td className="py-3 px-3 text-center font-mono font-bold">
                          <span
                            className={
                              t.variancePercentage >= 0
                                ? 'text-emerald-600'
                                : t.variancePercentage > -10
                                ? 'text-amber-600'
                                : 'text-rose-600'
                            }
                          >
                            {t.variancePercentage >= 0 ? '+' : ''}
                            {t.variancePercentage}%
                          </span>
                        </td>

                        {/* Baseline Health Badge */}
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              t.baselineHealth === 'Ahead'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : t.baselineHealth === 'On Track'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : t.baselineHealth === 'Behind'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {translateBaselineHealth(t.baselineHealth, lang)}
                          </span>
                        </td>

                        {/* Approval Status */}
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              t.approvalStatus === 'Approved'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : t.approvalStatus === 'Pending Review'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {translateApprovalStatus(t.approvalStatus, lang)}
                          </span>
                        </td>

                        {/* Department */}
                        <td className="py-3 px-3 text-slate-600">
                          {pickLocalized(lang, t.departmentName, t.departmentNameAr)}
                        </td>

                        {/* Assignee */}
                        <td className="py-3 px-3 text-slate-700">
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-bold text-[9px] inline-flex items-center justify-center shrink-0">
                              {pickLocalized(lang, t.assigneeName, t.assigneeNameAr).slice(0, 2).toUpperCase()}
                            </span>
                            <span className="truncate">
                              {pickLocalized(lang, t.assigneeName, t.assigneeNameAr)}
                            </span>
                          </div>
                        </td>

                        {/* Priority (1-3 Stars) */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-0.5">
                            {[1, 2, 3].map((starVal) => (
                              <button
                                key={starVal}
                                type="button"
                                onClick={() => changeTaskPriority(t.uniqueKey, starVal as 1 | 2 | 3)}
                                className="cursor-pointer text-slate-300 hover:text-amber-400"
                              >
                                <Star
                                  className={`w-3.5 h-3.5 ${
                                    starVal <= t.priorityStars
                                      ? 'fill-amber-400 text-amber-400'
                                      : 'text-slate-200'
                                  }`}
                                />
                              </button>
                            ))}
                          </div>
                        </td>

                        {/* Stage */}
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                            {translateStage(t.stage, lang)}
                          </span>
                        </td>

                        {/* Next Activity / Delay Reminder */}
                        <td className="py-3 px-4 text-end">
                          <div className="font-mono text-slate-700">{t.dueDate}</div>
                          {(t.nextActivityReminder || t.nextActivityReminderAr) && (
                            <div className="text-[10px] text-amber-600 truncate max-w-[150px] inline-block font-medium">
                              {pickLocalized(lang, t.nextActivityReminder, t.nextActivityReminderAr)}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* KANBAN VIEW FOR MASTER TASKS */}
          {masterTaskViewMode === 'kanban' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
              {(['Planning', 'Execution', 'Review', 'Completed'] as const).map((colStage) => {
                const stageTasks = filteredMasterTasks.filter((t) => t.stage === colStage);
                return (
                  <div key={colStage} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <h4 className="font-bold text-slate-800 text-xs">{translateStage(colStage, lang)}</h4>
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                        {stageTasks.length}
                      </span>
                    </div>

                    <div className="space-y-2.5 max-h-[600px] overflow-y-auto">
                      {stageTasks.map((task) => (
                        <div
                          key={task.uniqueKey}
                          className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2 hover:border-blue-400 transition-all"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-semibold text-slate-900 text-xs">
                              {pickLocalized(lang, task.title, task.titleAr)}
                            </span>
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                                task.itemType === 'Workstream'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : task.itemType === 'Milestone'
                                  ? 'bg-indigo-50 text-indigo-700'
                                  : 'bg-blue-50 text-blue-700'
                              }`}
                            >
                              {translateItemType(task.itemType, lang)}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-500 truncate">
                            {pickLocalized(lang, task.projectName, task.projectNameAr)}
                          </div>

                          <div className="flex items-center justify-between text-xs pt-1">
                            <span className="text-slate-600">
                              {pickLocalized(lang, task.assigneeName, task.assigneeNameAr)}
                            </span>
                            <span className="font-mono font-bold text-slate-800">{task.actualProgress}%</span>
                          </div>

                          <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                            <div
                              className="bg-blue-600 h-1 rounded-full"
                              style={{ width: `${task.actualProgress}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* GANTT TIMELINE PREVIEW */}
          {masterTaskViewMode === 'gantt' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-blue-600" />
                  <span>{isAr ? 'الجدول الزمني لمسارات العمل والمعالم' : 'Interactive Gantt Baseline Timeline'}</span>
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  {isAr ? 'الربع الأول 2026 – الربع الرابع 2026' : 'Q1 2026 – Q4 2026'}
                </span>
              </div>

              <div className="space-y-3 py-2">
                {filteredMasterTasks.slice(0, 10).map((t, idx) => (
                  <div key={t.uniqueKey} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800 truncate max-w-sm">
                        {pickLocalized(lang, t.title, t.titleAr)}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {t.startDate} {isAr ? '←' : '➔'} {t.dueDate}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-4 relative overflow-hidden flex items-center px-1">
                      <div
                        className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-end pe-2 text-[10px] font-bold text-white transition-all"
                        style={{
                          width: `${Math.max(15, t.actualProgress)}%`,
                          marginInlineStart: `${(idx % 4) * 12}%`
                        }}
                      >
                        {t.actualProgress}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CALENDAR VIEW */}
          {masterTaskViewMode === 'calendar' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  <span>{isAr ? 'التقويم الشهري للمواعيد الحرجة والتسليمات' : 'Monthly Milestone & Task Delivery Calendar'}</span>
                </h3>
                <span className="text-xs font-semibold text-slate-700">{isAr ? 'فبراير - أكتوبر 2026' : 'Feb - Oct 2026'}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {filteredMasterTasks.slice(0, 6).map((t) => (
                  <div key={t.uniqueKey} className="p-4 rounded-xl border border-slate-200 hover:border-blue-400 bg-slate-50/50 transition-all space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono text-[11px] font-bold">
                        {t.dueDate}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500">
                        {translateItemType(t.itemType, lang)}
                      </span>
                    </div>
                    <div className="font-semibold text-slate-800 text-xs">
                      {pickLocalized(lang, t.title, t.titleAr)}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {pickLocalized(lang, t.projectName, t.projectNameAr)}
                    </div>
                    <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-200/60 flex items-center justify-between">
                      <span>{pickLocalized(lang, t.assigneeName, t.assigneeNameAr)}</span>
                      <span className="font-mono font-bold text-slate-700">{t.actualProgress}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MAP VIEW */}
          {masterTaskViewMode === 'map' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-rose-600" />
                  <span>{isAr ? 'التوزيع الجغرافي للمشاريع ومواقع التنفيذ' : 'Geographical Deployment & Field Sites'}</span>
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  {isAr ? 'الرياض والمراكز الإقليمية' : 'Riyadh & Regional Hubs'}
                </span>
              </div>

              <div className="bg-slate-900 text-white rounded-xl p-8 relative overflow-hidden flex flex-col items-center justify-center min-h-[300px] border border-slate-800">
                <div className="absolute inset-0 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px] opacity-25"></div>
                <div className="relative z-10 text-center space-y-3 max-w-md">
                  <MapPin className="w-10 h-10 text-rose-500 mx-auto animate-bounce" />
                  <h4 className="font-bold text-lg text-white">
                    {isAr ? 'مواقع مبادرات الصندوق الثقافي بالمملكة' : 'Cultural Development Fund Site Nodes'}
                  </h4>
                  <p className="text-xs text-slate-300">
                    {isAr
                      ? 'تم ربط 14 موقعاً رئيسياً في الرياض، جدة، والعلا مع متابعة زمنية لفرق الدعم الميداني.'
                      : '14 strategic field sites mapped across Riyadh, Jeddah, and AlUla with active GPS coordination.'}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    <span className="px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs">
                      {isAr ? 'المركز الرقمي الرئيسي (الرياض)' : 'HQ Digital Hub (Riyadh)'}
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs">
                      {isAr ? 'مركز حاضنات الأعمال' : 'Incubation Center'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PIVOT & DASHBOARD VIEWS */}
          {(masterTaskViewMode === 'pivot' || masterTaskViewMode === 'dashboard') && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-purple-600" />
                  <span>
                    {masterTaskViewMode === 'pivot'
                      ? isAr
                        ? 'الجدول المحوري لتحليل وتوزيع المهام'
                        : 'Pivot Matrix & Cross-Tabulation'
                      : isAr
                      ? 'لوحة مؤشرات أداء مسارات العمل'
                      : 'Workstreams Performance Analytics'}
                  </span>
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-200">
                  <div className="text-xs text-purple-700 font-semibold">{isAr ? 'إجمالي المهام الموزعة' : 'Assigned Items'}</div>
                  <div className="text-2xl font-bold font-mono text-purple-900 mt-1">{filteredMasterTasks.length}</div>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200">
                  <div className="text-xs text-emerald-700 font-semibold">{isAr ? 'المهام ذات الأولوية القصوى' : '3-Star Critical Tasks'}</div>
                  <div className="text-2xl font-bold font-mono text-emerald-900 mt-1">
                    {filteredMasterTasks.filter((t) => t.priorityStars === 3).length}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200">
                  <div className="text-xs text-amber-700 font-semibold">{isAr ? 'المهام المعلقة للاعتماد' : 'Pending Approval'}</div>
                  <div className="text-2xl font-bold font-mono text-amber-900 mt-1">
                    {filteredMasterTasks.filter((t) => t.approvalStatus !== 'Approved').length}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          POWERPOINT PRESENTATION EXPORT MODAL
         ========================================================================= */}
      {exportModalOpen && exportPptData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-orange-500 to-amber-600 text-white">
              <div className="flex items-center gap-3">
                <Download className="w-5 h-5 text-white" />
                <div>
                  <h3 className="font-bold text-base">
                    {isAr ? 'عرض تقرير العرض التقديمي التنفيذي' : 'Executive PowerPoint Presentation Briefing'}
                  </h3>
                  <p className="text-xs text-orange-100">
                    {exportPptData.filename} • {exportPptData.slidesCount} {isAr ? 'شرائح عرض مجهزة' : 'Slides generated'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setExportModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Slide Viewer Navigation & Canvas */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-slate-50">
              {/* Slide Navigator Pills */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {exportPptData.slides.map((s: any, idx: number) => (
                    <button
                      key={s.slideNumber}
                      type="button"
                      onClick={() => setActiveSlideIndex(idx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        activeSlideIndex === idx
                          ? 'bg-orange-600 text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {isAr ? `شريحة ${s.slideNumber}` : `Slide ${s.slideNumber}`}
                    </button>
                  ))}
                </div>

                <div className="text-xs text-slate-500 font-mono">
                  {activeSlideIndex + 1} / {exportPptData.slidesCount}
                </div>
              </div>

              {/* Active Slide Canvas (16:9 Aspect Ratio) */}
              {(() => {
                const curSlide = exportPptData.slides[activeSlideIndex];
                if (!curSlide) return null;
                return (
                  <div className="bg-white border border-slate-300 rounded-xl p-8 shadow-md aspect-video flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 end-0 w-64 h-64 bg-orange-100/40 rounded-bl-full pointer-events-none -z-0"></div>

                    {/* Slide Top Banner */}
                    <div className="relative z-10">
                      <div className="flex items-center justify-between text-xs text-orange-600 font-semibold mb-2">
                        <span>{isAr ? 'الصندوق الثقافي • تقرير القيادة الاستراتيجية' : 'Cultural Development Fund • Strategic PMO'}</span>
                        <span className="font-mono">{new Date().toLocaleDateString(isAr ? 'ar-SA' : 'en-US')}</span>
                      </div>
                      <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                        {curSlide.title}
                      </h2>
                      {curSlide.subtitle && (
                        <p className="text-sm text-slate-500 mt-1">{curSlide.subtitle}</p>
                      )}
                    </div>

                    {/* Slide Body Content */}
                    <div className="relative z-10 py-4 flex-1 flex flex-col justify-center">
                      {curSlide.kpis && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {curSlide.kpis.map((k: any, i: number) => (
                            <div key={i} className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                              <div className="text-xs text-slate-500">{k.label}</div>
                              <div className="text-lg font-bold font-mono text-orange-600 mt-1">
                                {k.value}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {curSlide.criticalProjects && (
                        <div className="space-y-2">
                          <div className="text-xs font-bold text-slate-500 uppercase">
                            {isAr ? 'المشاريع ذات الأولوية القصوى:' : 'High Risk Priority Breakdown:'}
                          </div>
                          {curSlide.criticalProjects.map((p: any, i: number) => (
                            <div
                              key={i}
                              className="p-2.5 rounded-lg bg-red-50/70 border border-red-200 text-xs flex items-center justify-between"
                            >
                              <div>
                                <span className="font-bold text-slate-900">{p.name}</span>
                                <span className="text-slate-500 ms-2">({p.department})</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-mono font-bold text-rose-600">{p.variance}</span>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-rose-200 text-rose-900">
                                  {p.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {curSlide.strategicLinkages && (
                        <div className="space-y-2">
                          <div className="text-xs font-bold text-slate-500 uppercase">
                            {isAr ? 'الارتباط بالأهداف الاستراتيجية والميزانيات:' : 'Strategic Goals & Budget Impact:'}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {curSlide.strategicLinkages.map((link: any, i: number) => (
                              <div key={i} className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                                <div className="font-bold text-slate-900">{link.project}</div>
                                <div className="text-blue-600 mt-0.5 font-medium">{link.goal}</div>
                                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-1 border-t border-slate-200">
                                  <span>{link.budgetAllocated}</span>
                                  <span className="font-semibold text-emerald-600">{link.health}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {curSlide.presentedBy && (
                        <div className="text-center py-6 text-slate-600 space-y-1">
                          <div className="font-semibold">{curSlide.presentedBy}</div>
                          <div className="text-xs text-slate-400 font-mono">{curSlide.date}</div>
                        </div>
                      )}
                    </div>

                    {/* Slide Footer */}
                    <div className="relative z-10 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <span>
                        {isAr ? 'سري • عرض حوكمة مكتب إدارة المشاريع الداخلي' : 'Confidential • Internal PMO Governance Deck'}
                      </span>
                      <span className="font-mono">{curSlide.slideNumber}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={activeSlideIndex === 0}
                  onClick={() => setActiveSlideIndex((prev) => Math.max(0, prev - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                >
                  {isAr ? 'السابق' : 'Previous'}
                </button>
                <button
                  type="button"
                  disabled={activeSlideIndex === exportPptData.slidesCount - 1}
                  onClick={() =>
                    setActiveSlideIndex((prev) => Math.min(exportPptData.slidesCount - 1, prev + 1))
                  }
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                >
                  {isAr ? 'التالي' : 'Next'}
                </button>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setExportModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  {isAr ? 'إغلاق' : 'Close'}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPptReport}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{isAr ? 'تحميل ملف العرض التقديمي' : 'Download Presentation File'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          PROJECT DETAIL INSPECTION DRAWER
         ========================================================================= */}
      {inspectingProject && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-end p-0 animate-in fade-in">
          <div className="bg-white w-full max-w-lg h-full border-s border-slate-200 shadow-2xl overflow-y-auto p-6 space-y-6 flex flex-col justify-between">
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-start justify-between pb-4 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                      PROJ-{inspectingProject.id}
                    </span>
                    {getHealthBadge(inspectingProject.healthStatus)}
                  </div>
                  <h3 className="font-bold text-lg text-slate-900 mt-2">
                    {pickLocalized(lang, inspectingProject.name, inspectingProject.nameAr)}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {pickLocalized(lang, inspectingProject.description, inspectingProject.descriptionAr)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setInspectingProject(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Progress & Metrics Summary */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-semibold">{isAr ? 'نسبة الإنجاز الفعلي' : 'Actual Progress'}</span>
                  <span className="font-mono font-bold text-blue-600 text-base">
                    {inspectingProject.actualProgressPercentage}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full"
                    style={{ width: `${inspectingProject.actualProgressPercentage}%` }}
                  ></div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-slate-500 text-[11px]">{isAr ? 'المخطط' : 'Planned'}</div>
                    <div className="font-mono font-bold text-slate-800 mt-0.5">
                      {inspectingProject.plannedProgressPercentage}%
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-slate-500 text-[11px]">{isAr ? 'الانحراف' : 'Variance'}</div>
                    <div
                      className={`font-mono font-bold mt-0.5 ${
                        inspectingProject.variancePercentage >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {inspectingProject.variancePercentage >= 0 ? '+' : ''}
                      {inspectingProject.variancePercentage}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Strategic Mapping & Linkage */}
              <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-xs space-y-2">
                <div className="font-bold text-amber-900 flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-amber-600" />
                  <span>{isAr ? 'الارتباط الاستراتيجي' : 'Strategic Goal Mapping'}</span>
                </div>
                <div className="text-slate-700">
                  <span className="text-slate-500">{isAr ? 'الهدف الاستراتيجي:' : 'Strategic Goal:'} </span>
                  <span className="font-semibold">
                    {pickLocalized(lang, inspectingProject.strategicGoalTitle, inspectingProject.strategicGoalTitleAr)}
                  </span>
                </div>
                <div className="text-slate-700">
                  <span className="text-slate-500">{isAr ? 'المبادرة الأم:' : 'Parent Initiative:'} </span>
                  <span className="font-semibold">
                    {pickLocalized(lang, inspectingProject.initiativeName, inspectingProject.initiativeNameAr)}
                  </span>
                </div>
              </div>

              {/* Project Attributes Grid */}
              <div className="space-y-2 text-xs text-slate-700 divide-y divide-slate-100">
                <div className="flex items-center justify-between py-2">
                  <span className="text-slate-500">{isAr ? 'الإدارة المعنية:' : 'Department:'}</span>
                  <span className="font-medium">
                    {pickLocalized(lang, inspectingProject.departmentName, inspectingProject.departmentNameAr)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-slate-500">{isAr ? 'مدير المشروع:' : 'Project Manager:'}</span>
                  <span className="font-medium">
                    {pickLocalized(lang, inspectingProject.projectManagerName, inspectingProject.projectManagerNameAr)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-slate-500">{isAr ? 'الميزانية المتاحة:' : 'Available Budget:'}</span>
                  <span className="font-mono font-bold text-slate-900">{formatSar(inspectingProject.availableBudget)}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-slate-500">{isAr ? 'تاريخ البدء:' : 'Start Date:'}</span>
                  <span className="font-mono">{inspectingProject.startDate}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-slate-500">{isAr ? 'تاريخ الانتهاء:' : 'End Date:'}</span>
                  <span className="font-mono">{inspectingProject.endDate}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-slate-500">{isAr ? 'إشارات التأخير:' : 'Delay Flags:'}</span>
                  <span className="font-mono font-bold text-rose-600">{inspectingProject.delayFlags}</span>
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setInspectingProject(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>

              <button
                type="button"
                onClick={() => {
                  const pid = inspectingProject.id;
                  setInspectingProject(null);
                  handleViewTasksForProject(pid);
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <CheckSquare className="w-4 h-4" />
                <span>{isAr ? 'عرض مهام هذا المشروع' : 'View Project Tasks'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
