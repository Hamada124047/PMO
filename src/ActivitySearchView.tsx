import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from './apiClient';
import {
  Search,
  RotateCcw,
  Calendar,
  FolderKanban,
  User,
  ChevronLeft,
  ChevronRight,
  X,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Layers,
  FileText,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { Language, pickLocalized, translatePriority, translateStatus } from './i18n';

export interface ActivitySearchItem {
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
  subtaskCount?: number;
}

interface ActivitySearchFilterOptions {
  projects: { id: number; name: string; nameAr?: string }[];
  statuses: string[];
}

interface ActivitySearchResponse {
  items: ActivitySearchItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filters: ActivitySearchFilterOptions;
}

export interface ActivitySearchViewProps {
  lang: Language;
  showBanner: (type: 'success' | 'error', text: string) => void;
  onNavigateToProjectWorkspace?: (projectId: number) => void;
}

export const ActivitySearchView: React.FC<ActivitySearchViewProps> = ({
  lang,
  showBanner,
  onNavigateToProjectWorkspace
}) => {
  const isAr = lang === 'ar';

  // Search Results & Pagination State
  const [items, setItems] = useState<ActivitySearchItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [filterOptions, setFilterOptions] = useState<ActivitySearchFilterOptions>({
    projects: [],
    statuses: []
  });

  // Loading & Error States
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Search & Filter Inputs
  const [searchInput, setSearchInput] = useState<string>('');
  const [appliedSearch, setAppliedSearch] = useState<string>('');
  const [projectFilter, setProjectFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Detail Drawer State
  const [selectedActivityId, setSelectedActivityId] = useState<number | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<ActivitySearchItem | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const fetchSearchResults = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (appliedSearch) params.set('search', appliedSearch);
      if (projectFilter !== 'All') params.set('projectId', projectFilter);
      if (statusFilter !== 'All') params.set('status', statusFilter);

      const res = await apiFetch(`/api/activity-search?${params.toString()}`);
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.message || 'Failed to retrieve activities.');
      }

      const data: ActivitySearchResponse = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(typeof data.total === 'number' ? data.total : 0);
      setTotalPages(typeof data.totalPages === 'number' ? Math.max(1, data.totalPages) : 1);
      if (data.filters) {
        setFilterOptions(data.filters);
      }
    } catch (err: any) {
      console.error('Error searching activities:', err);
      const msg = isAr
        ? 'تعذر تحميل نتائج البحث عن الأنشطة. يرجى إعادة المحاولة.'
        : 'Failed to retrieve activity search results. Please try again.';
      setFetchError(msg);
      showBanner('error', msg);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, appliedSearch, projectFilter, statusFilter, isAr, showBanner]);

  useEffect(() => {
    fetchSearchResults();
  }, [fetchSearchResults]);

  const handleSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchInput.trim();
    if (trimmed === appliedSearch && page === 1) {
      fetchSearchResults();
    } else {
      setAppliedSearch(trimmed);
      setPage(1);
    }
  };

  const handleClearSearchOnly = () => {
    setSearchInput('');
    setAppliedSearch('');
    setPage(1);
  };

  const handleClearAll = () => {
    setSearchInput('');
    setAppliedSearch('');
    setProjectFilter('All');
    setStatusFilter('All');
    setPage(1);
  };

  const handleOpenDetails = async (item: ActivitySearchItem) => {
    setSelectedActivityId(item.id);
    setSelectedActivity(item);
    setDetailError(null);
    setDetailLoading(true);

    try {
      const res = await apiFetch(`/api/activity-search/${item.id}`);
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.message || 'Failed to retrieve activity details.');
      }
      const full: ActivitySearchItem = await res.json();
      setSelectedActivity(full);
    } catch (err: any) {
      console.error('Error loading activity details:', err);
      setDetailError(
        isAr
          ? 'تعذر استرجاع تفاصيل هذا النشاط. يرجى المحاولة مرة أخرى.'
          : 'Unable to retrieve activity details. Please retry.'
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const handleRetryDetails = () => {
    if (selectedActivityId && selectedActivity) {
      handleOpenDetails(selectedActivity);
    }
  };

  const handleCloseDrawer = () => {
    setSelectedActivityId(null);
    setSelectedActivity(null);
    setDetailError(null);
  };

  const hasActiveCriteria =
    appliedSearch !== '' || searchInput.trim() !== '' || projectFilter !== 'All' || statusFilter !== 'All';

  const renderStatusBadge = (status: string) => {
    const lower = status.toLowerCase();
    let cls = 'bg-slate-100 text-slate-700 border-slate-200';
    if (lower === 'completed') {
      cls = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    } else if (lower === 'in progress') {
      cls = 'bg-blue-50 text-blue-700 border-blue-200';
    } else if (lower === 'delayed') {
      cls = 'bg-rose-50 text-rose-700 border-rose-200';
    } else if (lower === 'on hold') {
      cls = 'bg-amber-50 text-amber-700 border-amber-200';
    }
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
        {translateStatus(status, lang)}
      </span>
    );
  };

  const renderPriorityBadge = (priority: string | null) => {
    if (!priority) return <span className="text-xs text-slate-400">—</span>;
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

  const statusChoices =
    filterOptions.statuses.length > 0
      ? filterOptions.statuses
      : ['Not Started', 'In Progress', 'Completed'];

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(total, page * pageSize);

  return (
    <div className={`space-y-6 ${isAr ? 'text-right' : 'text-left'}`} dir={isAr ? 'rtl' : 'ltr'}>
      {/* ==================== MODULE HEADER ==================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/90 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-500/20 shrink-0">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
              {isAr ? 'البحث عن الأنشطة' : 'Activity Search'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              {isAr
                ? 'البحث السريع عن الأنشطة عبر كافة المشاريع وتصفيتها حسب المشروع والحالة'
                : 'Quickly find and review activities across projects using name search, project, and status filters'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 font-mono">
            {isAr ? `إجمالي النتائج: ${total}` : `Total Matches: ${total}`}
          </div>
        </div>
      </div>

      {/* ==================== SEARCH & FILTER PANEL ==================== */}
      <form
        onSubmit={handleSubmitSearch}
        className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          {/* Search Input + Submit */}
          <div className="lg:col-span-6 flex items-center gap-2">
            <div className="relative flex-1">
              <Search
                className={`w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 ${
                  isAr ? 'right-3' : 'left-3'
                }`}
              />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchInput(val);
                  if (val.trim() === '' && appliedSearch !== '') {
                    setAppliedSearch('');
                    setPage(1);
                  }
                }}
                placeholder={isAr ? 'أدخل اسم النشاط للبحث...' : 'Enter activity name to search...'}
                aria-label={isAr ? 'البحث باسم النشاط' : 'Search activities by name'}
                className={`w-full text-xs sm:text-sm border border-slate-200 rounded-lg py-2 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-slate-50/50 transition-colors ${
                  isAr ? 'pr-9 pl-8' : 'pl-9 pr-8'
                }`}
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={handleClearSearchOnly}
                  className={`absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer ${
                    isAr ? 'left-2.5' : 'right-2.5'
                  }`}
                  aria-label={isAr ? 'مسح حقل البحث' : 'Clear search input'}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5" />
              <span>{isAr ? 'بحث' : 'Search'}</span>
            </button>
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
              className="w-full text-xs sm:text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 cursor-pointer"
            >
              <option value="All">{isAr ? 'جميع المشاريع' : 'All Projects'}</option>
              {filterOptions.projects.map((pr) => (
                <option key={pr.id} value={String(pr.id)}>
                  {pickLocalized(lang, pr.name, pr.nameAr)}
                </option>
              ))}
            </select>
          </div>

          {/* Filter by Status */}
          <div className="lg:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              aria-label={isAr ? 'تصفية حسب الحالة' : 'Filter by status'}
              className="w-full text-xs sm:text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 cursor-pointer"
            >
              <option value="All">{isAr ? 'جميع الحالات' : 'All Statuses'}</option>
              {statusChoices.map((st) => (
                <option key={st} value={st}>
                  {translateStatus(st, lang)}
                </option>
              ))}
            </select>
          </div>

          {/* Clear All Filters */}
          <div className="lg:col-span-1 flex justify-end">
            <button
              type="button"
              onClick={handleClearAll}
              disabled={!hasActiveCriteria}
              className="w-full lg:w-auto px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors flex items-center justify-center gap-1.5"
              title={isAr ? 'مسح البحث وعوامل التصفية' : 'Clear search and filters'}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="lg:hidden">{isAr ? 'مسح الكل' : 'Clear All'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* ==================== ERROR BANNER ==================== */}
      {fetchError && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 text-rose-800">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />
            <div>
              <p className="text-xs sm:text-sm font-semibold">{fetchError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchSearchResults}
            className="px-3 py-1.5 bg-white hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg border border-rose-300 cursor-pointer transition-colors shrink-0 self-start sm:self-center"
          >
            {isAr ? 'إعادة المحاولة' : 'Retry'}
          </button>
        </div>
      )}

      {/* ==================== SEARCH RESULTS TABLE ==================== */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
            <p className="text-sm text-slate-500">
              {isAr ? 'جارٍ البحث في الأنشطة...' : 'Searching activities across projects...'}
            </p>
          </div>
        ) : fetchError && items.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">{fetchError}</h3>
            <button
              type="button"
              onClick={fetchSearchResults}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              {isAr ? 'إعادة التحميل' : 'Retry'}
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Search className="w-8 h-8 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">
              {isAr ? 'لا توجد أنشطة مطابقة لنتائج البحث' : 'No matching activities found'}
            </h3>
            <p className="text-xs text-slate-500">
              {hasActiveCriteria
                ? isAr
                  ? 'لم يتم العثور على أنشطة تطابق معايير البحث والتصفية الحالية.'
                  : 'No activities matched the current search term and selected filters.'
                : isAr
                ? 'لا توجد أنشطة مسجلة في النظام حالياً.'
                : 'No activities are currently registered in the system.'}
            </p>
            {hasActiveCriteria && (
              <button
                type="button"
                onClick={handleClearAll}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isAr ? 'مسح البحث وعوامل التصفية' : 'Clear Search & Filters'}</span>
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-start border-collapse">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-slate-200/80 text-xs font-semibold text-slate-600">
                    <th className="py-3.5 px-4 w-14 text-start">{isAr ? 'المعرف' : 'ID'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'اسم النشاط' : 'Activity'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'المشروع المرتبط' : 'Associated Project'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'المكلف' : 'Assigned User'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'تاريخ الاستحقاق' : 'Due Date'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                    <th className="py-3.5 px-4 text-end">{isAr ? 'التفاصيل' : 'Details'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 text-sm">
                  {items.map((act) => (
                    <tr
                      key={act.id}
                      onClick={() => handleOpenDetails(act)}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-500 tabular-nums">
                        #{act.id}
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {pickLocalized(lang, act.name, act.nameAr)}
                        </div>
                        {act.parentActivityName && (
                          <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                            {isAr
                              ? `مهمة فرعية من: ${pickLocalized(lang, act.parentActivityName, act.parentActivityNameAr)}`
                              : `Subtask of: ${pickLocalized(lang, act.parentActivityName, act.parentActivityNameAr)}`}
                          </div>
                        )}
                      </td>

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

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-slate-800 tabular-nums">
                            {act.dueDate}
                          </span>
                          {act.isOverdue && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              <span>{isAr ? 'متأخر' : 'Overdue'}</span>
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">{renderStatusBadge(act.status)}</td>

                      <td className="py-3.5 px-4 text-end" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleOpenDetails(act)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                          title={isAr ? 'عرض تفاصيل النشاط' : 'View activity details'}
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
                    ? `عرض ${rangeStart}–${rangeEnd} من أصل ${total} نشاط`
                    : `Showing ${rangeStart}–${rangeEnd} of ${total} activities`}
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

      {/* ==================== ACTIVITY DETAILS DRAWER (Feature 4) ==================== */}
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
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
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
                  <Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto" />
                  <p className="text-xs text-slate-500">
                    {isAr ? 'جارٍ تحميل تفاصيل النشاط...' : 'Loading activity details...'}
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
                  {selectedActivity.isOverdue && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-xs text-rose-800 font-semibold">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>
                        {isAr
                          ? `هذا النشاط متأخر عن تاريخ الاستحقاق (${selectedActivity.dueDate}).`
                          : `This activity has passed its planned due date (${selectedActivity.dueDate}).`}
                      </span>
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
                        <span>{isAr ? 'تاريخ الاستحقاق' : 'Due Date'}</span>
                      </span>
                      <div className="text-xs font-bold font-mono text-slate-900">
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

                  {/* Additional Context */}
                  {(selectedActivity.milestoneName ||
                    selectedActivity.parentActivityName ||
                    selectedActivity.progressPercentage !== null ||
                    (selectedActivity.subtaskCount !== undefined && selectedActivity.subtaskCount > 0)) && (
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
                            {isAr ? 'نسبة الإنجاز' : 'Completion Progress'}
                          </span>
                          <span className="font-mono font-bold text-slate-900">
                            {selectedActivity.progressPercentage}%
                          </span>
                        </div>
                      )}
                      {selectedActivity.subtaskCount !== undefined && selectedActivity.subtaskCount > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">
                            {isAr ? 'المهام الفرعية المرتبطة' : 'Subtasks Count'}
                          </span>
                          <span className="font-mono font-semibold text-slate-800">
                            {selectedActivity.subtaskCount}
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
                {isAr ? 'نكسورا لإدارة المشاريع - البحث عن الأنشطة' : 'NEXORA PMO - Activity Search'}
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
