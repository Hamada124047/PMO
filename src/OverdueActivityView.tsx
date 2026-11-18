import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from './apiClient';
import {
  AlertTriangle,
  RefreshCw,
  Search,
  RotateCcw,
  Calendar,
  FolderKanban,
  User,
  ChevronLeft,
  ChevronRight,
  X,
  Clock,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Layers,
  Flag,
  FileText,
  AlertCircle
} from 'lucide-react';
import { Language, pickLocalized, translatePriority, translateStatus } from './i18n';

export interface OverdueActivityItem {
  id: number;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  projectId: number;
  projectName: string | null;
  projectNameAr?: string | null;
  initiativeId: number | null;
  initiativeName: string | null;
  initiativeNameAr?: string | null;
  workstreamId: number | null;
  workstreamName: string | null;
  workstreamNameAr?: string | null;
  milestoneId: number | null;
  milestoneName: string | null;
  milestoneNameAr?: string | null;
  parentActivityId: number | null;
  parentActivityName: string | null;
  parentActivityNameAr?: string | null;
  assignedUserId: number | null;
  assignedUserName: string | null;
  assignedUserNameAr?: string | null;
  startDate: string;
  dueDate: string;
  status: string;
  priority: string | null;
  progressPercentage: number | null;
  isOverdue: boolean;
  daysOverdue: number;
  evaluatedDate: string;
}

interface OverdueFilterOptions {
  projects: { id: number; name: string; nameAr?: string }[];
  assignedUsers: { id: number; fullName: string; fullNameAr?: string }[];
  hasUnassigned: boolean;
}

interface OverdueSummary {
  totalOverdue: number;
  criticalCount: number;
  highCount: number;
  unassignedCount: number;
}

interface OverdueActivityResponse {
  items: OverdueActivityItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  evaluatedDate: string;
  summary: OverdueSummary;
  filters: OverdueFilterOptions;
}

export interface OverdueActivityViewProps {
  lang: Language;
  showBanner: (type: 'success' | 'error', text: string) => void;
  onNavigateToProjectWorkspace?: (projectId: number) => void;
}

export const OverdueActivityView: React.FC<OverdueActivityViewProps> = ({
  lang,
  showBanner,
  onNavigateToProjectWorkspace
}) => {
  const isAr = lang === 'ar';

  // List & Pagination State
  const [items, setItems] = useState<OverdueActivityItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [evaluatedDate, setEvaluatedDate] = useState<string>('');
  const [summary, setSummary] = useState<OverdueSummary>({
    totalOverdue: 0,
    criticalCount: 0,
    highCount: 0,
    unassignedCount: 0
  });
  const [filterOptions, setFilterOptions] = useState<OverdueFilterOptions>({
    projects: [],
    assignedUsers: [],
    hasUnassigned: false
  });

  // Loading & Error States
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Search & Filters (backend-driven)
  const [searchInput, setSearchInput] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [projectFilter, setProjectFilter] = useState<string>('All');
  const [assignedUserFilter, setAssignedUserFilter] = useState<string>('All');

  // Detail Drawer State
  const [selectedActivityId, setSelectedActivityId] = useState<number | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<OverdueActivityItem | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Debounce search input cleanly and reset page to 1 when query changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchOverdueActivities = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setFetchError(null);

      try {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('pageSize', String(pageSize));
        if (debouncedSearch) params.set('search', debouncedSearch);
        if (projectFilter !== 'All') params.set('projectId', projectFilter);
        if (assignedUserFilter !== 'All') params.set('assignedUserId', assignedUserFilter);

        const res = await apiFetch(`/api/overdue-activities?${params.toString()}`);
        if (!res.ok) {
          const errBody = await res.json().catch(() => null);
          throw new Error(errBody?.message || 'Failed to load overdue activities.');
        }

        const data: OverdueActivityResponse = await res.json();
        setItems(Array.isArray(data.items) ? data.items : []);
        setTotal(typeof data.total === 'number' ? data.total : 0);
        setTotalPages(typeof data.totalPages === 'number' ? Math.max(1, data.totalPages) : 1);
        setEvaluatedDate(data.evaluatedDate || '');
        if (data.summary) {
          setSummary(data.summary);
        }
        if (data.filters) {
          setFilterOptions(data.filters);
        }

        if (isManualRefresh) {
          showBanner(
            'success',
            isAr
              ? 'تم تحديث قائمة الأنشطة المتأخرة بناءً على أحدث بيانات النظام.'
              : 'Overdue activity list refreshed from the latest records.'
          );
        }
      } catch (err: any) {
        console.error('Error loading overdue activities:', err);
        const msg = isAr
          ? 'تعذر تحميل قائمة الأنشطة المتأخرة. يرجى المحاولة مرة أخرى.'
          : 'Failed to load overdue activities. Please try again.';
        setFetchError(msg);
        if (isManualRefresh) {
          showBanner('error', msg);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, pageSize, debouncedSearch, projectFilter, assignedUserFilter, isAr, showBanner]
  );

  useEffect(() => {
    fetchOverdueActivities(false);
  }, [fetchOverdueActivities]);

  const handleOpenActivityDetails = async (item: OverdueActivityItem) => {
    setSelectedActivityId(item.id);
    setSelectedActivity(item);
    setDetailError(null);
    setDetailLoading(true);

    try {
      const res = await apiFetch(`/api/overdue-activities/${item.id}`);
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.message || 'Failed to retrieve activity details.');
      }
      const details: OverdueActivityItem = await res.json();
      setSelectedActivity(details);
    } catch (err: any) {
      console.error('Error fetching overdue activity details:', err);
      setDetailError(
        isAr
          ? 'تعذر استرجاع تفاصيل هذا النشاط المتأخر. يرجى إعادة المحاولة.'
          : 'Unable to retrieve details for this overdue activity. Please retry.'
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const handleRetryDetails = () => {
    if (selectedActivityId && selectedActivity) {
      handleOpenActivityDetails(selectedActivity);
    }
  };

  const handleCloseDrawer = () => {
    setSelectedActivityId(null);
    setSelectedActivity(null);
    setDetailError(null);
  };

  const hasActiveFilters =
    searchInput.trim() !== '' || projectFilter !== 'All' || assignedUserFilter !== 'All';

  const handleClearFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setProjectFilter('All');
    setAssignedUserFilter('All');
    setPage(1);
  };

  const formatDaysOverdue = (days: number) => {
    if (isAr) {
      if (days === 1) return 'متأخر يوم واحد';
      if (days === 2) return 'متأخر يومين';
      if (days >= 3 && days <= 10) return `متأخر ${days} أيام`;
      return `متأخر ${days} يوماً`;
    }
    return days === 1 ? '1 day overdue' : `${days} days overdue`;
  };

  const renderStatusBadge = (status: string) => {
    const lower = status.toLowerCase();
    let cls = 'bg-slate-100 text-slate-700 border-slate-200';
    if (lower === 'in progress') {
      cls = 'bg-blue-50 text-blue-700 border-blue-200';
    } else if (lower === 'delayed') {
      cls = 'bg-rose-50 text-rose-700 border-rose-200';
    } else if (lower === 'on hold') {
      cls = 'bg-amber-50 text-amber-700 border-amber-200';
    } else if (lower === 'completed') {
      cls = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
        {translateStatus(status, lang)}
      </span>
    );
  };

  const renderPriorityBadge = (priority: string | null) => {
    if (!priority) {
      return <span className="text-xs text-slate-400">—</span>;
    }
    const lower = priority.toLowerCase();
    let cls = 'bg-slate-100 text-slate-700 border-slate-200';
    if (lower === 'critical') {
      cls = 'bg-rose-50 text-rose-700 border-rose-200';
    } else if (lower === 'high') {
      cls = 'bg-amber-50 text-amber-700 border-amber-200';
    } else if (lower === 'medium') {
      cls = 'bg-sky-50 text-sky-700 border-sky-200';
    }
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${cls}`}>
        {translatePriority(priority, lang)}
      </span>
    );
  };

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(total, page * pageSize);

  return (
    <div className={`space-y-6 ${isAr ? 'text-right' : 'text-left'}`} dir={isAr ? 'rtl' : 'ltr'}>
      {/* ==================== MODULE HEADER ==================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/90 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-sm shadow-rose-500/20 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
              {isAr ? 'الأنشطة المتأخرة' : 'Overdue Activities'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              {isAr
                ? 'رصد ومتابعة الأنشطة غير المكتملة التي تجاوزت تاريخ الاستحقاق المخطط لها'
                : 'Identify and monitor incomplete activities that have passed their planned due date'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {evaluatedDate && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-600 font-mono">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>
                {isAr ? `تاريخ التقييم: ${evaluatedDate}` : `Evaluated: ${evaluatedDate}`}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => fetchOverdueActivities(true)}
            disabled={refreshing || loading}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            title={isAr ? 'تحديث قائمة الأنشطة المتأخرة' : 'Refresh overdue activity list'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-rose-600' : ''}`} />
            <span>{isAr ? 'تحديث القائمة' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* ==================== SUMMARY METRICS ==================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              {isAr ? 'إجمالي الأنشطة المتأخرة' : 'Total Overdue Activities'}
            </span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-rose-700 tabular-nums">
              {summary.totalOverdue}
            </span>
            <span className="text-xs text-slate-400">
              {isAr ? 'نشاط يتطلب متابعة' : 'requiring follow-up'}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              {isAr ? 'أولوية حرجة' : 'Critical Priority'}
            </span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <Flag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
              {summary.criticalCount}
            </span>
            <span className="text-xs text-slate-400">
              {isAr ? 'تأخير حرج' : 'critical overdue'}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              {isAr ? 'أولوية عالية' : 'High Priority'}
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
              {summary.highCount}
            </span>
            <span className="text-xs text-slate-400">
              {isAr ? 'أولوية مرتفعة' : 'high priority'}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              {isAr ? 'نتائج التصفية الحالية' : 'Matching Results'}
            </span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
              <FolderKanban className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
              {total}
            </span>
            <span className="text-xs text-slate-400">
              {isAr ? 'في العرض الحالي' : 'filtered total'}
            </span>
          </div>
        </div>
      </div>

      {/* ==================== ERROR BANNER ==================== */}
      {fetchError && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 text-rose-800">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />
            <div>
              <p className="text-xs sm:text-sm font-semibold">{fetchError}</p>
              <p className="text-xs text-rose-600 mt-0.5">
                {isAr
                  ? 'تعذر الاتصال بواجهة الأنشطة المتأخرة.'
                  : 'Unable to retrieve current overdue activity records from the server.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => fetchOverdueActivities(false)}
            className="px-3 py-1.5 bg-white hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg border border-rose-300 cursor-pointer transition-colors shrink-0 self-start sm:self-center"
          >
            {isAr ? 'إعادة المحاولة' : 'Retry'}
          </button>
        </div>
      )}

      {/* ==================== SEARCH & FILTER TOOLBAR ==================== */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          {/* Search by Activity Name */}
          <div className="lg:col-span-5 relative">
            <Search
              className={`w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 ${
                isAr ? 'right-3' : 'left-3'
              }`}
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={isAr ? 'البحث باسم النشاط المتأخر...' : 'Search overdue activities by name...'}
              className={`w-full text-xs sm:text-sm border border-slate-200 rounded-lg py-2 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600 bg-slate-50/50 transition-colors ${
                isAr ? 'pr-9 pl-8' : 'pl-9 pr-8'
              }`}
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className={`absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer ${
                  isAr ? 'left-2.5' : 'right-2.5'
                }`}
                aria-label={isAr ? 'مسح البحث' : 'Clear search'}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter by Project */}
          <div className="lg:col-span-3">
            <select
              value={projectFilter}
              onChange={(e) => {
                setProjectFilter(e.target.value);
                setPage(1);
              }}
              aria-label={isAr ? 'تصفية حسب المشروع' : 'Filter by project'}
              className="w-full text-xs sm:text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600 cursor-pointer"
            >
              <option value="All">{isAr ? 'جميع المشاريع' : 'All Projects'}</option>
              {filterOptions.projects.map((pr) => (
                <option key={pr.id} value={String(pr.id)}>
                  {pickLocalized(lang, pr.name, pr.nameAr)}
                </option>
              ))}
            </select>
          </div>

          {/* Filter by Assigned User */}
          <div className="lg:col-span-3">
            <select
              value={assignedUserFilter}
              onChange={(e) => {
                setAssignedUserFilter(e.target.value);
                setPage(1);
              }}
              aria-label={isAr ? 'تصفية حسب المكلف' : 'Filter by assigned user'}
              className="w-full text-xs sm:text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600 cursor-pointer"
            >
              <option value="All">{isAr ? 'جميع المكلفين' : 'All Assigned Users'}</option>
              {filterOptions.assignedUsers.map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {pickLocalized(lang, u.fullName, u.fullNameAr)}
                </option>
              ))}
              {filterOptions.hasUnassigned && (
                <option value="unassigned">{isAr ? 'غير مكلف' : 'Unassigned'}</option>
              )}
            </select>
          </div>

          {/* Clear Filters */}
          <div className="lg:col-span-1 flex justify-end">
            <button
              type="button"
              onClick={handleClearFilters}
              disabled={!hasActiveFilters}
              className="w-full lg:w-auto px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors flex items-center justify-center gap-1.5"
              title={isAr ? 'مسح عوامل التصفية' : 'Clear search and filters'}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="lg:hidden">{isAr ? 'مسح' : 'Clear'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ==================== OVERDUE ACTIVITY TABLE ==================== */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {loading || refreshing ? (
          <div className="p-12 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-rose-600 animate-spin mx-auto" />
            <p className="text-sm text-slate-500">
              {refreshing
                ? isAr
                  ? 'جارٍ تحديث بيانات الأنشطة المتأخرة...'
                  : 'Refreshing overdue activity records...'
                : isAr
                ? 'جارٍ فحص وتحميل الأنشطة المتأخرة...'
                : 'Retrieving overdue activities...'}
            </p>
          </div>
        ) : fetchError && items.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">{fetchError}</h3>
            <button
              type="button"
              onClick={() => fetchOverdueActivities(false)}
              className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              {isAr ? 'إعادة التحميل' : 'Retry'}
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            {hasActiveFilters ? (
              <>
                <Search className="w-8 h-8 text-slate-300 mx-auto" />
                <h3 className="text-sm font-bold text-slate-800">
                  {isAr ? 'لا توجد أنشطة متأخرة مطابقة' : 'No matching overdue activities found'}
                </h3>
                <p className="text-xs text-slate-500">
                  {isAr
                    ? 'جرب تعديل كلمات البحث أو مسح عوامل التصفية المحددة.'
                    : 'Try adjusting your search query or clearing active project and user filters.'}
                </p>
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{isAr ? 'مسح البحث والتصفية' : 'Clear Search & Filters'}</span>
                </button>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-9 h-9 text-emerald-500 mx-auto" />
                <h3 className="text-sm font-bold text-slate-800">
                  {isAr ? 'لا توجد أنشطة متأخرة حالياً' : 'No overdue activities'}
                </h3>
                <p className="text-xs text-slate-500">
                  {isAr
                    ? 'جميع الأنشطة المجدولة إما مكتملة أو لا تزال ضمن موعد استحقاقها المخطط.'
                    : 'All scheduled activities are either completed or within their planned due dates.'}
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-start border-collapse">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-slate-200/80 text-xs font-semibold text-slate-600">
                    <th className="py-3.5 px-4 w-14 text-start">{isAr ? 'المعرف' : 'ID'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'النشاط' : 'Activity'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'المشروع المرتبط' : 'Associated Project'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'المكلف بالتنفيذ' : 'Assigned User'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'تاريخ الاستحقاق والتأخير' : 'Due Date & Overdue'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'الأولوية' : 'Priority'}</th>
                    <th className="py-3.5 px-4 text-end">{isAr ? 'التفاصيل' : 'Details'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 text-sm">
                  {items.map((act) => (
                    <tr
                      key={act.id}
                      onClick={() => handleOpenActivityDetails(act)}
                      className="hover:bg-rose-50/40 transition-colors cursor-pointer group"
                    >
                      {/* ID */}
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-500 tabular-nums">
                        #{act.id}
                      </td>

                      {/* Activity Name */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 group-hover:text-rose-700 transition-colors">
                            {pickLocalized(lang, act.name, act.nameAr)}
                          </span>
                        </div>
                        {act.parentActivityName && (
                          <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                            {isAr
                              ? `مهمة فرعية من: ${pickLocalized(lang, act.parentActivityName, act.parentActivityNameAr)}`
                              : `Subtask of: ${pickLocalized(lang, act.parentActivityName, act.parentActivityNameAr)}`}
                          </div>
                        )}
                      </td>

                      {/* Associated Project */}
                      <td className="py-3.5 px-4 text-xs text-slate-700">
                        <div className="font-medium text-slate-800">
                          {pickLocalized(lang, act.projectName, act.projectNameAr) || '—'}
                        </div>
                        {act.workstreamName && (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {pickLocalized(lang, act.workstreamName, act.workstreamNameAr)}
                          </div>
                        )}
                      </td>

                      {/* Assigned User */}
                      <td className="py-3.5 px-4 text-xs text-slate-700 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>
                            {act.assignedUserName
                              ? pickLocalized(lang, act.assignedUserName, act.assignedUserNameAr)
                              : isAr
                              ? 'غير مكلف'
                              : 'Unassigned'}
                          </span>
                        </div>
                      </td>

                      {/* Due Date + Overdue Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span className="font-mono text-xs font-semibold text-slate-800 tabular-nums">
                            {act.dueDate}
                          </span>
                          <span className="inline-flex items-center gap-1 self-start px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span>{formatDaysOverdue(act.daysOverdue)}</span>
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">{renderStatusBadge(act.status)}</td>

                      {/* Priority */}
                      <td className="py-3.5 px-4 whitespace-nowrap">{renderPriorityBadge(act.priority)}</td>

                      {/* Details Trigger */}
                      <td className="py-3.5 px-4 text-end" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleOpenActivityDetails(act)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                          title={isAr ? 'عرض تفاصيل النشاط المتأخر' : 'View overdue activity details'}
                        >
                          <ChevronRight className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ==================== PAGINATION FOOTER ==================== */}
            <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-xs text-slate-600">
                <span>
                  {isAr
                    ? `عرض ${rangeStart}–${rangeEnd} من أصل ${total} نشاط متأخر`
                    : `Showing ${rangeStart}–${rangeEnd} of ${total} overdue activities`}
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  aria-label={isAr ? 'عدد السجلات في الصفحة' : 'Items per page'}
                  className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-700 cursor-pointer"
                >
                  <option value={5}>{isAr ? '5 لكل صفحة' : '5 / page'}</option>
                  <option value={10}>{isAr ? '10 لكل صفحة' : '10 / page'}</option>
                  <option value={20}>{isAr ? '20 لكل صفحة' : '20 / page'}</option>
                  <option value={50}>{isAr ? '50 لكل صفحة' : '50 / page'}</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
                >
                  <ChevronLeft className={`w-3.5 h-3.5 ${isAr ? 'rotate-180' : ''}`} />
                  <span>{isAr ? 'السابق' : 'Previous'}</span>
                </button>

                <span className="px-3 py-1 text-xs font-mono font-semibold text-slate-700">
                  {isAr ? `صفحة ${page} من ${totalPages}` : `Page ${page} of ${totalPages}`}
                </span>

                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
                >
                  <span>{isAr ? 'التالي' : 'Next'}</span>
                  <ChevronRight className={`w-3.5 h-3.5 ${isAr ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ==================== OVERDUE ACTIVITY DETAILS DRAWER (Feature 2) ==================== */}
      {selectedActivityId !== null && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={handleCloseDrawer}
          />

          <div
            className={`relative w-full max-w-xl bg-white shadow-2xl h-full flex flex-col z-10 overflow-hidden ${
              isAr ? 'text-right' : 'text-left'
            }`}
          >
            {/* Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900 truncate">
                    {selectedActivity
                      ? pickLocalized(lang, selectedActivity.name, selectedActivity.nameAr)
                      : isAr
                      ? 'تفاصيل النشاط'
                      : 'Activity Details'}
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">
                    {isAr ? `المعرف #${selectedActivityId}` : `ID #${selectedActivityId}`}
                    {selectedActivity?.status ? ` · ${translateStatus(selectedActivity.status, lang)}` : ''}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {onNavigateToProjectWorkspace && selectedActivity?.projectId && (
                  <button
                    type="button"
                    onClick={() => {
                      const projId = selectedActivity.projectId;
                      handleCloseDrawer();
                      onNavigateToProjectWorkspace(projId);
                    }}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg border border-slate-200 cursor-pointer"
                    title={isAr ? 'فتح مساحة عمل المشروع' : 'Open project workspace'}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCloseDrawer}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                  aria-label={isAr ? 'إغلاق' : 'Close'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {detailLoading ? (
                <div className="p-10 text-center space-y-2.5">
                  <Loader2 className="w-6 h-6 text-rose-600 animate-spin mx-auto" />
                  <p className="text-xs text-slate-500">
                    {isAr ? 'جارٍ تحميل تفاصيل النشاط المتأخر...' : 'Loading overdue activity details...'}
                  </p>
                </div>
              ) : detailError ? (
                <div className="p-5 bg-rose-50 border border-rose-200 rounded-xl space-y-3 text-center">
                  <AlertCircle className="w-6 h-6 text-rose-600 mx-auto" />
                  <p className="text-xs font-semibold text-rose-800">{detailError}</p>
                  <button
                    type="button"
                    onClick={handleRetryDetails}
                    className="px-3.5 py-1.5 bg-white hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg border border-rose-300 cursor-pointer"
                  >
                    {isAr ? 'إعادة المحاولة' : 'Retry'}
                  </button>
                </div>
              ) : selectedActivity ? (
                <>
                  {/* Overdue Status Banner */}
                  {selectedActivity.isOverdue ? (
                    <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs font-bold text-rose-900 uppercase tracking-wide">
                            {isAr ? 'نشاط متأخر عن موعد التسليم' : 'OVERDUE ACTIVITY'}
                          </div>
                          <p className="text-xs text-rose-700 mt-0.5">
                            {isAr
                              ? `تجاوز هذا النشاط تاريخ استحقاقه المخطط (${selectedActivity.dueDate}) بمقدار ${selectedActivity.daysOverdue} يوم دون اكتمال.`
                              : `Passed planned due date (${selectedActivity.dueDate}) by ${selectedActivity.daysOverdue} day(s) without completion.`}
                          </p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-600 text-white shrink-0 font-mono">
                        {formatDaysOverdue(selectedActivity.daysOverdue)}
                      </span>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div className="text-xs text-emerald-800 font-semibold">
                        {isAr
                          ? 'لم يعد هذا النشاط ضمن قائمة المتأخرات وفق آخر تحديث.'
                          : 'This activity is no longer flagged as overdue as of the latest evaluation.'}
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      <span>{isAr ? 'وصف النشاط' : 'Description'}</span>
                    </div>
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-700 leading-relaxed">
                      {pickLocalized(lang, selectedActivity.description, selectedActivity.descriptionAr) ||
                        (isAr ? 'لا يوجد وصف مسجل لهذا النشاط.' : 'No description provided for this activity.')}
                    </div>
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1">
                      <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                        <FolderKanban className="w-3.5 h-3.5" />
                        <span>{isAr ? 'المشروع المرتبط' : 'Associated Project'}</span>
                      </span>
                      <div className="text-xs font-bold text-slate-900">
                        {pickLocalized(
                          lang,
                          selectedActivity.projectName,
                          selectedActivity.projectNameAr
                        ) || '—'}
                      </div>
                      {selectedActivity.initiativeName && (
                        <div className="text-[11px] text-slate-500">
                          {pickLocalized(
                            lang,
                            selectedActivity.initiativeName,
                            selectedActivity.initiativeNameAr
                          )}
                        </div>
                      )}
                    </div>

                    <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1">
                      <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        <span>{isAr ? 'المكلف بالتنفيذ' : 'Assigned User'}</span>
                      </span>
                      <div className="text-xs font-bold text-slate-900">
                        {selectedActivity.assignedUserName
                          ? pickLocalized(
                              lang,
                              selectedActivity.assignedUserName,
                              selectedActivity.assignedUserNameAr
                            )
                          : isAr
                          ? 'غير مكلف'
                          : 'Unassigned'}
                      </div>
                      {selectedActivity.workstreamName && (
                        <div className="text-[11px] text-slate-500">
                          {pickLocalized(
                            lang,
                            selectedActivity.workstreamName,
                            selectedActivity.workstreamNameAr
                          )}
                        </div>
                      )}
                    </div>

                    <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1">
                      <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{isAr ? 'تاريخ الاستحقاق المخطط' : 'Planned Due Date'}</span>
                      </span>
                      <div className="text-xs font-bold font-mono text-rose-700">
                        {selectedActivity.dueDate}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {isAr ? `البدء: ${selectedActivity.startDate}` : `Start: ${selectedActivity.startDate}`}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1">
                      <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5" />
                        <span>{isAr ? 'الحالة والأولوية' : 'Status & Priority'}</span>
                      </span>
                      <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                        {renderStatusBadge(selectedActivity.status)}
                        {renderPriorityBadge(selectedActivity.priority)}
                      </div>
                    </div>
                  </div>

                  {/* Additional Hierarchy Context (Milestone / Parent Activity / Progress) */}
                  {(selectedActivity.milestoneName ||
                    selectedActivity.parentActivityName ||
                    selectedActivity.progressPercentage !== null) && (
                    <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60 space-y-2 text-xs">
                      {selectedActivity.parentActivityName && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">
                            {isAr ? 'النشاط الرئيسي' : 'Parent Activity'}
                          </span>
                          <span className="font-semibold text-slate-800">
                            {pickLocalized(
                              lang,
                              selectedActivity.parentActivityName,
                              selectedActivity.parentActivityNameAr
                            )}
                          </span>
                        </div>
                      )}
                      {selectedActivity.milestoneName && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">
                            {isAr ? 'المعلم المرتبط' : 'Linked Milestone'}
                          </span>
                          <span className="font-semibold text-slate-800">
                            {pickLocalized(
                              lang,
                              selectedActivity.milestoneName,
                              selectedActivity.milestoneNameAr
                            )}
                          </span>
                        </div>
                      )}
                      {selectedActivity.progressPercentage !== null && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">
                            {isAr ? 'نسبة الإنجاز الحالية' : 'Current Progress'}
                          </span>
                          <span className="font-mono font-bold text-slate-900">
                            {selectedActivity.progressPercentage}%
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-mono">
                {isAr ? 'نكسورا لإدارة المشاريع - الأنشطة المتأخرة' : 'NEXORA PMO - Overdue Activity'}
              </span>
              <button
                type="button"
                onClick={handleCloseDrawer}
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
