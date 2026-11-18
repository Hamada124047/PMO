import React, { useState, useEffect } from 'react';
import { apiFetch } from './apiClient';
import {
  CheckSquare,
  Plus,
  Edit2,
  Trash2,
  ChevronRight,
  ChevronDown,
  Diamond,
  GitBranch,
  Calendar as CalendarIcon,
  BarChart3,
  Columns,
  Layers,
  Filter,
  ArrowUpDown,
  CheckCircle2,
  AlertTriangle,
  Clock
} from 'lucide-react';
import {
  Project,
  Workstream,
  Milestone,
  Activity,
  TaskDependency,
  UserRecord
} from './App';
import { Language, pickLocalized, translations, translateStatus, translatePriority } from './i18n';

interface ProjectWorkspaceProps {
  lang: Language;
  projects: Project[];
  workstreams: Workstream[];
  milestones: Milestone[];
  activities: Activity[];
  dependencies: TaskDependency[];
  users: UserRecord[];
  selectedProjectId: number;
  onSelectProject: (id: number) => void;
  initialTab?: WorkspaceTab;
  canManage: boolean;
  canUpdateTask: boolean;
  onRefresh: () => void;
  onEditWorkstream: (ws?: Workstream, defaultProjectId?: number) => void;
  onDeleteWorkstream: (id: number, name: string) => void;
  onEditMilestone: (ms?: Milestone, defaultProjectId?: number) => void;
  onDeleteMilestone: (id: number, name: string) => void;
  onEditActivity: (act?: Activity, defaultProjectId?: number, parentActivityId?: number | null) => void;
  onDeleteActivity: (id: number, name: string) => void;
  showBanner: (type: 'success' | 'error', text: string) => void;
}

export type WorkspaceTab =
  | 'overview'
  | 'workstreams'
  | 'milestones'
  | 'activities'
  | 'gantt'
  | 'calendar'
  | 'board';

const getInitials = (name?: string | null): string => {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

export const ProjectWorkspaceView: React.FC<ProjectWorkspaceProps> = ({
  lang,
  projects,
  workstreams,
  milestones,
  activities,
  dependencies,
  users,
  selectedProjectId,
  onSelectProject,
  initialTab = 'overview',
  canManage,
  canUpdateTask,
  onRefresh,
  onEditWorkstream,
  onDeleteWorkstream,
  onEditMilestone,
  onDeleteMilestone,
  onEditActivity,
  onDeleteActivity,
  showBanner
}) => {
  const t = translations[lang];
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialTab);
  const [expandedParents, setExpandedParents] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    4: true,
    6: true
  });

  // Filters & sorting for Activities / Gantt / Calendar
  const [wsFilter, setWsFilter] = useState<string>('All');
  const [msFilter, setMsFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');
  const [userFilter, setUserFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'status' | 'progress'>('dueDate');

  // Dependency creation state
  const [predTaskId, setPredTaskId] = useState<number>(0);
  const [succTaskId, setSuccTaskId] = useState<number>(0);

  // Calendar Month State (Default October 2026 to match active project execution)
  const [calYear, setCalYear] = useState<number>(2026);
  const [calMonth, setCalMonth] = useState<number>(9); // 0=Jan, 9=Oct

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  const activeProject = projects.find((p) => p.id === selectedProjectId) || projects[0];
  if (!activeProject) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-500">
        {t.noRecordsFound}
      </div>
    );
  }

  const projectWorkstreams = workstreams.filter((w) => w.projectId === activeProject.id);
  const projectMilestones = milestones.filter((m) => m.projectId === activeProject.id);
  const allProjectActivities = activities.filter((a) => a.projectId === activeProject.id);
  const parentActivities = allProjectActivities.filter((a) => !a.parentActivityId);
  const subtasksByParent = (parentId: number) =>
    allProjectActivities.filter((a) => a.parentActivityId === parentId);

  const projectTaskIds = new Set(allProjectActivities.map((a) => a.id));
  const projectDependencies = dependencies.filter(
    (d) => projectTaskIds.has(d.predecessorTaskId) || projectTaskIds.has(d.successorTaskId)
  );

  const filteredParents = parentActivities
    .filter((a) => {
      if (wsFilter !== 'All' && String(a.workstreamId) !== wsFilter) return false;
      if (msFilter !== 'All' && String(a.milestoneId) !== msFilter) return false;
      if (statusFilter !== 'All' && a.status !== statusFilter) return false;
      if (priorityFilter !== 'All' && a.priority !== priorityFilter) return false;
      if (userFilter !== 'All' && String(a.assignedUserId) !== userFilter) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'dueDate') return a.dueDate.localeCompare(b.dueDate);
      if (sortBy === 'progress') return b.progressPercentage - a.progressPercentage;
      if (sortBy === 'status') return a.status.localeCompare(b.status);
      const pWeight: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
      return (pWeight[b.priority] || 0) - (pWeight[a.priority] || 0);
    });

  const toggleExpand = (id: number) => {
    setExpandedParents((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleToggleSubtask = async (sub: Activity) => {
    if (!canUpdateTask) return;
    const nextStatus = sub.status === 'Completed' ? 'In Progress' : 'Completed';
    const nextProgress = nextStatus === 'Completed' ? 100 : 50;
    const subLabel = pickLocalized(lang, sub.name, sub.nameAr);
    try {
      const res = await apiFetch(`/api/activities/${sub.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...sub,
          status: nextStatus,
          progressPercentage: nextProgress
        })
      });
      if (!res.ok) {
        throw new Error(lang === 'ar' ? 'تعذر تحديث المهمة الفرعية.' : 'Failed to update subtask.');
      }
      showBanner(
        'success',
        lang === 'ar'
          ? `تم تحديث المهمة الفرعية "${subLabel}" وإعادة احتساب نسبة الإنجاز تلقائياً.`
          : `Subtask "${subLabel}" marked ${nextStatus}. Parent, workstream & project progress recalculated.`
      );
      onRefresh();
    } catch (e: any) {
      showBanner('error', e.message || (lang === 'ar' ? 'خطأ أثناء تحديث المهمة الفرعية.' : 'Error updating subtask.'));
    }
  };

  const handleMoveKanban = async (
    act: Activity,
    newStatus: 'Not Started' | 'In Progress' | 'Completed'
  ) => {
    if (!canUpdateTask) return;
    const nextProgress =
      newStatus === 'Completed'
        ? 100
        : newStatus === 'Not Started'
        ? 0
        : Math.max(25, act.progressPercentage);
    const actLabel = pickLocalized(lang, act.name, act.nameAr);
    try {
      const res = await apiFetch(`/api/activities/${act.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...act,
          status: newStatus,
          progressPercentage: nextProgress
        })
      });
      if (!res.ok) {
        throw new Error(lang === 'ar' ? 'تعذر نقل النشاط.' : 'Failed to move task.');
      }
      showBanner(
        'success',
        lang === 'ar'
          ? `تم نقل النشاط "${actLabel}" إلى ${translateStatus(newStatus, 'ar')}.`
          : `Task "${actLabel}" moved to ${newStatus}. Progress updated.`
      );
      onRefresh();
    } catch (e: any) {
      showBanner('error', e.message || (lang === 'ar' ? 'خطأ أثناء نقل النشاط.' : 'Error moving task.'));
    }
  };

  const handleCreateDependency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!predTaskId || !succTaskId) {
      showBanner(
        'error',
        lang === 'ar'
          ? 'يرجى اختيار المهمة السابقة والمهمة اللاحقة.'
          : 'Select both a Predecessor task and a Successor task.'
      );
      return;
    }
    try {
      const res = await apiFetch('/api/dependencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          predecessorTaskId: predTaskId,
          successorTaskId: succTaskId,
          dependencyType: 'FinishToStart'
        })
      });
      const data = await res.json();
      if (!res.ok) {
        showBanner(
          'error',
          lang === 'ar'
            ? 'تعذر ربط الاعتمادية. تأكد من عدم وجود تكرار أو اعتمادية دائرية.'
            : data.message || 'Could not create dependency.'
        );
        return;
      }
      setPredTaskId(0);
      setSuccTaskId(0);
      const predLabel = pickLocalized(lang, data.predecessorTaskName, data.predecessorTaskNameAr);
      const succLabel = pickLocalized(lang, data.successorTaskName, data.successorTaskNameAr);
      showBanner(
        'success',
        lang === 'ar'
          ? `تم ربط الاعتمادية: "${predLabel}" ← "${succLabel}"`
          : `Dependency created: "${predLabel}" → "${succLabel}"`
      );
      onRefresh();
    } catch (err: any) {
      showBanner('error', err.message || (lang === 'ar' ? 'حدث خطأ أثناء إنشاء الاعتمادية.' : 'Error creating dependency.'));
    }
  };

  const handleDeleteDependency = async (id: number) => {
    try {
      const res = await apiFetch(`/api/dependencies/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error(lang === 'ar' ? 'تعذر إزالة الاعتمادية.' : 'Failed to remove dependency.');
      }
      showBanner('success', lang === 'ar' ? 'تمت إزالة الاعتمادية.' : 'Task dependency removed.');
      onRefresh();
    } catch (err: any) {
      showBanner('error', err.message || (lang === 'ar' ? 'حدث خطأ أثناء إزالة الاعتمادية.' : 'Error removing dependency.'));
    }
  };

  // Gantt bar calculation
  const pStartMs = new Date(activeProject.startDate).getTime();
  const pEndMs = new Date(activeProject.endDate).getTime();
  const totalSpanMs = Math.max(86400000, pEndMs - pStartMs);

  const calcBarStyle = (startStr: string, endStr: string) => {
    const s = Math.max(pStartMs, Math.min(pEndMs, new Date(startStr).getTime()));
    const e = Math.max(s, Math.min(pEndMs, new Date(endStr).getTime()));
    const leftPct = ((s - pStartMs) / totalSpanMs) * 100;
    const widthPct = Math.max(3, ((e - s) / totalSpanMs) * 100);
    return { left: `${leftPct.toFixed(1)}%`, width: `${widthPct.toFixed(1)}%` };
  };

  const calcDiamondLeft = (dateStr: string) => {
    const d = Math.max(pStartMs, Math.min(pEndMs, new Date(dateStr).getTime()));
    return `${(((d - pStartMs) / totalSpanMs) * 100).toFixed(1)}%`;
  };

  // Generate timeline month headers for Gantt
  const ganttMonths: string[] = [];
  {
    const cur = new Date(activeProject.startDate);
    cur.setDate(1);
    const endD = new Date(activeProject.endDate);
    while (cur <= endD && ganttMonths.length < 18) {
      ganttMonths.push(
        cur.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', {
          month: 'short',
          year: '2-digit'
        })
      );
      cur.setMonth(cur.getMonth() + 1);
    }
  }

  // Monthly Calendar generator
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDayWeekday = new Date(calYear, calMonth, 1).getDay();
  const monthLabel = new Date(calYear, calMonth, 1).toLocaleDateString(
    lang === 'ar' ? 'ar-SA' : 'en-US',
    {
      month: 'long',
      year: 'numeric'
    }
  );

  const changeMonth = (delta: number) => {
    let m = calMonth + delta;
    let y = calYear;
    if (m < 0) {
      m = 11;
      y--;
    } else if (m > 11) {
      m = 0;
      y++;
    }
    setCalMonth(m);
    setCalYear(y);
  };

  const overdueProjectTasks = allProjectActivities.filter((a) => a.isOverdue);

  const statusTextColor = (status: string, isDelayedOrOverdue?: boolean) => {
    if (isDelayedOrOverdue || status === 'Delayed') return 'text-rose-600 font-semibold';
    if (status === 'Completed' || status === 'Active') return 'text-emerald-700 font-semibold';
    if (status === 'In Progress') return 'text-blue-600 font-semibold';
    if (status === 'On Hold') return 'text-amber-700 font-semibold';
    return 'text-slate-600 font-medium';
  };

  const progressFillColor = (pct: number, isOverdue?: boolean) => {
    if (isOverdue) return 'bg-rose-600';
    if (pct >= 100) return 'bg-emerald-600';
    return 'bg-blue-600';
  };

  return (
    <div className="space-y-6">
      {/* Project Header Surface */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-200/80">
          <div>
            {/* Clean unboxed breadcrumb & metadata with typographic separators */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-2">
              <span className="font-medium text-slate-700">
                {pickLocalized(lang, activeProject.departmentName, activeProject.departmentNameAr, t.enterpriseWideOption)}
              </span>
              <span aria-hidden="true">·</span>
              <span>{pickLocalized(lang, activeProject.portfolioName, activeProject.portfolioNameAr)}</span>
              <span aria-hidden="true">·</span>
              <span>{pickLocalized(lang, activeProject.initiativeName, activeProject.initiativeNameAr)}</span>
              <span aria-hidden="true">·</span>
              <span className={statusTextColor(activeProject.status)}>
                {translateStatus(activeProject.status, lang)}
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-700 font-semibold">
                {translatePriority(activeProject.priority, lang)}
              </span>
            </div>
            <h2 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
              {pickLocalized(lang, activeProject.name, activeProject.nameAr)}
            </h2>
            <p className="text-sm text-slate-600 mt-1 max-w-3xl leading-relaxed">
              {pickLocalized(lang, activeProject.description, activeProject.descriptionAr)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                {t.switchActiveProject}
              </label>
              <select
                value={activeProject.id}
                onChange={(e) => onSelectProject(Number(e.target.value))}
                className="px-3.5 py-2 bg-[#F8FAFC] border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600 transition-colors cursor-pointer"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {pickLocalized(lang, p.name, p.nameAr)} ({p.progressPercentage}%)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Project KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 py-5 border-b border-slate-200/80">
          <div>
            <div className="text-xs text-slate-500">{t.projectManager}</div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 font-mono text-[10px] font-bold inline-flex items-center justify-center shrink-0">
                {getInitials(pickLocalized(lang, activeProject.projectManagerName, activeProject.projectManagerNameAr))}
              </span>
              <span className="text-sm font-semibold text-slate-900 truncate">
                {pickLocalized(lang, activeProject.projectManagerName, activeProject.projectManagerNameAr, t.unassignedOption)}
              </span>
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">{t.scheduleWindow}</div>
            <div className="text-xs font-mono tabular-nums font-semibold text-slate-900 mt-2">
              {activeProject.startDate} → {activeProject.endDate}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">{t.overallProgress}</div>
            <div className="flex items-center gap-2.5 mt-2">
              <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-opacity duration-150 ${progressFillColor(
                    activeProject.progressPercentage
                  )}`}
                  style={{ width: `${activeProject.progressPercentage}%` }}
                />
              </div>
              <span className="text-sm font-mono tabular-nums font-bold text-slate-900">
                {activeProject.progressPercentage}%
              </span>
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">{t.workstreams}</div>
            <div className="text-sm font-mono tabular-nums font-bold text-slate-900 mt-1.5">
              {projectWorkstreams.length} {t.tracksLabel}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">{t.milestones}</div>
            <div className="text-sm font-mono tabular-nums font-bold text-amber-700 mt-1.5">
              ◆ {projectMilestones.filter((m) => m.status === 'Completed').length} /{' '}
              {projectMilestones.length} {t.completedLabel}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">{t.activities}</div>
            <div className="text-sm font-mono tabular-nums font-bold text-slate-900 mt-1.5">
              {parentActivities.length} {t.tasksLabel}{' '}
              {overdueProjectTasks.length > 0 && (
                <span className="text-rose-600">
                  · {overdueProjectTasks.length} {t.overdueLabel}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 7 Unified Project Workspace Segmented Control Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 pt-4">
          {[
            { id: 'overview', label: t.tabOverview, icon: Layers },
            {
              id: 'workstreams',
              label: `${t.tabWorkstreams} (${projectWorkstreams.length})`,
              icon: GitBranch
            },
            {
              id: 'milestones',
              label: `${t.tabMilestones} (${projectMilestones.length})`,
              icon: Diamond
            },
            {
              id: 'activities',
              label: `${t.tabActivities} (${allProjectActivities.length})`,
              icon: CheckSquare
            },
            { id: 'gantt', label: t.tabGantt, icon: BarChart3 },
            { id: 'calendar', label: t.tabCalendar, icon: CalendarIcon },
            { id: 'board', label: t.tabBoard, icon: Columns }
          ].map((tabItem) => {
            const Icon = tabItem.icon;
            const active = activeTab === tabItem.id;
            return (
              <button
                key={tabItem.id}
                onClick={() => setActiveTab(tabItem.id as WorkspaceTab)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tabItem.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: OVERVIEW (Single-elevation dividers, no nested cards inside cards) */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200/80">
              <h3 className="font-display text-base font-bold text-slate-900">
                {t.workstreamExecSummary}
              </h3>
              {canManage && (
                <button
                  onClick={() => onEditWorkstream(undefined, activeProject.id)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 whitespace-nowrap cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> {t.addWorkstream}
                </button>
              )}
            </div>
            <div className="divide-y divide-slate-200/70">
              {projectWorkstreams.map((ws) => (
                <div key={ws.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-bold text-slate-900 text-sm">
                      {pickLocalized(lang, ws.name, ws.nameAr)}
                    </span>
                    <span className="font-mono tabular-nums font-bold text-slate-900">
                      {ws.progressPercentage}%
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mb-2.5">
                    <span className="font-medium text-slate-700">
                      {pickLocalized(lang, ws.ownerName, ws.ownerNameAr, t.unassignedOption)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {ws.startDate} → {ws.endDate}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {ws.activityCount} {t.tasksLabel}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className={statusTextColor(ws.status)}>
                      {translateStatus(ws.status, lang)}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${progressFillColor(ws.progressPercentage)}`}
                      style={{ width: `${ws.progressPercentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200/80">
              <h3 className="font-display text-base font-bold text-slate-900">
                {t.milestoneCheckpointsTitle}
              </h3>
              {canManage && (
                <button
                  onClick={() => onEditMilestone(undefined, activeProject.id)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 whitespace-nowrap cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> {t.addMilestone}
                </button>
              )}
            </div>
            <div className="divide-y divide-slate-200/70">
              {projectMilestones.map((ms) => (
                <div
                  key={ms.id}
                  className="flex items-center justify-between py-4 first:pt-0 last:pb-0 gap-4"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="text-amber-600 font-bold text-base leading-none mt-0.5">◆</span>
                    <div>
                      <div className="text-sm font-bold text-slate-900">
                        {pickLocalized(lang, ms.name, ms.nameAr)}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mt-1">
                        <span>{pickLocalized(lang, ms.workstreamName, ms.workstreamNameAr, t.enterpriseWideOption)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{pickLocalized(lang, ms.ownerName, ms.ownerNameAr, t.unassignedOption)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-end shrink-0">
                    <div className={`text-xs ${statusTextColor(ms.status, ms.isDelayed)}`}>
                      {translateStatus(ms.status, lang)}
                    </div>
                    <div className="text-xs font-mono tabular-nums text-slate-500 mt-0.5">
                      {ms.plannedDate}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: WORKSTREAMS CRUD */}
      {activeTab === 'workstreams' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-200/80 flex items-center justify-between gap-4">
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">{t.workstreams}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{t.workstreamRollupHint}</p>
            </div>
            {canManage && (
              <button
                onClick={() => onEditWorkstream(undefined, activeProject.id)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 whitespace-nowrap cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> {t.newWorkstream}
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-slate-200/80 text-xs font-semibold text-slate-600">
                  <th className="py-3.5 px-4 text-start">{t.workstreams}</th>
                  <th className="py-3.5 px-4 text-start">{t.ownerLabel}</th>
                  <th className="py-3.5 px-4 text-start">{t.scheduleWindow}</th>
                  <th className="py-3.5 px-4 text-start">{t.activities}</th>
                  <th className="py-3.5 px-4 text-start">{t.statusFilterLabel}</th>
                  <th className="py-3.5 px-4 text-start">{t.overallProgress}</th>
                  <th className="py-3.5 px-4 text-end">{t.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 text-sm">
                {projectWorkstreams.map((ws) => (
                  <tr key={ws.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">
                        {pickLocalized(lang, ws.name, ws.nameAr)}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {pickLocalized(lang, ws.description, ws.descriptionAr)}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-700">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-mono text-[10px] font-bold inline-flex items-center justify-center shrink-0">
                          {getInitials(pickLocalized(lang, ws.ownerName, ws.ownerNameAr))}
                        </span>
                        <span>{pickLocalized(lang, ws.ownerName, ws.ownerNameAr, '—')}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-slate-600">
                      {ws.startDate} → {ws.endDate}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 font-mono tabular-nums">
                      <button
                        onClick={() => {
                          setWsFilter(String(ws.id));
                          setActiveTab('activities');
                        }}
                        className="text-blue-600 hover:underline font-semibold cursor-pointer"
                      >
                        {ws.activityCount} {t.tasksLabel}
                      </button>{' '}
                      · {ws.milestoneCount} {t.milestones}
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      <span className={statusTextColor(ws.status)}>
                        {translateStatus(ws.status, lang)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${progressFillColor(
                              ws.progressPercentage
                            )}`}
                            style={{ width: `${ws.progressPercentage}%` }}
                          />
                        </div>
                        <span className="font-mono tabular-nums text-xs font-bold">
                          {ws.progressPercentage}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-end whitespace-nowrap">
                      {canManage && (
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => onEditWorkstream(ws)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100 cursor-pointer"
                            title={t.edit}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDeleteWorkstream(ws.id, pickLocalized(lang, ws.name, ws.nameAr))}
                            className="p-1.5 text-slate-500 hover:text-rose-600 rounded hover:bg-rose-50 cursor-pointer"
                            title={t.delete}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* TAB 3: MILESTONES CRUD */}
      {activeTab === 'milestones' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-200/80 flex items-center justify-between gap-4">
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">{t.milestones}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{t.milestoneHint}</p>
            </div>
            {canManage && (
              <button
                onClick={() => onEditMilestone(undefined, activeProject.id)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 whitespace-nowrap cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> {t.newMilestone}
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-slate-200/80 text-xs font-semibold text-slate-600">
                  <th className="py-3.5 px-4 text-start">{t.milestones}</th>
                  <th className="py-3.5 px-4 text-start">{t.workstreams}</th>
                  <th className="py-3.5 px-4 text-start">{t.ownerLabel}</th>
                  <th className="py-3.5 px-4 text-start">{t.plannedDateLabel}</th>
                  <th className="py-3.5 px-4 text-start">{t.actualDateLabel}</th>
                  <th className="py-3.5 px-4 text-start">{t.statusFilterLabel}</th>
                  <th className="py-3.5 px-4 text-end">{t.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 text-sm">
                {projectMilestones.map((ms) => (
                  <tr key={ms.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2 font-semibold text-slate-900">
                        <span className="text-amber-600 text-base">◆</span>
                        <span>{pickLocalized(lang, ms.name, ms.nameAr)}</span>
                      </div>
                      <div className="text-xs text-slate-500 ps-5 mt-0.5">
                        {pickLocalized(lang, ms.description, ms.descriptionAr)}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-700">
                      {pickLocalized(lang, ms.workstreamName, ms.workstreamNameAr, t.enterpriseWideOption)}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-700">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-mono text-[10px] font-bold inline-flex items-center justify-center shrink-0">
                          {getInitials(pickLocalized(lang, ms.ownerName, ms.ownerNameAr))}
                        </span>
                        <span>{pickLocalized(lang, ms.ownerName, ms.ownerNameAr, '—')}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-slate-800">
                      {ms.plannedDate}
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-slate-600">
                      {ms.actualDate || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      <span className={statusTextColor(ms.status, ms.isDelayed)}>
                        {translateStatus(ms.status, lang)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-end whitespace-nowrap">
                      {canManage && (
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => onEditMilestone(ms)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100 cursor-pointer"
                            title={t.edit}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDeleteMilestone(ms.id, pickLocalized(lang, ms.name, ms.nameAr))}
                            className="p-1.5 text-slate-500 hover:text-rose-600 rounded hover:bg-rose-50 cursor-pointer"
                            title={t.delete}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* TAB 4: ACTIVITIES, SUBTASKS & DEPENDENCIES */}
      {activeTab === 'activities' && (
        <div className="space-y-6">
          {/* Filter & Sort Toolbar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <Filter className="w-3.5 h-3.5" />
              </div>
              <select
                value={wsFilter}
                onChange={(e) => setWsFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-[#F8FAFC] border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-600"
              >
                <option value="All">{t.allWorkstreams}</option>
                {projectWorkstreams.map((w) => (
                  <option key={w.id} value={String(w.id)}>
                    {pickLocalized(lang, w.name, w.nameAr)}
                  </option>
                ))}
              </select>
              <select
                value={msFilter}
                onChange={(e) => setMsFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-[#F8FAFC] border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-600"
              >
                <option value="All">{t.allMilestones}</option>
                {projectMilestones.map((m) => (
                  <option key={m.id} value={String(m.id)}>
                    ◆ {pickLocalized(lang, m.name, m.nameAr)}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-[#F8FAFC] border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-600"
              >
                <option value="All">{t.allStatuses}</option>
                <option value="Not Started">{translateStatus('Not Started', lang)}</option>
                <option value="In Progress">{translateStatus('In Progress', lang)}</option>
                <option value="Completed">{translateStatus('Completed', lang)}</option>
              </select>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-[#F8FAFC] border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-600"
              >
                <option value="All">{t.allPriorities}</option>
                <option value="Critical">{translatePriority('Critical', lang)}</option>
                <option value="High">{translatePriority('High', lang)}</option>
                <option value="Medium">{translatePriority('Medium', lang)}</option>
                <option value="Low">{translatePriority('Low', lang)}</option>
              </select>
              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-[#F8FAFC] border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-600"
              >
                <option value="All">{t.allAssignees}</option>
                {users.map((u) => (
                  <option key={u.id} value={String(u.id)}>
                    {pickLocalized(lang, u.fullName, u.fullNameAr)}
                  </option>
                ))}
              </select>
              <div className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 ms-1">
                <ArrowUpDown className="w-3.5 h-3.5" />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-2.5 py-1.5 bg-[#F8FAFC] border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-600"
              >
                <option value="dueDate">{t.sortByDueDate}</option>
                <option value="priority">{t.sortByPriority}</option>
                <option value="status">{t.sortByStatus}</option>
                <option value="progress">{t.sortByProgress}</option>
              </select>
            </div>

            {canManage && (
              <button
                onClick={() => onEditActivity(undefined, activeProject.id, null)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 whitespace-nowrap cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> {t.newParentActivity}
              </button>
            )}
          </div>

          {/* Hierarchical Activity & Subtasks Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-start border-collapse">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-slate-200/80 text-xs font-semibold text-slate-600">
                    <th className="py-3.5 px-4 text-start">{t.activities}</th>
                    <th className="py-3.5 px-4 text-start">
                      {t.workstreams} · {t.milestones}
                    </th>
                    <th className="py-3.5 px-4 text-start">{t.assignedUserLabel}</th>
                    <th className="py-3.5 px-4 text-start">{t.scheduleWindow}</th>
                    <th className="py-3.5 px-4 text-start">{t.dependsOn}</th>
                    <th className="py-3.5 px-4 text-start">
                      {t.statusFilterLabel} · {t.priorityLabel}
                    </th>
                    <th className="py-3.5 px-4 text-start">{t.overallProgress}</th>
                    <th className="py-3.5 px-4 text-end">{t.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 text-sm">
                  {filteredParents.map((act) => {
                    const subs = subtasksByParent(act.id);
                    const isExpanded = !!expandedParents[act.id];
                    return (
                      <React.Fragment key={act.id}>
                        <tr className="hover:bg-blue-50/30 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-start gap-2">
                              {subs.length > 0 ? (
                                <button
                                  onClick={() => toggleExpand(act.id)}
                                  className="mt-0.5 p-0.5 rounded hover:bg-slate-200 text-slate-600 cursor-pointer"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRight className={`w-4 h-4 ${lang === 'ar' ? 'rotate-180' : ''}`} />
                                  )}
                                </button>
                              ) : (
                                <span className="w-5" />
                              )}
                              <div>
                                <div className="font-semibold text-slate-900 flex flex-wrap items-center gap-2">
                                  <span>{pickLocalized(lang, act.name, act.nameAr)}</span>
                                  {subs.length > 0 && (
                                    <span className="text-xs font-mono tabular-nums text-blue-600 font-semibold">
                                      · {act.completedSubtaskCount}/{subs.length}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5">
                                  {pickLocalized(lang, act.description, act.descriptionAr)}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            <div className="font-semibold text-slate-800">
                              {pickLocalized(lang, act.workstreamName, act.workstreamNameAr, t.unassignedOption)}
                            </div>
                            {(act.milestoneName || act.milestoneNameAr) && (
                              <div className="text-amber-700 font-medium mt-0.5">
                                ◆ {pickLocalized(lang, act.milestoneName, act.milestoneNameAr)}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-700">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-mono text-[10px] font-bold inline-flex items-center justify-center shrink-0">
                                {getInitials(pickLocalized(lang, act.assignedUserName, act.assignedUserNameAr))}
                              </span>
                              <span>{pickLocalized(lang, act.assignedUserName, act.assignedUserNameAr, t.unassignedOption)}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono tabular-nums text-xs">
                            <div>{act.startDate}</div>
                            <div
                              className={
                                act.isOverdue ? 'text-rose-600 font-bold' : 'text-slate-600'
                              }
                            >
                              → {act.dueDate} {act.isOverdue && `(${t.overdueLabel})`}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            {act.predecessors && act.predecessors.length > 0 ? (
                              <div className="space-y-1">
                                {act.predecessors.map((p) => (
                                  <div
                                    key={p.dependencyId}
                                    className="text-amber-800 text-xs font-medium"
                                  >
                                    {t.dependsOn}: {pickLocalized(lang, p.relatedTaskName, p.relatedTaskNameAr)}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400">{t.noDependencies}</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            <span className={statusTextColor(act.status, act.isOverdue)}>
                              {translateStatus(act.status, lang)}
                            </span>
                            <span className="mx-1.5 text-slate-300">·</span>
                            <span className="text-slate-600">
                              {translatePriority(act.priority, lang)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${progressFillColor(
                                    act.progressPercentage,
                                    act.isOverdue
                                  )}`}
                                  style={{ width: `${act.progressPercentage}%` }}
                                />
                              </div>
                              <span className="font-mono tabular-nums text-xs font-bold">
                                {act.progressPercentage}%
                              </span>
                            </div>
                            {subs.length > 0 && (
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                {t.autoCalculatedSubtasks}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-end whitespace-nowrap">
                            {canManage && (
                              <button
                                onClick={() => onEditActivity(undefined, activeProject.id, act.id)}
                                className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md me-1 cursor-pointer transition-colors"
                              >
                                + {t.addSubtask}
                              </button>
                            )}
                            {canUpdateTask && (
                              <button
                                onClick={() => onEditActivity(act)}
                                className="p-1.5 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100 cursor-pointer"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                            {canManage && (
                              <button
                                onClick={() => onDeleteActivity(act.id, pickLocalized(lang, act.name, act.nameAr))}
                                className="p-1.5 text-slate-500 hover:text-rose-600 rounded hover:bg-rose-50 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>

                        {/* Subtasks rows (clean surface contrast & indentation, no thick left accent border) */}
                        {isExpanded &&
                          subs.map((sub) => (
                            <tr key={sub.id} className="bg-slate-50/70 hover:bg-slate-100/70 transition-colors">
                              <td className="py-2.5 ps-12 pe-4">
                                <div className="flex items-center gap-2.5">
                                  <input
                                    type="checkbox"
                                    checked={sub.status === 'Completed'}
                                    onChange={() => handleToggleSubtask(sub)}
                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 accent-blue-600 cursor-pointer"
                                  />
                                  <div>
                                    <div
                                      className={`text-xs font-semibold ${
                                        sub.status === 'Completed'
                                          ? 'line-through text-slate-400'
                                          : 'text-slate-800'
                                      }`}
                                    >
                                      ↳ {pickLocalized(lang, sub.name, sub.nameAr)}
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      {pickLocalized(lang, sub.description, sub.descriptionAr)}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-2.5 px-4 text-xs text-slate-500">
                                {t.addSubtask}
                              </td>
                              <td className="py-2.5 px-4 text-xs text-slate-700">
                                {pickLocalized(lang, sub.assignedUserName, sub.assignedUserNameAr, '—')}
                              </td>
                              <td className="py-2.5 px-4 font-mono tabular-nums text-xs text-slate-600">
                                {sub.startDate} → {sub.dueDate}
                              </td>
                              <td className="py-2.5 px-4 text-xs text-slate-400">—</td>
                              <td className="py-2.5 px-4 text-xs">
                                <span className={statusTextColor(sub.status)}>
                                  {translateStatus(sub.status, lang)}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 font-mono tabular-nums text-xs font-semibold text-slate-700">
                                {sub.progressPercentage}%
                              </td>
                              <td className="py-2.5 px-4 text-end">
                                {canUpdateTask && (
                                  <button
                                    onClick={() => onEditActivity(sub)}
                                    className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {canManage && (
                                  <button
                                    onClick={() => onDeleteActivity(sub.id, pickLocalized(lang, sub.name, sub.nameAr))}
                                    className="p-1 text-slate-500 hover:text-rose-600 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Task Dependencies Manager */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="font-display text-base font-bold text-slate-900 mb-1">
              {t.dependenciesManagerTitle}
            </h3>
            <p className="text-xs text-slate-500 mb-4">{t.dependenciesManagerDesc}</p>

            {canManage && (
              <form
                onSubmit={handleCreateDependency}
                className="flex flex-wrap items-end gap-3 mb-5 pb-4 border-b border-slate-200/80"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.predecessorLabel}
                  </label>
                  <select
                    value={predTaskId}
                    onChange={(e) => setPredTaskId(Number(e.target.value))}
                    className="px-3 py-2 bg-[#F8FAFC] border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-600"
                  >
                    <option value={0}>{t.selectPredecessor}</option>
                    {parentActivities.map((task) => (
                      <option key={task.id} value={task.id}>
                        #{task.id} {pickLocalized(lang, task.name, task.nameAr)} ({translateStatus(task.status, lang)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.successorLabel}
                  </label>
                  <select
                    value={succTaskId}
                    onChange={(e) => setSuccTaskId(Number(e.target.value))}
                    className="px-3 py-2 bg-[#F8FAFC] border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-600"
                  >
                    <option value={0}>{t.selectSuccessor}</option>
                    {parentActivities.map((task) => (
                      <option key={task.id} value={task.id}>
                        #{task.id} {pickLocalized(lang, task.name, task.nameAr)} ({translateStatus(task.status, lang)})
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 whitespace-nowrap cursor-pointer transition-colors"
                >
                  {t.linkDependency}
                </button>
              </form>
            )}

            <div className="divide-y divide-slate-200/70">
              {projectDependencies.map((dep) => (
                <div
                  key={dep.id}
                  className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 text-xs"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">
                      {pickLocalized(lang, dep.predecessorTaskName, dep.predecessorTaskNameAr)}
                    </span>
                    <span className="font-mono text-blue-600 font-semibold">→</span>
                    <span className="font-semibold text-slate-900">
                      {pickLocalized(lang, dep.successorTaskName, dep.successorTaskNameAr)}
                    </span>
                  </div>
                  {canManage && (
                    <button
                      onClick={() => handleDeleteDependency(dep.id)}
                      className="text-rose-600 hover:underline font-semibold cursor-pointer"
                    >
                      {t.removeDependency}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: GANTT CHART VIEW */}
      {activeTab === 'gantt' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-200/80">
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">
                {t.ganttTitle} ({activeProject.startDate} → {activeProject.endDate})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">{t.ganttSubtitle}</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-blue-600 inline-block" /> {t.overallProgress}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-amber-600 font-bold">◆</span> {t.milestones}
              </span>
            </div>
          </div>

          {/* Month scale header */}
          <div className="grid grid-cols-12 border-b border-slate-200/80 pb-2 text-xs font-mono tabular-nums font-semibold text-slate-500">
            <div className="col-span-4 ps-2">{t.wbsHeader}</div>
            <div className="col-span-8 flex justify-between px-2" dir="ltr">
              {ganttMonths.map((m, i) => (
                <span key={i}>{m}</span>
              ))}
            </div>
          </div>

          {/* Workstream groups */}
          <div className="space-y-4">
            {projectWorkstreams.map((ws) => {
              const wsTasks = parentActivities.filter((a) => a.workstreamId === ws.id);
              const wsMilestones = projectMilestones.filter((m) => m.workstreamId === ws.id);
              return (
                <div key={ws.id} className="border border-slate-200/80 rounded-lg overflow-hidden">
                  {/* Workstream summary bar */}
                  <div className="grid grid-cols-12 items-center bg-[#F8FAFC] py-2.5 px-3 border-b border-slate-200/80">
                    <div className="col-span-4 text-xs font-bold text-slate-900">
                      {pickLocalized(lang, ws.name, ws.nameAr)} ({ws.progressPercentage}%)
                    </div>
                    <div className="col-span-8 relative h-5 bg-slate-200/70 rounded" dir="ltr">
                      <div
                        style={calcBarStyle(ws.startDate, ws.endDate)}
                        className="absolute top-1 bottom-1 bg-slate-800 rounded"
                      />
                    </div>
                  </div>

                  {/* Activities & Subtasks */}
                  <div className="divide-y divide-slate-100">
                    {wsTasks.map((act) => {
                      const subs = subtasksByParent(act.id);
                      return (
                        <React.Fragment key={act.id}>
                          <div className="grid grid-cols-12 items-center py-2.5 px-3 hover:bg-blue-50/20">
                            <div className="col-span-4 pe-2">
                              <div className="text-xs font-semibold text-slate-900">
                                {pickLocalized(lang, act.name, act.nameAr)}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                                {act.startDate} → {act.dueDate}
                                {act.predecessors && act.predecessors.length > 0 && (
                                  <span className="ms-1.5 text-amber-700 font-sans">
                                    [#{act.predecessors.map((p) => p.relatedTaskId).join(', #')}]
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="col-span-8 relative h-7 bg-slate-100 rounded" dir="ltr">
                              <div
                                style={calcBarStyle(act.startDate, act.dueDate)}
                                className={`absolute top-1 bottom-1 rounded overflow-hidden ${
                                  act.isOverdue
                                    ? 'bg-rose-100 border border-rose-500'
                                    : 'bg-blue-100 border border-blue-600'
                                }`}
                              >
                                <div
                                  className={`h-full ${
                                    act.isOverdue
                                      ? 'bg-rose-600'
                                      : act.progressPercentage >= 100
                                      ? 'bg-emerald-600'
                                      : 'bg-blue-600'
                                  }`}
                                  style={{ width: `${act.progressPercentage}%` }}
                                />
                                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono tabular-nums font-bold text-slate-900">
                                  {act.progressPercentage}%
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Subtask bars */}
                          {subs.map((sub) => (
                            <div
                              key={sub.id}
                              className="grid grid-cols-12 items-center py-1.5 px-3 bg-slate-50/60"
                            >
                              <div className="col-span-4 ps-5 pe-2 text-xs text-slate-600">
                                ↳ {pickLocalized(lang, sub.name, sub.nameAr)}
                              </div>
                              <div className="col-span-8 relative h-4 bg-slate-100 rounded" dir="ltr">
                                <div
                                  style={calcBarStyle(sub.startDate, sub.dueDate)}
                                  className="absolute top-0.5 bottom-0.5 bg-emerald-500 rounded"
                                />
                              </div>
                            </div>
                          ))}
                        </React.Fragment>
                      );
                    })}

                    {/* Workstream Milestones */}
                    {wsMilestones.map((ms) => {
                      const msName = pickLocalized(lang, ms.name, ms.nameAr);
                      return (
                      <div
                        key={ms.id}
                        className="grid grid-cols-12 items-center py-2 px-3 bg-amber-50/40"
                      >
                        <div className="col-span-4 text-xs font-bold text-amber-900">
                          ◆ {msName} ({ms.plannedDate})
                        </div>
                        <div className="col-span-8 relative h-6" dir="ltr">
                          <div
                            style={{ left: calcDiamondLeft(ms.plannedDate) }}
                            className="absolute top-0.5 -translate-x-1/2 flex items-center gap-1 text-amber-600 font-bold text-sm"
                            title={`${msName}: ${ms.plannedDate} (${translateStatus(ms.status, lang)})`}
                          >
                            ◆{' '}
                            <span className="text-[10px] font-mono text-amber-900">
                              {translateStatus(ms.status, lang)}
                            </span>
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 6: CALENDAR VIEW */}
      {activeTab === 'calendar' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200/80">
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">
                {t.calendarTitle} — {monthLabel}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {pickLocalized(lang, activeProject.name, activeProject.nameAr)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => changeMonth(-1)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                {t.prevMonth}
              </button>
              <button
                onClick={() => {
                  setCalYear(2026);
                  setCalMonth(9);
                }}
                className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                {t.activeWindowBtn}
              </button>
              <button
                onClick={() => changeMonth(1)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                {t.nextMonth}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-500">
            {(lang === 'ar'
              ? ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
              : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
            ).map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: firstDayWeekday }).map((_, idx) => (
              <div
                key={`pad-${idx}`}
                className="h-28 bg-slate-50/60 border border-slate-100 rounded-lg"
              />
            ))}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(
                dayNum
              ).padStart(2, '0')}`;
              const dayMs = projectMilestones.filter((m) => m.plannedDate === dateStr);
              const dayActs = allProjectActivities.filter(
                (a) => a.startDate === dateStr || a.dueDate === dateStr
              );
              return (
                <div
                  key={dateStr}
                  className="min-h-28 p-2 border border-slate-200/80 rounded-lg bg-white flex flex-col gap-1 hover:border-blue-300 transition-colors"
                >
                  <div className="text-xs font-mono tabular-nums font-bold text-slate-500">
                    {dayNum}
                  </div>
                  {dayMs.map((m) => {
                    const mName = pickLocalized(lang, m.name, m.nameAr);
                    return (
                    <div
                      key={`m-${m.id}`}
                      className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 text-[11px] font-semibold truncate"
                      title={mName}
                    >
                      ◆ {mName}
                    </div>
                    );
                  })}
                  {dayActs.map((a) => {
                    const aName = pickLocalized(lang, a.name, a.nameAr);
                    return (
                    <div
                      key={`a-${a.id}`}
                      className={`px-1.5 py-0.5 rounded text-[11px] font-medium truncate ${
                        a.dueDate === dateStr
                          ? 'bg-blue-50 text-blue-900'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                      title={`${aName} (${a.startDate} → ${a.dueDate})`}
                    >
                      {a.dueDate === dateStr ? t.duePrefix : t.startPrefix} {aName}
                    </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 7: KANBAN BOARD VIEW */}
      {activeTab === 'board' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(['Not Started', 'In Progress', 'Completed'] as const).map((colStatus) => {
            const colTasks = filteredParents.filter((a) => a.status === colStatus);
            const StatusIcon =
              colStatus === 'Completed'
                ? CheckCircle2
                : colStatus === 'In Progress'
                ? Clock
                : AlertTriangle;
            const statusIconColor =
              colStatus === 'Completed'
                ? 'text-emerald-600'
                : colStatus === 'In Progress'
                ? 'text-blue-600'
                : 'text-slate-500';
            return (
              <div
                key={colStatus}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
                  <span className="font-display text-sm font-bold text-slate-900 flex items-center gap-2">
                    <StatusIcon className={`w-4 h-4 ${statusIconColor}`} />
                    <span>{translateStatus(colStatus, lang)}</span>
                  </span>
                  <span className="text-xs font-mono tabular-nums font-bold text-slate-500">
                    {colTasks.length}
                  </span>
                </div>

                <div className="divide-y divide-slate-200/70">
                  {colTasks.map((act) => (
                    <div key={act.id} className="py-4 first:pt-0 last:pb-0 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900 leading-snug">
                          {pickLocalized(lang, act.name, act.nameAr)}
                        </span>
                        <span className="text-xs text-slate-500 font-medium shrink-0">
                          {translatePriority(act.priority, lang)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        <span>{pickLocalized(lang, act.workstreamName, act.workstreamNameAr, t.unassignedOption)}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-slate-700 font-medium">
                          {pickLocalized(lang, act.assignedUserName, act.assignedUserNameAr, t.unassignedOption)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={`font-mono tabular-nums ${
                            act.isOverdue ? 'text-rose-600 font-bold' : ''
                          }`}
                        >
                          {act.dueDate}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${progressFillColor(
                              act.progressPercentage,
                              act.isOverdue
                            )}`}
                            style={{ width: `${act.progressPercentage}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono tabular-nums font-bold">
                          {act.progressPercentage}%
                        </span>
                      </div>

                      {canUpdateTask && (
                        <div className="flex items-center gap-1.5 pt-1.5">
                          {(['Not Started', 'In Progress', 'Completed'] as const)
                            .filter((s) => s !== colStatus)
                            .map((targetStatus) => (
                              <button
                                key={targetStatus}
                                onClick={() => handleMoveKanban(act, targetStatus)}
                                className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 rounded text-xs font-semibold text-slate-700 transition-colors cursor-pointer whitespace-nowrap"
                              >
                                → {translateStatus(targetStatus, lang)}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
