import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Compass,
  FolderKanban,
  Layers,
  Network,
  RefreshCw,
  Search
} from 'lucide-react';
import type {
  Activity,
  AuthUser,
  DashboardSummary,
  Department,
  Initiative,
  Milestone,
  Portfolio,
  Project,
  Workstream
} from './App';
import { Language, pickLocalized, translatePriority, translateStatus, translations } from './i18n';

export type ExecutiveDashboardNavTarget =
  | 'dashboard'
  | 'strategic-planning'
  | 'project-workspace'
  | 'hierarchy'
  | 'departments'
  | 'portfolios'
  | 'initiatives'
  | 'projects'
  | 'activities'
  | 'scheduling'
  | 'pmo-management'
  | 'pmo-dashboard'
  | 'progress-tracking'
  | 'overdue-activities'
  | 'activity-search';

export interface ExecutiveDashboardViewProps {
  lang: Language;
  currentUser: AuthUser | null;
  loading: boolean;
  dashboard: DashboardSummary | null;
  departments: Department[];
  portfolios: Portfolio[];
  initiatives: Initiative[];
  projects: Project[];
  workstreams: Workstream[];
  milestones: Milestone[];
  activities: Activity[];
  onRefresh: () => void;
  onNavigateSection: (section: ExecutiveDashboardNavTarget) => void;
  onOpenProjectWorkspace: (
    projectId: number,
    tab?: 'overview' | 'workstreams' | 'milestones' | 'activities' | 'gantt'
  ) => void;
}

const STATUS_FILTERS = ['All', 'In Progress', 'Planned', 'Completed', 'On Hold'] as const;

export const ExecutiveDashboardView: React.FC<ExecutiveDashboardViewProps> = ({
  lang,
  currentUser,
  loading,
  dashboard,
  departments,
  portfolios,
  initiatives,
  projects,
  workstreams,
  milestones,
  activities,
  onRefresh,
  onNavigateSection,
  onOpenProjectWorkspace
}) => {
  const isAr = lang === 'ar';
  const t = translations[lang];

  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [chartView, setChartView] = useState<'status' | 'department'>('status');

  const deptIdNum = selectedDeptId === 'all' ? null : Number(selectedDeptId);

  const scopedPortfolios = useMemo(
    () => (deptIdNum ? portfolios.filter((p) => p.departmentId === deptIdNum) : portfolios),
    [portfolios, deptIdNum]
  );

  const scopedInitiatives = useMemo(
    () => (deptIdNum ? initiatives.filter((i) => i.departmentId === deptIdNum) : initiatives),
    [initiatives, deptIdNum]
  );

  const scopedProjects = useMemo(
    () => (deptIdNum ? projects.filter((pr) => pr.departmentId === deptIdNum) : projects),
    [projects, deptIdNum]
  );

  const scopedProjectIds = useMemo(
    () => new Set(scopedProjects.map((pr) => pr.id)),
    [scopedProjects]
  );

  const scopedWorkstreams = useMemo(
    () =>
      deptIdNum
        ? workstreams.filter((w) => scopedProjectIds.has(w.projectId))
        : workstreams,
    [workstreams, deptIdNum, scopedProjectIds]
  );

  const scopedMilestones = useMemo(
    () =>
      deptIdNum
        ? milestones.filter((m) => scopedProjectIds.has(m.projectId))
        : milestones,
    [milestones, deptIdNum, scopedProjectIds]
  );

  const scopedActivities = useMemo(
    () =>
      deptIdNum
        ? activities.filter((a) => scopedProjectIds.has(a.projectId))
        : activities,
    [activities, deptIdNum, scopedProjectIds]
  );

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return scopedProjects.filter((pr) => {
      const matchesStatus = statusFilter === 'All' || pr.status === statusFilter;
      if (!matchesStatus) return false;
      if (!q) return true;
      const name = pickLocalized(lang, pr.name, pr.nameAr).toLowerCase();
      const mgr = pickLocalized(lang, pr.projectManagerName, pr.projectManagerNameAr).toLowerCase();
      const initName = pickLocalized(lang, pr.initiativeName, pr.initiativeNameAr).toLowerCase();
      const deptName = pickLocalized(lang, pr.departmentName, pr.departmentNameAr).toLowerCase();
      return (
        name.includes(q) ||
        mgr.includes(q) ||
        initName.includes(q) ||
        deptName.includes(q)
      );
    });
  }, [scopedProjects, statusFilter, searchQuery, lang]);

  const activePortfolioCount = scopedPortfolios.filter((p) => p.status === 'Active').length;
  const inProgressProjectsCount = scopedProjects.filter((p) => p.status === 'In Progress').length;
  const completedProjectsCount = scopedProjects.filter((p) => p.status === 'Completed').length;
  const avgProjectProgress = useMemo(() => {
    if (scopedProjects.length === 0) return 0;
    const total = scopedProjects.reduce((acc, pr) => acc + (Number(pr.progressPercentage) || 0), 0);
    return Math.round(total / scopedProjects.length);
  }, [scopedProjects]);

  const completedActivitiesCount = scopedActivities.filter((a) => a.status === 'Completed').length;
  const overdueActivitiesList = useMemo(
    () =>
      scopedActivities
        .filter((a) => a.isOverdue && a.status !== 'Completed')
        .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '')),
    [scopedActivities]
  );

  const delayedMilestonesCount = scopedMilestones.filter(
    (m) => m.isDelayed || m.status === 'Delayed'
  ).length;
  const completedMilestonesCount = scopedMilestones.filter(
    (m) => m.status === 'Completed'
  ).length;

  const upcomingAndPriorityMilestones = useMemo(() => {
    const ordered = [...scopedMilestones].sort((a, b) => {
      if (a.status === 'Delayed' && b.status !== 'Delayed') return -1;
      if (b.status === 'Delayed' && a.status !== 'Delayed') return 1;
      if (a.status === 'Completed' && b.status !== 'Completed') return 1;
      if (b.status === 'Completed' && a.status !== 'Completed') return -1;
      return (a.plannedDate || '').localeCompare(b.plannedDate || '');
    });
    return ordered.slice(0, 6);
  }, [scopedMilestones]);

  const projectStatusBreakdown = useMemo(() => {
    const statuses = ['In Progress', 'Completed', 'Planned', 'On Hold'];
    const total = scopedProjects.length;
    return statuses.map((st) => {
      const count = scopedProjects.filter((p) => p.status === st).length;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      const color =
        st === 'Completed'
          ? { bar: 'bg-emerald-600', stroke: '#16A34A', text: 'text-emerald-700' }
          : st === 'In Progress'
          ? { bar: 'bg-blue-600', stroke: '#2563EB', text: 'text-blue-700' }
          : st === 'On Hold'
          ? { bar: 'bg-amber-500', stroke: '#D97706', text: 'text-amber-700' }
          : { bar: 'bg-slate-400', stroke: '#94A3B8', text: 'text-slate-600' };
      return { status: st, count, pct, color };
    });
  }, [scopedProjects]);

  const departmentBreakdown = useMemo(() => {
    return departments
      .map((dept) => {
        const deptProjects = projects.filter((p) => p.departmentId === dept.id);
        const deptInits = initiatives.filter((i) => i.departmentId === dept.id);
        const avgPct =
          deptProjects.length > 0
            ? Math.round(
                deptProjects.reduce((acc, p) => acc + (Number(p.progressPercentage) || 0), 0) /
                  deptProjects.length
              )
            : 0;
        const overdue = deptProjects.reduce(
          (acc, p) => acc + (Number(p.overdueActivityCount) || 0),
          0
        );
        return {
          id: dept.id,
          name: pickLocalized(lang, dept.name, dept.nameAr),
          projectCount: deptProjects.length,
          initiativeCount: deptInits.length,
          avgPct,
          overdue
        };
      })
      .sort((a, b) => b.projectCount - a.projectCount);
  }, [departments, projects, initiatives, lang]);

  // SVG Donut ring geometry for Project Status Breakdown
  const donutSegments = useMemo(() => {
    const radius = 52;
    const circumference = 2 * Math.PI * radius;
    const total = scopedProjects.length;
    let offset = 0;
    return projectStatusBreakdown.map((item) => {
      const len = total > 0 ? (item.count / total) * circumference : 0;
      const seg = {
        ...item,
        dashArray: `${len} ${Math.max(0, circumference - len)}`,
        dashOffset: -offset
      };
      offset += len;
      return seg;
    });
  }, [projectStatusBreakdown, scopedProjects.length]);

  const statusTextClass = (status: string): string => {
    if (status === 'Completed' || status === 'Active') return 'text-emerald-700';
    if (status === 'In Progress') return 'text-blue-700';
    if (status === 'Delayed') return 'text-rose-600';
    if (status === 'On Hold') return 'text-amber-700';
    return 'text-slate-600';
  };

  const displayName = currentUser
    ? pickLocalized(lang, currentUser.fullName, currentUser.fullNameAr)
    : '';

  // ==================== LOADING SKELETON STATE ====================
  if (loading && !dashboard) {
    return (
      <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="space-y-2">
            <div className="h-7 w-64 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-96 max-w-full bg-slate-200/70 rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-36 bg-slate-200 rounded-lg animate-pulse" />
            <div className="h-9 w-32 bg-slate-200 rounded-lg animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="bg-white border border-slate-200 rounded-xl p-5 h-36 flex flex-col justify-between"
            >
              <div className="h-3.5 w-28 bg-slate-200 rounded animate-pulse" />
              <div className="h-8 w-20 bg-slate-200 rounded animate-pulse" />
              <div className="h-3 w-40 bg-slate-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 h-80 animate-pulse" />
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 h-80 animate-pulse" />
        </div>
      </div>
    );
  }

  // ==================== ERROR / EMPTY DATA FALLBACK ====================
  if (!dashboard && projects.length === 0) {
    return (
      <div
        className="bg-white border border-slate-200 rounded-xl p-12 text-center max-w-2xl mx-auto my-8 space-y-4"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        <h2 className="font-display text-xl font-bold text-slate-900">
          {isAr ? 'لا تتوفر بيانات لوحة القيادة حالياً' : 'Dashboard Summary Unavailable'}
        </h2>
        <p className="text-sm text-slate-600">
          {isAr
            ? 'تعذر تحميل ملخص المحافظ والمشاريع. يمكنك إعادة المحاولة أو إضافة خطط ومشاريع جديدة.'
            : 'No portfolio summary data was returned yet. Retry loading records or create a new project.'}
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={onRefresh}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {isAr ? 'إعادة تحميل البيانات' : 'Reload Data'}
          </button>
          <button
            type="button"
            onClick={() => onNavigateSection('strategic-planning')}
            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {isAr ? 'فتح التخطيط الاستراتيجي' : 'Open Strategic Planning'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* ==================== HEADER & FILTER TOOLBAR ==================== */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="min-w-0">
          {displayName && (
            <div className="text-xs font-medium text-slate-500 mb-1 flex flex-wrap items-center gap-1.5">
              <span>{isAr ? `مرحباً، ${displayName}` : `Welcome, ${displayName}`}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {departments.length} {t.departments}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {scopedPortfolios.length} {t.portfolios}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {scopedProjects.length} {t.projects}
              </span>
            </div>
          )}
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {t.execDashboardTitle}
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">{t.execDashboardSub}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <select
            aria-label={isAr ? 'تصفية حسب الإدارة' : 'Filter by Department'}
            value={selectedDeptId}
            onChange={(e) => setSelectedDeptId(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
          >
            <option value="all">{isAr ? 'جميع الإدارات' : 'All Departments'}</option>
            {departments.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {pickLocalized(lang, d.name, d.nameAr)}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span>{isAr ? 'تحديث' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenProjectWorkspace(scopedProjects[0]?.id || projects[0]?.id || 1, 'overview')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{t.openWorkspace}</span>
          </button>
        </div>
      </div>

      {/* ==================== 1. EXECUTIVE KPI SUMMARY STRIP ==================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* KPI 1: Portfolios & Initiatives */}
        <button
          type="button"
          onClick={() => onNavigateSection('portfolios')}
          className="bg-white border border-slate-200 hover:border-blue-500 rounded-xl p-5 text-start transition-colors cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-semibold text-slate-500">
              {t.portfolios} · {t.initiatives}
            </span>
            <ChevronRight className="w-4 h-4 text-slate-400 rtl:rotate-180" />
          </div>
          <div className="font-mono tabular-nums text-3xl font-bold text-slate-900 my-3">
            {scopedPortfolios.length} / {scopedInitiatives.length}
          </div>
          <div className="text-xs text-slate-500">
            <span className="font-mono tabular-nums font-semibold text-emerald-700">
              {activePortfolioCount}
            </span>{' '}
            {translateStatus('Active', lang)} {t.portfolios}
            <span aria-hidden="true"> · </span>
            <span className="font-mono tabular-nums font-semibold text-slate-700">
              {departments.length}
            </span>{' '}
            {t.departments}
          </div>
        </button>

        {/* KPI 2: Projects & Workstreams */}
        <button
          type="button"
          onClick={() => onNavigateSection('projects')}
          className="bg-white border border-slate-200 hover:border-blue-500 rounded-xl p-5 text-start transition-colors cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-semibold text-slate-500">
              {t.projects} · {t.workstreams}
            </span>
            <ChevronRight className="w-4 h-4 text-slate-400 rtl:rotate-180" />
          </div>
          <div className="font-mono tabular-nums text-3xl font-bold text-slate-900 my-3">
            {scopedProjects.length} / {scopedWorkstreams.length}
          </div>
          <div className="text-xs text-slate-500">
            <span className="font-mono tabular-nums font-semibold text-blue-700">
              {inProgressProjectsCount}
            </span>{' '}
            {translateStatus('In Progress', lang)}
            <span aria-hidden="true"> · </span>
            <span className="font-mono tabular-nums font-semibold text-emerald-700">
              {completedProjectsCount}
            </span>{' '}
            {translateStatus('Completed', lang)}
          </div>
        </button>

        {/* KPI 3: Overall Delivery Progress */}
        <button
          type="button"
          onClick={() => onNavigateSection('progress-tracking')}
          className="bg-white border border-slate-200 hover:border-blue-500 rounded-xl p-5 text-start transition-colors cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-semibold text-slate-500">{t.overallProgress}</span>
            <ChevronRight className="w-4 h-4 text-slate-400 rtl:rotate-180" />
          </div>
          <div className="font-mono tabular-nums text-3xl font-bold text-blue-600 my-3">
            {avgProjectProgress}%
          </div>
          <div className="w-full space-y-1.5">
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all"
                style={{ width: `${avgProjectProgress}%` }}
              />
            </div>
            <div className="text-xs text-slate-500 font-mono tabular-nums">
              {completedActivitiesCount}/{scopedActivities.length}{' '}
              <span className="font-sans">{t.activities}</span>
            </div>
          </div>
        </button>

        {/* KPI 4: Schedule Alerts (Overdue + Delayed Milestones) */}
        <button
          type="button"
          onClick={() => onNavigateSection('overdue-activities')}
          className="bg-white border border-slate-200 hover:border-rose-400 rounded-xl p-5 text-start transition-colors cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-semibold text-slate-500">{t.kpiOverdue}</span>
            <ChevronRight className="w-4 h-4 text-slate-400 rtl:rotate-180" />
          </div>
          <div
            className={`font-mono tabular-nums text-3xl font-bold my-3 ${
              overdueActivitiesList.length > 0 ? 'text-rose-600' : 'text-emerald-700'
            }`}
          >
            {overdueActivitiesList.length}
          </div>
          <div className="text-xs text-slate-500">
            <span
              className={`font-semibold ${
                overdueActivitiesList.length > 0 ? 'text-rose-600' : 'text-emerald-700'
              }`}
            >
              {overdueActivitiesList.length > 0
                ? isAr
                  ? 'يتطلب متابعة'
                  : 'Needs Attention'
                : isAr
                ? 'ضمن المسار'
                : 'On Schedule'}
            </span>
            <span aria-hidden="true"> · </span>
            <span className="font-mono tabular-nums font-semibold text-amber-700">
              {delayedMilestonesCount}
            </span>{' '}
            {isAr ? 'معالم متأخرة' : 'delayed milestones'}
          </div>
        </button>
      </div>

      {/* ==================== 2. ANALYTICS & MILESTONE RADAR ==================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Portfolio Distribution (Status Donut + Department Breakdown) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                {chartView === 'status'
                  ? t.statusDistTitle
                  : isAr
                  ? 'توزيع المشاريع والأداء حسب الإدارة'
                  : 'Delivery Distribution by Department'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {chartView === 'status'
                  ? isAr
                    ? 'انقر على أي حالة لتصفية جدول المشاريع أدناه'
                    : 'Click any status row to filter the project tracker below'
                  : isAr
                  ? 'عدد المشاريع ومتوسط الإنجاز لكل إدارة تنظيمية'
                  : 'Project volume and average completion rate per department'}
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start sm:self-auto shrink-0">
              <button
                type="button"
                onClick={() => setChartView('status')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  chartView === 'status'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isAr ? 'حسب الحالة' : 'By Status'}
              </button>
              <button
                type="button"
                onClick={() => setChartView('department')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  chartView === 'department'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isAr ? 'حسب الإدارة' : 'By Department'}
              </button>
            </div>
          </div>

          {chartView === 'status' ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center pt-5 flex-1">
              <div className="md:col-span-5 flex items-center justify-center">
                <div className="relative w-40 h-40">
                  <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
                    <circle
                      cx="70"
                      cy="70"
                      r="52"
                      fill="none"
                      stroke="#F1F5F9"
                      strokeWidth="16"
                    />
                    {donutSegments.map((seg) =>
                      seg.count > 0 ? (
                        <circle
                          key={seg.status}
                          cx="70"
                          cy="70"
                          r="52"
                          fill="none"
                          stroke={seg.color.stroke}
                          strokeWidth="16"
                          strokeDasharray={seg.dashArray}
                          strokeDashoffset={seg.dashOffset}
                        />
                      ) : null
                    )}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="font-mono tabular-nums text-2xl font-bold text-slate-900">
                      {scopedProjects.length}
                    </span>
                    <span className="text-[11px] font-medium text-slate-500">{t.projects}</span>
                  </div>
                </div>
              </div>

              <div className="md:col-span-7 space-y-3">
                {projectStatusBreakdown.map((item) => (
                  <button
                    key={item.status}
                    type="button"
                    onClick={() =>
                      setStatusFilter(
                        statusFilter === item.status
                          ? 'All'
                          : (item.status as (typeof STATUS_FILTERS)[number])
                      )
                    }
                    className={`w-full text-start p-2 rounded-lg transition-colors cursor-pointer ${
                      statusFilter === item.status ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className={`font-semibold ${item.color.text}`}>
                        {translateStatus(item.status, lang)}
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-slate-700">
                        {item.count} ({item.pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${item.color.bar}`}
                        style={{ width: `${item.pct}%` }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="pt-4 divide-y divide-slate-100 flex-1">
              {departmentBreakdown.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500">{t.noRecordsFound}</div>
              ) : (
                departmentBreakdown.map((dept) => (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() =>
                      setSelectedDeptId(
                        selectedDeptId === String(dept.id) ? 'all' : String(dept.id)
                      )
                    }
                    className={`w-full py-3 px-2 rounded-lg text-start flex items-center justify-between gap-4 transition-colors cursor-pointer ${
                      selectedDeptId === String(dept.id) ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-900 truncate">
                        {dept.name}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 font-mono tabular-nums">
                        {dept.initiativeCount} {t.initiatives} · {dept.projectCount} {t.projects}
                        {dept.overdue > 0 && (
                          <span className="text-rose-600 font-semibold">
                            {' '}
                            · {dept.overdue} {t.overdueLabel}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="w-32 shrink-0">
                      <div className="flex items-center justify-between text-[11px] font-mono tabular-nums mb-1">
                        <span className="text-slate-500">{t.progress}</span>
                        <span className="font-bold text-slate-800">{dept.avgPct}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full"
                          style={{ width: `${dept.avgPct}%` }}
                        />
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Right: Milestone Radar */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                {t.milestoneRadarTitle}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                <span className="font-mono tabular-nums font-semibold text-emerald-700">
                  {completedMilestonesCount}
                </span>{' '}
                {translateStatus('Completed', lang)}
                <span aria-hidden="true"> · </span>
                <span className="font-mono tabular-nums font-semibold text-amber-700">
                  {scopedMilestones.length - completedMilestonesCount}
                </span>{' '}
                {isAr ? 'قيد المتابعة' : 'pending gates'}
              </p>
            </div>
            <span className="font-mono tabular-nums text-xs font-bold text-amber-600 shrink-0">
              ◆ {scopedMilestones.length}
            </span>
          </div>

          <div className="divide-y divide-slate-100 pt-2 flex-1">
            {upcomingAndPriorityMilestones.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">{t.noRecordsFound}</div>
            ) : (
              upcomingAndPriorityMilestones.map((ms) => (
                <button
                  key={ms.id}
                  type="button"
                  onClick={() => onOpenProjectWorkspace(ms.projectId, 'milestones')}
                  className="w-full py-3 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between gap-3 text-start"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 truncate">
                      <span className="text-amber-600 me-1">◆</span>
                      {pickLocalized(lang, ms.name, ms.nameAr)}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                      {pickLocalized(lang, ms.projectName, ms.projectNameAr, '—')}
                    </div>
                  </div>
                  <div className="text-end shrink-0">
                    <div className="text-xs font-mono tabular-nums font-semibold text-slate-800">
                      {ms.plannedDate || '—'}
                    </div>
                    <div className={`text-[11px] font-semibold mt-0.5 ${statusTextClass(ms.status)}`}>
                      {translateStatus(ms.status, lang)}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ==================== 3. PROJECT TRACKER TABLE + OVERDUE & QUICK NAVIGATION ==================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left (8 cols): Project Portfolio Health Table */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                {t.projectProgressTitle}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                {filteredProjects.length} / {scopedProjects.length}{' '}
                <span className="font-sans">{t.projects}</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 -translate-y-1/2 start-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isAr ? 'ابحث عن مشروع أو مدير...' : 'Search projects or managers...'}
                  className="ps-8 pe-3 py-1.5 w-48 sm:w-56 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Interactive Segmented Status Filter */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
            {STATUS_FILTERS.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  statusFilter === st
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'All' ? t.allStatuses : translateStatus(st, lang)}
              </button>
            ))}
          </div>

          {filteredProjects.length === 0 ? (
            <div className="py-10 text-center space-y-3 border-t border-slate-100">
              <p className="text-xs text-slate-500">{t.noRecordsFound}</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedDeptId('all');
                  setStatusFilter('All');
                  setSearchQuery('');
                }}
                className="px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {t.clearFilters}
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                    <th className="py-2.5 pe-3 text-start">{t.project}</th>
                    <th className="py-2.5 px-3 text-start hidden sm:table-cell">{t.projectManager}</th>
                    <th className="py-2.5 px-3 text-start">{t.status}</th>
                    <th className="py-2.5 px-3 text-end">{t.progress}</th>
                    <th className="py-2.5 ps-3 text-end">{t.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProjects.slice(0, 8).map((pr) => (
                    <tr
                      key={pr.id}
                      onClick={() => onOpenProjectWorkspace(pr.id, 'overview')}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    >
                      <td className="py-3 pe-3">
                        <div className="font-semibold text-slate-900">
                          {pickLocalized(lang, pr.name, pr.nameAr)}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {pickLocalized(lang, pr.departmentName, pr.departmentNameAr, '—')}
                          <span aria-hidden="true"> · </span>
                          <span className="font-mono tabular-nums">{pr.endDate}</span>
                          {(pr.overdueActivityCount || 0) > 0 && (
                            <>
                              <span aria-hidden="true"> · </span>
                              <span className="font-mono tabular-nums font-semibold text-rose-600">
                                {pr.overdueActivityCount} {t.overdueLabel}
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-600 hidden sm:table-cell whitespace-nowrap">
                        {pickLocalized(lang, pr.projectManagerName, pr.projectManagerNameAr, '—')}
                      </td>
                      <td className={`py-3 px-3 font-semibold whitespace-nowrap ${statusTextClass(pr.status)}`}>
                        {translateStatus(pr.status, lang)}
                      </td>
                      <td className="py-3 px-3 text-end whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden md:block">
                            <div
                              className={`h-full rounded-full ${
                                pr.progressPercentage === 100 ? 'bg-emerald-600' : 'bg-blue-600'
                              }`}
                              style={{ width: `${pr.progressPercentage || 0}%` }}
                            />
                          </div>
                          <span className="font-mono tabular-nums font-bold text-slate-800 w-9 text-end">
                            {pr.progressPercentage}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 ps-3 text-end whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenProjectWorkspace(pr.id, 'overview');
                          }}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <span>{isAr ? 'فتح' : 'Inspect'}</span>
                          <ArrowRight className={`w-3.5 h-3.5 ${isAr ? 'rotate-180' : ''}`} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right (4 cols): Overdue Attention & Quick Workspace Links */}
        <div className="lg:col-span-4 space-y-6">
          {/* Overdue Activities */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">
                  {t.overdueAlertsTitle}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  <span
                    className={`font-mono tabular-nums font-semibold ${
                      overdueActivitiesList.length > 0 ? 'text-rose-600' : 'text-emerald-700'
                    }`}
                  >
                    {overdueActivitiesList.length}
                  </span>{' '}
                  {t.overdueLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateSection('overdue-activities')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer whitespace-nowrap shrink-0"
              >
                {isAr ? 'عرض الكل' : 'View All'}
              </button>
            </div>

            {overdueActivitiesList.length === 0 ? (
              <p className="text-xs text-emerald-700 font-medium py-4 text-center">
                {t.noOverdueTasks}
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {overdueActivitiesList.slice(0, 5).map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => onOpenProjectWorkspace(act.projectId, 'activities')}
                    className="w-full py-3 first:pt-0 last:pb-0 text-start hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 truncate">
                        {pickLocalized(lang, act.name, act.nameAr)}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">
                        {pickLocalized(lang, act.projectName, act.projectNameAr, '—')} ·{' '}
                        {pickLocalized(
                          lang,
                          act.assignedUserName,
                          act.assignedUserNameAr,
                          isAr ? 'غير مكلف' : 'Unassigned'
                        )}
                      </div>
                    </div>
                    <div className="text-end shrink-0">
                      <div className="text-[11px] font-mono tabular-nums font-bold text-rose-600">
                        {act.dueDate}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {translatePriority(act.priority, lang)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Modules Navigation */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <h2 className="font-display text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
              {isAr ? 'الوصول المباشر للوحدات' : 'Workspace Shortcuts'}
            </h2>
            <div className="divide-y divide-slate-100">
              {[
                {
                  id: 'strategic-planning' as ExecutiveDashboardNavTarget,
                  label: isAr ? 'التخطيط الاستراتيجي' : 'Strategic Planning',
                  sub: isAr ? 'الخطط والمبادرات والأهداف' : 'Plans, goals & strategic initiatives',
                  icon: Compass
                },
                {
                  id: 'hierarchy' as ExecutiveDashboardNavTarget,
                  label: t.hierarchyExplorer,
                  sub: isAr ? 'استعراض شجرة الإدارات والمحافظ' : 'Department to task drill-down',
                  icon: Network
                },
                {
                  id: 'pmo-management' as ExecutiveDashboardNavTarget,
                  label: isAr ? 'إدارة مكتب المشاريع' : 'PMO Management',
                  sub: isAr ? 'المشاريع الحرجة وكانبان الإدارات' : 'Kanban & critical governance',
                  icon: FolderKanban
                },
                {
                  id: 'overdue-activities' as ExecutiveDashboardNavTarget,
                  label: t.overdueActivities,
                  sub: isAr ? 'متابعة الأنشطة المتجاوزة للموعد' : 'Past-due escalation register',
                  icon: AlertTriangle
                }
              ].map((nav) => {
                const Icon = nav.icon;
                return (
                  <button
                    key={nav.id}
                    type="button"
                    onClick={() => onNavigateSection(nav.id)}
                    className="w-full py-3 first:pt-1 last:pb-1 flex items-center justify-between gap-3 text-start hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className="w-4 h-4 text-blue-600 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 truncate">
                          {nav.label}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">{nav.sub}</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 rtl:rotate-180" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
