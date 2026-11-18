import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from './apiClient';
import {
  TrendingUp,
  RefreshCw,
  Search,
  Filter,
  Layers,
  Compass,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FolderKanban,
  Building2,
  User,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  X,
  FileText,
  BarChart3,
  Calendar,
  Sparkles,
  Loader2
} from 'lucide-react';
import { Language, pickLocalized, translations, translateStatus } from './i18n';

export interface ChildProjectProgress {
  id: number;
  name: string;
  nameAr?: string;
  status: string;
  priority: string;
  progressPercentage: number | null;
  hasProgressData?: boolean;
  startDate: string;
  endDate: string;
  projectManagerName: string | null;
  projectManagerNameAr?: string | null;
  activityCount: number;
  completedActivityCount?: number;
}

export interface InitiativeProgressItem {
  id: number;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  departmentId: number | null;
  departmentName: string | null;
  departmentNameAr?: string | null;
  portfolioId: number;
  portfolioName: string | null;
  portfolioNameAr?: string | null;
  ownerId: number | null;
  ownerName: string | null;
  ownerNameAr?: string | null;
  status: string;
  priority: string;
  startDate: string;
  targetDate: string;
  progressPercentage: number | null;
  hasProgressData?: boolean;
  projectCount: number;
  completedProjectCount: number;
  projects?: ChildProjectProgress[];
}

export interface ChildActivityProgress {
  id: number;
  name: string;
  nameAr?: string;
  description?: string;
  descriptionAr?: string;
  status: string;
  priority: string;
  progressPercentage: number | null;
  startDate: string;
  dueDate: string;
  assignedUserName: string | null;
  assignedUserNameAr?: string | null;
  workstreamName: string | null;
  workstreamNameAr?: string | null;
}

export interface ProjectProgressItem {
  id: number;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  initiativeId: number;
  initiativeName: string | null;
  initiativeNameAr?: string | null;
  portfolioName: string | null;
  portfolioNameAr?: string | null;
  departmentName: string | null;
  departmentNameAr?: string | null;
  projectManagerId: number | null;
  projectManagerName: string | null;
  projectManagerNameAr?: string | null;
  status: string;
  priority: string;
  startDate: string;
  endDate: string;
  progressPercentage: number | null;
  hasProgressData?: boolean;
  activityCount: number;
  completedActivityCount: number;
  activities?: ChildActivityProgress[];
}

export interface ProgressSummary {
  overallPmoProgress: number;
  initiatives: {
    total: number;
    withData?: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    averageProgress: number;
  };
  projects: {
    total: number;
    withData?: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    averageProgress: number;
  };
  activities: {
    total: number;
    completed: number;
    inProgress: number;
    notStarted: number;
  };
}

export interface ProgressTrackingViewProps {
  lang: Language;
  currentUserRole?: string;
  showBanner: (type: 'success' | 'error', text: string) => void;
  onNavigateToInitiative?: (initiativeId: number) => void;
  onNavigateToProjectWorkspace?: (projectId: number) => void;
}

export const ProgressTrackingView: React.FC<ProgressTrackingViewProps> = ({
  lang,
  currentUserRole = 'PMO Manager',
  showBanner,
  onNavigateToInitiative,
  onNavigateToProjectWorkspace
}) => {
  const isAr = lang === 'ar';
  const t = translations[lang];

  // View state: 'initiatives' | 'projects'
  const [activeTab, setActiveTab] = useState<'initiatives' | 'projects'>('initiatives');

  // Summary state
  const [summary, setSummary] = useState<ProgressSummary | null>(null);

  // Data states
  const [initiatives, setInitiatives] = useState<InitiativeProgressItem[]>([]);
  const [projects, setProjects] = useState<ProjectProgressItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [progressRangeFilter, setProgressRangeFilter] = useState<string>('All');

  // Drawer drill-down state
  const [selectedInitiative, setSelectedInitiative] = useState<InitiativeProgressItem | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectProgressItem | null>(null);
  const [drawerDetailsLoading, setDrawerDetailsLoading] = useState<boolean>(false);

  const hasValidProgress = (
    percent: number | null | undefined,
    hasData?: boolean
  ): percent is number => {
    return typeof percent === 'number' && !Number.isNaN(percent) && hasData !== false;
  };

  // Helpers: progress bar color based on percentage
  const getProgressColor = (percent: number | null | undefined, hasData?: boolean) => {
    if (!hasValidProgress(percent, hasData)) return 'bg-slate-300';
    if (percent === 100) return 'bg-emerald-500';
    if (percent >= 70) return 'bg-blue-600';
    if (percent >= 40) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  // Status badge styling (localized cleanly)
  const renderStatusBadge = (status: string) => {
    const lower = status.toLowerCase();
    const isCompleted = lower === 'completed';
    const isInProgress = lower === 'in progress';
    const isDelayed = lower === 'delayed';
    const isOnHold = lower === 'on hold';
    const isApproved = lower === 'approved';

    let colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';
    if (isCompleted) {
      colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    } else if (isInProgress) {
      colorClasses = 'bg-blue-50 text-blue-700 border-blue-200';
    } else if (isDelayed) {
      colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
    } else if (isOnHold) {
      colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
    } else if (isApproved) {
      colorClasses = 'bg-indigo-50 text-indigo-700 border-indigo-200';
    }

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colorClasses}`}
      >
        {translateStatus(status, lang)}
      </span>
    );
  };

  // Load live data from backend APIs
  const fetchProgressData = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setFetchError(null);

    try {
      const [summaryRes, initiativesRes, projectsRes] = await Promise.all([
        apiFetch('/api/progress/summary'),
        apiFetch('/api/progress/initiatives'),
        apiFetch('/api/progress/projects')
      ]);

      if (!summaryRes.ok || !initiativesRes.ok || !projectsRes.ok) {
        throw new Error('Failed to retrieve progress data.');
      }

      const summaryData = await summaryRes.json();
      const initiativesData = await initiativesRes.json();
      const projectsData = await projectsRes.json();

      setSummary(summaryData);
      setInitiatives(Array.isArray(initiativesData) ? initiativesData : []);
      setProjects(Array.isArray(projectsData) ? projectsData : []);

      if (isManualRefresh) {
        showBanner(
          'success',
          isAr
            ? 'تم تحديث بيانات ونسب الإنجاز بنجاح بناءً على أحدث السجلات الفعلية.'
            : 'Progress data was successfully refreshed from actual project records.'
        );
      }
    } catch (err: any) {
      console.error('Error fetching progress data:', err);
      const msg = isAr
        ? 'فشل تحميل بيانات تتبع الإنجاز. يرجى إعادة المحاولة.'
        : 'Failed to load progress tracking telemetry. Please retry.';
      setFetchError(msg);
      showBanner('error', msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProgressData(false);
  }, []);

  // Filtered Initiatives
  const filteredInitiatives = useMemo(() => {
    return initiatives.filter((i) => {
      // Search
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        i.name.toLowerCase().includes(q) ||
        (i.nameAr || '').toLowerCase().includes(q) ||
        (i.description || '').toLowerCase().includes(q) ||
        (i.descriptionAr || '').toLowerCase().includes(q) ||
        (i.departmentName || '').toLowerCase().includes(q) ||
        (i.departmentNameAr || '').toLowerCase().includes(q) ||
        (i.ownerName || '').toLowerCase().includes(q) ||
        (i.ownerNameAr || '').toLowerCase().includes(q);

      // Status
      const matchesStatus =
        statusFilter === 'All' || i.status.toLowerCase() === statusFilter.toLowerCase();

      // Range (never lump null / unavailable data into numeric ranges)
      const validPct = hasValidProgress(i.progressPercentage, i.hasProgressData)
        ? i.progressPercentage
        : null;
      let matchesRange = true;
      if (progressRangeFilter === '100') {
        matchesRange = validPct === 100;
      } else if (progressRangeFilter === '70-99') {
        matchesRange = validPct !== null && validPct >= 70 && validPct < 100;
      } else if (progressRangeFilter === '40-69') {
        matchesRange = validPct !== null && validPct >= 40 && validPct < 70;
      } else if (progressRangeFilter === '0-39') {
        matchesRange = validPct !== null && validPct < 40;
      } else if (progressRangeFilter === 'no-data') {
        matchesRange = validPct === null;
      }

      return matchesSearch && matchesStatus && matchesRange;
    });
  }, [initiatives, searchQuery, statusFilter, progressRangeFilter]);

  // Filtered Projects
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      // Search
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.nameAr || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        (p.descriptionAr || '').toLowerCase().includes(q) ||
        (p.initiativeName || '').toLowerCase().includes(q) ||
        (p.initiativeNameAr || '').toLowerCase().includes(q) ||
        (p.projectManagerName || '').toLowerCase().includes(q) ||
        (p.projectManagerNameAr || '').toLowerCase().includes(q);

      // Status
      const matchesStatus =
        statusFilter === 'All' || p.status.toLowerCase() === statusFilter.toLowerCase();

      // Range (never lump null / unavailable data into numeric ranges)
      const validPct = hasValidProgress(p.progressPercentage, p.hasProgressData)
        ? p.progressPercentage
        : null;
      let matchesRange = true;
      if (progressRangeFilter === '100') {
        matchesRange = validPct === 100;
      } else if (progressRangeFilter === '70-99') {
        matchesRange = validPct !== null && validPct >= 70 && validPct < 100;
      } else if (progressRangeFilter === '40-69') {
        matchesRange = validPct !== null && validPct >= 40 && validPct < 70;
      } else if (progressRangeFilter === '0-39') {
        matchesRange = validPct !== null && validPct < 40;
      } else if (progressRangeFilter === 'no-data') {
        matchesRange = validPct === null;
      }

      return matchesSearch && matchesStatus && matchesRange;
    });
  }, [projects, searchQuery, statusFilter, progressRangeFilter]);

  // Open Initiative Details Drawer (Story 4.1 AC 2 & Story 4.2)
  const handleOpenInitiativeDetails = async (item: InitiativeProgressItem) => {
    setSelectedInitiative(item);
    setSelectedProject(null);
    setDrawerDetailsLoading(true);

    try {
      const res = await apiFetch(`/api/progress/initiatives/${item.id}`);
      if (res.ok) {
        const full = await res.json();
        setSelectedInitiative(full);
      }
    } catch (e) {
      console.warn('Error fetching single initiative progress details:', e);
    } finally {
      setDrawerDetailsLoading(false);
    }
  };

  // Open Project Details Drawer (Story 4.3 AC 2 & Story 4.4)
  const handleOpenProjectDetails = async (item: ProjectProgressItem) => {
    setSelectedProject(item);
    setSelectedInitiative(null);
    setDrawerDetailsLoading(true);

    try {
      const res = await apiFetch(`/api/progress/projects/${item.id}`);
      if (res.ok) {
        const full = await res.json();
        setSelectedProject(full);
      }
    } catch (e) {
      console.warn('Error fetching single project progress details:', e);
    } finally {
      setDrawerDetailsLoading(false);
    }
  };

  return (
    <div className={`space-y-6 ${isAr ? 'text-right' : 'text-left'}`} dir={isAr ? 'rtl' : 'ltr'}>
      {/* ==================== MODULE HEADER ==================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/90 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-500/20">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
                {isAr ? 'تتبع الإنجاز' : 'Progress Tracking'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                {isAr
                  ? 'متابعة حية ومحدثة لنسب الإنجاز المحتسبة تلقائياً بناءً على بيانات المشاريع والأنشطة الفعلية'
                  : 'Live completion telemetry calculated directly from related project and activity records'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Live Refresh Button (Story 4.7 & 4.8) */}
          <button
            onClick={() => fetchProgressData(true)}
            disabled={refreshing}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            title={isAr ? 'تحديث نسب الإنجاز' : 'Refresh progress data'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span>{isAr ? 'تحديث البيانات' : 'Refresh Data'}</span>
          </button>
        </div>
      </div>

      {/* ==================== ERROR STATE BANNER (Story 4.7 AC 5) ==================== */}
      {fetchError && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 text-rose-800">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />
            <div>
              <p className="text-xs sm:text-sm font-semibold">{fetchError}</p>
              <p className="text-xs text-rose-600 mt-0.5">
                {isAr
                  ? 'تعذر استرجاع بيانات نسب الإنجاز المحدثة من الخادم.'
                  : 'Unable to retrieve calculated progress telemetry from the backend.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => fetchProgressData(false)}
            className="px-3 py-1.5 bg-white hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg border border-rose-300 cursor-pointer transition-colors shrink-0 self-start sm:self-center"
          >
            {isAr ? 'إعادة المحاولة' : 'Retry'}
          </button>
        </div>
      )}

      {/* ==================== SUMMARY KPI STATS (Story 4.5 & 4.6) ==================== */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Overall PMO Progress */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">
                {isAr ? 'متوسط إنجاز المكتب' : 'Overall PMO Progress'}
              </span>
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                {summary.overallPmoProgress}%
              </span>
              <span className="text-xs text-slate-400">
                {isAr ? 'معدل الحصيلة الكلي' : 'weighted rollup'}
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getProgressColor(
                  summary.overallPmoProgress
                )}`}
                style={{ width: `${summary.overallPmoProgress}%` }}
              />
            </div>
          </div>

          {/* Initiatives Average Progress */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">
                {isAr ? 'المبادرات الاستراتيجية' : 'Strategic Initiatives'}
              </span>
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Compass className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                {summary.initiatives.averageProgress}%
              </span>
              <span className="text-xs text-emerald-600 font-medium">
                {summary.initiatives.completed}/{summary.initiatives.total} {isAr ? 'مكتملة' : 'done'}
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getProgressColor(
                  summary.initiatives.averageProgress
                )}`}
                style={{ width: `${summary.initiatives.averageProgress}%` }}
              />
            </div>
          </div>

          {/* Projects Average Progress */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">
                {isAr ? 'مشاريع التنفيذ' : 'Delivery Projects'}
              </span>
              <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                <FolderKanban className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                {summary.projects.averageProgress}%
              </span>
              <span className="text-xs text-emerald-600 font-medium">
                {summary.projects.completed}/{summary.projects.total} {isAr ? 'مكتمل' : 'done'}
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getProgressColor(
                  summary.projects.averageProgress
                )}`}
                style={{ width: `${summary.projects.averageProgress}%` }}
              />
            </div>
          </div>

          {/* Activities Completed */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">
                {isAr ? 'الأنشطة المنجزة' : 'Activity Checkpoints'}
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                {summary.activities.completed}
                <span className="text-sm text-slate-400 font-normal">
                  /{summary.activities.total}
                </span>
              </span>
              <span className="text-xs text-blue-600 font-medium">
                {summary.activities.inProgress} {isAr ? 'جارية' : 'active'}
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{
                  width: `${
                    summary.activities.total > 0
                      ? Math.round((summary.activities.completed / summary.activities.total) * 100)
                      : 0
                  }%`
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ==================== VIEW MODE SWITCHER & TOOLBAR ==================== */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
        {/* Toggle Buttons: Initiatives vs Projects */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="inline-flex p-1 rounded-lg bg-slate-100 border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('initiatives')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors flex items-center gap-2 ${
                activeTab === 'initiatives'
                  ? 'bg-white text-blue-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>{isAr ? 'إنجاز المبادرات' : 'Initiative Progress'}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700 font-mono">
                {initiatives.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('projects')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors flex items-center gap-2 ${
                activeTab === 'projects'
                  ? 'bg-white text-blue-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderKanban className="w-3.5 h-3.5" />
              <span>{isAr ? 'إنجاز المشاريع' : 'Project Progress'}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700 font-mono">
                {projects.length}
              </span>
            </button>
          </div>

          <span className="text-xs text-slate-500">
            {activeTab === 'initiatives'
              ? isAr
                ? 'تُحسب نسبة كل مبادرة بناءً على متوسط إنجاز مشاريعها التابعة'
                : 'Each initiative progress percentage rolls up from its child delivery projects'
              : isAr
              ? 'تُحسب نسبة كل مشروع بناءً على متوسط إنجاز أنشطته الميدانية'
              : 'Each project progress percentage rolls up directly from its underlying activity completion'}
          </span>
        </div>

        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          {/* Search Input */}
          <div className="lg:col-span-6 relative">
            <Search
              className={`w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 ${
                isAr ? 'right-3' : 'left-3'
              }`}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === 'initiatives'
                  ? isAr
                    ? 'البحث باسم المبادرة، الإدارة، أو المالك...'
                    : 'Search by initiative name, department, or owner...'
                  : isAr
                  ? 'البحث باسم المشروع، المبادرة، أو مدير المشروع...'
                  : 'Search by project name, initiative, or manager...'
              }
              className={`w-full text-xs sm:text-sm border border-slate-200 rounded-lg py-2 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-slate-50/50 transition-colors ${
                isAr ? 'pr-9 pl-3' : 'pl-9 pr-3'
              }`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className={`absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 ${
                  isAr ? 'left-3' : 'right-3'
                }`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="lg:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs sm:text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 cursor-pointer"
            >
              <option value="All">{isAr ? 'جميع الحالات' : 'All Statuses'}</option>
              <option value="Completed">{isAr ? 'مكتمل' : 'Completed'}</option>
              <option value="In Progress">{isAr ? 'قيد التنفيذ' : 'In Progress'}</option>
              <option value="Planned">{isAr ? 'مخطط' : 'Planned'}</option>
              <option value="Not Started">{isAr ? 'لم يبدأ' : 'Not Started'}</option>
              <option value="Delayed">{isAr ? 'متأخر' : 'Delayed'}</option>
              <option value="On Hold">{isAr ? 'معلق' : 'On Hold'}</option>
              <option value="Draft">{isAr ? 'مسودة' : 'Draft'}</option>
            </select>
          </div>

          {/* Progress Range Filter */}
          <div className="lg:col-span-3">
            <select
              value={progressRangeFilter}
              onChange={(e) => setProgressRangeFilter(e.target.value)}
              className="w-full text-xs sm:text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 cursor-pointer"
            >
              <option value="All">{isAr ? 'جميع نطاقات الإنجاز' : 'All Progress Ranges'}</option>
              <option value="100">{isAr ? 'مكتمل 100%' : '100% Completed'}</option>
              <option value="70-99">{isAr ? 'إنجاز متقدم (70% - 99%)' : 'Advanced (70% - 99%)'}</option>
              <option value="40-69">{isAr ? 'إنجاز متوسط (40% - 69%)' : 'Moderate (40% - 69%)'}</option>
              <option value="0-39">{isAr ? 'إنجاز مبكر (أقل من 40%)' : 'Early Stage (< 40%)'}</option>
              <option value="no-data">{isAr ? 'لا تتوفر بيانات إنجاز' : 'No Progress Data'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* ==================== INITIATIVE PROGRESS TABLE (Feature 1) ==================== */}
      {activeTab === 'initiatives' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          {loading ? (
            <div className="p-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
              <p className="text-sm text-slate-500">
                {isAr ? 'جارٍ احتساب نسب إنجاز المبادرات...' : 'Calculating initiative progress telemetry...'}
              </p>
            </div>
          ) : fetchError && initiatives.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">{fetchError}</h3>
              <button
                type="button"
                onClick={() => fetchProgressData(false)}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                {isAr ? 'إعادة التحميل' : 'Retry'}
              </button>
            </div>
          ) : filteredInitiatives.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Compass className="w-8 h-8 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">
                {isAr ? 'لا توجد مبادرات مطابقة' : 'No initiatives match the criteria'}
              </h3>
              <p className="text-xs text-slate-500">
                {isAr
                  ? 'جرب ضبط معايير البحث أو تصفية الحالات لاستعراض السجلات.'
                  : 'Try adjusting your search query or progress range filter.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start border-collapse">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-slate-200/80 text-xs font-semibold text-slate-600">
                    <th className="py-3.5 px-4 w-14 text-start">{isAr ? 'المعرف' : 'ID'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'المبادرة الاستراتيجية' : 'Initiative'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'المحفظة / الإدارة' : 'Portfolio · Department'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'المالك' : 'Owner'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                    <th className="py-3.5 px-4 text-center">{isAr ? 'مشاريع مكتملة' : 'Projects Done'}</th>
                    <th className="py-3.5 px-4 w-56 text-start">{isAr ? 'نسبة الإنجاز المحتسبة' : 'Calculated Progress'}</th>
                    <th className="py-3.5 px-4 text-end">{isAr ? 'التفاصيل' : 'Details'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 text-sm">
                  {filteredInitiatives.map((i) => (
                    <tr
                      key={i.id}
                      onClick={() => handleOpenInitiativeDetails(i)}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                    >
                      {/* ID */}
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-500 tabular-nums">
                        #{i.id}
                      </td>

                      {/* Name */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {pickLocalized(lang, i.name, i.nameAr)}
                        </div>
                        {(i.description || i.descriptionAr) && (
                          <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                            {pickLocalized(lang, i.description, i.descriptionAr)}
                          </div>
                        )}
                      </td>

                      {/* Portfolio & Department */}
                      <td className="py-3.5 px-4 text-xs text-slate-700 whitespace-nowrap">
                        <span className="font-medium text-slate-800">
                          {pickLocalized(lang, i.portfolioName, i.portfolioNameAr, '—')}
                        </span>
                        <span className="mx-1.5 text-slate-400">·</span>
                        <span className="text-slate-500">
                          {pickLocalized(lang, i.departmentName, i.departmentNameAr, isAr ? 'عام' : 'Enterprise')}
                        </span>
                      </td>

                      {/* Owner */}
                      <td className="py-3.5 px-4 text-xs text-slate-700 whitespace-nowrap">
                        {pickLocalized(lang, i.ownerName, i.ownerNameAr, isAr ? 'غير محدد' : 'Unassigned')}
                      </td>

                      {/* Status (Story 4.5) */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {renderStatusBadge(i.status)}
                      </td>

                      {/* Projects completion ratio */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-mono text-xs font-bold tabular-nums text-slate-700">
                          {i.completedProjectCount} / {i.projectCount}
                        </span>
                      </td>

                      {/* Progress Visual Bar (Story 4.1 AC 3 & AC 4) */}
                      <td className="py-3.5 px-4">
                        {hasValidProgress(i.progressPercentage, i.hasProgressData) ? (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-mono font-bold text-slate-800">
                                {i.progressPercentage}%
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {i.projectCount > 0
                                  ? isAr
                                    ? `${i.projectCount} مشاريع`
                                    : `${i.projectCount} projects`
                                  : isAr
                                  ? 'بدون مشاريع'
                                  : 'No projects'}
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${getProgressColor(
                                  i.progressPercentage,
                                  i.hasProgressData
                                )}`}
                                style={{ width: `${i.progressPercentage}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                                {isAr ? 'لا تتوفر بيانات' : 'No data'}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {i.projectCount > 0
                                  ? isAr
                                    ? `${i.projectCount} مشاريع بلا أنشطة`
                                    : `${i.projectCount} projects (no activities)`
                                  : isAr
                                  ? 'بدون مشاريع'
                                  : 'No projects'}
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden" />
                          </div>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-end" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleOpenInitiativeDetails(i)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                          title={isAr ? 'عرض تفاصيل الإنجاز' : 'Inspect progress breakdown'}
                        >
                          <ChevronRight className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==================== PROJECT PROGRESS TABLE (Feature 2) ==================== */}
      {activeTab === 'projects' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          {loading ? (
            <div className="p-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
              <p className="text-sm text-slate-500">
                {isAr ? 'جارٍ احتساب نسب إنجاز المشاريع...' : 'Calculating project progress telemetry...'}
              </p>
            </div>
          ) : fetchError && projects.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">{fetchError}</h3>
              <button
                type="button"
                onClick={() => fetchProgressData(false)}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                {isAr ? 'إعادة التحميل' : 'Retry'}
              </button>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <FolderKanban className="w-8 h-8 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">
                {isAr ? 'لا توجد مشاريع مطابقة' : 'No projects match the criteria'}
              </h3>
              <p className="text-xs text-slate-500">
                {isAr
                  ? 'جرب ضبط معايير البحث أو تصفية الحالات لاستعراض السجلات.'
                  : 'Try adjusting your search query or progress range filter.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start border-collapse">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-slate-200/80 text-xs font-semibold text-slate-600">
                    <th className="py-3.5 px-4 w-14 text-start">{isAr ? 'المعرف' : 'ID'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'المشروع' : 'Project'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'المبادرة الاستراتيجية' : 'Strategic Initiative'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'مدير المشروع' : 'Project Manager'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                    <th className="py-3.5 px-4 text-center">{isAr ? 'الأنشطة المكتملة' : 'Activities Done'}</th>
                    <th className="py-3.5 px-4 w-56 text-start">{isAr ? 'نسبة الإنجاز المحتسبة' : 'Calculated Progress'}</th>
                    <th className="py-3.5 px-4 text-end">{isAr ? 'التفاصيل' : 'Details'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 text-sm">
                  {filteredProjects.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => handleOpenProjectDetails(p)}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                    >
                      {/* ID */}
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-500 tabular-nums">
                        #{p.id}
                      </td>

                      {/* Name */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {pickLocalized(lang, p.name, p.nameAr)}
                        </div>
                        {(p.description || p.descriptionAr) && (
                          <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                            {pickLocalized(lang, p.description, p.descriptionAr)}
                          </div>
                        )}
                      </td>

                      {/* Initiative */}
                      <td className="py-3.5 px-4 text-xs text-slate-700 whitespace-nowrap">
                        <span className="font-medium text-slate-800">
                          {pickLocalized(lang, p.initiativeName, p.initiativeNameAr, '—')}
                        </span>
                      </td>

                      {/* Project Manager */}
                      <td className="py-3.5 px-4 text-xs text-slate-700 whitespace-nowrap">
                        {pickLocalized(lang, p.projectManagerName, p.projectManagerNameAr, isAr ? 'غير محدد' : 'Unassigned')}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {renderStatusBadge(p.status)}
                      </td>

                      {/* Activities Done */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-mono text-xs font-bold tabular-nums text-slate-700">
                          {p.completedActivityCount} / {p.activityCount}
                        </span>
                      </td>

                      {/* Progress Visual Bar (Story 4.3 AC 3 & AC 4) */}
                      <td className="py-3.5 px-4">
                        {hasValidProgress(p.progressPercentage, p.hasProgressData) ? (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-mono font-bold text-slate-800">
                                {p.progressPercentage}%
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {p.activityCount > 0
                                  ? isAr
                                    ? `${p.activityCount} أنشطة`
                                    : `${p.activityCount} activities`
                                  : isAr
                                  ? 'بدون أنشطة'
                                  : 'No activities'}
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${getProgressColor(
                                  p.progressPercentage,
                                  p.hasProgressData
                                )}`}
                                style={{ width: `${p.progressPercentage}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                                {isAr ? 'لا تتوفر بيانات' : 'No data'}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {isAr ? 'بدون أنشطة' : 'No activities'}
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden" />
                          </div>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-end" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleOpenProjectDetails(p)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                          title={isAr ? 'عرض تفاصيل الأنشطة' : 'Inspect activity breakdown'}
                        >
                          <ChevronRight className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==================== INITIATIVE PROGRESS DETAILS DRAWER (Story 4.1 AC 2 & Story 4.2) ==================== */}
      {selectedInitiative && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedInitiative(null)}
          />

          <div
            className={`relative w-full max-w-xl bg-white shadow-2xl h-full flex flex-col z-10 overflow-hidden ${
              isAr ? 'text-right' : 'text-left'
            }`}
          >
            {/* Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Compass className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {pickLocalized(lang, selectedInitiative.name, selectedInitiative.nameAr)}
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">
                    {isAr ? `المعرف #${selectedInitiative.id}` : `ID #${selectedInitiative.id}`} ·{' '}
                    {translateStatus(selectedInitiative.status, lang)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {onNavigateToInitiative && (
                  <button
                    onClick={() => {
                      const id = selectedInitiative.id;
                      setSelectedInitiative(null);
                      onNavigateToInitiative(id);
                    }}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg border border-slate-200 cursor-pointer"
                    title={isAr ? 'فتح في إدارة المبادرات' : 'Open in initiative management'}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setSelectedInitiative(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Progress Hero */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50/60 to-blue-50/60 border border-indigo-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-900">
                    {isAr ? 'نسبة الإنجاز المحتسبة' : 'Calculated Progress Rollup'}
                  </span>
                  {hasValidProgress(selectedInitiative.progressPercentage, selectedInitiative.hasProgressData) ? (
                    <span className="text-2xl font-bold font-mono text-indigo-900">
                      {selectedInitiative.progressPercentage}%
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-white text-slate-600 border border-slate-200">
                      {isAr ? 'لا تتوفر بيانات' : 'No data available'}
                    </span>
                  )}
                </div>
                <div className="w-full bg-slate-200/80 rounded-full h-2.5 mt-2.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${getProgressColor(
                      selectedInitiative.progressPercentage,
                      selectedInitiative.hasProgressData
                    )}`}
                    style={{
                      width: `${
                        hasValidProgress(selectedInitiative.progressPercentage, selectedInitiative.hasProgressData)
                          ? selectedInitiative.progressPercentage
                          : 0
                      }%`
                    }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  {hasValidProgress(selectedInitiative.progressPercentage, selectedInitiative.hasProgressData)
                    ? isAr
                      ? `تُحسب هذه النسبة كمتوسط لإنجاز ${selectedInitiative.projectCount} مشروع تابع للمبادرة.`
                      : `Calculated as the live average of ${selectedInitiative.projectCount} project(s) with progress data.`
                    : isAr
                    ? 'لا توجد مشاريع تحتوي على بيانات أنشطة مكتملة أو قيد التنفيذ لاحتساب نسبة الإنجاز حتى الآن.'
                    : 'No projects with measurable activity progress data are currently available to calculate a percentage.'}
                </p>
              </div>

              {/* Child Projects Rollup Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <FolderKanban className="w-4 h-4 text-blue-600" />
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      {isAr ? 'المشاريع التابعة ومعدلات إنجازها' : 'Underlying Projects & Progress'}
                    </h4>
                  </div>
                  <span className="text-xs font-mono font-semibold text-slate-500">
                    {selectedInitiative.projects?.length || 0} {isAr ? 'مشاريع' : 'projects'}
                  </span>
                </div>

                {drawerDetailsLoading ? (
                  <div className="p-8 text-center text-xs text-slate-400 space-y-2">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-blue-600" />
                    <p>{isAr ? 'جارٍ تحميل تفاصيل المشاريع...' : 'Loading child projects...'}</p>
                  </div>
                ) : !selectedInitiative.projects || selectedInitiative.projects.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
                    <p>
                      {isAr
                        ? 'لا توجد مشاريع مسجلة تحت هذه المبادرة حالياً.'
                        : 'No projects are currently linked to this initiative.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedInitiative.projects.map((pr) => (
                      <div
                        key={pr.id}
                        className="p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:shadow-xs transition-all space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <span className="font-semibold text-xs text-slate-900 truncate block">
                              {pickLocalized(lang, pr.name, pr.nameAr)}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {pickLocalized(lang, pr.projectManagerName, pr.projectManagerNameAr, isAr ? 'بدون مدير' : 'No PM')} ·{' '}
                              {translateStatus(pr.status, lang)}
                            </span>
                          </div>
                          <div className="text-end">
                            {hasValidProgress(pr.progressPercentage, pr.hasProgressData) ? (
                              <span className="font-mono text-xs font-bold text-blue-700">
                                {pr.progressPercentage}%
                              </span>
                            ) : (
                              <span className="text-[11px] font-medium text-slate-400">
                                {isAr ? 'لا تتوفر بيانات' : 'No data'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Progress mini bar */}
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${getProgressColor(
                              pr.progressPercentage,
                              pr.hasProgressData
                            )}`}
                            style={{
                              width: `${
                                hasValidProgress(pr.progressPercentage, pr.hasProgressData)
                                  ? pr.progressPercentage
                                  : 0
                              }%`
                            }}
                          />
                        </div>

                        {/* Deep link to workspace */}
                        {onNavigateToProjectWorkspace && (
                          <div className="flex justify-end pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedInitiative(null);
                                onNavigateToProjectWorkspace(pr.id);
                              }}
                              className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                            >
                              <span>{isAr ? 'فتح مساحة عمل المشروع' : 'Open in workspace'}</span>
                              <ArrowRight className={`w-3 h-3 ${isAr ? 'rotate-180' : ''}`} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-mono">
                {isAr ? 'نكسورا لإدارة المشاريع - تتبع الإنجاز' : 'NEXORA PMO - Progress Tracking'}
              </span>
              <button
                type="button"
                onClick={() => setSelectedInitiative(null)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== PROJECT PROGRESS DETAILS DRAWER (Story 4.3 AC 2 & Story 4.4) ==================== */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedProject(null)}
          />

          <div
            className={`relative w-full max-w-xl bg-white shadow-2xl h-full flex flex-col z-10 overflow-hidden ${
              isAr ? 'text-right' : 'text-left'
            }`}
          >
            {/* Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
                  <FolderKanban className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {pickLocalized(lang, selectedProject.name, selectedProject.nameAr)}
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">
                    {isAr ? `المعرف #${selectedProject.id}` : `ID #${selectedProject.id}`} ·{' '}
                    {translateStatus(selectedProject.status, lang)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {onNavigateToProjectWorkspace && (
                  <button
                    onClick={() => {
                      const id = selectedProject.id;
                      setSelectedProject(null);
                      onNavigateToProjectWorkspace(id);
                    }}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg border border-slate-200 cursor-pointer"
                    title={isAr ? 'فتح في مساحة العمل' : 'Open in project workspace'}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setSelectedProject(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Progress Hero */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-sky-50/60 to-blue-50/60 border border-sky-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-900">
                    {isAr ? 'نسبة إنجاز المشروع المحتسبة' : 'Calculated Project Progress'}
                  </span>
                  {hasValidProgress(selectedProject.progressPercentage, selectedProject.hasProgressData) ? (
                    <span className="text-2xl font-bold font-mono text-sky-900">
                      {selectedProject.progressPercentage}%
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-white text-slate-600 border border-slate-200">
                      {isAr ? 'لا تتوفر بيانات' : 'No data available'}
                    </span>
                  )}
                </div>
                <div className="w-full bg-slate-200/80 rounded-full h-2.5 mt-2.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${getProgressColor(
                      selectedProject.progressPercentage,
                      selectedProject.hasProgressData
                    )}`}
                    style={{
                      width: `${
                        hasValidProgress(selectedProject.progressPercentage, selectedProject.hasProgressData)
                          ? selectedProject.progressPercentage
                          : 0
                      }%`
                    }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  {hasValidProgress(selectedProject.progressPercentage, selectedProject.hasProgressData)
                    ? isAr
                      ? `تُحسب هذه النسبة كمتوسط فعلي لجميع الأنشطة المجدولة (${selectedProject.completedActivityCount || 0} من ${selectedProject.activityCount} مكتملة).`
                      : `Calculated dynamically from all project activities (${selectedProject.completedActivityCount || 0} of ${selectedProject.activityCount} completed).`
                    : isAr
                    ? 'لا توجد أنشطة ذات بيانات إنجاز مرتبطة بهذا المشروع حالياً.'
                    : 'No activities with measurable progress data are currently linked to this project.'}
                </p>
              </div>

              {/* Child Activities Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      {isAr ? 'الأنشطة التنفيذية ونسب الإنجاز' : 'Underlying Activities & Completion'}
                    </h4>
                  </div>
                  <span className="text-xs font-mono font-semibold text-slate-500">
                    {selectedProject.activities?.length || 0} {isAr ? 'نشاط' : 'activities'}
                  </span>
                </div>

                {drawerDetailsLoading ? (
                  <div className="p-8 text-center text-xs text-slate-400 space-y-2">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-blue-600" />
                    <p>{isAr ? 'جارٍ تحميل تفاصيل الأنشطة...' : 'Loading activities...'}</p>
                  </div>
                ) : !selectedProject.activities || selectedProject.activities.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
                    <p>
                      {isAr
                        ? 'لا توجد أنشطة مسجلة تحت هذا المشروع حالياً.'
                        : 'No activities are currently scheduled for this project.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedProject.activities.map((act) => (
                      <div
                        key={act.id}
                        className="p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:shadow-xs transition-all space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <span className="font-semibold text-xs text-slate-900 truncate block">
                              {pickLocalized(lang, act.name, act.nameAr)}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {(act.workstreamName || act.workstreamNameAr) ? `${pickLocalized(lang, act.workstreamName, act.workstreamNameAr)} · ` : ''}
                              {pickLocalized(lang, act.assignedUserName, act.assignedUserNameAr, isAr ? 'غير محدد' : 'Unassigned')} ·{' '}
                              {translateStatus(act.status, lang)} · {act.dueDate}
                            </span>
                          </div>
                          <div className="text-end">
                            {hasValidProgress(act.progressPercentage) ? (
                              <span className="font-mono text-xs font-bold text-emerald-700">
                                {act.progressPercentage}%
                              </span>
                            ) : (
                              <span className="text-[11px] font-medium text-slate-400">
                                {isAr ? 'لا تتوفر بيانات' : 'No data'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Progress mini bar */}
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${getProgressColor(act.progressPercentage)}`}
                            style={{
                              width: `${hasValidProgress(act.progressPercentage) ? act.progressPercentage : 0}%`
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-mono">
                {isAr ? 'نكسورا لإدارة المشاريع - تتبع الإنجاز' : 'NEXORA PMO - Progress Tracking'}
              </span>
              <button
                type="button"
                onClick={() => setSelectedProject(null)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
