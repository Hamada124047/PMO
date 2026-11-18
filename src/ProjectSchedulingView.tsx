import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from './apiClient';
import {
  Calendar,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  Save,
  Edit2,
  X,
  Loader2,
  FolderKanban,
  ArrowRight,
  ExternalLink,
  RotateCcw,
  SlidersHorizontal
} from 'lucide-react';
import { Language, pickLocalized, translateConflictMessage, translateStatus, translatePriority } from './i18n';

export type TimelineRelation =
  | 'within_timeline'
  | 'starts_before_project'
  | 'ends_after_project'
  | 'outside_both'
  | 'invalid_order'
  | 'missing_dates';

export interface ScheduledActivityItem {
  id: number;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  projectId: number;
  workstreamId?: number | null;
  workstreamName?: string | null;
  workstreamNameAr?: string | null;
  milestoneId?: number | null;
  milestoneName?: string | null;
  milestoneNameAr?: string | null;
  parentActivityId?: number | null;
  parentActivityName?: string | null;
  parentActivityNameAr?: string | null;
  assignedUserId: number | null;
  assignedUserName?: string | null;
  assignedUserNameAr?: string | null;
  startDate: string;
  dueDate: string;
  status: 'Not Started' | 'In Progress' | 'Completed';
  priority: string;
  progressPercentage: number;
  durationDays: number | null;
  hasMissingDates: boolean;
  hasInvalidDateOrder: boolean;
  startsBeforeProject: boolean;
  endsAfterProject: boolean;
  isWithinProjectTimeline: boolean;
  timelineRelation: TimelineRelation;
  conflicts: string[];
  conflictMessages: string[];
}

export interface ScheduleConflictItem {
  activityId: number;
  activityName: string;
  activityNameAr?: string;
  startDate: string;
  dueDate: string;
  status: string;
  timelineRelation: TimelineRelation;
  codes: string[];
  messages: string[];
}

export interface ProjectScheduleProject {
  id: number;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  status: string;
  priority: string;
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
  startDate: string;
  endDate: string;
  targetDate: string;
  progressPercentage: number;
  durationDays: number | null;
}

export interface ProjectScheduleSummary {
  totalActivities: number;
  scheduledActivities: number;
  missingDateActivities: number;
  conflictingActivities: number;
  hasConflicts: boolean;
  earliestActivityStart: string | null;
  latestActivityDue: string | null;
  projectDurationDays: number | null;
  projectDateError: boolean;
}

export interface ProjectScheduleResponse {
  project: ProjectScheduleProject;
  activities: ScheduledActivityItem[];
  summary: ProjectScheduleSummary;
  conflicts: ScheduleConflictItem[];
  warnings?: string[];
}

interface ProjectOption {
  id: number;
  name: string;
  nameAr?: string;
  status: string;
  startDate: string;
  endDate: string;
}

export interface ProjectSchedulingViewProps {
  lang: Language;
  currentUserRole?: string;
  initialProjectId?: number | null;
  showBanner: (type: 'success' | 'error', text: string) => void;
  onDataChanged?: () => void;
  onNavigateToProjectWorkspace?: (projectId: number) => void;
}

const isValidIso = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
};

const toUtcMs = (dateStr: string): number => new Date(`${dateStr}T00:00:00Z`).getTime();

const computeDaySpan = (start: string, end: string): number | null => {
  if (!isValidIso(start) || !isValidIso(end) || end < start) return null;
  return Math.max(1, Math.round((toUtcMs(end) - toUtcMs(start)) / 86400000) + 1);
};

export const ProjectSchedulingView: React.FC<ProjectSchedulingViewProps> = ({
  lang,
  currentUserRole = 'PMO Manager',
  initialProjectId = null,
  showBanner,
  onDataChanged,
  onNavigateToProjectWorkspace
}) => {
  const isAr = lang === 'ar';
  const canManage = currentUserRole === 'PMO Manager' || currentUserRole === 'Project Manager';

  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(initialProjectId);
  const [projectsLoading, setProjectsLoading] = useState<boolean>(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  const [schedule, setSchedule] = useState<ProjectScheduleResponse | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState<boolean>(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  // Project planned dates form state
  const [projectStartInput, setProjectStartInput] = useState<string>('');
  const [projectTargetInput, setProjectTargetInput] = useState<string>('');
  const [projectDateErrors, setProjectDateErrors] = useState<{
    startDate?: string;
    targetDate?: string;
    general?: string;
  }>({});
  const [savingProjectDates, setSavingProjectDates] = useState<boolean>(false);

  // Activity schedule modal editor state
  const [editingActivity, setEditingActivity] = useState<ScheduledActivityItem | null>(null);
  const [actStartInput, setActStartInput] = useState<string>('');
  const [actDueInput, setActDueInput] = useState<string>('');
  const [actDateErrors, setActDateErrors] = useState<{
    startDate?: string;
    dueDate?: string;
    general?: string;
  }>({});
  const [savingActivityDates, setSavingActivityDates] = useState<boolean>(false);

  // Sync external initialProjectId changes
  useEffect(() => {
    if (initialProjectId && initialProjectId > 0) {
      setSelectedProjectId(initialProjectId);
    }
  }, [initialProjectId]);

  const fetchProjectsList = useCallback(async () => {
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      const res = await apiFetch('/api/projects');
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.message ||
            (isAr ? 'تعذر تحميل قائمة المشاريع.' : 'Failed to load projects list.')
        );
      }
      const data = await res.json();
      const rawList = Array.isArray(data) ? data : data.items || [];
      const mapped: ProjectOption[] = rawList.map((p: any) => ({
        id: Number(p.id),
        name: String(p.name || ''),
        nameAr: String(p.nameAr || p.name || ''),
        status: String(p.status || 'Planned'),
        startDate: String(p.startDate || ''),
        endDate: String(p.endDate || p.targetDate || '')
      }));
      setProjectOptions(mapped);

      setSelectedProjectId((prev) => {
        if (initialProjectId && mapped.some((p) => p.id === initialProjectId)) {
          return initialProjectId;
        }
        if (prev && mapped.some((p) => p.id === prev)) {
          return prev;
        }
        return mapped.length > 0 ? mapped[0].id : null;
      });
    } catch (err: any) {
      setProjectsError(
        err?.message || (isAr ? 'حدث خطأ أثناء تحميل المشاريع.' : 'Error loading projects.')
      );
    } finally {
      setProjectsLoading(false);
    }
  }, [initialProjectId, isAr]);

  const fetchSchedule = useCallback(
    async (projectId: number, options?: { notifyOnRefresh?: boolean }) => {
      setScheduleLoading(true);
      setScheduleError(null);
      try {
        const res = await apiFetch(`/api/projects/${projectId}/schedule?lang=${lang}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            data.message ||
              (isAr ? 'تعذر تحميل الجدول الزمني للمشروع.' : 'Failed to load project schedule.')
          );
        }
        setSchedule(data as ProjectScheduleResponse);
        setProjectStartInput(data.project?.startDate || '');
        setProjectTargetInput(data.project?.targetDate || data.project?.endDate || '');
        setProjectDateErrors({});
        setLastRefreshedAt(new Date().toLocaleTimeString());
        if (options?.notifyOnRefresh) {
          showBanner(
            'success',
            isAr ? 'تم تحديث الجدول الزمني بأحدث البيانات.' : 'Project schedule refreshed with latest data.'
          );
        }
      } catch (err: any) {
        const msg =
          err?.message ||
          (isAr ? 'حدث خطأ أثناء جلب الجدول الزمني.' : 'Error fetching project schedule.');
        setScheduleError(msg);
      } finally {
        setScheduleLoading(false);
      }
    },
    [isAr, lang, showBanner]
  );

  useEffect(() => {
    fetchProjectsList();
  }, [fetchProjectsList]);

  useEffect(() => {
    if (selectedProjectId) {
      fetchSchedule(selectedProjectId);
    } else {
      setSchedule(null);
    }
  }, [selectedProjectId, fetchSchedule]);

  const isProjectDatesDirty = useMemo(() => {
    if (!schedule) return false;
    return (
      projectStartInput !== schedule.project.startDate ||
      projectTargetInput !== (schedule.project.targetDate || schedule.project.endDate)
    );
  }, [schedule, projectStartInput, projectTargetInput]);

  // Live conflict preview if the user changes project start/target dates in the editor before saving
  const draftProjectConflicts = useMemo(() => {
    if (!schedule || !isValidIso(projectStartInput) || !isValidIso(projectTargetInput)) {
      return [] as { id: number; name: string; reason: string }[];
    }
    if (projectTargetInput < projectStartInput) {
      return [];
    }
    const items: { id: number; name: string; reason: string }[] = [];
    for (const act of schedule.activities) {
      const actLabel = pickLocalized(lang, act.name, act.nameAr);
      const startsBefore = isValidIso(act.startDate) && act.startDate < projectStartInput;
      const endsAfter = isValidIso(act.dueDate) && act.dueDate > projectTargetInput;
      if (startsBefore && endsAfter) {
        items.push({
          id: act.id,
          name: actLabel,
          reason: isAr
            ? `يبدأ (${act.startDate}) وينتهي (${act.dueDate}) خارج نطاق المشروع`
            : `Starts (${act.startDate}) and ends (${act.dueDate}) outside project dates`
        });
      } else if (startsBefore) {
        items.push({
          id: act.id,
          name: actLabel,
          reason: isAr
            ? `يبدأ قبل بداية المشروع (${act.startDate} < ${projectStartInput})`
            : `Starts before project start (${act.startDate} < ${projectStartInput})`
        });
      } else if (endsAfter) {
        items.push({
          id: act.id,
          name: actLabel,
          reason: isAr
            ? `ينتهي بعد التاريخ المستهدف للمشروع (${act.dueDate} > ${projectTargetInput})`
            : `Ends after project target (${act.dueDate} > ${projectTargetInput})`
        });
      }
    }
    return items;
  }, [schedule, projectStartInput, projectTargetInput, isAr, lang]);

  const handleSaveProjectDates = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedule || !canManage) return;

    const errs: { startDate?: string; targetDate?: string; general?: string } = {};
    if (!isValidIso(projectStartInput)) {
      errs.startDate = isAr
        ? 'يرجى إدخال تاريخ بدء مخطط صحيح.'
        : 'Please enter a valid planned start date.';
    }
    if (!isValidIso(projectTargetInput)) {
      errs.targetDate = isAr
        ? 'يرجى إدخال تاريخ مستهدف مخطط صحيح.'
        : 'Please enter a valid planned target date.';
    }
    if (!errs.startDate && !errs.targetDate && projectTargetInput < projectStartInput) {
      errs.targetDate = isAr
        ? 'التاريخ المستهدف للمشروع لا يمكن أن يسبق تاريخ البدء المخطط.'
        : 'Project target date cannot be earlier than planned start date.';
    }
    if (Object.keys(errs).length > 0) {
      setProjectDateErrors(errs);
      return;
    }

    setSavingProjectDates(true);
    setProjectDateErrors({});
    try {
      const res = await apiFetch(`/api/projects/${schedule.project.id}/schedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: projectStartInput,
          targetDate: projectTargetInput,
          lang
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.fieldErrors) {
          setProjectDateErrors({
            ...data.fieldErrors,
            general: data.message
          });
        } else {
          setProjectDateErrors({
            general:
              data.message ||
              (isAr ? 'فشل تحديث تواريخ تخطيط المشروع.' : 'Failed to update project planning dates.')
          });
        }
        showBanner(
          'error',
          data.message ||
            (isAr ? 'تعذر حفظ تواريخ الجدول الزمني.' : 'Unable to save project schedule dates.')
        );
        return;
      }

      setSchedule(data as ProjectScheduleResponse);
      setProjectStartInput(data.project.startDate);
      setProjectTargetInput(data.project.targetDate || data.project.endDate);
      setLastRefreshedAt(new Date().toLocaleTimeString());
      setProjectOptions((prev) =>
        prev.map((p) =>
          p.id === data.project.id
            ? { ...p, startDate: data.project.startDate, endDate: data.project.endDate }
            : p
        )
      );

      if (data.summary?.hasConflicts) {
        showBanner(
          'success',
          isAr
            ? `تم تحديث تواريخ المشروع، مع رصد ${data.summary.conflictingActivities} نشاط(أنشطة) خارج النطاق الزمني.`
            : `Project dates updated. ${data.summary.conflictingActivities} activity schedule conflict(s) detected.`
        );
      } else {
        showBanner(
          'success',
          isAr ? 'تم تحديث تواريخ تخطيط المشروع بنجاح.' : 'Project planning dates updated successfully.'
        );
      }

      onDataChanged?.();
    } catch (err: any) {
      const msg =
        err?.message || (isAr ? 'خطأ في الاتصال بالخادم.' : 'Network error updating project dates.');
      setProjectDateErrors({ general: msg });
      showBanner('error', msg);
    } finally {
      setSavingProjectDates(false);
    }
  };

  const handleOpenEditActivity = (act: ScheduledActivityItem) => {
    setEditingActivity(act);
    setActStartInput(act.startDate || schedule?.project.startDate || '');
    setActDueInput(act.dueDate || schedule?.project.targetDate || '');
    setActDateErrors({});
  };

  const handleSaveActivityDates = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingActivity || !schedule || !canManage) return;

    const errs: { startDate?: string; dueDate?: string; general?: string } = {};
    if (!isValidIso(actStartInput)) {
      errs.startDate = isAr
        ? 'يرجى إدخال تاريخ بدء صحيح للنشاط.'
        : 'Please enter a valid activity start date.';
    }
    if (!isValidIso(actDueInput)) {
      errs.dueDate = isAr
        ? 'يرجى إدخال تاريخ استحقاق صحيح للنشاط.'
        : 'Please enter a valid activity due date.';
    }
    if (!errs.startDate && !errs.dueDate && actDueInput < actStartInput) {
      errs.dueDate = isAr
        ? 'تاريخ استحقاق النشاط لا يمكن أن يسبق تاريخ بدئه.'
        : 'Activity due date cannot be earlier than start date.';
    }

    const projStart = schedule.project.startDate;
    const projEnd = schedule.project.targetDate || schedule.project.endDate;
    if (!errs.startDate && isValidIso(projStart) && actStartInput < projStart) {
      errs.startDate = isAr
        ? `تاريخ بدء النشاط (${actStartInput}) يسبق تاريخ بدء المشروع (${projStart}).`
        : `Activity start date (${actStartInput}) cannot be earlier than project start date (${projStart}).`;
    }
    if (!errs.dueDate && isValidIso(projEnd) && actDueInput > projEnd) {
      errs.dueDate = isAr
        ? `تاريخ استحقاق النشاط (${actDueInput}) يتجاوز التاريخ المستهدف للمشروع (${projEnd}).`
        : `Activity due date (${actDueInput}) cannot exceed project target date (${projEnd}).`;
    }

    if (Object.keys(errs).length > 0) {
      setActDateErrors(errs);
      return;
    }

    setSavingActivityDates(true);
    setActDateErrors({});
    try {
      const res = await apiFetch(
        `/api/projects/${schedule.project.id}/schedule/activities/${editingActivity.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startDate: actStartInput,
            dueDate: actDueInput,
            lang
          })
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.fieldErrors) {
          setActDateErrors({
            ...data.fieldErrors,
            general: data.message
          });
        } else {
          setActDateErrors({
            general:
              data.message ||
              (isAr ? 'تعذر حفظ تواريخ النشاط.' : 'Failed to save activity schedule dates.')
          });
        }
        return;
      }

      if (data.schedule) {
        setSchedule(data.schedule as ProjectScheduleResponse);
        setLastRefreshedAt(new Date().toLocaleTimeString());
      } else {
        await fetchSchedule(schedule.project.id);
      }
      setEditingActivity(null);
      showBanner(
        'success',
        isAr ? 'تم تحديث جدول النشاط والتحقق من التواريخ.' : 'Activity schedule dates updated.'
      );
      onDataChanged?.();
    } catch (err: any) {
      setActDateErrors({
        general:
          err?.message || (isAr ? 'خطأ أثناء حفظ جدول النشاط.' : 'Error saving activity schedule.')
      });
    } finally {
      setSavingActivityDates(false);
    }
  };

  // Compute timeline bounds across project window and all valid activity dates
  const timelineBounds = useMemo(() => {
    if (!schedule) return null;
    const validDates: string[] = [];
    if (isValidIso(schedule.project.startDate)) validDates.push(schedule.project.startDate);
    if (isValidIso(schedule.project.targetDate)) validDates.push(schedule.project.targetDate);
    for (const act of schedule.activities) {
      if (isValidIso(act.startDate)) validDates.push(act.startDate);
      if (isValidIso(act.dueDate)) validDates.push(act.dueDate);
    }
    if (validDates.length < 2) return null;
    validDates.sort();
    const minStr = validDates[0];
    const maxStr = validDates[validDates.length - 1];
    const minMs = toUtcMs(minStr);
    const maxMs = Math.max(minMs + 86400000, toUtcMs(maxStr));
    const totalSpan = maxMs - minMs;

    const pctFor = (dateStr: string): number => {
      if (!isValidIso(dateStr)) return 0;
      const pos = ((toUtcMs(dateStr) - minMs) / totalSpan) * 100;
      return Math.max(0, Math.min(100, pos));
    };

    const projStartPct = isValidIso(schedule.project.startDate)
      ? pctFor(schedule.project.startDate)
      : 0;
    const projEndPct = isValidIso(schedule.project.targetDate)
      ? pctFor(schedule.project.targetDate)
      : 100;

    return {
      minStr,
      maxStr,
      minMs,
      maxMs,
      totalSpan,
      pctFor,
      projStartPct,
      projEndPct
    };
  }, [schedule]);

  const getRelationDisplay = (relation: TimelineRelation) => {
    switch (relation) {
      case 'within_timeline':
        return {
          label: isAr ? 'ضمن جدول المشروع' : 'Within Project Timeline',
          className: 'text-emerald-700',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        };
      case 'starts_before_project':
        return {
          label: isAr ? 'يبدأ قبل بداية المشروع' : 'Starts Before Project',
          className: 'text-amber-700 font-semibold',
          icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        };
      case 'ends_after_project':
        return {
          label: isAr ? 'ينتهي بعد التاريخ المستهدف' : 'Ends After Target Date',
          className: 'text-amber-700 font-semibold',
          icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        };
      case 'outside_both':
        return {
          label: isAr ? 'خارج نطاق المشروع بالكامل' : 'Outside Both Project Bounds',
          className: 'text-rose-700 font-semibold',
          icon: <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
        };
      case 'invalid_order':
        return {
          label: isAr ? 'تاريخ الاستحقاق يسبق البداية' : 'Due Date Before Start',
          className: 'text-rose-700 font-semibold',
          icon: <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
        };
      case 'missing_dates':
      default:
        return {
          label: isAr ? 'تواريخ غير مكتملة' : 'Missing Schedule Dates',
          className: 'text-slate-600 font-medium',
          icon: <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        };
    }
  };

  const getActivityStatusTextClass = (status: string) => {
    if (status === 'Completed') return 'text-emerald-700 font-semibold';
    if (status === 'In Progress') return 'text-blue-700 font-semibold';
    return 'text-slate-600 font-medium';
  };

  const plannedDurationPreview = computeDaySpan(projectStartInput, projectTargetInput);

  return (
    <div className="space-y-6">
      {/* Page Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200/90 pb-5">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            {isAr ? 'تخطيط وجدولة المشاريع' : 'Project Planning & Scheduling'}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {isAr
              ? 'تنظيم الجداول الزمنية للمشاريع وترتيب الأنشطة زمنياً والتحقق من توافق التواريخ.'
              : 'Manage planned project windows, inspect chronological activity sequences, and validate schedule alignment.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Project Selector */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-xs">
            <FolderKanban className="w-4 h-4 text-slate-500 shrink-0" />
            <label htmlFor="schedule-project-select" className="sr-only">
              {isAr ? 'اختيار المشروع' : 'Select Project'}
            </label>
            <select
              id="schedule-project-select"
              value={selectedProjectId ?? ''}
              onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : null)}
              disabled={projectsLoading || projectOptions.length === 0}
              className="text-sm font-medium text-slate-900 bg-transparent focus:outline-none cursor-pointer max-w-[260px]"
            >
              {projectOptions.length === 0 ? (
                <option value="">{isAr ? 'لا توجد مشاريع متاحة' : 'No projects available'}</option>
              ) : (
                projectOptions.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {pickLocalized(lang, proj.name, proj.nameAr)}
                  </option>
                ))
              )}
            </select>
          </div>

          {schedule && onNavigateToProjectWorkspace && (
            <button
              type="button"
              onClick={() => onNavigateToProjectWorkspace(schedule.project.id)}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer inline-flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              <span>{isAr ? 'مساحة العمل' : 'Workspace'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (selectedProjectId) {
                fetchSchedule(selectedProjectId, { notifyOnRefresh: true });
              } else {
                fetchProjectsList();
              }
            }}
            disabled={scheduleLoading || projectsLoading}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scheduleLoading ? 'animate-spin' : ''}`} />
            <span>{isAr ? 'تحديث الجدول' : 'Refresh Schedule'}</span>
          </button>
        </div>
      </div>

      {/* Loading Projects */}
      {projectsLoading && !schedule && (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
          <Loader2 className="w-7 h-7 text-blue-600 animate-spin mx-auto" />
          <p className="text-sm text-slate-600">
            {isAr ? 'جارٍ تحميل قائمة المشاريع...' : 'Loading projects...'}
          </p>
        </div>
      )}

      {/* Projects Error */}
      {!projectsLoading && projectsError && (
        <div className="bg-white border border-rose-200 rounded-xl p-8 text-center space-y-3">
          <AlertCircle className="w-7 h-7 text-rose-600 mx-auto" />
          <p className="text-sm font-semibold text-rose-800">{projectsError}</p>
          <button
            type="button"
            onClick={fetchProjectsList}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            {isAr ? 'إعادة المحاولة' : 'Retry'}
          </button>
        </div>
      )}

      {/* Schedule Loading */}
      {selectedProjectId && scheduleLoading && !schedule && (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
          <Loader2 className="w-7 h-7 text-blue-600 animate-spin mx-auto" />
          <p className="text-sm text-slate-600">
            {isAr ? 'جارٍ تحميل الجدول الزمني للمشروع...' : 'Loading project schedule...'}
          </p>
        </div>
      )}

      {/* Schedule Error */}
      {selectedProjectId && scheduleError && !scheduleLoading && (
        <div className="bg-white border border-rose-200 rounded-xl p-8 text-center space-y-3">
          <AlertCircle className="w-7 h-7 text-rose-600 mx-auto" />
          <p className="text-sm font-semibold text-rose-800">{scheduleError}</p>
          <button
            type="button"
            onClick={() => fetchSchedule(selectedProjectId)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            {isAr ? 'إعادة التحميل' : 'Retry'}
          </button>
        </div>
      )}

      {/* Main Loaded Schedule View */}
      {schedule && !scheduleError && (
        <>
          {/* Project Overview & Date Management Panel */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">
                    {pickLocalized(lang, schedule.project.name, schedule.project.nameAr)}
                  </h2>
                  {scheduleLoading && (
                    <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{isAr ? 'جارٍ التحديث...' : 'Refreshing...'}</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 font-medium">
                  {[
                    pickLocalized(lang, schedule.project.departmentName, schedule.project.departmentNameAr),
                    pickLocalized(lang, schedule.project.initiativeName, schedule.project.initiativeNameAr),
                    schedule.project.projectManagerName
                      ? pickLocalized(lang, schedule.project.projectManagerName, schedule.project.projectManagerNameAr)
                      : isAr
                      ? 'غير معين لمدير مشروع'
                      : 'No project manager',
                    translateStatus(schedule.project.status, lang),
                    translatePriority(schedule.project.priority, lang),
                    `${schedule.project.progressPercentage}% ${isAr ? 'مكتمل' : 'Progress'}`
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>

              {/* Clean Metric Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 shrink-0 text-start border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    {isAr ? 'مدة المشروع' : 'Planned Span'}
                  </div>
                  <div className="text-sm font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                    {schedule.summary.projectDurationDays !== null
                      ? `${schedule.summary.projectDurationDays} ${isAr ? 'يوم' : 'days'}`
                      : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    {isAr ? 'الأنشطة' : 'Activities'}
                  </div>
                  <div className="text-sm font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                    {schedule.summary.totalActivities}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    {isAr ? 'نطاق الأنشطة' : 'Activity Range'}
                  </div>
                  <div className="text-xs font-semibold font-mono tabular-nums text-slate-800 mt-1">
                    {schedule.summary.earliestActivityStart && schedule.summary.latestActivityDue
                      ? `${schedule.summary.earliestActivityStart} → ${schedule.summary.latestActivityDue}`
                      : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    {isAr ? 'التعارضات' : 'Conflicts'}
                  </div>
                  <div
                    className={`text-sm font-bold font-mono tabular-nums mt-0.5 ${
                      schedule.summary.hasConflicts ? 'text-amber-700' : 'text-emerald-700'
                    }`}
                  >
                    {schedule.summary.conflictingActivities}
                  </div>
                </div>
              </div>
            </div>

            {/* Editable Project Planning Dates Form (Stories 11.3 & 11.4) */}
            <form onSubmit={handleSaveProjectDates} className="p-5 bg-slate-50/70 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    {isAr ? 'تواريخ تخطيط المشروع المعتمدة' : 'Planned Project Schedule Dates'}
                  </h3>
                </div>
                {lastRefreshedAt && (
                  <span className="text-[11px] font-mono text-slate-500">
                    {isAr ? `آخر تحديث: ${lastRefreshedAt}` : `Synced at ${lastRefreshedAt}`}
                  </span>
                )}
              </div>

              {projectDateErrors.general && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{projectDateErrors.general}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                <div className="md:col-span-4">
                  <label
                    htmlFor="proj-planned-start"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    {isAr ? 'تاريخ البدء المخطط' : 'Planned Start Date'}
                  </label>
                  <input
                    id="proj-planned-start"
                    type="date"
                    value={projectStartInput}
                    onChange={(e) => {
                      setProjectStartInput(e.target.value);
                      setProjectDateErrors((prev) => ({ ...prev, startDate: undefined, general: undefined }));
                    }}
                    disabled={!canManage || savingProjectDates}
                    className={`w-full text-sm font-mono bg-white border rounded-lg px-3 py-2 text-slate-900 disabled:bg-slate-100 disabled:text-slate-600 ${
                      projectDateErrors.startDate ? 'border-rose-400' : 'border-slate-300'
                    }`}
                  />
                  {projectDateErrors.startDate && (
                    <p className="text-xs text-rose-600 mt-1">{projectDateErrors.startDate}</p>
                  )}
                </div>

                <div className="md:col-span-4">
                  <label
                    htmlFor="proj-planned-target"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    {isAr ? 'التاريخ المستهدف المخطط' : 'Planned Target Date'}
                  </label>
                  <input
                    id="proj-planned-target"
                    type="date"
                    value={projectTargetInput}
                    onChange={(e) => {
                      setProjectTargetInput(e.target.value);
                      setProjectDateErrors((prev) => ({ ...prev, targetDate: undefined, general: undefined }));
                    }}
                    disabled={!canManage || savingProjectDates}
                    className={`w-full text-sm font-mono bg-white border rounded-lg px-3 py-2 text-slate-900 disabled:bg-slate-100 disabled:text-slate-600 ${
                      projectDateErrors.targetDate ? 'border-rose-400' : 'border-slate-300'
                    }`}
                  />
                  {projectDateErrors.targetDate && (
                    <p className="text-xs text-rose-600 mt-1">{projectDateErrors.targetDate}</p>
                  )}
                </div>

                <div className="md:col-span-4 flex flex-wrap items-center gap-2 md:pt-5">
                  {canManage ? (
                    <>
                      <button
                        type="submit"
                        disabled={savingProjectDates || !isProjectDatesDirty}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {savingProjectDates ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        <span>{isAr ? 'حفظ جدول المشروع' : 'Save Project Dates'}</span>
                      </button>
                      {isProjectDatesDirty && (
                        <button
                          type="button"
                          onClick={() => {
                            setProjectStartInput(schedule.project.startDate);
                            setProjectTargetInput(schedule.project.targetDate || schedule.project.endDate);
                            setProjectDateErrors({});
                          }}
                          disabled={savingProjectDates}
                          className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer inline-flex items-center gap-1"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>{isAr ? 'تراجع' : 'Reset'}</span>
                        </button>
                      )}
                      {plannedDurationPreview !== null && (
                        <span className="text-xs font-mono text-slate-500">
                          {plannedDurationPreview} {isAr ? 'يوم' : 'd'}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-slate-500">
                      {isAr
                        ? 'عرض للقراءة فقط — تعديل تواريخ المشروع متاح لمدير المشروع أو مدير PMO.'
                        : 'Read-only view — only PMO or Project Managers can modify project planning dates.'}
                    </span>
                  )}
                </div>
              </div>

              {/* Draft Conflict Warning Preview before saving */}
              {isProjectDatesDirty && draftProjectConflicts.length > 0 && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      {isAr
                        ? `تحذير تعارض مسبق: ${draftProjectConflicts.length} نشاط(أنشطة) ستقع خارج النطاق الجديد`
                        : `Schedule Conflict Preview: ${draftProjectConflicts.length} existing activity(ies) fall outside these dates`}
                    </span>
                  </div>
                  <ul className="text-xs text-amber-800 space-y-0.5 ps-6 list-disc">
                    {draftProjectConflicts.slice(0, 4).map((item) => (
                      <li key={item.id}>
                        <span className="font-semibold">{item.name}</span> — {item.reason}
                      </li>
                    ))}
                    {draftProjectConflicts.length > 4 && (
                      <li>
                        {isAr
                          ? `و ${draftProjectConflicts.length - 4} أنشطة أخرى...`
                          : `and ${draftProjectConflicts.length - 4} more...`}
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Saved Database Conflict Banner */}
              {schedule.summary.hasConflicts && (
                <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-lg space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      {isAr
                        ? `تعارضات الجدول الزمني الحالية (${schedule.summary.conflictingActivities})`
                        : `Active Schedule Conflicts (${schedule.summary.conflictingActivities})`}
                    </span>
                  </div>
                  <p className="text-xs text-amber-800">
                    {isAr
                      ? 'بعض الأنشطة تحتوي على تواريخ غير مكتملة أو تقع خارج نافذة المشروع المخططة. راجع الجدول أدناه لتعديل تواريخ الأنشطة أو توسيع تواريخ المشروع.'
                      : 'Some activities have dates outside the planned project timeline or missing dates. Adjust the affected activity dates or expand the project window.'}
                  </p>
                </div>
              )}
            </form>
          </div>

          {/* Empty State if project has zero activities */}
          {schedule.activities.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-2.5 shadow-xs">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-900">
                {isAr ? 'لا توجد أنشطة مجدولة لهذا المشروع' : 'No Activities in Project Schedule'}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {isAr
                  ? 'يمكنك تعديل تواريخ تخطيط المشروع أعلاه، أو إضافة أنشطة من وحدة إدارة الأنشطة لتظهر هنا بترتيبها الزمني.'
                  : 'You can plan the project start and target dates above. Any activities added to this project will appear here in chronological order.'}
              </p>
            </div>
          ) : (
            <>
              {/* Visual Schedule Timeline Overview */}
              {timelineBounds && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        {isAr ? 'الخط الزمني المرئي للمشروع والأنشطة' : 'Timeline Comparison View'}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {isAr
                          ? 'مقارنة الفترات الزمنية للأنشطة (مرتبة حسب تاريخ البدء) مع حدود المشروع المخططة.'
                          : 'Activities sorted chronologically by planned start date relative to the project window.'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-600">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-3 h-2 rounded-xs bg-blue-600 inline-block" />
                        <span>{isAr ? 'ضمن النطاق' : 'Within Window'}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-3 h-2 rounded-xs bg-emerald-600 inline-block" />
                        <span>{isAr ? 'مكتمل' : 'Completed'}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-3 h-2 rounded-xs bg-amber-500 inline-block" />
                        <span>{isAr ? 'خارج نطاق المشروع' : 'Out of Bounds'}</span>
                      </span>
                    </div>
                  </div>

                  {/* Timeline Header Axis */}
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="grid grid-cols-12 bg-slate-50 border-b border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-600">
                      <div className="col-span-5 sm:col-span-4">
                        {isAr ? 'النشاط (تسلسل زمني)' : 'Activity (Chronological)'}
                      </div>
                      <div className="col-span-7 sm:col-span-8 flex items-center justify-between font-mono tabular-nums">
                        <span>{timelineBounds.minStr}</span>
                        <span className="text-blue-700 font-bold">
                          {isAr ? 'نافذة المشروع:' : 'Project:'} {schedule.project.startDate} →{' '}
                          {schedule.project.targetDate}
                        </span>
                        <span>{timelineBounds.maxStr}</span>
                      </div>
                    </div>

                    {/* Timeline Rows */}
                    <div className="divide-y divide-slate-100">
                      {schedule.activities.map((act, index) => {
                        const hasBars = isValidIso(act.startDate) && isValidIso(act.dueDate) && act.dueDate >= act.startDate;
                        const leftPct = hasBars ? timelineBounds.pctFor(act.startDate) : 0;
                        const rightPct = hasBars ? timelineBounds.pctFor(act.dueDate) : 0;
                        const widthPct = Math.max(2, rightPct - leftPct);

                        const barColor = !act.isWithinProjectTimeline
                          ? 'bg-amber-500'
                          : act.status === 'Completed'
                          ? 'bg-emerald-600'
                          : 'bg-blue-600';

                        return (
                          <div
                            key={act.id}
                            className="grid grid-cols-12 items-center px-3 py-2.5 hover:bg-slate-50/70 transition-colors gap-2"
                          >
                            <div className="col-span-5 sm:col-span-4 min-w-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[11px] font-mono tabular-nums text-slate-400 shrink-0 w-5">
                                  {String(index + 1).padStart(2, '0')}
                                </span>
                                <span
                                  className="text-xs font-semibold text-slate-900 truncate"
                                  title={pickLocalized(lang, act.name, act.nameAr)}
                                >
                                  {pickLocalized(lang, act.name, act.nameAr)}
                                </span>
                              </div>
                              <div className="text-[11px] font-mono tabular-nums text-slate-500 ps-7">
                                {act.hasMissingDates
                                  ? isAr
                                    ? 'بدون تواريخ'
                                    : 'No dates'
                                  : `${act.startDate} → ${act.dueDate}`}
                              </div>
                            </div>

                            <div className="col-span-7 sm:col-span-8 relative h-6 bg-slate-100/80 rounded">
                              {/* Shaded Project Window Background */}
                              <div
                                className="absolute top-0 bottom-0 bg-blue-50/70 border-x border-dashed border-blue-400/70"
                                style={{
                                  left: `${timelineBounds.projStartPct}%`,
                                  width: `${Math.max(1, timelineBounds.projEndPct - timelineBounds.projStartPct)}%`
                                }}
                                title={`${isAr ? 'نطاق المشروع:' : 'Project Window:'} ${schedule.project.startDate} → ${schedule.project.targetDate}`}
                              />

                              {/* Activity Bar */}
                              {hasBars ? (
                                <div
                                  className={`absolute top-1.5 bottom-1.5 rounded ${barColor} transition-all`}
                                  style={{
                                    left: `${leftPct}%`,
                                    width: `${widthPct}%`
                                  }}
                                  title={`${pickLocalized(lang, act.name, act.nameAr)}: ${act.startDate} → ${act.dueDate}`}
                                />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-[10px] text-rose-600 font-medium">
                                  {act.hasInvalidDateOrder
                                    ? isAr
                                      ? 'تاريخ غير صالح'
                                      : 'Invalid range'
                                    : isAr
                                    ? 'تواريخ غير محددة'
                                    : 'Unscheduled'}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Chronological Activities Schedule Table */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-slate-500" />
                    <h3 className="text-sm font-bold text-slate-900">
                      {isAr ? 'الأنشطة المرتبة زمنياً' : 'Chronological Activity Schedule'}
                    </h3>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-slate-500">
                    {schedule.activities.length} {isAr ? 'نشاط مرتب حسب تاريخ البدء' : 'activities ordered by start date'}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-start border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        <th className="py-3 px-4 w-10 text-start">#</th>
                        <th className="py-3 px-4 text-start">{isAr ? 'النشاط' : 'Activity'}</th>
                        <th className="py-3 px-4 text-start">{isAr ? 'تاريخ البدء' : 'Start Date'}</th>
                        <th className="py-3 px-4 text-start">{isAr ? 'تاريخ الاستحقاق' : 'Due Date'}</th>
                        <th className="py-3 px-4 text-start">{isAr ? 'المدة' : 'Duration'}</th>
                        <th className="py-3 px-4 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                        <th className="py-3 px-4 text-start">{isAr ? 'التوافق مع المشروع' : 'Schedule Alignment'}</th>
                        {canManage && (
                          <th className="py-3 px-4 text-end">{isAr ? 'تعديل التواريخ' : 'Adjust'}</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {schedule.activities.map((act, idx) => {
                        const rel = getRelationDisplay(act.timelineRelation);
                        return (
                          <tr
                            key={act.id}
                            className={`transition-colors ${
                              !act.isWithinProjectTimeline
                                ? 'bg-amber-50/35 hover:bg-amber-50/60'
                                : 'hover:bg-slate-50/80'
                            }`}
                          >
                            <td className="py-3.5 px-4 font-mono tabular-nums text-slate-400">
                              {String(idx + 1).padStart(2, '0')}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-slate-900">
                                {pickLocalized(lang, act.name, act.nameAr)}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {[
                                  act.parentActivityName
                                    ? `${isAr ? 'تابع لـ:' : 'Subtask of'} ${pickLocalized(lang, act.parentActivityName, act.parentActivityNameAr)}`
                                    : null,
                                  pickLocalized(lang, act.workstreamName, act.workstreamNameAr),
                                  act.assignedUserName
                                    ? pickLocalized(lang, act.assignedUserName, act.assignedUserNameAr)
                                    : isAr
                                    ? 'غير مكلف'
                                    : 'Unassigned'
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </div>
                              {(act.conflicts.length > 0 || act.conflictMessages.length > 0) && (
                                <div className="text-[11px] text-amber-800 mt-1">
                                  {(act.conflicts.length > 0
                                    ? act.conflicts.map((code) =>
                                        translateConflictMessage(code, lang, {
                                          startDate: act.startDate,
                                          dueDate: act.dueDate,
                                          projectStart: schedule.project.startDate,
                                          projectTarget: schedule.project.targetDate
                                        })
                                      )
                                    : act.conflictMessages
                                  ).join(' · ')}
                                </div>
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-mono tabular-nums text-slate-800 whitespace-nowrap">
                              {act.startDate || '—'}
                            </td>
                            <td className="py-3.5 px-4 font-mono tabular-nums text-slate-800 whitespace-nowrap">
                              {act.dueDate || '—'}
                            </td>
                            <td className="py-3.5 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                              {act.durationDays !== null
                                ? `${act.durationDays} ${isAr ? 'ي' : 'd'}`
                                : '—'}
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className={getActivityStatusTextClass(act.status)}>
                                {translateStatus(act.status, lang)}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1.5 ${rel.className}`}>
                                {rel.icon}
                                <span>{rel.label}</span>
                              </span>
                            </td>
                            {canManage && (
                              <td className="py-3.5 px-4 text-end whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditActivity(act)}
                                  className="px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 border border-slate-200 rounded-lg cursor-pointer inline-flex items-center gap-1"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                  <span>{isAr ? 'تعديل' : 'Edit Dates'}</span>
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Activity Schedule Date Edit Modal (Stories 11.7 & 11.8) */}
      {editingActivity && schedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/45 backdrop-blur-xs"
            onClick={() => !savingActivityDates && setEditingActivity(null)}
          />
          <div className="relative bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md z-10 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 truncate">
                  {isAr ? 'تعديل التواريخ المجدولة للنشاط' : 'Adjust Activity Schedule Dates'}
                </h3>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  {pickLocalized(lang, editingActivity.name, editingActivity.nameAr)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => !savingActivityDates && setEditingActivity(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveActivityDates} className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 flex items-center justify-between gap-2">
                <span className="font-semibold">
                  {isAr ? 'نافذة المشروع المسموحة:' : 'Allowed Project Window:'}
                </span>
                <span className="font-mono tabular-nums font-bold text-slate-900 inline-flex items-center gap-1">
                  <span>{schedule.project.startDate}</span>
                  <ArrowRight className={`w-3 h-3 text-slate-400 ${isAr ? 'rotate-180' : ''}`} />
                  <span>{schedule.project.targetDate}</span>
                </span>
              </div>

              {actDateErrors.general && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{actDateErrors.general}</span>
                </div>
              )}

              <div>
                <label
                  htmlFor="act-schedule-start"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  {isAr ? 'تاريخ بدء النشاط *' : 'Activity Start Date *'}
                </label>
                <input
                  id="act-schedule-start"
                  type="date"
                  value={actStartInput}
                  onChange={(e) => {
                    setActStartInput(e.target.value);
                    setActDateErrors((prev) => ({ ...prev, startDate: undefined, general: undefined }));
                  }}
                  disabled={savingActivityDates}
                  className={`w-full text-sm font-mono border rounded-lg px-3 py-2 ${
                    actDateErrors.startDate ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                  }`}
                />
                {actDateErrors.startDate && (
                  <p className="text-xs text-rose-600 mt-1">{actDateErrors.startDate}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="act-schedule-due"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  {isAr ? 'تاريخ استحقاق النشاط *' : 'Activity Due Date *'}
                </label>
                <input
                  id="act-schedule-due"
                  type="date"
                  value={actDueInput}
                  onChange={(e) => {
                    setActDueInput(e.target.value);
                    setActDateErrors((prev) => ({ ...prev, dueDate: undefined, general: undefined }));
                  }}
                  disabled={savingActivityDates}
                  className={`w-full text-sm font-mono border rounded-lg px-3 py-2 ${
                    actDateErrors.dueDate ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                  }`}
                />
                {actDateErrors.dueDate && (
                  <p className="text-xs text-rose-600 mt-1">{actDateErrors.dueDate}</p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingActivity(null)}
                  disabled={savingActivityDates}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={savingActivityDates}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  {savingActivityDates ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>{isAr ? 'حفظ التواريخ' : 'Save Schedule'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
