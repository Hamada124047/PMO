import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from './apiClient';
import {
  CheckSquare,
  FolderKanban,
  Plus,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Calendar,
  User,
  AlertTriangle,
  AlertCircle,
  Loader2,
  FileText,
  ExternalLink,
  RefreshCw,
  Layers
} from 'lucide-react';
import { Language, pickLocalized, translatePriority, translateRole, translateStatus } from './i18n';

export type ActivityStatus = 'Not Started' | 'In Progress' | 'Completed';
export type ActivityPriority = 'Low' | 'Medium' | 'High' | 'Critical';

export interface ActivityManagementItem {
  id: number;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  projectId: number;
  projectName: string | null;
  projectNameAr?: string | null;
  initiativeId?: number | null;
  initiativeName?: string | null;
  initiativeNameAr?: string | null;
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
  assignedUserName: string | null;
  assignedUserNameAr?: string | null;
  startDate: string;
  dueDate: string;
  status: ActivityStatus;
  priority: ActivityPriority;
  progressPercentage: number;
  isOverdue?: boolean;
  daysOverdue?: number;
  project?: {
    id: number;
    name: string;
    nameAr?: string;
    status: string;
    startDate: string;
    endDate: string;
  } | null;
  assignedUser?: {
    id: number;
    fullName: string;
    fullNameAr?: string;
    email: string;
    roleName: string | null;
  } | null;
}

interface ProjectOption {
  id: number;
  name: string;
  nameAr?: string;
  status: string;
  startDate: string;
  endDate: string;
  initiativeName?: string | null;
  initiativeNameAr?: string | null;
}

interface UserOption {
  id: number;
  fullName: string;
  fullNameAr?: string;
  roleName?: string;
}

interface PaginatedProjectActivitiesResponse {
  project: ProjectOption;
  items: ActivityManagementItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface ScheduleConflictActivity {
  id: number;
  name: string;
  nameAr?: string;
  projectId: number;
  projectName: string | null;
  projectNameAr?: string | null;
  startDate: string;
  dueDate: string;
  status: string;
}

export interface ActivityManagementViewProps {
  lang: Language;
  currentUserRole?: string;
  initialProjectId?: number | null;
  showBanner: (type: 'success' | 'error', text: string) => void;
  onDataChanged?: () => void;
  onNavigateToWorkspace?: (projectId: number) => void;
}

const VALID_ACTIVITY_STATUSES: ActivityStatus[] = ['Not Started', 'In Progress', 'Completed'];
const VALID_ACTIVITY_PRIORITIES: ActivityPriority[] = ['Low', 'Medium', 'High', 'Critical'];

export const ActivityManagementView: React.FC<ActivityManagementViewProps> = ({
  lang,
  currentUserRole = 'PMO Manager',
  initialProjectId = null,
  showBanner,
  onDataChanged,
  onNavigateToWorkspace
}) => {
  const isAr = lang === 'ar';
  const canManage = currentUserRole === 'PMO Manager' || currentUserRole === 'Project Manager';
  const canManageStatus =
    canManage || currentUserRole === 'Team Member';

  // Projects & Users Reference Data
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [projectsLoading, setProjectsLoading] = useState<boolean>(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  // Selected Project & Paginated Activities
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(initialProjectId);
  const [selectedProjectMeta, setSelectedProjectMeta] = useState<ProjectOption | null>(null);
  const [activities, setActivities] = useState<ActivityManagementItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Inline Status Update State
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);

  // Create / Edit Form Modal State
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    nameAr: string;
    description: string;
    descriptionAr: string;
    projectId: string;
    assignedUserId: string;
    status: ActivityStatus;
    priority: ActivityPriority;
    progressPercentage: string;
    startDate: string;
    dueDate: string;
  }>({
    name: '',
    nameAr: '',
    description: '',
    descriptionAr: '',
    projectId: '',
    assignedUserId: '',
    status: 'Not Started',
    priority: 'Medium',
    progressPercentage: '0',
    startDate: '2026-05-01',
    dueDate: '2026-06-30'
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formSubmitError, setFormSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [scheduleConflicts, setScheduleConflicts] = useState<ScheduleConflictActivity[]>([]);
  const [checkingConflicts, setCheckingConflicts] = useState<boolean>(false);
  const [originalEditSchedule, setOriginalEditSchedule] = useState<{
    assignedUserId: string;
    startDate: string;
    dueDate: string;
  } | null>(null);

  // Activity Details Drawer State
  const [detailActivityId, setDetailActivityId] = useState<number | null>(null);
  const [detailActivity, setDetailActivity] = useState<ActivityManagementItem | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Safe Delete Modal State
  const [deleteCandidate, setDeleteCandidate] = useState<ActivityManagementItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Sync incoming initialProjectId prop changes
  useEffect(() => {
    if (initialProjectId && initialProjectId > 0) {
      setSelectedProjectId(initialProjectId);
      setPage(1);
    }
  }, [initialProjectId]);

  // Load projects & users for selectors
  const fetchReferenceData = useCallback(async () => {
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      const [projRes, userRes] = await Promise.all([
        apiFetch('/api/projects'),
        canManage ? apiFetch('/api/users/options') : Promise.resolve(new Response('[]', { status: 200 }))
      ]);
      if (!projRes.ok) {
        throw new Error('Failed to load projects.');
      }
      const projData = await projRes.json();
      const projList: ProjectOption[] = (Array.isArray(projData) ? projData : projData.items || []).map(
        (p: any) => ({
          id: p.id,
          name: p.name,
          nameAr: p.nameAr || p.name,
          status: p.status,
          startDate: p.startDate,
          endDate: p.targetDate || p.endDate,
          initiativeName: p.initiativeName || null,
          initiativeNameAr: p.initiativeNameAr || p.initiativeName || null
        })
      );
      setProjects(projList);

      setSelectedProjectId((prev) => {
        if (prev && projList.some((p) => p.id === prev)) return prev;
        return projList.length > 0 ? projList[0].id : null;
      });

      if (userRes.ok) {
        const userData = await userRes.json();
        const userList: UserOption[] = (Array.isArray(userData) ? userData : userData.items || []).map(
          (u: any) => ({
            id: u.id,
            fullName: u.fullName,
            fullNameAr: u.fullNameAr || u.fullName,
            roleName: u.roleName
          })
        );
        setUsers(userList);
      }
    } catch (err) {
      console.error('Error loading activity management reference data:', err);
      setProjectsError(
        isAr ? 'تعذر تحميل قائمة المشاريع. يرجى إعادة المحاولة.' : 'Failed to load project list. Please retry.'
      );
    } finally {
      setProjectsLoading(false);
    }
  }, [isAr]);

  useEffect(() => {
    fetchReferenceData();
  }, [fetchReferenceData]);

  // Fetch paginated activities for selected project (Story 9.1 & 9.2)
  const fetchProjectActivities = useCallback(async () => {
    if (!selectedProjectId) {
      setActivities([]);
      setSelectedProjectMeta(null);
      setTotal(0);
      setTotalPages(1);
      return;
    }

    setLoading(true);
    setFetchError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));

      const res = await apiFetch(`/api/projects/${selectedProjectId}/activities?${params.toString()}`);
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.message || 'Failed to load project activities.');
      }

      const data: PaginatedProjectActivitiesResponse = await res.json();
      setSelectedProjectMeta(data.project || null);
      setActivities(Array.isArray(data.items) ? data.items : []);
      setTotal(typeof data.total === 'number' ? data.total : 0);
      setTotalPages(typeof data.totalPages === 'number' ? Math.max(1, data.totalPages) : 1);
    } catch (err: any) {
      console.error('Error fetching project activities:', err);
      setFetchError(
        isAr
          ? 'تعذر تحميل أنشطة المشروع المحدد. يرجى إعادة المحاولة.'
          : 'Failed to load project activities. Please retry.'
      );
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, page, pageSize, isAr]);

  useEffect(() => {
    fetchProjectActivities();
  }, [fetchProjectActivities]);

  // Live resource schedule overlap check when modal assignee or dates change (TC07)
  useEffect(() => {
    if (
      !isFormOpen ||
      !formData.assignedUserId ||
      !formData.startDate ||
      !formData.dueDate ||
      formData.dueDate < formData.startDate
    ) {
      setScheduleConflicts([]);
      setCheckingConflicts(false);
      return;
    }

    let cancelled = false;
    setCheckingConflicts(true);

    const params = new URLSearchParams();
    params.set('assignedUserId', formData.assignedUserId);
    params.set('startDate', formData.startDate);
    params.set('dueDate', formData.dueDate);
    if (editingId) {
      params.set('excludeActivityId', String(editingId));
    }

    apiFetch(`/api/activities/check-conflicts?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setScheduleConflicts(Array.isArray(data?.conflicts) ? data.conflicts : []);
      })
      .catch(() => {
        if (!cancelled) setScheduleConflicts([]);
      })
      .finally(() => {
        if (!cancelled) setCheckingConflicts(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isFormOpen, formData.assignedUserId, formData.startDate, formData.dueDate, editingId]);

  // Open Activity Details Drawer (Story 9.11 & 9.12)
  const handleOpenDetails = async (activityId: number) => {
    setDetailActivityId(activityId);
    setDetailLoading(true);
    setDetailError(null);
    setDetailActivity(null);

    try {
      const res = await apiFetch(`/api/activities/${activityId}`);
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.message || 'Failed to retrieve activity details.');
      }
      const data: ActivityManagementItem = await res.json();
      setDetailActivity(data);
    } catch (err: any) {
      console.error('Error fetching activity details:', err);
      setDetailError(
        err?.message ||
          (isAr ? 'تعذر تحميل تفاصيل النشاط. يرجى المحاولة مرة أخرى.' : 'Unable to load activity details.')
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetails = () => {
    setDetailActivityId(null);
    setDetailActivity(null);
    setDetailError(null);
  };

  // Open Create Modal (Story 9.3)
  const handleOpenCreate = () => {
    const activeProj = projects.find((p) => p.id === selectedProjectId) || projects[0] || null;
    setEditingId(null);
    setFormData({
      name: '',
      nameAr: '',
      description: '',
      descriptionAr: '',
      projectId: activeProj ? String(activeProj.id) : '',
      assignedUserId: '',
      status: 'Not Started',
      priority: 'Medium',
      progressPercentage: '0',
      startDate: activeProj?.startDate || '2026-05-01',
      dueDate: activeProj?.endDate || '2026-06-30'
    });
    setFormErrors({});
    setFormSubmitError(null);
    setScheduleConflicts([]);
    setOriginalEditSchedule(null);
    setIsFormOpen(true);
  };

  // Open Edit Modal (Story 9.5)
  const handleOpenEdit = (act: ActivityManagementItem) => {
    setEditingId(act.id);
    const resolvedStatus = VALID_ACTIVITY_STATUSES.includes(act.status) ? act.status : 'Not Started';
    const resolvedPct =
      typeof act.progressPercentage === 'number' && Number.isFinite(act.progressPercentage)
        ? Math.max(0, Math.min(100, Math.round(act.progressPercentage)))
        : resolvedStatus === 'Completed'
        ? 100
        : resolvedStatus === 'In Progress'
        ? 50
        : 0;
    const assignedStr = act.assignedUserId ? String(act.assignedUserId) : '';
    const startStr = act.startDate || '2026-05-01';
    const dueStr = act.dueDate || '2026-06-30';
    setFormData({
      name: act.name || '',
      nameAr: act.nameAr || act.name || '',
      description: act.description || '',
      descriptionAr: act.descriptionAr || act.description || '',
      projectId: String(act.projectId || selectedProjectId || ''),
      assignedUserId: assignedStr,
      status: resolvedStatus,
      priority: VALID_ACTIVITY_PRIORITIES.includes(act.priority) ? act.priority : 'Medium',
      progressPercentage: String(resolvedPct),
      startDate: startStr,
      dueDate: dueStr
    });
    setOriginalEditSchedule({
      assignedUserId: assignedStr,
      startDate: startStr,
      dueDate: dueStr
    });
    setFormErrors({});
    setFormSubmitError(null);
    setScheduleConflicts([]);
    setIsFormOpen(true);
  };

  const handleFormStatusChange = (nextStatus: ActivityStatus) => {
    setFormData((prev) => {
      const currentNum = Number(prev.progressPercentage);
      let nextProgress = prev.progressPercentage;
      if (nextStatus === 'Completed') {
        nextProgress = '100';
      } else if (nextStatus === 'Not Started') {
        nextProgress = '0';
      } else if (!Number.isFinite(currentNum) || currentNum <= 0 || currentNum >= 100) {
        nextProgress = '50';
      }
      return {
        ...prev,
        status: nextStatus,
        progressPercentage: nextProgress
      };
    });
  };

  const handleFormProgressChange = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === '') {
      setFormData((prev) => ({ ...prev, progressPercentage: '' }));
      return;
    }
    const num = Number(trimmed);
    if (!Number.isFinite(num)) {
      setFormData((prev) => ({ ...prev, progressPercentage: raw }));
      return;
    }
    const clamped = Math.max(0, Math.min(100, Math.round(num)));
    const nextStatus: ActivityStatus =
      clamped >= 100 ? 'Completed' : clamped <= 0 ? 'Not Started' : 'In Progress';
    setFormData((prev) => ({
      ...prev,
      progressPercentage: raw,
      status: nextStatus
    }));
  };

  // Client-side validation matching backend rules
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    const activeName = isAr
      ? formData.nameAr.trim() || formData.name.trim()
      : formData.name.trim() || formData.nameAr.trim();
    if (!activeName) {
      errors.name = isAr ? 'اسم النشاط مطلوب.' : 'Activity name is required.';
    }
    if (!formData.projectId) {
      errors.projectId = isAr ? 'يجب اختيار المشروع المرتبط.' : 'Associated project is required.';
    }
    const rawProgress = formData.progressPercentage.trim();
    const parsedProgress = Number(rawProgress);
    if (
      rawProgress === '' ||
      !Number.isFinite(parsedProgress) ||
      parsedProgress < 0 ||
      parsedProgress > 100
    ) {
      errors.progressPercentage = isAr
        ? 'يجب أن تكون نسبة الإنجاز رقماً بين 0 و 100.'
        : 'Completion percentage must be between 0 and 100.';
    }
    if (!formData.startDate) {
      errors.startDate = isAr ? 'تاريخ البدء مطلوب.' : 'Start date is required.';
    }
    if (!formData.dueDate) {
      errors.dueDate = isAr ? 'تاريخ الاستحقاق مطلوب.' : 'Due date is required.';
    }
    if (formData.startDate && formData.dueDate && formData.dueDate < formData.startDate) {
      errors.dueDate = isAr
        ? 'يجب أن يكون تاريخ الاستحقاق مساوياً أو لاحقاً لتاريخ البدء.'
        : 'Due date cannot be earlier than start date.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Create or Edit (Stories 9.3–9.6 & TC07)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitError(null);
    if (!validateForm()) return;

    const scheduleChangedOnEdit =
      !editingId ||
      !originalEditSchedule ||
      formData.assignedUserId !== originalEditSchedule.assignedUserId ||
      formData.startDate !== originalEditSchedule.startDate ||
      formData.dueDate !== originalEditSchedule.dueDate;

    if (scheduleConflicts.length > 0 && scheduleChangedOnEdit) {
      const first = scheduleConflicts[0];
      const assignedOpt = users.find((u) => String(u.id) === formData.assignedUserId);
      const userName = assignedOpt
        ? pickLocalized(lang, assignedOpt.fullName, assignedOpt.fullNameAr)
        : isAr
        ? 'المستخدم المحدد'
        : 'the selected team member';
      const conflictActName = pickLocalized(lang, first.name, first.nameAr);
      setFormSubmitError(
        isAr
          ? `لا يمكن الحفظ: يوجد تعارض في الجدول الزمني للمستخدم ${userName} مع النشاط "${conflictActName}" (${first.startDate} إلى ${first.dueDate}).`
          : `Cannot save: Scheduling conflict detected for ${userName}. Overlaps with "${conflictActName}" (${first.startDate} to ${first.dueDate}).`
      );
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: formData.name.trim() || formData.nameAr.trim(),
        nameAr: formData.nameAr.trim() || formData.name.trim(),
        description: formData.description.trim() || formData.descriptionAr.trim(),
        descriptionAr: formData.descriptionAr.trim() || formData.description.trim(),
        projectId: Number(formData.projectId),
        assignedUserId: formData.assignedUserId ? Number(formData.assignedUserId) : null,
        status: formData.status,
        priority: formData.priority,
        progressPercentage: Math.max(0, Math.min(100, Math.round(Number(formData.progressPercentage)))),
        startDate: formData.startDate,
        dueDate: formData.dueDate
      };

      const url = editingId ? `/api/activities/${editingId}` : '/api/activities';
      const method = editingId ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const body = await res.json().catch(() => null);
      if (!res.ok) {
        if (Array.isArray(body?.conflicts) && body.conflicts.length > 0) {
          setScheduleConflicts(body.conflicts);
        }
        const errMsg =
          (isAr ? body?.messageAr || body?.message : body?.message) ||
          (isAr ? 'فشل حفظ بيانات النشاط. يرجى مراجعة المدخلات.' : 'Failed to save activity.');
        setFormSubmitError(errMsg);
        return;
      }

      const displayActivityName = pickLocalized(
        lang,
        body?.name || payload.name,
        body?.nameAr || payload.nameAr
      );
      setIsFormOpen(false);
      showBanner(
        'success',
        editingId
          ? isAr
            ? `تم تحديث النشاط "${displayActivityName}" بنجاح.`
            : `Activity "${displayActivityName}" updated successfully.`
          : isAr
          ? `تم إنشاء النشاط "${displayActivityName}" بنجاح.`
          : `Activity "${displayActivityName}" created successfully.`
      );

      // If activity belongs to another project now, switch view to that project so user sees it immediately
      if (payload.projectId !== selectedProjectId) {
        setSelectedProjectId(payload.projectId);
        setPage(1);
      } else {
        await fetchProjectActivities();
      }

      if (detailActivityId && editingId === detailActivityId && body) {
        handleOpenDetails(detailActivityId);
      }

      onDataChanged?.();
    } catch (err) {
      console.error('Error saving activity:', err);
      setFormSubmitError(
        isAr ? 'حدث خطأ في الاتصال بالخادم أثناء الحفظ.' : 'Network error while saving activity.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Manage Activity Status (Stories 9.7 & 9.8)
  const handleStatusChange = async (activity: ActivityManagementItem, nextStatus: ActivityStatus) => {
    if (!canManageStatus || activity.status === nextStatus) return;

    setUpdatingStatusId(activity.id);
    try {
      const res = await apiFetch(`/api/activities/${activity.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });

      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          body?.message ||
            (isAr ? 'تعذر تحديث حالة النشاط.' : 'Failed to update activity status.')
        );
      }

      // Update local state immediately and reload list
      setActivities((prev) =>
        prev.map((item) =>
          item.id === activity.id
            ? {
                ...item,
                status: body.status,
                progressPercentage: body.progressPercentage,
                isOverdue: body.isOverdue,
                daysOverdue: body.daysOverdue
              }
            : item
        )
      );

      if (detailActivity && detailActivity.id === activity.id) {
        setDetailActivity((prev) =>
          prev
            ? {
                ...prev,
                status: body.status,
                progressPercentage: body.progressPercentage,
                isOverdue: body.isOverdue,
                daysOverdue: body.daysOverdue
              }
            : prev
        );
      }

      const displayActName = pickLocalized(lang, activity.name, activity.nameAr);
      showBanner(
        'success',
        isAr
          ? `تم تحديث حالة النشاط "${displayActName}" إلى ${translateStatus(nextStatus, 'ar')}.`
          : `Activity "${displayActName}" status updated to ${nextStatus}.`
      );
      onDataChanged?.();
    } catch (err: any) {
      console.error('Error updating activity status:', err);
      showBanner(
        'error',
        err?.message || (isAr ? 'فشل تحديث حالة النشاط.' : 'Failed to update activity status.')
      );
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Delete Activity Confirmation & Execution (Stories 9.9 & 9.10)
  const handleOpenDelete = (activity: ActivityManagementItem) => {
    setDeleteCandidate(activity);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteCandidate) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await apiFetch(`/api/activities/${deleteCandidate.id}`, {
        method: 'DELETE'
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          body?.message ||
          (isAr ? 'تعذر حذف النشاط المحدد.' : 'Failed to delete the selected activity.');
        setDeleteError(msg);
        showBanner('error', msg);
        return;
      }

      const deletedName = pickLocalized(lang, deleteCandidate.name, deleteCandidate.nameAr);
      const deletedId = deleteCandidate.id;
      setDeleteCandidate(null);
      if (detailActivityId === deletedId) {
        handleCloseDetails();
      }

      showBanner(
        'success',
        isAr
          ? `تم حذف النشاط "${deletedName}" بنجاح.`
          : `Activity "${deletedName}" deleted successfully.`
      );

      await fetchProjectActivities();
      onDataChanged?.();
    } catch (err) {
      console.error('Error deleting activity:', err);
      const msg = isAr
        ? 'حدث خطأ أثناء محاولة حذف النشاط.'
        : 'Network error while deleting activity.';
      setDeleteError(msg);
      showBanner('error', msg);
    } finally {
      setIsDeleting(false);
    }
  };

  // Helpers for badges
  const renderStatusBadge = (status: string) => {
    const styleMap: Record<string, string> = {
      Completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      'In Progress': 'bg-blue-50 text-blue-700 border-blue-200',
      'Not Started': 'bg-slate-100 text-slate-700 border-slate-200'
    };
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${
          styleMap[status] || 'bg-slate-100 text-slate-700 border-slate-200'
        }`}
      >
        {translateStatus(status, lang)}
      </span>
    );
  };

  const renderPriorityBadge = (priority: string) => {
    const styleMap: Record<string, string> = {
      Critical: 'bg-rose-50 text-rose-700 border-rose-200',
      High: 'bg-amber-50 text-amber-700 border-amber-200',
      Medium: 'bg-sky-50 text-sky-700 border-sky-200',
      Low: 'bg-slate-100 text-slate-600 border-slate-200'
    };
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border whitespace-nowrap ${
          styleMap[priority] || 'bg-slate-100 text-slate-600 border-slate-200'
        }`}
      >
        {translatePriority(priority, lang)}
      </span>
    );
  };

  const getActivityOverdueInfo = (act: Pick<ActivityManagementItem, 'status' | 'dueDate' | 'isOverdue' | 'daysOverdue'>) => {
    if (act.status === 'Completed') {
      return { isOverdue: false, daysOverdue: 0 };
    }
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;
    const isPastDue = Boolean(act.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(act.dueDate) && act.dueDate < todayIso);
    const overdue = typeof act.isOverdue === 'boolean' ? act.isOverdue || isPastDue : isPastDue;
    if (!overdue) {
      return { isOverdue: false, daysOverdue: 0 };
    }
    let days = typeof act.daysOverdue === 'number' && act.daysOverdue > 0 ? act.daysOverdue : 0;
    if (days === 0 && act.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(act.dueDate) && act.dueDate < todayIso) {
      const dueMs = new Date(`${act.dueDate}T00:00:00Z`).getTime();
      const todayMs = new Date(`${todayIso}T00:00:00Z`).getTime();
      days = Math.max(1, Math.round((todayMs - dueMs) / 86400000));
    }
    return { isOverdue: true, daysOverdue: days };
  };

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(total, page * pageSize);

  return (
    <div className="space-y-6">
      {/* ==================== PAGE HEADER ==================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/90 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <CheckSquare className="w-5 h-5" />
            </div>
            <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
              {isAr ? 'إدارة الأنشطة' : 'Activity Management'}
            </h1>
          </div>
          <p className="text-sm text-slate-600 mt-1.5">
            {isAr
              ? 'إنشاء وتحديث وإدارة الأنشطة المرتبطة بكل مشروع ومتابعة حالتها ومواعيد تسليمها.'
              : 'Create, update, assign, and manage individual project activities, statuses, and delivery dates.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={fetchProjectActivities}
            disabled={loading || !selectedProjectId}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{isAr ? 'تحديث' : 'Refresh'}</span>
          </button>

          {canManage && (
            <button
              type="button"
              onClick={handleOpenCreate}
              disabled={projects.length === 0}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{isAr ? 'نشاط جديد' : 'New Activity'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ==================== PROJECT SELECTOR & SUMMARY ==================== */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
        {projectsError ? (
          <div className="flex items-center justify-between gap-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{projectsError}</span>
            </div>
            <button
              type="button"
              onClick={fetchReferenceData}
              className="px-3 py-1 bg-white border border-rose-300 rounded-md font-semibold hover:bg-rose-100 cursor-pointer"
            >
              {isAr ? 'إعادة المحاولة' : 'Retry'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex-1 max-w-xl space-y-1">
              <label
                htmlFor="activity-project-selector"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
              >
                {isAr ? 'المشروع المحدد' : 'Selected Project'}
              </label>
              <div className="relative">
                <FolderKanban
                  className={`w-4 h-4 text-blue-600 absolute top-1/2 -translate-y-1/2 pointer-events-none ${
                    isAr ? 'right-3' : 'left-3'
                  }`}
                />
                <select
                  id="activity-project-selector"
                  value={selectedProjectId ?? ''}
                  disabled={projectsLoading || projects.length === 0}
                  onChange={(e) => {
                    const nextId = e.target.value ? Number(e.target.value) : null;
                    setSelectedProjectId(nextId);
                    setPage(1);
                  }}
                  className={`w-full text-sm font-semibold border border-slate-200 rounded-lg py-2.5 bg-slate-50/70 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 cursor-pointer ${
                    isAr ? 'pr-9 pl-4' : 'pl-9 pr-4'
                  }`}
                >
                  {projects.length === 0 ? (
                    <option value="">
                      {projectsLoading
                        ? isAr
                          ? 'جارٍ تحميل المشاريع...'
                          : 'Loading projects...'
                        : isAr
                        ? 'لا توجد مشاريع متاحة'
                        : 'No projects available'}
                    </option>
                  ) : (
                    projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        #{p.id} — {pickLocalized(lang, p.name, p.nameAr)}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {selectedProjectMeta && (
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 bg-slate-50 border border-slate-200/80 rounded-lg px-4 py-2.5">
                {selectedProjectMeta.initiativeName && (
                  <div>
                    <span className="text-slate-400 block text-[11px]">
                      {isAr ? 'المبادرة' : 'Initiative'}
                    </span>
                    <span className="font-semibold text-slate-800">
                      {pickLocalized(
                        lang,
                        selectedProjectMeta.initiativeName,
                        selectedProjectMeta.initiativeNameAr
                      )}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-slate-400 block text-[11px]">
                    {isAr ? 'حالة المشروع' : 'Project Status'}
                  </span>
                  <span className="font-semibold text-slate-800">
                    {translateStatus(selectedProjectMeta.status, lang)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">
                    {isAr ? 'الفترة المخططة' : 'Planned Window'}
                  </span>
                  <span className="font-mono font-semibold text-slate-800">
                    {selectedProjectMeta.startDate} → {selectedProjectMeta.endDate}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">
                    {isAr ? 'إجمالي الأنشطة' : 'Total Activities'}
                  </span>
                  <span className="font-mono font-bold text-blue-700">{total}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ==================== ERROR BANNER ==================== */}
      {fetchError && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 text-rose-800">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs sm:text-sm font-bold">{fetchError}</h3>
              <p className="text-xs text-rose-600 mt-0.5">
                {isAr
                  ? 'تحقق من اتصال الخادم ثم أعد المحاولة.'
                  : 'Verify server connectivity and try loading the project activities again.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchProjectActivities}
            className="px-3.5 py-1.5 bg-white hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg border border-rose-300 cursor-pointer transition-colors shrink-0 self-start sm:self-center"
          >
            {isAr ? 'إعادة المحاولة' : 'Retry'}
          </button>
        </div>
      )}

      {/* ==================== PROJECT ACTIVITIES TABLE ==================== */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {loading || projectsLoading ? (
          <div className="p-12 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
            <p className="text-sm text-slate-500">
              {isAr ? 'جارٍ تحميل أنشطة المشروع...' : 'Retrieving project activities...'}
            </p>
          </div>
        ) : !selectedProjectId ? (
          <div className="p-12 text-center space-y-3">
            <FolderKanban className="w-8 h-8 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">
              {isAr ? 'لا توجد مشاريع متاحة' : 'No projects available'}
            </h3>
            <p className="text-xs text-slate-500">
              {isAr
                ? 'قم بإنشاء مشروع أولاً للبدء في إدارة أنشطته.'
                : 'Create a project first to manage its activities.'}
            </p>
          </div>
        ) : fetchError && activities.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">{fetchError}</h3>
            <button
              type="button"
              onClick={fetchProjectActivities}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              {isAr ? 'إعادة التحميل' : 'Retry'}
            </button>
          </div>
        ) : activities.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <CheckSquare className="w-8 h-8 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">
              {isAr
                ? 'لا توجد أنشطة مسجلة لهذا المشروع'
                : 'No activities exist for this project'}
            </h3>
            <p className="text-xs text-slate-500">
              {isAr
                ? 'أضف أول نشاط لهذا المشروع لتحديد العمل المطلوب وتواريخ التسليم.'
                : 'Create the first activity for this project to track deliverables and due dates.'}
            </p>
            {canManage && (
              <button
                type="button"
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAr ? 'إنشاء نشاط جديد' : 'Create Activity'}</span>
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
                    <th className="py-3.5 px-4 text-start">{isAr ? 'النشاط' : 'Activity'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'المكلف' : 'Assigned User'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'نسبة الإنجاز' : 'Completion'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'الأولوية' : 'Priority'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'تاريخ البدء' : 'Start Date'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'تاريخ الاستحقاق' : 'Due Date'}</th>
                    <th className="py-3.5 px-4 text-end">{isAr ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 text-sm">
                  {activities.map((act) => {
                    const overdueInfo = getActivityOverdueInfo(act);
                    return (
                    <tr
                      key={act.id}
                      onClick={() => handleOpenDetails(act.id)}
                      className={`hover:bg-blue-50/40 transition-colors cursor-pointer group ${
                        overdueInfo.isOverdue ? 'bg-rose-50/25' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-500 tabular-nums">
                        #{act.id}
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {pickLocalized(lang, act.name, act.nameAr)}
                          </span>
                          {overdueInfo.isOverdue && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 whitespace-nowrap">
                              <AlertTriangle className="w-3 h-3" />
                              <span>{isAr ? 'متأخر' : 'Overdue'}</span>
                            </span>
                          )}
                        </div>
                        {(act.description || act.descriptionAr) && (
                          <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                            {pickLocalized(lang, act.description, act.descriptionAr)}
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
                              ? 'غير مسند'
                              : 'Unassigned'}
                          </span>
                        </div>
                      </td>

                      <td
                        className="py-3.5 px-4 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {canManageStatus ? (
                          <div className="inline-flex items-center gap-1.5">
                            <select
                              value={act.status}
                              disabled={updatingStatusId === act.id}
                              onChange={(e) =>
                                handleStatusChange(act, e.target.value as ActivityStatus)
                              }
                              aria-label={
                                isAr
                                  ? `تحديث حالة ${pickLocalized(lang, act.name, act.nameAr)}`
                                  : `Status for ${pickLocalized(lang, act.name, act.nameAr)}`
                              }
                              className={`text-xs font-semibold rounded-lg border px-2.5 py-1 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 ${
                                act.status === 'Completed'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : act.status === 'In Progress'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {VALID_ACTIVITY_STATUSES.map((st) => (
                                <option key={st} value={st}>
                                  {translateStatus(st, lang)}
                                </option>
                              ))}
                            </select>
                            {updatingStatusId === act.id && (
                              <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                            )}
                          </div>
                        ) : (
                          renderStatusBadge(act.status)
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 min-w-[96px]">
                          <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                (act.progressPercentage ?? 0) >= 100
                                  ? 'bg-emerald-600'
                                  : (act.progressPercentage ?? 0) > 0
                                  ? 'bg-blue-600'
                                  : 'bg-slate-300'
                              }`}
                              style={{ width: `${Math.max(0, Math.min(100, act.progressPercentage ?? 0))}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs font-semibold text-slate-700 tabular-nums">
                            {Math.max(0, Math.min(100, act.progressPercentage ?? 0))}%
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {renderPriorityBadge(act.priority || 'Medium')}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                        {act.startDate}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs tabular-nums whitespace-nowrap">
                        {overdueInfo.isOverdue ? (
                          <div className="space-y-1">
                            <div className="font-semibold text-rose-700">{act.dueDate}</div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 font-sans">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span>
                                {overdueInfo.daysOverdue > 0
                                  ? isAr
                                    ? `متأخر ${overdueInfo.daysOverdue} يوم`
                                    : `Overdue (${overdueInfo.daysOverdue}d)`
                                  : isAr
                                  ? 'متأخر'
                                  : 'Overdue'}
                              </span>
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-600">{act.dueDate}</span>
                        )}
                      </td>

                      <td
                        className="py-3.5 px-4 text-end whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(act.id)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                            title={isAr ? 'عرض تفاصيل النشاط' : 'View activity details'}
                          >
                            <ChevronRight className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} />
                          </button>

                          {canManage && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(act)}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer transition-colors"
                                title={isAr ? 'تعديل النشاط' : 'Edit activity'}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenDelete(act)}
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                                title={isAr ? 'حذف النشاط' : 'Delete activity'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
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
                  aria-label={isAr ? 'عدد الأنشطة في الصفحة' : 'Activities per page'}
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

      {/* ==================== CREATE / EDIT ACTIVITY MODAL ==================== */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            onClick={() => !isSaving && setIsFormOpen(false)}
          />
          <div
            className={`relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 z-10 overflow-hidden ${
              isAr ? 'text-right' : 'text-left'
            }`}
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                  <CheckSquare className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900">
                  {editingId
                    ? isAr
                      ? 'تعديل النشاط'
                      : 'Edit Activity'
                    : isAr
                    ? 'إنشاء نشاط جديد'
                    : 'Create New Activity'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => !isSaving && setIsFormOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {formSubmitError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-xs text-rose-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formSubmitError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isAr ? 'اسم النشاط' : 'Activity Name'} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={isAr ? formData.nameAr : formData.name}
                  onChange={(e) =>
                    setFormData(
                      isAr
                        ? { ...formData, nameAr: e.target.value }
                        : { ...formData, name: e.target.value }
                    )
                  }
                  placeholder={isAr ? 'أدخل اسم النشاط...' : 'Enter activity name...'}
                  className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 ${
                    formErrors.name ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                  }`}
                />
                {formErrors.name && (
                  <p className="text-xs text-rose-600 mt-1">{formErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isAr ? 'الوصف' : 'Description'}
                </label>
                <textarea
                  rows={3}
                  value={isAr ? formData.descriptionAr : formData.description}
                  onChange={(e) =>
                    setFormData(
                      isAr
                        ? { ...formData, descriptionAr: e.target.value }
                        : { ...formData, description: e.target.value }
                    )
                  }
                  placeholder={
                    isAr ? 'وصف نطاق العمل والمخرجات المتوقعة...' : 'Describe activity scope and deliverables...'
                  }
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isAr ? 'المشروع' : 'Project'} <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.projectId}
                    onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                    className={`w-full text-sm border rounded-lg px-3 py-2 bg-white cursor-pointer ${
                      formErrors.projectId ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                    }`}
                  >
                    <option value="">{isAr ? 'اختر المشروع...' : 'Select project...'}</option>
                    {projects.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {pickLocalized(lang, p.name, p.nameAr)}
                      </option>
                    ))}
                  </select>
                  {formErrors.projectId && (
                    <p className="text-xs text-rose-600 mt-1">{formErrors.projectId}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isAr ? 'المستخدم المكلف' : 'Assigned User'}
                  </label>
                  <select
                    value={formData.assignedUserId}
                    onChange={(e) => {
                      setFormSubmitError(null);
                      setFormData({ ...formData, assignedUserId: e.target.value });
                    }}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white cursor-pointer"
                  >
                    <option value="">{isAr ? 'غير مسند' : 'Unassigned'}</option>
                    {users.map((u) => (
                      <option key={u.id} value={String(u.id)}>
                        {pickLocalized(lang, u.fullName, u.fullNameAr)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isAr ? 'الحالة' : 'Status'}
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => handleFormStatusChange(e.target.value as ActivityStatus)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white cursor-pointer"
                  >
                    {VALID_ACTIVITY_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {translateStatus(st, lang)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isAr ? 'الأولوية' : 'Priority'}
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: e.target.value as ActivityPriority })
                    }
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white cursor-pointer"
                  >
                    {VALID_ACTIVITY_PRIORITIES.map((pr) => (
                      <option key={pr} value={pr}>
                        {translatePriority(pr, lang)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="activity-completion-percentage"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    {isAr ? 'نسبة الإنجاز (%)' : 'Completion Percentage (%)'}
                  </label>
                  <span className="text-xs font-mono font-bold text-blue-700 tabular-nums">
                    {formData.progressPercentage.trim() !== '' &&
                    Number.isFinite(Number(formData.progressPercentage))
                      ? `${Math.max(0, Math.min(100, Math.round(Number(formData.progressPercentage))))}%`
                      : '0%'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative w-28 shrink-0">
                    <input
                      id="activity-completion-percentage"
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={formData.progressPercentage}
                      onChange={(e) => handleFormProgressChange(e.target.value)}
                      placeholder="0"
                      className={`w-full text-sm border rounded-lg px-3 py-2 font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 ${
                        isAr ? 'pl-7' : 'pr-7'
                      } ${
                        formErrors.progressPercentage ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                      }`}
                    />
                    <span
                      className={`absolute top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400 pointer-events-none ${
                        isAr ? 'left-2.5' : 'right-2.5'
                      }`}
                    >
                      %
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    aria-label={isAr ? 'شريط نسبة الإنجاز' : 'Completion percentage slider'}
                    value={
                      formData.progressPercentage.trim() !== '' &&
                      Number.isFinite(Number(formData.progressPercentage))
                        ? Math.max(0, Math.min(100, Math.round(Number(formData.progressPercentage))))
                        : 0
                    }
                    onChange={(e) => handleFormProgressChange(e.target.value)}
                    className="flex-1 accent-blue-600 cursor-pointer"
                  />
                </div>
                {formErrors.progressPercentage && (
                  <p className="text-xs text-rose-600 mt-1">{formErrors.progressPercentage}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isAr ? 'تاريخ البدء' : 'Start Date'} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => {
                      setFormSubmitError(null);
                      setFormData({ ...formData, startDate: e.target.value });
                    }}
                    className={`w-full text-sm border rounded-lg px-3 py-2 font-mono ${
                      formErrors.startDate || scheduleConflicts.length > 0
                        ? 'border-rose-400 bg-rose-50/30'
                        : 'border-slate-200'
                    }`}
                  />
                  {formErrors.startDate && (
                    <p className="text-xs text-rose-600 mt-1">{formErrors.startDate}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isAr ? 'تاريخ الاستحقاق' : 'Due Date'} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => {
                      setFormSubmitError(null);
                      setFormData({ ...formData, dueDate: e.target.value });
                    }}
                    className={`w-full text-sm border rounded-lg px-3 py-2 font-mono ${
                      formErrors.dueDate || scheduleConflicts.length > 0
                        ? 'border-rose-400 bg-rose-50/30'
                        : 'border-slate-200'
                    }`}
                  />
                  {formErrors.dueDate && (
                    <p className="text-xs text-rose-600 mt-1">{formErrors.dueDate}</p>
                  )}
                </div>
              </div>

              {(checkingConflicts || scheduleConflicts.length > 0) && (
                <div
                  role="alert"
                  className={`rounded-xl border p-3.5 text-xs ${
                    scheduleConflicts.length > 0
                      ? 'bg-amber-50 border-amber-300 text-amber-900'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  {checkingConflicts && scheduleConflicts.length === 0 ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />
                      <span>
                        {isAr
                          ? 'جارٍ التحقق من تعارضات الجدول الزمني...'
                          : 'Checking team member schedule conflicts...'}
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <div className="font-bold text-amber-950">
                            {isAr
                              ? 'تم اكتشاف تعارض في الجدول الزمني'
                              : 'Scheduling Conflict Detected'}
                          </div>
                          <p className="text-amber-800">
                            {isAr
                              ? 'المستخدم المكلف لديه أنشطة أخرى متداخلة خلال الفترة الزمنية المحددة:'
                              : 'The assigned team member is already scheduled on overlapping activity dates:'}
                          </p>
                        </div>
                      </div>
                      <ul className="space-y-1 ps-6 list-disc">
                        {scheduleConflicts.map((c) => (
                          <li key={c.id} className="text-[11px] text-amber-900">
                            <span className="font-semibold">
                              {pickLocalized(lang, c.name, c.nameAr)}
                            </span>
                            {c.projectName && (
                              <span className="text-amber-700">
                                {' '}
                                ({pickLocalized(lang, c.projectName, c.projectNameAr)})
                              </span>
                            )}
                            <span className="font-mono font-semibold ms-1.5">
                              [{c.startDate} → {c.dueDate}]
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  disabled={isSaving}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>
                    {editingId
                      ? isAr
                        ? 'حفظ التعديلات'
                        : 'Save Changes'
                      : isAr
                      ? 'إنشاء النشاط'
                      : 'Create Activity'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== ACTIVITY DETAILS DRAWER (STORIES 9.11 & 9.12) ==================== */}
      {detailActivityId !== null && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={handleCloseDetails}
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
                  <CheckSquare className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900 truncate">
                    {detailActivity
                      ? pickLocalized(lang, detailActivity.name, detailActivity.nameAr)
                      : isAr
                      ? 'تفاصيل النشاط'
                      : 'Activity Details'}
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">
                    {isAr ? `المعرف #${detailActivityId}` : `ID #${detailActivityId}`}
                    {detailActivity?.status
                      ? ` · ${translateStatus(detailActivity.status, lang)}`
                      : ''}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {onNavigateToWorkspace && detailActivity && (
                  <button
                    type="button"
                    onClick={() => {
                      const pid = detailActivity.projectId;
                      handleCloseDetails();
                      onNavigateToWorkspace(pid);
                    }}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg border border-slate-200 cursor-pointer"
                    title={isAr ? 'فتح مساحة عمل المشروع' : 'Open project workspace'}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                )}
                {canManage && detailActivity && (
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(detailActivity)}
                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200 cursor-pointer"
                    title={isAr ? 'تعديل النشاط' : 'Edit activity'}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCloseDetails}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
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
                    onClick={() => handleOpenDetails(detailActivityId)}
                    className="px-3.5 py-1.5 bg-white hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg border border-rose-300 cursor-pointer"
                  >
                    {isAr ? 'إعادة المحاولة' : 'Retry'}
                  </button>
                </div>
              ) : detailActivity ? (
                <>
                  {/* Overdue Warning Banner in Drawer */}
                  {(() => {
                    const detailOverdue = getActivityOverdueInfo(detailActivity);
                    if (!detailOverdue.isOverdue) return null;
                    return (
                      <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-900">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <div className="font-bold text-rose-950">
                            {isAr ? 'نشاط متأخر عن موعد التسليم' : 'Overdue Activity'}
                          </div>
                          <p className="text-rose-700">
                            {isAr
                              ? `تجاوز هذا النشاط تاريخ استحقاقه (${detailActivity.dueDate})${
                                  detailOverdue.daysOverdue > 0
                                    ? ` بمقدار ${detailOverdue.daysOverdue} يوم`
                                    : ''
                                } ولم يكتمل بعد.`
                              : `This activity passed its due date (${detailActivity.dueDate})${
                                  detailOverdue.daysOverdue > 0
                                    ? ` by ${detailOverdue.daysOverdue} day(s)`
                                    : ''
                                } and is not yet completed.`}
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Description */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      <span>{isAr ? 'وصف النشاط' : 'Description'}</span>
                    </div>
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-700 leading-relaxed">
                      {pickLocalized(lang, detailActivity.description, detailActivity.descriptionAr) ||
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
                          detailActivity.project?.name || detailActivity.projectName,
                          detailActivity.project?.nameAr || detailActivity.projectNameAr
                        ) || '—'}
                      </div>
                      {detailActivity.initiativeName && (
                        <div className="text-[11px] text-slate-500">
                          {pickLocalized(
                            lang,
                            detailActivity.initiativeName,
                            detailActivity.initiativeNameAr
                          )}
                        </div>
                      )}
                    </div>

                    <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1">
                      <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        <span>{isAr ? 'المستخدم المكلف' : 'Assigned User'}</span>
                      </span>
                      <div className="text-xs font-bold text-slate-900">
                        {pickLocalized(
                          lang,
                          detailActivity.assignedUser?.fullName || detailActivity.assignedUserName,
                          detailActivity.assignedUser?.fullNameAr || detailActivity.assignedUserNameAr
                        ) || (isAr ? 'غير مسند' : 'Unassigned')}
                      </div>
                      {detailActivity.assignedUser?.roleName && (
                        <div className="text-[11px] text-slate-500">
                          {translateRole(detailActivity.assignedUser.roleName, lang)}
                        </div>
                      )}
                    </div>

                    <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1">
                      <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{isAr ? 'تاريخ البدء والاستحقاق' : 'Schedule Dates'}</span>
                      </span>
                      <div className="text-xs font-bold font-mono text-slate-900">
                        {detailActivity.startDate} → {detailActivity.dueDate}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1.5">
                      <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5" />
                        <span>{isAr ? 'الحالة والأولوية' : 'Status & Priority'}</span>
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        {renderStatusBadge(detailActivity.status)}
                        {renderPriorityBadge(detailActivity.priority || 'Medium')}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-2 sm:col-span-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-400">
                          {isAr ? 'نسبة الإنجاز' : 'Completion Percentage'}
                        </span>
                        <span className="font-mono text-xs font-bold text-blue-700 tabular-nums">
                          {Math.max(0, Math.min(100, detailActivity.progressPercentage ?? 0))}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            (detailActivity.progressPercentage ?? 0) >= 100
                              ? 'bg-emerald-600'
                              : (detailActivity.progressPercentage ?? 0) > 0
                              ? 'bg-blue-600'
                              : 'bg-slate-300'
                          }`}
                          style={{
                            width: `${Math.max(0, Math.min(100, detailActivity.progressPercentage ?? 0))}%`
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Quick Status Management inside Details Drawer (Story 9.7) */}
                  {canManageStatus && (
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                      <label className="block text-xs font-bold text-slate-700">
                        {isAr ? 'تحديث حالة النشاط' : 'Update Activity Status'}
                      </label>
                      <div className="flex items-center gap-2">
                        <select
                          value={detailActivity.status}
                          disabled={updatingStatusId === detailActivity.id}
                          onChange={(e) =>
                            handleStatusChange(detailActivity, e.target.value as ActivityStatus)
                          }
                          className="flex-1 text-xs sm:text-sm font-semibold border border-slate-200 rounded-lg px-3 py-2 bg-white cursor-pointer"
                        >
                          {VALID_ACTIVITY_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {translateStatus(st, lang)}
                            </option>
                          ))}
                        </select>
                        {updatingStatusId === detailActivity.id && (
                          <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Additional Project Relationships if present */}
                  {(detailActivity.workstreamName ||
                    detailActivity.milestoneName ||
                    detailActivity.parentActivityName) && (
                    <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 text-xs">
                      <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                        {isAr ? 'ارتباطات إضافية' : 'Additional Context'}
                      </h4>
                      {detailActivity.workstreamName && (
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-500">
                            {isAr ? 'مسار العمل:' : 'Workstream:'}
                          </span>
                          <span className="font-semibold text-slate-800">
                            {pickLocalized(
                              lang,
                              detailActivity.workstreamName,
                              detailActivity.workstreamNameAr
                            )}
                          </span>
                        </div>
                      )}
                      {detailActivity.milestoneName && (
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-500">
                            {isAr ? 'المعلم الرئيسي:' : 'Milestone:'}
                          </span>
                          <span className="font-semibold text-slate-800">
                            {pickLocalized(
                              lang,
                              detailActivity.milestoneName,
                              detailActivity.milestoneNameAr
                            )}
                          </span>
                        </div>
                      )}
                      {detailActivity.parentActivityName && (
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-500">
                            {isAr ? 'النشاط الرئيسي:' : 'Parent Activity:'}
                          </span>
                          <span className="font-semibold text-slate-800">
                            {pickLocalized(
                              lang,
                              detailActivity.parentActivityName,
                              detailActivity.parentActivityNameAr
                            )}
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
              {canManage && detailActivity ? (
                <button
                  type="button"
                  onClick={() => handleOpenDelete(detailActivity)}
                  className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isAr ? 'حذف النشاط' : 'Delete Activity'}</span>
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={handleCloseDetails}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== DELETE CONFIRMATION MODAL (STORIES 9.9 & 9.10) ==================== */}
      {deleteCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            onClick={() => !isDeleting && setDeleteCandidate(null)}
          />
          <div
            className={`relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 z-10 p-6 space-y-4 ${
              isAr ? 'text-right' : 'text-left'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {isAr ? 'تأكيد حذف النشاط' : 'Confirm Activity Deletion'}
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  {isAr
                    ? `هل أنت متأكد من رغبتك في حذف النشاط "${pickLocalized(lang, deleteCandidate.name, deleteCandidate.nameAr)}"؟`
                    : `Are you sure you want to delete activity "${pickLocalized(lang, deleteCandidate.name, deleteCandidate.nameAr)}"?`}
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-rose-800">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isAr ? 'تأكيد الحذف' : 'Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
