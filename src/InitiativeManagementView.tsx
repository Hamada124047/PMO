import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from './apiClient';
import {
  FolderKanban,
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  Calendar,
  User,
  Building2,
  Briefcase,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  Layers,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  FileText,
  RotateCcw
} from 'lucide-react';
import { Language, pickLocalized, translateStatus, translations } from './i18n';

export interface AssociatedProject {
  id: number;
  name: string;
  nameAr?: string;
  description?: string;
  descriptionAr?: string;
  status: string;
  priority: string;
  progressPercentage: number;
  startDate: string;
  endDate: string;
  projectManagerName: string | null;
  projectManagerNameAr?: string | null;
  budget?: number;
}

export interface InitiativeItem {
  id: number;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  departmentId: number | null;
  portfolioId: number;
  ownerId: number | null;
  startDate: string;
  targetDate: string;
  status: 'Draft' | 'Not Started' | 'In Progress' | 'Completed' | 'On Hold';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  progressPercentage: number;
  departmentName?: string | null;
  departmentNameAr?: string | null;
  portfolioName?: string | null;
  portfolioNameAr?: string | null;
  ownerName?: string | null;
  ownerNameAr?: string | null;
  projectCount: number;
  associatedProjects?: AssociatedProject[];
}

interface PortfolioOption {
  id: number;
  name: string;
  nameAr?: string;
}

interface DepartmentOption {
  id: number;
  name: string;
  nameAr?: string;
}

interface UserOption {
  id: number;
  fullName: string;
  fullNameAr?: string;
}

interface InitiativeManagementViewProps {
  lang: Language;
  currentUserRole?: string;
  showBanner: (type: 'success' | 'error', text: string) => void;
  onNavigateToProjects?: (initiativeId?: number, projectId?: number) => void;
}

export const InitiativeManagementView: React.FC<InitiativeManagementViewProps> = ({
  lang,
  currentUserRole = 'PMO Manager',
  showBanner,
  onNavigateToProjects
}) => {
  const t = translations[lang];
  const isAr = lang === 'ar';
  const canManage = useMemo(
    () => (currentUserRole || '').trim().toLowerCase() === 'pmo manager',
    [currentUserRole]
  );

  // Data States
  const [initiatives, setInitiatives] = useState<InitiativeItem[]>([]);
  const [portfolios, setPortfolios] = useState<PortfolioOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filtering States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');
  const [portfolioFilter, setPortfolioFilter] = useState<string>('All');
  const [departmentFilter, setDepartmentFilter] = useState<string>('All');

  // Pagination States
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Modal / Drawer States
  const [detailDrawerItem, setDetailDrawerItem] = useState<InitiativeItem | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [editingInitiativeId, setEditingInitiativeId] = useState<number | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<number | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<InitiativeItem | null>(null);

  // Form Field States
  const [formData, setFormData] = useState<{
    name: string;
    nameAr: string;
    description: string;
    descriptionAr: string;
    portfolioId: number | '';
    departmentId: number | '';
    ownerId: number | '';
    startDate: string;
    targetDate: string;
    status: InitiativeItem['status'];
    priority: InitiativeItem['priority'];
    progressPercentage: number;
  }>({
    name: '',
    nameAr: '',
    description: '',
    descriptionAr: '',
    portfolioId: '',
    departmentId: '',
    ownerId: '',
    startDate: '2026-01-15',
    targetDate: '2026-10-30',
    status: 'In Progress',
    priority: 'Medium',
    progressPercentage: 0
  });
  const [formValidationErrors, setFormValidationErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Fetch Initiatives and Reference Data
  const fetchInitiatives = async () => {
    setLoading(true);
    setError(null);
    try {
      const [resInit, resPort, resDept, resUsers] = await Promise.all([
        apiFetch('/api/initiatives'),
        apiFetch('/api/portfolios'),
        apiFetch('/api/departments'),
        canManage ? apiFetch('/api/users/options') : Promise.resolve(new Response('[]', { status: 200 }))
      ]);

      if (!resInit.ok) throw new Error('Failed to retrieve initiatives');

      const initData = await resInit.json();
      setInitiatives(Array.isArray(initData) ? initData : initData.items || []);

      if (resPort.ok) {
        const portData = await resPort.json();
        setPortfolios(Array.isArray(portData) ? portData : []);
      }
      if (resDept.ok) {
        const deptData = await resDept.json();
        setDepartments(Array.isArray(deptData) ? deptData : []);
      }
      if (resUsers.ok) {
        const userData = await resUsers.json();
        setUsers(Array.isArray(userData) ? userData : []);
      }
    } catch (err: any) {
      const msg = err.message || (isAr ? 'تعذر تحميل سجل المبادرات' : 'Unable to load initiative records');
      setError(msg);
      showBanner('error', msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitiatives();
  }, []);

  // Filtered initiatives list
  const filteredInitiatives = useMemo(() => {
    let result = [...initiatives];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.nameAr && i.nameAr.toLowerCase().includes(q)) ||
          (i.description && i.description.toLowerCase().includes(q)) ||
          (i.descriptionAr && i.descriptionAr.toLowerCase().includes(q)) ||
          (i.portfolioName && i.portfolioName.toLowerCase().includes(q)) ||
          (i.portfolioNameAr && i.portfolioNameAr.toLowerCase().includes(q)) ||
          (i.ownerName && i.ownerName.toLowerCase().includes(q)) ||
          (i.ownerNameAr && i.ownerNameAr.toLowerCase().includes(q))
      );
    }

    if (statusFilter !== 'All') {
      result = result.filter((i) => i.status.toLowerCase() === statusFilter.toLowerCase());
    }

    if (priorityFilter !== 'All') {
      result = result.filter((i) => i.priority.toLowerCase() === priorityFilter.toLowerCase());
    }

    if (portfolioFilter !== 'All') {
      result = result.filter((i) => String(i.portfolioId) === portfolioFilter);
    }

    if (departmentFilter !== 'All') {
      result = result.filter((i) => String(i.departmentId) === departmentFilter);
    }

    return result;
  }, [initiatives, searchQuery, statusFilter, priorityFilter, portfolioFilter, departmentFilter]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, priorityFilter, portfolioFilter, departmentFilter, pageSize]);

  // Paginated Slice
  const totalItems = filteredInitiatives.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedInitiatives = filteredInitiatives.slice(startIndex, startIndex + pageSize);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    statusFilter !== 'All' ||
    priorityFilter !== 'All' ||
    portfolioFilter !== 'All' ||
    departmentFilter !== 'All';

  const clearAllFilters = () => {
    setSearchQuery('');
    setStatusFilter('All');
    setPriorityFilter('All');
    setPortfolioFilter('All');
    setDepartmentFilter('All');
    setCurrentPage(1);
  };

  // Open Create Form
  const handleOpenCreateModal = () => {
    setEditingInitiativeId(null);
    setFormData({
      name: '',
      nameAr: '',
      description: '',
      descriptionAr: '',
      portfolioId: portfolios[0]?.id || '',
      departmentId: departments[0]?.id || '',
      ownerId: users[0]?.id || '',
      startDate: '2026-01-15',
      targetDate: '2026-10-30',
      status: 'In Progress',
      priority: 'Medium',
      progressPercentage: 0
    });
    setFormValidationErrors({});
    setIsFormModalOpen(true);
  };

  // Open Edit Form
  const handleOpenEditModal = (item: InitiativeItem) => {
    setEditingInitiativeId(item.id);
    setFormData({
      name: item.name,
      nameAr: item.nameAr || item.name,
      description: item.description || '',
      descriptionAr: item.descriptionAr || item.description || '',
      portfolioId: item.portfolioId,
      departmentId: item.departmentId ?? '',
      ownerId: item.ownerId ?? '',
      startDate: item.startDate || '2026-01-15',
      targetDate: item.targetDate || '2026-10-30',
      status: item.status,
      priority: item.priority,
      progressPercentage: item.progressPercentage ?? 0
    });
    setFormValidationErrors({});
    setIsFormModalOpen(true);
  };

  // Validate and Submit Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    const activeName = isAr ? (formData.nameAr.trim() || formData.name.trim()) : (formData.name.trim() || formData.nameAr.trim());

    if (!activeName) {
      errors.name = isAr ? 'اسم المبادرة مطلوب' : 'Initiative name is required';
    }
    if (!formData.portfolioId) {
      errors.portfolioId = isAr ? 'يجب اختيار المحفظة التابعة' : 'Portfolio is required';
    }
    if (formData.startDate && formData.targetDate) {
      if (new Date(formData.targetDate) < new Date(formData.startDate)) {
        errors.targetDate = isAr
          ? 'تاريخ الانتهاء لا يمكن أن يسبق تاريخ البدء'
          : 'Target date cannot be earlier than start date';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormValidationErrors(errors);
      return;
    }

    setIsSaving(true);
    try {
      const url = editingInitiativeId ? `/api/initiatives/${editingInitiativeId}` : '/api/initiatives';
      const method = editingInitiativeId ? 'PUT' : 'POST';

      const enName = formData.name.trim() || formData.nameAr.trim();
      const arName = formData.nameAr.trim() || formData.name.trim();
      const enDesc = formData.description.trim() || formData.descriptionAr.trim();
      const arDesc = formData.descriptionAr.trim() || formData.description.trim();

      const payload = {
        name: enName,
        nameAr: arName,
        description: enDesc,
        descriptionAr: arDesc,
        portfolioId: Number(formData.portfolioId),
        departmentId: formData.departmentId ? Number(formData.departmentId) : null,
        ownerId: formData.ownerId ? Number(formData.ownerId) : null,
        startDate: formData.startDate,
        targetDate: formData.targetDate,
        status: formData.status,
        priority: formData.priority,
        progressPercentage: Number(formData.progressPercentage)
      };

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resData = await res.json();

      if (!res.ok) {
        throw new Error(resData.message || (isAr ? 'فشلت عملية الحفظ' : 'Operation failed'));
      }

      const displayName = isAr ? arName : enName;
      showBanner(
        'success',
        editingInitiativeId
          ? isAr
            ? `تم تحديث المبادرة "${displayName}" بنجاح`
            : `Initiative "${displayName}" updated successfully`
          : isAr
          ? `تم إنشاء المبادرة "${displayName}" بنجاح`
          : `Initiative "${displayName}" created successfully`
      );

      setIsFormModalOpen(false);
      await fetchInitiatives();

      // If drawer was open for this item, update it
      if (detailDrawerItem && detailDrawerItem.id === editingInitiativeId) {
        setDetailDrawerItem(resData);
      }
    } catch (err: any) {
      const msg = err.message || (isAr ? 'حدث خطأ أثناء حفظ المبادرة' : 'Error saving initiative');
      setFormValidationErrors({ form: msg });
      showBanner('error', msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Safe Deletion Handling (Feature 4, Story 1.7 & 1.8)
  const handleInitiateDelete = (item: InitiativeItem) => {
    setDeleteCandidate(item);
  };

  const handleConfirmDelete = async () => {
    if (!deleteCandidate) return;
    setIsDeletingId(deleteCandidate.id);

    try {
      const res = await apiFetch(`/api/initiatives/${deleteCandidate.id}`, {
        method: 'DELETE'
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || (isAr ? 'تعذر حذف المبادرة' : 'Could not delete initiative'));
      }

      const delName = pickLocalized(lang, deleteCandidate.name, deleteCandidate.nameAr);
      showBanner(
        'success',
        isAr
          ? `تم حذف المبادرة "${delName}" بنجاح.`
          : `Initiative "${delName}" was successfully deleted.`
      );

      // If drawer was showing this item, close it
      if (detailDrawerItem?.id === deleteCandidate.id) {
        setDetailDrawerItem(null);
      }

      setDeleteCandidate(null);
      await fetchInitiatives();
    } catch (err: any) {
      const msg = err.message || (isAr ? 'فشل حذف المبادرة' : 'Failed to delete initiative');
      showBanner('error', msg);
      // Keep deleteCandidate open to let user review reason
    } finally {
      setIsDeletingId(null);
    }
  };

  // View Details Drawer
  const handleOpenDetails = async (item: InitiativeItem) => {
    setDetailDrawerItem(item);
    // Fetch refreshed details with associated projects
    try {
      const res = await apiFetch(`/api/initiatives/${item.id}`);
      if (res.ok) {
        const enriched = await res.json();
        setDetailDrawerItem(enriched);
      }
    } catch {
      // Keep current item
    }
  };

  // Visual Priority Styling
  const getPriorityBadge = (priority: InitiativeItem['priority']) => {
    switch (priority) {
      case 'Critical':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
            {isAr ? 'حرجة' : 'Critical'}
          </span>
        );
      case 'High':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            {isAr ? 'عالية' : 'High'}
          </span>
        );
      case 'Medium':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            {isAr ? 'متوسطة' : 'Medium'}
          </span>
        );
      case 'Low':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            {isAr ? 'منخفضة' : 'Low'}
          </span>
        );
    }
  };

  // Visual Status Styling
  const getStatusBadge = (status: InitiativeItem['status']) => {
    switch (status) {
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            {isAr ? 'مكتملة' : 'Completed'}
          </span>
        );
      case 'In Progress':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3 h-3 text-blue-600" />
            {isAr ? 'قيد التنفيذ' : 'In Progress'}
          </span>
        );
      case 'On Hold':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertCircle className="w-3 h-3 text-amber-600" />
            {isAr ? 'معلقة' : 'On Hold'}
          </span>
        );
      case 'Draft':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <FileText className="w-3 h-3 text-slate-500" />
            {isAr ? 'مسودة' : 'Draft'}
          </span>
        );
      case 'Not Started':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">
            {isAr ? 'لم تبدأ' : 'Not Started'}
          </span>
        );
    }
  };

  const getInitials = (name?: string | null) => {
    if (!name) return 'UN';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* 1. Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              {isAr ? 'وحدة إدارة المبادرات' : 'Initiative Management'}
            </span>
            <span className="text-slate-400 text-xs">•</span>
            <span className="text-xs text-slate-500 font-mono">
              {initiatives.length} {isAr ? 'مبادرة مسجلة' : 'Registered Initiatives'}
            </span>
          </div>
          <h1 className="text-2xl font-bold font-display text-slate-900 tracking-tight flex items-center gap-2.5">
            <FolderKanban className="w-7 h-7 text-blue-600 shrink-0" />
            <span>{isAr ? 'سجل وإدارة المبادرات' : 'Initiative Registry & Governance'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-3xl">
            {isAr
              ? 'إنشاء ومتابعة وتحديث المبادرات الاستراتيجية، ربطها بالمحافظ والأقسام، وحوكمة المشاريع التنفيذية التابعة.'
              : 'Create, monitor, and update initiatives, link them to parent portfolios and departments, and access associated projects.'}
          </p>
        </div>

        {canManage && (
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs hover:shadow transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isAr ? 'مبادرة جديدة' : 'New Initiative'}</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. KPI Summary Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 block mb-1">{isAr ? 'إجمالي المبادرات' : 'Total Initiatives'}</span>
          <span className="text-2xl font-bold font-mono text-slate-900">{initiatives.length}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 block mb-1">{isAr ? 'قيد التنفيذ' : 'In Progress'}</span>
          <span className="text-2xl font-bold font-mono text-blue-600">
            {initiatives.filter((i) => i.status === 'In Progress').length}
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 block mb-1">{isAr ? 'مكتملة' : 'Completed'}</span>
          <span className="text-2xl font-bold font-mono text-emerald-600">
            {initiatives.filter((i) => i.status === 'Completed').length}
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 block mb-1">{isAr ? 'أولوية حرجة / عالية' : 'Critical / High'}</span>
          <span className="text-2xl font-bold font-mono text-rose-600">
            {initiatives.filter((i) => i.priority === 'Critical' || i.priority === 'High').length}
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs col-span-2 sm:col-span-1">
          <span className="text-xs text-slate-500 block mb-1">{isAr ? 'المشاريع المرتبطة' : 'Linked Projects'}</span>
          <span className="text-2xl font-bold font-mono text-indigo-600">
            {initiatives.reduce((sum, i) => sum + (i.projectCount || 0), 0)}
          </span>
        </div>
      </div>

      {/* 3. Search and Status Filters Toolbar (Story 1.5) */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute top-3 start-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isAr ? 'البحث بالاسم أو الوصف أو المحفظة أو المسؤول...' : 'Search by name, description, portfolio, or owner...'}
              className="w-full ps-10 pe-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 transition-colors"
            />
          </div>

          {/* Filters Row */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500 hidden sm:inline">{isAr ? 'الحالة:' : 'Status:'}</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:border-blue-600"
              >
                <option value="All">{isAr ? 'كافة الحالات' : 'All Statuses'}</option>
                <option value="In Progress">{isAr ? 'قيد التنفيذ' : 'In Progress'}</option>
                <option value="Completed">{isAr ? 'مكتملة' : 'Completed'}</option>
                <option value="On Hold">{isAr ? 'معلقة' : 'On Hold'}</option>
                <option value="Draft">{isAr ? 'مسودة' : 'Draft'}</option>
                <option value="Not Started">{isAr ? 'لم تبدأ' : 'Not Started'}</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500 hidden sm:inline">{isAr ? 'الأولوية:' : 'Priority:'}</span>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:border-blue-600"
              >
                <option value="All">{isAr ? 'كافة الأولويات' : 'All Priorities'}</option>
                <option value="Critical">{isAr ? 'حرجة' : 'Critical'}</option>
                <option value="High">{isAr ? 'عالية' : 'High'}</option>
                <option value="Medium">{isAr ? 'متوسطة' : 'Medium'}</option>
                <option value="Low">{isAr ? 'منخفضة' : 'Low'}</option>
              </select>
            </div>

            {/* Portfolio Filter */}
            <select
              value={portfolioFilter}
              onChange={(e) => setPortfolioFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:border-blue-600"
            >
              <option value="All">{isAr ? 'كافة المحافظ' : 'All Portfolios'}</option>
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>
                  {pickLocalized(lang, p.name, p.nameAr)}
                </option>
              ))}
            </select>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="px-3 py-2 text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                title={isAr ? 'إلغاء التصفية' : 'Clear filters'}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isAr ? 'مسح الفلاتر' : 'Reset'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Summary Counter */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
          <span>
            {isAr
              ? `تم العثور على ${filteredInitiatives.length} مبادرة`
              : `Found ${filteredInitiatives.length} initiative(s)`}
            {hasActiveFilters && (
              <span className="ms-1.5 text-blue-600 font-semibold">
                ({isAr ? 'نتائج مطابقة للفلاتر' : 'filtered results'})
              </span>
            )}
          </span>
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <span>{isAr ? 'لكل صفحة:' : 'Page Size:'}</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-transparent border-none text-slate-700 font-bold focus:outline-none cursor-pointer"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Initiative Registry Table (Story 1.1 & Story 1.9) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-500 font-medium">
              {isAr ? 'جارٍ تحميل سجل المبادرات...' : 'Loading initiatives registry...'}
            </p>
          </div>
        ) : error ? (
          <div className="p-12 text-center space-y-3">
            <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
            <p className="text-sm font-bold text-rose-700">{error}</p>
            <button
              onClick={fetchInitiatives}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
            >
              {isAr ? 'إعادة المحاولة' : 'Retry'}
            </button>
          </div>
        ) : filteredInitiatives.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <FolderKanban className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">
              {hasActiveFilters
                ? isAr
                  ? 'لا توجد مبادرات مطابقة لشروط البحث'
                  : 'No initiatives match the selected criteria'
                : isAr
                ? 'لا توجد مبادرات مسجلة حالياً'
                : 'No initiatives currently registered'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {hasActiveFilters
                ? isAr
                  ? 'جرّب تعديل كلمات البحث أو مسح الفلاتر المحددة.'
                  : 'Try clearing your search filters or adjusting the status/priority selection.'
                : isAr
                ? 'ابدأ بإضافة أول مبادرة استراتيجية لربطها بالمحافظ والمشاريع.'
                : 'Start by creating your first strategic initiative to link it with portfolios and projects.'}
            </p>
            {hasActiveFilters ? (
              <button
                onClick={clearAllFilters}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
              >
                {isAr ? 'مسح الفلاتر' : 'Clear Filters'}
              </button>
            ) : canManage ? (
              <button
                onClick={handleOpenCreateModal}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
              >
                {isAr ? 'إضافة مبادرة جديدة' : 'Add New Initiative'}
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-start border-collapse text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-4 text-start w-16">{isAr ? 'المعرف' : 'ID'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'اسم المبادرة والوصف' : 'Initiative & Scope'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'المحفظة · الإدارة' : 'Portfolio · Department'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'المسؤول' : 'Owner'}</th>
                    <th className="py-3.5 px-4 text-start font-mono">{isAr ? 'المستهدف الزمني' : 'Target Dates'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'الأولوية' : 'Priority'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                    <th className="py-3.5 px-4 text-center">{isAr ? 'الإنجاز' : 'Progress'}</th>
                    <th className="py-3.5 px-4 text-center">{isAr ? 'المشاريع' : 'Projects'}</th>
                    <th className="py-3.5 px-4 text-end">{isAr ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {paginatedInitiatives.map((item) => {
                    const itemName = pickLocalized(lang, item.name, item.nameAr);
                    const itemDesc = pickLocalized(lang, item.description, item.descriptionAr);
                    const itemPort = pickLocalized(lang, item.portfolioName, item.portfolioNameAr);
                    const itemDept = pickLocalized(lang, item.departmentName, item.departmentNameAr);
                    const itemOwner = pickLocalized(lang, item.ownerName, item.ownerNameAr);
                    return (
                    <tr
                      key={item.id}
                      className="hover:bg-blue-50/40 transition-colors group cursor-pointer"
                      onClick={() => handleOpenDetails(item)}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-500">
                        #{item.id}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs sm:max-w-md">
                        <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {itemName}
                        </div>
                        <div className="text-slate-500 text-[11px] line-clamp-1 mt-0.5">
                          {itemDesc || (isAr ? 'لا يوجد وصف تفصيلي' : 'No description provided')}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-medium text-slate-900">
                          <Briefcase className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span>{itemPort || (isAr ? 'غير محدد' : 'Unassigned')}</span>
                        </div>
                        <div className="text-slate-500 text-[11px] flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{itemDept || (isAr ? 'مؤسسي عام' : 'Enterprise-Wide')}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 font-bold font-mono text-[10px] flex items-center justify-center shrink-0">
                            {getInitials(itemOwner)}
                          </div>
                          <span className="font-medium text-slate-800">
                            {itemOwner || (isAr ? 'غير محدد' : 'Unassigned')}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px] text-slate-600">
                        <div>{item.startDate || '—'}</div>
                        <div className="text-slate-400 text-[10px]">➔ {item.targetDate || '—'}</div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getPriorityBadge(item.priority)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getStatusBadge(item.status)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-center">
                        <div className="inline-flex flex-col items-center gap-1">
                          <span className="font-mono font-bold text-slate-800">
                            {item.progressPercentage !== undefined ? `${item.progressPercentage}%` : '—'}
                          </span>
                          <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-blue-600 h-1.5 rounded-full"
                              style={{ width: `${Math.min(100, Math.max(0, item.progressPercentage || 0))}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-mono text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {item.projectCount} {isAr ? 'مشروع' : 'proj'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-end whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(item)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title={isAr ? 'عرض التفاصيل والمشاريع' : 'View Details & Projects'}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                          {canManage && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(item)}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                title={isAr ? 'تعديل المبادرة' : 'Edit Initiative'}
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleInitiateDelete(item)}
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title={isAr ? 'حذف آمن' : 'Safe Delete'}
                              >
                                <Trash2 className="w-4 h-4" />
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

            {/* Pagination Bar (Story 1.1 AC 3) */}
            <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
              <div>
                {isAr
                  ? `عرض ${startIndex + 1} إلى ${Math.min(startIndex + pageSize, totalItems)} من إجمالي ${totalItems} مبادرة`
                  : `Showing ${startIndex + 1} to ${Math.min(startIndex + pageSize, totalItems)} of ${totalItems} initiatives`}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors flex items-center gap-1 font-semibold"
                >
                  <ChevronLeft className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} />
                  <span>{isAr ? 'السابق' : 'Previous'}</span>
                </button>

                <div className="flex items-center gap-1 px-1">
                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const pNum = idx + 1;
                    if (
                      totalPages > 6 &&
                      pNum !== 1 &&
                      pNum !== totalPages &&
                      Math.abs(pNum - currentPage) > 1
                    ) {
                      if (pNum === 2 || pNum === totalPages - 1) {
                        return <span key={pNum} className="text-slate-400 px-1">...</span>;
                      }
                      return null;
                    }

                    return (
                      <button
                        key={pNum}
                        onClick={() => setCurrentPage(pNum)}
                        className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          currentPage === pNum
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {pNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors flex items-center gap-1 font-semibold"
                >
                  <span>{isAr ? 'التالي' : 'Next'}</span>
                  <ChevronRight className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 5. Initiative Details Drawer & Associated Projects (Story 1.1 AC 4, Story 1.9 & Feature 1 AC 8) */}
      {detailDrawerItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-end animate-in fade-in">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col border-s border-slate-200 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                    #{detailDrawerItem.id}
                  </span>
                  {getPriorityBadge(detailDrawerItem.priority)}
                  {getStatusBadge(detailDrawerItem.status)}
                </div>
                <h2 className="text-lg font-bold font-display text-slate-900 line-clamp-1">
                  {pickLocalized(lang, detailDrawerItem.name, detailDrawerItem.nameAr)}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDetailDrawerItem(null)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Description */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="font-bold text-slate-800 mb-1">{isAr ? 'وصف المبادرة' : 'Description'}</h4>
                <p className="text-slate-600 leading-relaxed">
                  {pickLocalized(lang, detailDrawerItem.description, detailDrawerItem.descriptionAr) || (isAr ? 'لا يوجد وصف مسجل' : 'No description provided')}
                </p>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[11px] text-slate-400 font-semibold">{isAr ? 'المحفظة التابعة' : 'Portfolio'}</span>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>{pickLocalized(lang, detailDrawerItem.portfolioName, detailDrawerItem.portfolioNameAr) || '—'}</span>
                  </div>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[11px] text-slate-400 font-semibold">{isAr ? 'الإدارة التابعة' : 'Department'}</span>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>{pickLocalized(lang, detailDrawerItem.departmentName, detailDrawerItem.departmentNameAr) || (isAr ? 'مؤسسي عام' : 'Enterprise-Wide')}</span>
                  </div>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[11px] text-slate-400 font-semibold">{isAr ? 'المسؤول' : 'Owner'}</span>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{pickLocalized(lang, detailDrawerItem.ownerName, detailDrawerItem.ownerNameAr) || (isAr ? 'غير محدد' : 'Unassigned')}</span>
                  </div>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[11px] text-slate-400 font-semibold">{isAr ? 'المستهدف الزمني' : 'Target Dates'}</span>
                  <div className="font-mono font-bold text-slate-900 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{detailDrawerItem.startDate} ➔ {detailDrawerItem.targetDate}</span>
                  </div>
                </div>
              </div>

              {/* Progress Indicator Card */}
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    <span>{isAr ? 'نسبة الإنجاز المحققة' : 'Recorded Progress'}</span>
                  </span>
                  <span className="font-mono text-base font-bold text-blue-700">
                    {detailDrawerItem.progressPercentage}%
                  </span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, detailDrawerItem.progressPercentage || 0))}%` }}
                  />
                </div>
              </div>

              {/* Associated Projects Section (Feature 1 AC 8) */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <h3 className="font-bold text-sm text-slate-900">
                      {isAr ? 'المشاريع التنفيذية المرتبطة بالمبادرة' : 'Associated Projects'}
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {detailDrawerItem.associatedProjects?.length || detailDrawerItem.projectCount || 0} {isAr ? 'مشروع' : 'projects'}
                  </span>
                </div>

                {(!detailDrawerItem.associatedProjects || detailDrawerItem.associatedProjects.length === 0) ? (
                  <div className="p-6 text-center border border-dashed border-slate-300 rounded-xl bg-slate-50/50 space-y-2">
                    <Layers className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-slate-500">
                      {isAr ? 'لا توجد مشاريع مرتبطة بهذه المبادرة حالياً.' : 'No projects associated with this initiative yet.'}
                    </p>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                    {detailDrawerItem.associatedProjects.map((p) => (
                      <div key={p.id} className="p-3.5 hover:bg-slate-50 flex items-center justify-between gap-3 transition-colors">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] font-bold text-slate-500">#{p.id}</span>
                            <span className="font-bold text-slate-900">{pickLocalized(lang, p.name, p.nameAr)}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-3">
                            <span>{isAr ? 'مدير المشروع:' : 'PM:'} {pickLocalized(lang, p.projectManagerName, p.projectManagerNameAr) || '—'}</span>
                            <span>•</span>
                            <span className="font-mono">{p.startDate} ➔ {p.endDate}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-end font-mono">
                            <span className="font-bold text-blue-700">{p.progressPercentage}%</span>
                            <div className="text-[10px] text-slate-400">{translateStatus(p.status, lang)}</div>
                          </div>
                          {onNavigateToProjects && (
                            <button
                              type="button"
                              onClick={() => {
                                setDetailDrawerItem(null);
                                onNavigateToProjects(detailDrawerItem.id, p.id);
                              }}
                              className="px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                              title={isAr ? 'عرض في سجل المشاريع' : 'View in projects workspace'}
                            >
                              <span>{isAr ? 'فتح' : 'Open'}</span>
                              <ArrowRight className={`w-3.5 h-3.5 ${isAr ? 'rotate-180' : ''}`} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              {canManage ? (
                <button
                  type="button"
                  onClick={() => {
                    const target = detailDrawerItem;
                    setDetailDrawerItem(null);
                    handleInitiateDelete(target);
                  }}
                  className="px-4 py-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isAr ? 'حذف المبادرة' : 'Delete'}</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                {canManage && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = detailDrawerItem;
                      setDetailDrawerItem(null);
                      handleOpenEditModal(target);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span>{isAr ? 'تعديل البيانات' : 'Edit Initiative'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDetailDrawerItem(null)}
                  className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  {isAr ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Create / Edit Initiative Modal Form (Story 1.3 & 1.4) */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FolderKanban className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-base text-slate-900">
                  {editingInitiativeId
                    ? isAr
                      ? 'تعديل المبادرة الاستراتيجية'
                      : 'Edit Strategic Initiative'
                    : isAr
                    ? 'تسجيل مبادرة استراتيجية جديدة'
                    : 'Create New Strategic Initiative'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitForm} className="p-6 space-y-4 text-xs">
              {formValidationErrors.form && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formValidationErrors.form}</span>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  {isAr ? 'اسم المبادرة' : 'Initiative Title'} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={isAr ? formData.nameAr : formData.name}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData(isAr ? { ...formData, nameAr: val } : { ...formData, name: val });
                    if (formValidationErrors.name) setFormValidationErrors({ ...formValidationErrors, name: '' });
                  }}
                  placeholder={isAr ? 'مثال: برنامج التحول الرقمي وأتمتة الخدمات الثقافية' : 'e.g. Digital Transformation & Cultural Automation'}
                  className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-lg focus:bg-white focus:outline-none transition-colors ${
                    formValidationErrors.name ? 'border-rose-400 focus:border-rose-500' : 'border-slate-300 focus:border-blue-600'
                  }`}
                />
                {formValidationErrors.name && (
                  <p className="text-rose-600 text-[11px] mt-1">{formValidationErrors.name}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  {isAr ? 'الوصف والنطاق التنفيذي' : 'Description & Scope'}
                </label>
                <textarea
                  rows={3}
                  value={isAr ? formData.descriptionAr : formData.description}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData(isAr ? { ...formData, descriptionAr: val } : { ...formData, description: val });
                  }}
                  placeholder={isAr ? 'أدخل أهداف ونطاق عمل المبادرة...' : 'Enter initiative objectives, expected impact, and scope...'}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600 transition-colors"
                />
              </div>

              {/* Portfolio & Department */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    {isAr ? 'المحفظة التابعة' : 'Parent Portfolio'} <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.portfolioId}
                    onChange={(e) => {
                      setFormData({ ...formData, portfolioId: Number(e.target.value) });
                      if (formValidationErrors.portfolioId) setFormValidationErrors({ ...formValidationErrors, portfolioId: '' });
                    }}
                    className={`w-full px-3 py-2 bg-slate-50 border rounded-lg focus:bg-white focus:outline-none ${
                      formValidationErrors.portfolioId ? 'border-rose-400' : 'border-slate-300 focus:border-blue-600'
                    }`}
                  >
                    <option value="">{isAr ? '-- اختر المحفظة --' : '-- Select Portfolio --'}</option>
                    {portfolios.map((p) => (
                      <option key={p.id} value={p.id}>{pickLocalized(lang, p.name, p.nameAr)}</option>
                    ))}
                  </select>
                  {formValidationErrors.portfolioId && (
                    <p className="text-rose-600 text-[11px] mt-1">{formValidationErrors.portfolioId}</p>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    {isAr ? 'الإدارة التابعة' : 'Department'}
                  </label>
                  <select
                    value={formData.departmentId}
                    onChange={(e) => setFormData({ ...formData, departmentId: e.target.value ? Number(e.target.value) : '' })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
                  >
                    <option value="">{isAr ? '-- مؤسسي عام --' : '-- Enterprise-Wide --'}</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{pickLocalized(lang, d.name, d.nameAr)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Owner, Priority, Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    {isAr ? 'المسؤول' : 'Initiative Owner'}
                  </label>
                  <select
                    value={formData.ownerId}
                    onChange={(e) => setFormData({ ...formData, ownerId: e.target.value ? Number(e.target.value) : '' })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
                  >
                    <option value="">{isAr ? '-- غير محدد --' : '-- Unassigned --'}</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{pickLocalized(lang, u.fullName, u.fullNameAr)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    {isAr ? 'الأولوية' : 'Priority'}
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
                  >
                    <option value="Critical">{isAr ? 'حرجة' : 'Critical'}</option>
                    <option value="High">{isAr ? 'عالية' : 'High'}</option>
                    <option value="Medium">{isAr ? 'متوسطة' : 'Medium'}</option>
                    <option value="Low">{isAr ? 'منخفضة' : 'Low'}</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    {isAr ? 'الحالة' : 'Status'}
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
                  >
                    <option value="Draft">{isAr ? 'مسودة' : 'Draft'}</option>
                    <option value="Not Started">{isAr ? 'لم تبدأ' : 'Not Started'}</option>
                    <option value="In Progress">{isAr ? 'قيد التنفيذ' : 'In Progress'}</option>
                    <option value="Completed">{isAr ? 'مكتملة' : 'Completed'}</option>
                    <option value="On Hold">{isAr ? 'معلقة' : 'On Hold'}</option>
                  </select>
                </div>
              </div>

              {/* Dates & Progress */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    {isAr ? 'تاريخ البدء' : 'Start Date'}
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono focus:bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    {isAr ? 'تاريخ الانتهاء المستهدف' : 'Target Date'}
                  </label>
                  <input
                    type="date"
                    value={formData.targetDate}
                    onChange={(e) => {
                      setFormData({ ...formData, targetDate: e.target.value });
                      if (formValidationErrors.targetDate) setFormValidationErrors({ ...formValidationErrors, targetDate: '' });
                    }}
                    className={`w-full px-3 py-2 bg-slate-50 border rounded-lg font-mono focus:bg-white focus:outline-none ${
                      formValidationErrors.targetDate ? 'border-rose-400' : 'border-slate-300 focus:border-blue-600'
                    }`}
                  />
                  {formValidationErrors.targetDate && (
                    <p className="text-rose-600 text-[11px] mt-1">{formValidationErrors.targetDate}</p>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    {isAr ? 'نسبة الإنجاز (%)' : 'Progress (%)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.progressPercentage}
                    onChange={(e) => setFormData({ ...formData, progressPercentage: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold focus:bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  disabled={isSaving}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg font-semibold transition-colors cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {isSaving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  <span>{isAr ? 'حفظ المبادرة' : 'Save Initiative'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Safe Deletion Confirmation Dialog (Story 1.7 & 1.8) */}
      {deleteCandidate && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="p-5 border-b border-slate-200 bg-rose-50/60 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  {isAr ? 'تأكيد حذف المبادرة' : 'Confirm Initiative Deletion'}
                </h3>
                <p className="text-xs text-slate-500">
                  {isAr ? 'التحقق من سلامة البيانات والمشاريع المرتبطة' : 'Integrity and dependency check'}
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-700">
              <p>
                {isAr ? 'أنت على وشك حذف المبادرة التالية:' : 'You are requesting to delete the following initiative:'}
              </p>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="font-bold text-slate-900 text-sm">
                  {pickLocalized(lang, deleteCandidate.name, deleteCandidate.nameAr)}
                </div>
                <div className="text-slate-500 flex items-center gap-2">
                  <span>{isAr ? `المعرف: #${deleteCandidate.id}` : `ID: #${deleteCandidate.id}`}</span>
                  <span>•</span>
                  <span>{pickLocalized(lang, deleteCandidate.portfolioName, deleteCandidate.portfolioNameAr)}</span>
                </div>
              </div>

              {/* Associated Projects Safety Check (Story 1.8 Acceptance Criteria 3 & 4) */}
              {deleteCandidate.projectCount > 0 ? (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-rose-900">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{isAr ? 'لا يمكن الحذف: توجد مشاريع مرتبطة!' : 'Deletion Blocked: Associated Projects Exist!'}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    {isAr
                      ? `هذه المبادرة مرتبطة بـ (${deleteCandidate.projectCount}) مشروع تنفيذي. يمنع نظام الحوكمة حذف المبادرات المرتبطة بمشاريع قائمة لمنع فقدان البيانات.`
                      : `This initiative currently has ${deleteCandidate.projectCount} associated project(s). PMO safety rules prevent deleting initiatives with active projects to protect data integrity.`}
                  </p>
                  <p className="text-[11px] font-semibold text-rose-900">
                    {isAr ? 'الحل: يرجى إعادة تعيين أو حذف المشاريع المرتبطة أولاً.' : 'Action required: Reassign or delete associated projects before deletion.'}
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {isAr ? 'جاهزة للحذف بأمان (لا توجد مشاريع مرتبطة بها).' : 'Safe to delete (0 associated projects).'}
                  </span>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2.5 text-xs">
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                disabled={Boolean(isDeletingId)}
                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg font-semibold transition-colors cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={Boolean(isDeletingId) || deleteCandidate.projectCount > 0}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {isDeletingId && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <span>{isAr ? 'تأكيد الحذف' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
