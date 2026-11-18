import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from './apiClient';
import {
  FolderKanban,
  Search,
  RotateCcw,
  Plus,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Calendar,
  User,
  Compass,
  AlertTriangle,
  AlertCircle,
  Loader2,
  CheckCircle2,
  FileText,
  ExternalLink,
  Layers,
  CheckSquare
} from 'lucide-react';
import { Language, pickLocalized, translatePriority, translateStatus } from './i18n';

export interface ProjectActivityItem {
  id: number;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  status: string;
  priority: string | null;
  assignedUserId: number | null;
  assignedUserName: string | null;
  assignedUserNameAr?: string | null;
  startDate: string;
  dueDate: string;
  progressPercentage: number | null;
  workstreamName?: string | null;
  workstreamNameAr?: string | null;
  milestoneName?: string | null;
  milestoneNameAr?: string | null;
  parentActivityName?: string | null;
  parentActivityNameAr?: string | null;
}

export interface ProjectManagementItem {
  id: number;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  initiativeId: number;
  initiativeName: string | null;
  initiativeNameAr?: string | null;
  projectManagerId: number | null;
  projectManagerName: string | null;
  projectManagerNameAr?: string | null;
  ownerId?: number | null;
  ownerName?: string | null;
  ownerNameAr?: string | null;
  startDate: string;
  endDate: string;
  targetDate?: string;
  status: 'Planned' | 'In Progress' | 'On Hold' | 'Completed' | 'Cancelled';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  progressPercentage: number;
  activityCount: number;
  activities?: ProjectActivityItem[];
}

interface InitiativeOption {
  id: number;
  name: string;
  nameAr?: string;
}

interface UserOption {
  id: number;
  fullName: string;
  fullNameAr?: string;
}

interface PaginatedProjectsResponse {
  items: ProjectManagementItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filters?: {
    initiatives: InitiativeOption[];
    statuses: string[];
  };
}

export interface ProjectManagementViewProps {
  lang: Language;
  currentUserRole?: string;
  showBanner: (type: 'success' | 'error', text: string) => void;
  onNavigateToWorkspace?: (projectId: number) => void;
  onManageActivities?: (projectId: number) => void;
  onPlanSchedule?: (projectId: number) => void;
}

const VALID_PROJECT_STATUSES: ProjectManagementItem['status'][] = [
  'Planned',
  'In Progress',
  'On Hold',
  'Completed',
  'Cancelled'
];

const VALID_PROJECT_PRIORITIES: ProjectManagementItem['priority'][] = [
  'Low',
  'Medium',
  'High',
  'Critical'
];

export const ProjectManagementView: React.FC<ProjectManagementViewProps> = ({
  lang,
  currentUserRole = 'PMO Manager',
  showBanner,
  onNavigateToWorkspace,
  onManageActivities,
  onPlanSchedule
}) => {
  const isAr = lang === 'ar';
  const canManage = currentUserRole === 'PMO Manager' || currentUserRole === 'Project Manager';

  // Registry & Pagination State
  const [projects, setProjects] = useState<ProjectManagementItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Reference Options
  const [initiatives, setInitiatives] = useState<InitiativeOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);

  // Loading & Error States
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Search & Filter States
  const [searchInput, setSearchInput] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [initiativeFilter, setInitiativeFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Form Modal State (Create / Edit)
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    nameAr: string;
    description: string;
    descriptionAr: string;
    initiativeId: string;
    ownerId: string;
    status: ProjectManagementItem['status'];
    priority: ProjectManagementItem['priority'];
    startDate: string;
    targetDate: string;
  }>({
    name: '',
    nameAr: '',
    description: '',
    descriptionAr: '',
    initiativeId: '',
    ownerId: '',
    status: 'Planned',
    priority: 'Medium',
    startDate: '2026-03-01',
    targetDate: '2026-12-31'
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formSubmitError, setFormSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Details Drawer & Activity Detail State
  const [detailProjectId, setDetailProjectId] = useState<number | null>(null);
  const [detailProject, setDetailProject] = useState<ProjectManagementItem | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<ProjectActivityItem | null>(null);

  // Safe Deletion Modal State
  const [deleteCandidate, setDeleteCandidate] = useState<ProjectManagementItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [blockingActivities, setBlockingActivities] = useState<
    { id: number; name: string; nameAr?: string; status: string }[]
  >([]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Load Initiatives & Users for dropdowns
  const fetchReferenceData = useCallback(async () => {
    try {
      const [initRes, userRes] = await Promise.all([
        apiFetch('/api/initiatives'),
        canManage ? apiFetch('/api/users/options') : Promise.resolve(new Response('[]', { status: 200 }))
      ]);
      if (initRes.ok) {
        const initData = await initRes.json();
        const list = Array.isArray(initData) ? initData : initData.items || [];
        setInitiatives(list.map((i: any) => ({ id: i.id, name: i.name, nameAr: i.nameAr })));
      }
      if (userRes.ok) {
        const userData = await userRes.json();
        const list = Array.isArray(userData) ? userData : userData.items || [];
        setUsers(list.map((u: any) => ({ id: u.id, fullName: u.fullName, fullNameAr: u.fullNameAr })));
      }
    } catch (err) {
      console.error('Error loading project reference options:', err);
    }
  }, [canManage]);

  useEffect(() => {
    fetchReferenceData();
  }, [fetchReferenceData]);

  // Fetch paginated projects from backend
  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (initiativeFilter !== 'All') params.set('initiativeId', initiativeFilter);
      if (statusFilter !== 'All') params.set('status', statusFilter);

      const res = await apiFetch(`/api/projects?${params.toString()}`);
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.message || 'Failed to retrieve projects.');
      }

      const data: PaginatedProjectsResponse = await res.json();
      setProjects(Array.isArray(data.items) ? data.items : []);
      setTotal(typeof data.total === 'number' ? data.total : 0);
      setTotalPages(typeof data.totalPages === 'number' ? Math.max(1, data.totalPages) : 1);
      if (data.filters?.initiatives && initiatives.length === 0) {
        setInitiatives(data.filters.initiatives);
      }
    } catch (err: any) {
      console.error('Error fetching projects:', err);
      const msg = isAr
        ? 'تعذر تحميل سجل المشاريع. يرجى إعادة المحاولة.'
        : 'Failed to load project registry. Please retry.';
      setFetchError(msg);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, initiativeFilter, statusFilter, isAr, initiatives.length]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const hasActiveFilters =
    searchInput.trim() !== '' || initiativeFilter !== 'All' || statusFilter !== 'All';

  const handleClearFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setInitiativeFilter('All');
    setStatusFilter('All');
    setPage(1);
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({
      name: '',
      nameAr: '',
      description: '',
      descriptionAr: '',
      initiativeId: initiatives[0] ? String(initiatives[0].id) : '',
      ownerId: users[0] ? String(users[0].id) : '',
      status: 'Planned',
      priority: 'Medium',
      startDate: '2026-03-01',
      targetDate: '2026-12-31'
    });
    setFormErrors({});
    setFormSubmitError(null);
    setIsFormOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (proj: ProjectManagementItem) => {
    setEditingId(proj.id);
    setFormData({
      name: proj.name,
      nameAr: proj.nameAr || proj.name,
      description: proj.description || '',
      descriptionAr: proj.descriptionAr || proj.description || '',
      initiativeId: proj.initiativeId ? String(proj.initiativeId) : '',
      ownerId: (proj.ownerId ?? proj.projectManagerId) ? String(proj.ownerId ?? proj.projectManagerId) : '',
      status: proj.status,
      priority: proj.priority,
      startDate: proj.startDate || '2026-03-01',
      targetDate: proj.targetDate || proj.endDate || '2026-12-31'
    });
    setFormErrors({});
    setFormSubmitError(null);
    setIsFormOpen(true);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    const activeName = isAr ? (formData.nameAr.trim() || formData.name.trim()) : (formData.name.trim() || formData.nameAr.trim());
    if (!activeName) {
      errors.name = isAr ? 'اسم المشروع مطلوب.' : 'Project name is required.';
    }
    if (!formData.initiativeId) {
      errors.initiativeId = isAr ? 'المبادرة المرتبطة مطلوبة.' : 'Associated initiative is required.';
    }
    if (!formData.startDate) {
      errors.startDate = isAr ? 'تاريخ البدء مطلوب.' : 'Start date is required.';
    }
    if (!formData.targetDate) {
      errors.targetDate = isAr ? 'التاريخ المستهدف مطلوب.' : 'Target date is required.';
    }
    if (formData.startDate && formData.targetDate && formData.targetDate < formData.startDate) {
      errors.targetDate = isAr
        ? 'التاريخ المستهدف لا يمكن أن يكون قبل تاريخ البدء.'
        : 'Target date cannot be earlier than start date.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitError(null);
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const enName = formData.name.trim() || formData.nameAr.trim();
      const arName = formData.nameAr.trim() || formData.name.trim();
      const enDesc = formData.description.trim() || formData.descriptionAr.trim();
      const arDesc = formData.descriptionAr.trim() || formData.description.trim();
      const payload = {
        name: enName,
        nameAr: arName,
        description: enDesc,
        descriptionAr: arDesc,
        initiativeId: Number(formData.initiativeId),
        ownerId: formData.ownerId ? Number(formData.ownerId) : null,
        projectManagerId: formData.ownerId ? Number(formData.ownerId) : null,
        status: formData.status,
        priority: formData.priority,
        startDate: formData.startDate,
        targetDate: formData.targetDate,
        endDate: formData.targetDate
      };

      const url = editingId ? `/api/projects/${editingId}` : '/api/projects';
      const method = editingId ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.message || (isAr ? 'فشل حفظ بيانات المشروع.' : 'Failed to save project.'));
      }

      const savedDisplayName = pickLocalized(lang, body?.name || enName, body?.nameAr || arName);
      setIsFormOpen(false);
      showBanner(
        'success',
        editingId
          ? isAr
            ? `تم تحديث المشروع "${savedDisplayName}" بنجاح.`
            : `Project "${savedDisplayName}" updated successfully.`
          : isAr
          ? `تم إنشاء المشروع "${savedDisplayName}" بنجاح.`
          : `Project "${savedDisplayName}" created successfully.`
      );
      await fetchProjects();

      if (detailProjectId && detailProjectId === editingId) {
        handleOpenDetails(body);
      }
    } catch (err: any) {
      const msg =
        err?.message ||
        (isAr ? 'حدث خطأ أثناء حفظ بيانات المشروع.' : 'Failed to save project information.');
      setFormSubmitError(msg);
      showBanner('error', msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Open Project Details & Associated Activities Drawer
  const handleOpenDetails = async (proj: ProjectManagementItem) => {
    setDetailProjectId(proj.id);
    setDetailProject(proj);
    setDetailError(null);
    setSelectedActivity(null);
    setDetailLoading(true);

    try {
      const res = await apiFetch(`/api/projects/${proj.id}`);
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.message || 'Failed to load project details.');
      }
      setDetailProject(body);
    } catch (err: any) {
      console.error('Error fetching project details:', err);
      setDetailError(
        isAr
          ? 'تعذر استرجاع تفاصيل المشروع والأنشطة المرتبطة به. يرجى إعادة المحاولة.'
          : 'Unable to retrieve project details and associated activities. Please retry.'
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetails = () => {
    setDetailProjectId(null);
    setDetailProject(null);
    setDetailError(null);
    setSelectedActivity(null);
  };

  // Open Safe Deletion Modal
  const handleOpenDelete = (proj: ProjectManagementItem) => {
    setDeleteCandidate(proj);
    setDeleteError(null);
    setBlockingActivities([]);
  };

  const handleConfirmDelete = async () => {
    if (!deleteCandidate) return;
    setIsDeleting(true);
    setDeleteError(null);
    setBlockingActivities([]);

    try {
      const res = await apiFetch(`/api/projects/${deleteCandidate.id}`, {
        method: 'DELETE'
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        if (Array.isArray(body?.associatedActivities)) {
          setBlockingActivities(body.associatedActivities);
        }
        throw new Error(body?.message || 'Unable to delete project.');
      }

      const deletedName = pickLocalized(lang, deleteCandidate.name, deleteCandidate.nameAr);
      const deletedId = deleteCandidate.id;
      setDeleteCandidate(null);
      if (detailProjectId === deletedId) {
        handleCloseDetails();
      }
      showBanner(
        'success',
        isAr
          ? `تم حذف المشروع "${deletedName}" بنجاح.`
          : `Project "${deletedName}" was successfully deleted.`
      );
      await fetchProjects();
    } catch (err: any) {
      const msg =
        err?.message ||
        (isAr
          ? 'تعذر حذف المشروع بسبب وجود أنشطة مرتبطة أو خطأ في الخادم.'
          : 'Failed to delete project.');
      setDeleteError(msg);
      showBanner('error', msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    const lower = status.toLowerCase();
    let cls = 'bg-slate-100 text-slate-700 border-slate-200';
    if (lower === 'completed') {
      cls = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    } else if (lower === 'in progress') {
      cls = 'bg-blue-50 text-blue-700 border-blue-200';
    } else if (lower === 'on hold') {
      cls = 'bg-amber-50 text-amber-700 border-amber-200';
    } else if (lower === 'cancelled') {
      cls = 'bg-rose-50 text-rose-700 border-rose-200';
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

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(total, page * pageSize);

  return (
    <div className={`space-y-6 ${isAr ? 'text-right' : 'text-left'}`} dir={isAr ? 'rtl' : 'ltr'}>
      {/* ==================== HEADER ==================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/90 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-500/20 shrink-0">
            <FolderKanban className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
              {isAr ? 'إدارة المشاريع' : 'Project Management'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              {isAr
                ? 'إنشاء وتحديث ومتابعة المشاريع وربطها بالمبادرات واستعراض الأنشطة المرتبطة بها'
                : 'Create, update, filter, and safely manage projects linked to strategic initiatives'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {canManage && (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{isAr ? 'إنشاء مشروع جديد' : 'New Project'}</span>
            </button>
          )}
        </div>
      </div>

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
            onClick={fetchProjects}
            className="px-3 py-1.5 bg-white hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg border border-rose-300 cursor-pointer transition-colors shrink-0 self-start sm:self-center"
          >
            {isAr ? 'إعادة المحاولة' : 'Retry'}
          </button>
        </div>
      )}

      {/* ==================== SEARCH & FILTER TOOLBAR ==================== */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          {/* Search by Project Name */}
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
              placeholder={isAr ? 'البحث باسم المشروع...' : 'Search projects by name...'}
              aria-label={isAr ? 'البحث باسم المشروع' : 'Search projects by name'}
              className={`w-full text-xs sm:text-sm border border-slate-200 rounded-lg py-2 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-slate-50/50 transition-colors ${
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

          {/* Filter by Initiative */}
          <div className="lg:col-span-4">
            <select
              value={initiativeFilter}
              onChange={(e) => {
                setInitiativeFilter(e.target.value);
                setPage(1);
              }}
              aria-label={isAr ? 'تصفية حسب المبادرة' : 'Filter by initiative'}
              className="w-full text-xs sm:text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 cursor-pointer"
            >
              <option value="All">{isAr ? 'جميع المبادرات' : 'All Initiatives'}</option>
              {initiatives.map((init) => (
                <option key={init.id} value={String(init.id)}>
                  {pickLocalized(lang, init.name, init.nameAr)}
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
              {VALID_PROJECT_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {translateStatus(st, lang)}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Search & Filters */}
          <div className="lg:col-span-1 flex justify-end">
            <button
              type="button"
              onClick={handleClearFilters}
              disabled={!hasActiveFilters}
              className="w-full lg:w-auto px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors flex items-center justify-center gap-1.5"
              title={isAr ? 'مسح البحث وعوامل التصفية' : 'Clear search and filters'}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="lg:hidden">{isAr ? 'مسح' : 'Clear'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ==================== PROJECT REGISTRY TABLE ==================== */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
            <p className="text-sm text-slate-500">
              {isAr ? 'جارٍ تحميل سجل المشاريع...' : 'Retrieving project records...'}
            </p>
          </div>
        ) : fetchError && projects.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">{fetchError}</h3>
            <button
              type="button"
              onClick={fetchProjects}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              {isAr ? 'إعادة التحميل' : 'Retry'}
            </button>
          </div>
        ) : projects.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <FolderKanban className="w-8 h-8 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">
              {hasActiveFilters
                ? isAr
                  ? 'لا توجد مشاريع مطابقة لمعايير البحث'
                  : 'No matching projects found'
                : isAr
                ? 'لا توجد مشاريع مسجلة حالياً'
                : 'No projects registered yet'}
            </h3>
            <p className="text-xs text-slate-500">
              {hasActiveFilters
                ? isAr
                  ? 'جرب تعديل كلمات البحث أو مسح عوامل التصفية.'
                  : 'Try adjusting your search query or clearing active filters.'
                : isAr
                ? 'ابدأ بإنشاء أول مشروع وربطه بمبادرة استراتيجية.'
                : 'Create your first project and link it to a strategic initiative.'}
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isAr ? 'مسح البحث والتصفية' : 'Clear Search & Filters'}</span>
              </button>
            ) : canManage ? (
              <button
                type="button"
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAr ? 'إنشاء مشروع جديد' : 'New Project'}</span>
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-start border-collapse">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-slate-200/80 text-xs font-semibold text-slate-600">
                    <th className="py-3.5 px-4 w-14 text-start">{isAr ? 'المعرف' : 'ID'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'المشروع' : 'Project'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'المبادرة المرتبطة' : 'Initiative'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'المالك' : 'Owner'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'الأولوية' : 'Priority'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'تاريخ البدء' : 'Start Date'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'التاريخ المستهدف' : 'Target Date'}</th>
                    <th className="py-3.5 px-4 text-end">{isAr ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 text-sm">
                  {projects.map((pr) => (
                    <tr
                      key={pr.id}
                      onClick={() => handleOpenDetails(pr)}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-500 tabular-nums">
                        #{pr.id}
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {pickLocalized(lang, pr.name, pr.nameAr)}
                        </div>
                        {pickLocalized(lang, pr.description, pr.descriptionAr) && (
                          <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                            {pickLocalized(lang, pr.description, pr.descriptionAr)}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-700">
                        <span className="font-medium text-slate-800">
                          {pickLocalized(lang, pr.initiativeName, pr.initiativeNameAr) || '—'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-700 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>
                            {pickLocalized(
                              lang,
                              pr.ownerName || pr.projectManagerName,
                              pr.ownerNameAr || pr.projectManagerNameAr
                            ) || (isAr ? 'غير محدد' : 'Unassigned')}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">{renderStatusBadge(pr.status)}</td>

                      <td className="py-3.5 px-4 whitespace-nowrap">{renderPriorityBadge(pr.priority)}</td>

                      <td className="py-3.5 px-4 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                        {pr.startDate}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                        {pr.targetDate || pr.endDate}
                      </td>

                      <td className="py-3.5 px-4 text-end whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(pr)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                            title={isAr ? 'عرض تفاصيل المشروع والأنشطة' : 'View project details'}
                          >
                            <ChevronRight className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} />
                          </button>

                          {canManage && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(pr)}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer transition-colors"
                                title={isAr ? 'تعديل المشروع' : 'Edit project'}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenDelete(pr)}
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                                title={isAr ? 'حذف المشروع' : 'Delete project'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
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
                    ? `عرض ${rangeStart}–${rangeEnd} من أصل ${total} مشروع`
                    : `Showing ${rangeStart}–${rangeEnd} of ${total} projects`}
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  aria-label={isAr ? 'عدد المشاريع في الصفحة' : 'Projects per page'}
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

      {/* ==================== CREATE / EDIT PROJECT MODAL ==================== */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            onClick={() => !isSaving && setIsFormOpen(false)}
          />
          <div
            className={`relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 z-10 overflow-hidden ${
              isAr ? 'text-right' : 'text-left'
            }`}
          >
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                  <FolderKanban className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900">
                  {editingId
                    ? isAr
                      ? 'تعديل بيانات المشروع'
                      : 'Edit Project'
                    : isAr
                    ? 'إنشاء مشروع جديد'
                    : 'Create New Project'}
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

            <form onSubmit={handleSaveProject} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {formSubmitError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formSubmitError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isAr ? 'اسم المشروع *' : 'Project Name *'}
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
                  placeholder={isAr ? 'أدخل اسم المشروع...' : 'Enter project name...'}
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
                  {isAr ? 'وصف المشروع' : 'Description'}
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
                  placeholder={isAr ? 'أدخل نطاق وأهداف المشروع...' : 'Enter project scope and description...'}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isAr ? 'المبادرة المرتبطة *' : 'Associated Initiative *'}
                  </label>
                  <select
                    value={formData.initiativeId}
                    onChange={(e) => setFormData({ ...formData, initiativeId: e.target.value })}
                    className={`w-full text-sm border rounded-lg px-3 py-2 bg-white cursor-pointer ${
                      formErrors.initiativeId ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                    }`}
                  >
                    <option value="">{isAr ? 'اختر المبادرة...' : 'Select initiative...'}</option>
                    {initiatives.map((i) => (
                      <option key={i.id} value={String(i.id)}>
                        {pickLocalized(lang, i.name, i.nameAr)}
                      </option>
                    ))}
                  </select>
                  {formErrors.initiativeId && (
                    <p className="text-xs text-rose-600 mt-1">{formErrors.initiativeId}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isAr ? 'مالك المشروع' : 'Project Owner'}
                  </label>
                  <select
                    value={formData.ownerId}
                    onChange={(e) => setFormData({ ...formData, ownerId: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white cursor-pointer"
                  >
                    <option value="">{isAr ? 'غير محدد' : 'Unassigned'}</option>
                    {users.map((u) => (
                      <option key={u.id} value={String(u.id)}>
                        {pickLocalized(lang, u.fullName, u.fullNameAr)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isAr ? 'الحالة' : 'Status'}
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: e.target.value as ProjectManagementItem['status']
                      })
                    }
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white cursor-pointer"
                  >
                    {VALID_PROJECT_STATUSES.map((st) => (
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
                      setFormData({
                        ...formData,
                        priority: e.target.value as ProjectManagementItem['priority']
                      })
                    }
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white cursor-pointer"
                  >
                    {VALID_PROJECT_PRIORITIES.map((pr) => (
                      <option key={pr} value={pr}>
                        {translatePriority(pr, lang)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isAr ? 'تاريخ البدء *' : 'Start Date *'}
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className={`w-full text-sm border rounded-lg px-3 py-2 font-mono ${
                      formErrors.startDate ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                    }`}
                  />
                  {formErrors.startDate && (
                    <p className="text-xs text-rose-600 mt-1">{formErrors.startDate}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isAr ? 'التاريخ المستهدف *' : 'Target Date *'}
                  </label>
                  <input
                    type="date"
                    value={formData.targetDate}
                    onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                    className={`w-full text-sm border rounded-lg px-3 py-2 font-mono ${
                      formErrors.targetDate ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                    }`}
                  />
                  {formErrors.targetDate && (
                    <p className="text-xs text-rose-600 mt-1">{formErrors.targetDate}</p>
                  )}
                </div>
              </div>

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
                      ? 'إنشاء المشروع'
                      : 'Create Project'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== PROJECT DETAILS & ACTIVITIES DRAWER ==================== */}
      {detailProjectId !== null && (
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
                  <FolderKanban className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900 truncate">
                    {detailProject
                      ? pickLocalized(lang, detailProject.name, detailProject.nameAr)
                      : isAr
                      ? 'تفاصيل المشروع'
                      : 'Project Details'}
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">
                    {isAr ? `المعرف #${detailProjectId}` : `ID #${detailProjectId}`}
                    {detailProject?.status ? ` · ${translateStatus(detailProject.status, lang)}` : ''}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {onPlanSchedule && detailProject && (
                  <button
                    type="button"
                    onClick={() => {
                      const pid = detailProject.id;
                      handleCloseDetails();
                      onPlanSchedule(pid);
                    }}
                    className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-lg border border-slate-200 cursor-pointer"
                    title={isAr ? 'تخطيط وجدولة المشروع' : 'Plan project schedule'}
                  >
                    <Calendar className="w-4 h-4" />
                  </button>
                )}
                {onNavigateToWorkspace && detailProject && (
                  <button
                    type="button"
                    onClick={() => {
                      const pid = detailProject.id;
                      handleCloseDetails();
                      onNavigateToWorkspace(pid);
                    }}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg border border-slate-200 cursor-pointer"
                    title={isAr ? 'فتح مساحة عمل المشروع' : 'Open project workspace'}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                )}
                {canManage && detailProject && (
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(detailProject)}
                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200 cursor-pointer"
                    title={isAr ? 'تعديل المشروع' : 'Edit project'}
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
                    {isAr ? 'جارٍ تحميل تفاصيل المشروع والأنشطة...' : 'Loading project details and activities...'}
                  </p>
                </div>
              ) : detailError ? (
                <div className="p-5 bg-rose-50 border border-rose-200 rounded-xl space-y-3 text-center">
                  <AlertCircle className="w-6 h-6 text-rose-600 mx-auto" />
                  <p className="text-xs font-semibold text-rose-800">{detailError}</p>
                  {detailProject && (
                    <button
                      type="button"
                      onClick={() => handleOpenDetails(detailProject)}
                      className="px-3.5 py-1.5 bg-white hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg border border-rose-300 cursor-pointer"
                    >
                      {isAr ? 'إعادة المحاولة' : 'Retry'}
                    </button>
                  )}
                </div>
              ) : detailProject ? (
                <>
                  {/* Description */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      <span>{isAr ? 'وصف المشروع' : 'Description'}</span>
                    </div>
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-700 leading-relaxed">
                      {pickLocalized(lang, detailProject.description, detailProject.descriptionAr) ||
                        (isAr ? 'لا يوجد وصف مسجل لهذا المشروع.' : 'No description provided for this project.')}
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1">
                      <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                        <Compass className="w-3.5 h-3.5" />
                        <span>{isAr ? 'المبادرة المرتبطة' : 'Associated Initiative'}</span>
                      </span>
                      <div className="text-xs font-bold text-slate-900">
                        {pickLocalized(lang, detailProject.initiativeName, detailProject.initiativeNameAr) || '—'}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1">
                      <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        <span>{isAr ? 'مالك المشروع' : 'Project Owner'}</span>
                      </span>
                      <div className="text-xs font-bold text-slate-900">
                        {pickLocalized(
                          lang,
                          detailProject.ownerName || detailProject.projectManagerName,
                          detailProject.ownerNameAr || detailProject.projectManagerNameAr
                        ) || (isAr ? 'غير محدد' : 'Unassigned')}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1">
                      <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{isAr ? 'تاريخ البدء والتاريخ المستهدف' : 'Planned Dates'}</span>
                      </span>
                      <div className="text-xs font-bold font-mono text-slate-900">
                        {detailProject.startDate} → {detailProject.targetDate || detailProject.endDate}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1">
                      <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5" />
                        <span>{isAr ? 'الحالة والأولوية' : 'Status & Priority'}</span>
                      </span>
                      <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                        {renderStatusBadge(detailProject.status)}
                        {renderPriorityBadge(detailProject.priority)}
                      </div>
                    </div>
                  </div>

                  {/* Selected Activity Details Preview (Story 8.9 AC 5) */}
                  {selectedActivity && (
                    <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                            {isAr ? 'تفاصيل النشاط المحدد' : 'Selected Activity Details'}
                          </span>
                          <h5 className="text-sm font-bold text-slate-900 mt-0.5">
                            {pickLocalized(lang, selectedActivity.name, selectedActivity.nameAr)}
                          </h5>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedActivity(null)}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-slate-700">
                        {pickLocalized(lang, selectedActivity.description, selectedActivity.descriptionAr) ||
                          (isAr ? 'لا يوجد وصف لهذا النشاط.' : 'No description provided.')}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 pt-1">
                        <span>
                          <strong>{isAr ? 'الحالة:' : 'Status:'}</strong>{' '}
                          {translateStatus(selectedActivity.status, lang)}
                        </span>
                        <span>
                          <strong>{isAr ? 'المكلف:' : 'Assigned:'}</strong>{' '}
                          {pickLocalized(
                            lang,
                            selectedActivity.assignedUserName,
                            selectedActivity.assignedUserNameAr
                          ) || (isAr ? 'غير مكلف' : 'Unassigned')}
                        </span>
                        <span className="font-mono">
                          <strong>{isAr ? 'الاستحقاق:' : 'Due:'}</strong> {selectedActivity.dueDate}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Associated Activities List */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          {isAr ? 'الأنشطة المرتبطة بالمشروع' : 'Associated Activities'}
                        </h4>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono font-semibold text-slate-500">
                          {detailProject.activities?.length || 0} {isAr ? 'نشاط' : 'activities'}
                        </span>
                        {onManageActivities && detailProject && (
                          <button
                            type="button"
                            onClick={() => {
                              const pid = detailProject.id;
                              handleCloseDetails();
                              onManageActivities(pid);
                            }}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer flex items-center gap-1"
                          >
                            <span>{isAr ? 'إدارة الأنشطة' : 'Manage'}</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {!detailProject.activities || detailProject.activities.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
                        {isAr
                          ? 'لا توجد أنشطة مرتبطة بهذا المشروع حالياً.'
                          : 'No activities are currently associated with this project.'}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {detailProject.activities.map((act) => (
                          <div
                            key={act.id}
                            onClick={() => setSelectedActivity(act)}
                            className={`p-3 rounded-lg border transition-all cursor-pointer ${
                              selectedActivity?.id === act.id
                                ? 'border-blue-500 bg-blue-50/40'
                                : 'border-slate-200 bg-white hover:border-blue-300'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-slate-900 truncate">
                                {pickLocalized(lang, act.name, act.nameAr)}
                              </span>
                              {renderStatusBadge(act.status)}
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5">
                              <span>
                                {pickLocalized(lang, act.assignedUserName, act.assignedUserNameAr) ||
                                  (isAr ? 'غير مكلف' : 'Unassigned')}
                              </span>
                              <span className="font-mono">{act.dueDate}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              {canManage && detailProject ? (
                <button
                  type="button"
                  onClick={() => handleOpenDelete(detailProject)}
                  className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isAr ? 'حذف المشروع' : 'Delete Project'}</span>
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

      {/* ==================== SAFE DELETE CONFIRMATION MODAL ==================== */}
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
                  {isAr ? 'تأكيد حذف المشروع' : 'Confirm Project Deletion'}
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  {isAr
                    ? `هل أنت متأكد من رغبتك في حذف المشروع "${pickLocalized(lang, deleteCandidate.name, deleteCandidate.nameAr)}"؟`
                    : `Are you sure you want to delete project "${pickLocalized(lang, deleteCandidate.name, deleteCandidate.nameAr)}"?`}
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg space-y-2">
                <p className="text-xs font-semibold text-rose-800">{deleteError}</p>
                {blockingActivities.length > 0 && (
                  <ul className="text-[11px] text-rose-700 list-disc ps-4 space-y-0.5 max-h-28 overflow-y-auto">
                    {blockingActivities.map((act) => (
                      <li key={act.id}>
                        {pickLocalized(lang, act.name, act.nameAr)} ({translateStatus(act.status, lang)})
                      </li>
                    ))}
                  </ul>
                )}
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
