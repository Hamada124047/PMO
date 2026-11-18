import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from './apiClient';
import {
  LayoutDashboard,
  RefreshCw,
  Briefcase,
  Compass,
  FolderKanban,
  CheckSquare,
  AlertTriangle,
  TrendingUp,
  Search,
  Calendar,
  ArrowRight,
  ChevronRight,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { Language, pickLocalized, translatePriority, translateStatus } from './i18n';

interface DashboardInitiativeItem {
  id: number;
  name: string;
  nameAr?: string;
  status: string;
  priority: string;
  portfolioName: string | null;
  portfolioNameAr?: string | null;
  departmentName: string | null;
  departmentNameAr?: string | null;
  ownerName: string | null;
  ownerNameAr?: string | null;
  projectCount: number;
  progressPercentage: number | null;
  hasProgressData: boolean;
}

interface DashboardProjectItem {
  id: number;
  name: string;
  nameAr?: string;
  status: string;
  priority: string;
  initiativeId: number;
  initiativeName: string | null;
  initiativeNameAr?: string | null;
  projectManagerName: string | null;
  projectManagerNameAr?: string | null;
  activityCount: number;
  endDate: string;
  progressPercentage: number | null;
  hasProgressData: boolean;
}

interface DashboardOverdueItem {
  id: number;
  name: string;
  nameAr?: string;
  projectId: number;
  projectName: string | null;
  projectNameAr?: string | null;
  assignedUserName: string | null;
  assignedUserNameAr?: string | null;
  dueDate: string;
  status: string;
  priority: string | null;
  daysOverdue: number;
}

export interface PmoDashboardData {
  evaluatedDate: string;
  summary: {
    departments: { total: number };
    portfolios: {
      total: number;
      active: number;
      planning: number;
      onHold: number;
      completed: number;
    };
    initiatives: {
      total: number;
      inProgress: number;
      completed: number;
      onHold: number;
      draftOrNotStarted: number;
      withProgressData: number;
      averageProgress: number | null;
    };
    projects: {
      total: number;
      inProgress: number;
      completed: number;
      planned: number;
      onHold: number;
      withProgressData: number;
      averageProgress: number | null;
    };
    activities: {
      total: number;
      completed: number;
      inProgress: number;
      notStarted: number;
      overdue: number;
    };
  };
  progressOverview: {
    overallPmoProgress: number | null;
    averageInitiativeProgress: number | null;
    averageProjectProgress: number | null;
    initiatives: DashboardInitiativeItem[];
    projects: DashboardProjectItem[];
  };
  overdueSummary: {
    totalOverdue: number;
    criticalCount: number;
    highCount: number;
    topOverdue: DashboardOverdueItem[];
  };
}

export type DashboardTargetSection =
  | 'portfolios'
  | 'initiatives'
  | 'projects'
  | 'activities'
  | 'pmo-management'
  | 'progress-tracking'
  | 'overdue-activities'
  | 'activity-search'
  | 'departments';

export interface PmoDashboardViewProps {
  lang: Language;
  showBanner: (type: 'success' | 'error', text: string) => void;
  onNavigateSection: (section: DashboardTargetSection) => void;
  onNavigateToProjectWorkspace?: (projectId: number) => void;
}

export const PmoDashboardView: React.FC<PmoDashboardViewProps> = ({
  lang,
  showBanner,
  onNavigateSection,
  onNavigateToProjectWorkspace
}) => {
  const isAr = lang === 'ar';

  const [data, setData] = useState<PmoDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchDashboard = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setFetchError(null);

      try {
        const res = await apiFetch('/api/pmo-dashboard');
        if (!res.ok) {
          const errBody = await res.json().catch(() => null);
          throw new Error(errBody?.message || 'Failed to load PMO dashboard.');
        }

        const payload: PmoDashboardData = await res.json();
        setData(payload);

        if (isManualRefresh) {
          showBanner(
            'success',
            isAr
              ? 'تم تحديث بيانات لوحة تحكم مكتب المشاريع بنجاح.'
              : 'PMO Dashboard refreshed with the latest records.'
          );
        }
      } catch (err: any) {
        console.error('Error loading PMO dashboard:', err);
        const msg = isAr
          ? 'تعذر تحميل بيانات لوحة تحكم مكتب المشاريع. يرجى إعادة المحاولة.'
          : 'Failed to load PMO dashboard summary. Please retry.';
        setFetchError(msg);
        if (isManualRefresh) {
          showBanner('error', msg);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isAr, showBanner]
  );

  useEffect(() => {
    fetchDashboard(false);
  }, [fetchDashboard]);

  const hasValidProgress = (pct: number | null | undefined, hasData?: boolean): pct is number => {
    return typeof pct === 'number' && !Number.isNaN(pct) && hasData !== false;
  };

  const getProgressColor = (pct: number | null | undefined, hasData?: boolean) => {
    if (!hasValidProgress(pct, hasData)) return 'bg-slate-300';
    if (pct === 100) return 'bg-emerald-500';
    if (pct >= 70) return 'bg-blue-600';
    if (pct >= 40) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const formatDaysOverdue = (days: number) => {
    if (isAr) {
      if (days === 1) return 'يوم واحد';
      if (days === 2) return 'يومان';
      if (days >= 3 && days <= 10) return `${days} أيام`;
      return `${days} يوماً`;
    }
    return days === 1 ? '1 day' : `${days} days`;
  };

  return (
    <div className={`space-y-6 ${isAr ? 'text-right' : 'text-left'}`} dir={isAr ? 'rtl' : 'ltr'}>
      {/* ==================== HEADER ==================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/90 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-500/20 shrink-0">
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
              {isAr ? 'لوحة تحكم مكتب المشاريع' : 'PMO Dashboard'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              {isAr
                ? 'مركز المتابعة التنفيذي للمحافظ والمبادرات والمشاريع ونسب الإنجاز والأنشطة المتأخرة'
                : 'Central overview of portfolios, initiatives, projects, calculated progress, and overdue work'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {data?.evaluatedDate && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-600 font-mono">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>{data.evaluatedDate}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => fetchDashboard(true)}
            disabled={refreshing || loading}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            title={isAr ? 'تحديث لوحة التحكم' : 'Refresh dashboard'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span>{isAr ? 'تحديث البيانات' : 'Refresh'}</span>
          </button>
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
                  ? 'تعذر استرجاع ملخص مكتب إدارة المشاريع من الخادم.'
                  : 'Unable to retrieve the latest PMO dashboard summary from the backend.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => fetchDashboard(false)}
            className="px-3 py-1.5 bg-white hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg border border-rose-300 cursor-pointer transition-colors shrink-0 self-start sm:self-center"
          >
            {isAr ? 'إعادة المحاولة' : 'Retry'}
          </button>
        </div>
      )}

      {/* ==================== LOADING STATE ==================== */}
      {loading && !data ? (
        <div className="bg-white border border-slate-200 rounded-xl p-14 text-center space-y-3 shadow-xs">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
          <p className="text-sm text-slate-500">
            {isAr ? 'جارٍ تحميل بيانات لوحة تحكم مكتب المشاريع...' : 'Loading PMO dashboard overview...'}
          </p>
        </div>
      ) : data ? (
        <>
          {/* ==================== FEATURE 1: PMO SUMMARY CARDS ==================== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Portfolios */}
            <button
              type="button"
              onClick={() => onNavigateSection('portfolios')}
              className="bg-white border border-slate-200 hover:border-blue-400 rounded-xl p-5 shadow-xs transition-all text-start cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  {isAr ? 'المحافظ الاستراتيجية' : 'Portfolios'}
                </span>
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <Briefcase className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-3xl font-bold font-mono text-slate-900 tabular-nums">
                  {data.summary.portfolios.total}
                </span>
                <span className="text-xs font-semibold text-blue-600 flex items-center gap-1">
                  <span>{isAr ? 'عرض' : 'View'}</span>
                  <ChevronRight className={`w-3.5 h-3.5 ${isAr ? 'rotate-180' : ''}`} />
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {isAr
                  ? `${data.summary.portfolios.active} نشطة · ${data.summary.portfolios.planning} قيد التخطيط`
                  : `${data.summary.portfolios.active} active · ${data.summary.portfolios.planning} planning`}
              </p>
            </button>

            {/* Initiatives */}
            <button
              type="button"
              onClick={() => onNavigateSection('initiatives')}
              className="bg-white border border-slate-200 hover:border-blue-400 rounded-xl p-5 shadow-xs transition-all text-start cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  {isAr ? 'المبادرات' : 'Initiatives'}
                </span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Compass className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-3xl font-bold font-mono text-slate-900 tabular-nums">
                  {data.summary.initiatives.total}
                </span>
                <span className="text-xs font-semibold text-blue-600 flex items-center gap-1">
                  <span>{isAr ? 'عرض' : 'View'}</span>
                  <ChevronRight className={`w-3.5 h-3.5 ${isAr ? 'rotate-180' : ''}`} />
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {isAr
                  ? `${data.summary.initiatives.inProgress} قيد التنفيذ · ${data.summary.initiatives.completed} مكتملة`
                  : `${data.summary.initiatives.inProgress} in progress · ${data.summary.initiatives.completed} completed`}
              </p>
            </button>

            {/* Projects */}
            <button
              type="button"
              onClick={() => onNavigateSection('projects')}
              className="bg-white border border-slate-200 hover:border-blue-400 rounded-xl p-5 shadow-xs transition-all text-start cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  {isAr ? 'المشاريع' : 'Projects'}
                </span>
                <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center group-hover:bg-sky-600 group-hover:text-white transition-colors">
                  <FolderKanban className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-3xl font-bold font-mono text-slate-900 tabular-nums">
                  {data.summary.projects.total}
                </span>
                <span className="text-xs font-semibold text-blue-600 flex items-center gap-1">
                  <span>{isAr ? 'عرض' : 'View'}</span>
                  <ChevronRight className={`w-3.5 h-3.5 ${isAr ? 'rotate-180' : ''}`} />
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {isAr
                  ? `${data.summary.projects.inProgress} قيد التنفيذ · ${data.summary.projects.completed} مكتمل`
                  : `${data.summary.projects.inProgress} in progress · ${data.summary.projects.completed} completed`}
              </p>
            </button>

            {/* Activities */}
            <button
              type="button"
              onClick={() => onNavigateSection('activity-search')}
              className="bg-white border border-slate-200 hover:border-blue-400 rounded-xl p-5 shadow-xs transition-all text-start cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  {isAr ? 'الأنشطة' : 'Activities'}
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <CheckSquare className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-3xl font-bold font-mono text-slate-900 tabular-nums">
                  {data.summary.activities.total}
                </span>
                <span className="text-xs font-semibold text-blue-600 flex items-center gap-1">
                  <span>{isAr ? 'بحث' : 'Search'}</span>
                  <ChevronRight className={`w-3.5 h-3.5 ${isAr ? 'rotate-180' : ''}`} />
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {isAr
                  ? `${data.summary.activities.completed} مكتملة · ${data.summary.activities.inProgress} جارية`
                  : `${data.summary.activities.completed} completed · ${data.summary.activities.inProgress} active`}
              </p>
            </button>
          </div>

          {/* ==================== FEATURE 3 & FEATURE 4: OVERDUE ATTENTION + QUICK ACCESS ==================== */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Overdue Activity Summary (Story 7.5) */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      data.overdueSummary.totalOverdue > 0
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {data.overdueSummary.totalOverdue > 0 ? (
                      <AlertTriangle className="w-5 h-5" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900">
                        {isAr ? 'ملخص الأنشطة المتأخرة' : 'Overdue Activity Attention'}
                      </h2>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-bold font-mono ${
                          data.overdueSummary.totalOverdue > 0
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {data.overdueSummary.totalOverdue}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {data.overdueSummary.totalOverdue > 0
                        ? isAr
                          ? `يوجد ${data.overdueSummary.totalOverdue} نشاط تجاوز تاريخ الاستحقاق ويتطلب متابعة فورية`
                          : `${data.overdueSummary.totalOverdue} incomplete activities require immediate PMO follow-up`
                        : isAr
                        ? 'لا توجد أنشطة متأخرة حالياً — جميع المهام تسير وفق الجدول'
                        : '0 overdue activities — all scheduled work is currently on track'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigateSection('overdue-activities')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 shrink-0 ${
                    data.overdueSummary.totalOverdue > 0
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <span>{isAr ? 'مراجعة الأنشطة المتأخرة' : 'View Overdue Activities'}</span>
                  <ArrowRight className={`w-3.5 h-3.5 ${isAr ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {data.overdueSummary.totalOverdue > 0 ? (
                <div className="space-y-2">
                  {data.overdueSummary.topOverdue.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => onNavigateSection('overdue-activities')}
                      className="p-3 rounded-lg border border-slate-200 hover:border-rose-300 hover:bg-rose-50/30 transition-all flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 truncate">
                          {pickLocalized(lang, item.name, item.nameAr)}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          {pickLocalized(lang, item.projectName, item.projectNameAr, '—')} ·{' '}
                          {pickLocalized(
                            lang,
                            item.assignedUserName,
                            item.assignedUserNameAr,
                            isAr ? 'غير مكلف' : 'Unassigned'
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.priority && (
                          <span className="hidden sm:inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {translatePriority(item.priority, lang)}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold font-mono bg-rose-100 text-rose-800 border border-rose-200">
                          {formatDaysOverdue(item.daysOverdue)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 rounded-lg bg-emerald-50/60 border border-emerald-200/80 text-center text-xs text-emerald-800 font-medium">
                  {isAr
                    ? 'جميع الأنشطة مكتملة أو ضمن مواعيدها المحددة.'
                    : 'No overdue activities require escalation right now.'}
                </div>
              )}
            </div>

            {/* Quick Access Panel (Story 7.7) */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-base font-bold text-slate-900">
                  {isAr ? 'الوصول السريع للوحدات' : 'Quick Access'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isAr
                    ? 'انتقل مباشرة إلى السجلات والوحدات الأساسية في مكتب المشاريع'
                    : 'Jump directly to key PMO modules and operational records'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => onNavigateSection('portfolios')}
                  className="p-3 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 transition-all flex items-center justify-between text-start cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Briefcase className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="text-xs font-semibold text-slate-800">
                      {isAr ? 'إدارة المحافظ' : 'Portfolios'}
                    </span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 text-slate-400 ${isAr ? 'rotate-180' : ''}`} />
                </button>

                <button
                  type="button"
                  onClick={() => onNavigateSection('initiatives')}
                  className="p-3 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition-all flex items-center justify-between text-start cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Compass className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="text-xs font-semibold text-slate-800">
                      {isAr ? 'إدارة المبادرات' : 'Initiatives'}
                    </span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 text-slate-400 ${isAr ? 'rotate-180' : ''}`} />
                </button>

                <button
                  type="button"
                  onClick={() => onNavigateSection('projects')}
                  className="p-3 rounded-lg border border-slate-200 hover:border-sky-400 hover:bg-sky-50/40 transition-all flex items-center justify-between text-start cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <FolderKanban className="w-4 h-4 text-sky-600 shrink-0" />
                    <span className="text-xs font-semibold text-slate-800">
                      {isAr ? 'إدارة المشاريع' : 'Projects'}
                    </span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 text-slate-400 ${isAr ? 'rotate-180' : ''}`} />
                </button>

                <button
                  type="button"
                  onClick={() => onNavigateSection('overdue-activities')}
                  className="p-3 rounded-lg border border-slate-200 hover:border-rose-400 hover:bg-rose-50/40 transition-all flex items-center justify-between text-start cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span className="text-xs font-semibold text-slate-800">
                      {isAr ? 'الأنشطة المتأخرة' : 'Overdue Activities'}
                    </span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 text-slate-400 ${isAr ? 'rotate-180' : ''}`} />
                </button>

                <button
                  type="button"
                  onClick={() => onNavigateSection('progress-tracking')}
                  className="p-3 rounded-lg border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/40 transition-all flex items-center justify-between text-start cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-xs font-semibold text-slate-800">
                      {isAr ? 'تتبع الإنجاز' : 'Progress Tracking'}
                    </span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 text-slate-400 ${isAr ? 'rotate-180' : ''}`} />
                </button>

                <button
                  type="button"
                  onClick={() => onNavigateSection('activities')}
                  className="p-3 rounded-lg border border-slate-200 hover:border-teal-400 hover:bg-teal-50/40 transition-all flex items-center justify-between text-start cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <CheckSquare className="w-4 h-4 text-teal-600 shrink-0" />
                    <span className="text-xs font-semibold text-slate-800">
                      {isAr ? 'إدارة الأنشطة' : 'Activity Management'}
                    </span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 text-slate-400 ${isAr ? 'rotate-180' : ''}`} />
                </button>

                <button
                  type="button"
                  onClick={() => onNavigateSection('activity-search')}
                  className="p-3 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition-all flex items-center justify-between text-start cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Search className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="text-xs font-semibold text-slate-800">
                      {isAr ? 'البحث عن الأنشطة' : 'Activity Search'}
                    </span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 text-slate-400 ${isAr ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {/* ==================== FEATURE 2: PROGRESS OVERVIEW ==================== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Initiatives Progress Overview */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {isAr ? 'تقدم المبادرات' : 'Initiatives Progress Overview'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {data.progressOverview.averageInitiativeProgress !== null
                      ? isAr
                        ? `متوسط الإنجاز المحتسب: ${data.progressOverview.averageInitiativeProgress}%`
                        : `Calculated average: ${data.progressOverview.averageInitiativeProgress}%`
                      : isAr
                      ? 'لا تتوفر بيانات إنجاز محتسبة بعد'
                      : 'No calculated progress data available yet'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateSection('progress-tracking')}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                >
                  <span>{isAr ? 'التفاصيل' : 'View All'}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>

              {data.progressOverview.initiatives.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  {isAr ? 'لا توجد مبادرات مسجلة.' : 'No initiatives registered.'}
                </div>
              ) : (
                <div className="space-y-3">
                  {data.progressOverview.initiatives.map((init) => (
                    <div
                      key={init.id}
                      onClick={() => onNavigateSection('initiatives')}
                      className="p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/20 transition-all cursor-pointer space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-900 truncate">
                            {pickLocalized(lang, init.name, init.nameAr)}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {pickLocalized(lang, init.portfolioName, init.portfolioNameAr, '—')} ·{' '}
                            {translateStatus(init.status, lang)}
                          </div>
                        </div>
                        {hasValidProgress(init.progressPercentage, init.hasProgressData) ? (
                          <span className="font-mono text-xs font-bold text-slate-800 shrink-0">
                            {init.progressPercentage}%
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200 shrink-0">
                            {isAr ? 'لا تتوفر بيانات' : 'No data'}
                          </span>
                        )}
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${getProgressColor(
                            init.progressPercentage,
                            init.hasProgressData
                          )}`}
                          style={{
                            width: `${
                              hasValidProgress(init.progressPercentage, init.hasProgressData)
                                ? init.progressPercentage
                                : 0
                            }%`
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Projects Progress Overview */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {isAr ? 'تقدم المشاريع' : 'Projects Progress Overview'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {data.progressOverview.averageProjectProgress !== null
                      ? isAr
                        ? `متوسط الإنجاز المحتسب: ${data.progressOverview.averageProjectProgress}%`
                        : `Calculated average: ${data.progressOverview.averageProjectProgress}%`
                      : isAr
                      ? 'لا تتوفر بيانات إنجاز محتسبة بعد'
                      : 'No calculated progress data available yet'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateSection('progress-tracking')}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                >
                  <span>{isAr ? 'التفاصيل' : 'View All'}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>

              {data.progressOverview.projects.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  {isAr ? 'لا توجد مشاريع مسجلة.' : 'No projects registered.'}
                </div>
              ) : (
                <div className="space-y-3">
                  {data.progressOverview.projects.map((proj) => (
                    <div
                      key={proj.id}
                      onClick={() => {
                        if (onNavigateToProjectWorkspace) {
                          onNavigateToProjectWorkspace(proj.id);
                        } else {
                          onNavigateSection('pmo-management');
                        }
                      }}
                      className="p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/20 transition-all cursor-pointer space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-900 truncate">
                            {pickLocalized(lang, proj.name, proj.nameAr)}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {pickLocalized(lang, proj.initiativeName, proj.initiativeNameAr, '—')} ·{' '}
                            {translateStatus(proj.status, lang)}
                          </div>
                        </div>
                        {hasValidProgress(proj.progressPercentage, proj.hasProgressData) ? (
                          <span className="font-mono text-xs font-bold text-slate-800 shrink-0">
                            {proj.progressPercentage}%
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200 shrink-0">
                            {isAr ? 'لا تتوفر بيانات' : 'No data'}
                          </span>
                        )}
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${getProgressColor(
                            proj.progressPercentage,
                            proj.hasProgressData
                          )}`}
                          style={{
                            width: `${
                              hasValidProgress(proj.progressPercentage, proj.hasProgressData)
                                ? proj.progressPercentage
                                : 0
                            }%`
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
