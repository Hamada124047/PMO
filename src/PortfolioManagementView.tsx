import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from './apiClient';
import {
  Briefcase,
  Search,
  Plus,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Layers,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  FileText,
  RotateCcw,
  CheckCircle2,
  Calendar,
  Building2,
  User,
  ExternalLink,
  ShieldAlert,
  Loader2,
  Compass
} from 'lucide-react';
import { Language, pickLocalized, translateStatus, translations } from './i18n';

export interface AssociatedInitiative {
  id: number;
  name: string;
  nameAr?: string;
  description?: string;
  descriptionAr?: string;
  status: string;
  priority?: string;
  startDate?: string;
  targetDate?: string;
  progressPercentage?: number;
  ownerName?: string | null;
  ownerNameAr?: string | null;
  projectCount?: number;
}

export interface PortfolioItem {
  id: number;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  departmentId: number | null;
  departmentName: string | null;
  departmentNameAr?: string | null;
  ownerId: number | null;
  ownerName: string | null;
  ownerNameAr?: string | null;
  startDate: string;
  endDate: string;
  targetDate: string;
  status: string;
  initiativeCount: number;
  associatedInitiatives?: AssociatedInitiative[];
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

export interface PortfolioManagementViewProps {
  lang: Language;
  currentUserRole?: string;
  showBanner: (type: 'success' | 'error', text: string) => void;
  onNavigateToInitiatives?: (portfolioId?: number, initiativeId?: number) => void;
}

export const PortfolioManagementView: React.FC<PortfolioManagementViewProps> = ({
  lang,
  currentUserRole = 'PMO Manager',
  showBanner,
  onNavigateToInitiatives
}) => {
  const isAr = lang === 'ar';
  const t = translations[lang];

  // RBAC permissions: PMO Manager has portfolio governance management rights
  const canManage = useMemo(() => {
    const role = (currentUserRole || '').trim().toLowerCase();
    return role === 'pmo manager';
  }, [currentUserRole]);

  // State: Data
  const [portfolios, setPortfolios] = useState<PortfolioItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // State: Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [departmentFilter, setDepartmentFilter] = useState<string>('All');

  // State: Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // State: Details Drawer
  const [detailDrawerItem, setDetailDrawerItem] = useState<PortfolioItem | null>(null);
  const [drawerInitiativesLoading, setDrawerInitiativesLoading] = useState<boolean>(false);
  const [drawerInitiatives, setDrawerInitiatives] = useState<AssociatedInitiative[]>([]);

  // State: Create / Edit Modal
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null);
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [formValidationErrors, setFormValidationErrors] = useState<{ [key: string]: string }>({});
  const [formData, setFormData] = useState<{
    name: string;
    nameAr: string;
    description: string;
    descriptionAr: string;
    departmentId: string;
    ownerId: string;
    startDate: string;
    targetDate: string;
    status: string;
  }>({
    name: '',
    nameAr: '',
    description: '',
    descriptionAr: '',
    departmentId: '',
    ownerId: '',
    startDate: '2026-01-01',
    targetDate: '2026-12-31',
    status: 'Active'
  });

  // State: Safe Delete Modal
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const [itemToDelete, setItemToDelete] = useState<PortfolioItem | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState<boolean>(false);
  const [deleteBlockReason, setDeleteBlockReason] = useState<{
    count: number;
    initiatives: { id: number; name: string; nameAr?: string; status: string }[];
  } | null>(null);

  // Status badge config
  const statusConfig: { [key: string]: { labelEn: string; labelAr: string; bg: string; text: string; border: string } } = {
    Active: {
      labelEn: 'Active',
      labelAr: 'نشط',
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      text: 'text-emerald-700 dark:text-emerald-300',
      border: 'border-emerald-200 dark:border-emerald-800'
    },
    Planning: {
      labelEn: 'Planning',
      labelAr: 'قيد التخطيط',
      bg: 'bg-sky-50 dark:bg-sky-950/40',
      text: 'text-sky-700 dark:text-sky-300',
      border: 'border-sky-200 dark:border-sky-800'
    },
    'On Hold': {
      labelEn: 'On Hold',
      labelAr: 'معلق',
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      text: 'text-amber-700 dark:text-amber-300',
      border: 'border-amber-200 dark:border-amber-800'
    },
    Completed: {
      labelEn: 'Completed',
      labelAr: 'مكتمل',
      bg: 'bg-blue-50 dark:bg-blue-950/40',
      text: 'text-blue-700 dark:text-blue-300',
      border: 'border-blue-200 dark:border-blue-800'
    },
    Archived: {
      labelEn: 'Archived',
      labelAr: 'مؤرشف',
      bg: 'bg-slate-100 dark:bg-slate-800',
      text: 'text-slate-600 dark:text-slate-400',
      border: 'border-slate-300 dark:border-slate-700'
    }
  };

  // Helper for status translations
  const renderStatusBadge = (status: string) => {
    const config = statusConfig[status] || {
      labelEn: status,
      labelAr: status,
      bg: 'bg-slate-50',
      text: 'text-slate-700',
      border: 'border-slate-200'
    };
    return (
      <span
        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${config.bg} ${config.text} ${config.border}`}
      >
        {isAr ? config.labelAr : config.labelEn}
      </span>
    );
  };

  // Avatar initials generator
  const getInitials = (name?: string | null) => {
    if (!name) return 'UN';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Load auxiliary options (departments and users) once
  const loadAuxiliaryData = async () => {
    try {
      const [depRes, userRes] = await Promise.all([
        apiFetch('/api/departments'),
        canManage ? apiFetch('/api/users/options') : Promise.resolve(new Response('[]', { status: 200 }))
      ]);

      if (depRes.ok) {
        const dData = await depRes.json();
        setDepartments(Array.isArray(dData) ? dData : []);
      }
      if (userRes.ok) {
        const uData = await userRes.json();
        setUsers(Array.isArray(uData) ? uData : []);
      }
    } catch (err) {
      console.warn('Failed to load auxiliary options:', err);
    }
  };

  // Fetch portfolios with search, filters, and pagination
  const fetchPortfolios = async (page = currentPage, currentSize = pageSize) => {
    setLoading(true);
    setFetchError(null);

    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('pageSize', String(currentSize));
      params.append('paginate', 'true');

      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }
      if (statusFilter !== 'All') {
        params.append('status', statusFilter);
      }
      if (departmentFilter !== 'All') {
        params.append('departmentId', departmentFilter);
      }

      const res = await apiFetch(`/api/portfolios?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load portfolios: ${res.statusText}`);
      }

      const data = await res.json();
      if (data && Array.isArray(data.items)) {
        setPortfolios(data.items);
        setTotalItems(data.total || data.items.length);
        setCurrentPage(data.page || page);
        setTotalPages(data.totalPages || 1);
      } else if (Array.isArray(data)) {
        setPortfolios(data);
        setTotalItems(data.length);
        setTotalPages(Math.ceil(data.length / currentSize) || 1);
      } else {
        setPortfolios([]);
        setTotalItems(0);
        setTotalPages(1);
      }
    } catch (error: any) {
      console.error('Error fetching portfolios:', error);
      const msg = isAr ? 'فشل تحميل سجل المحافظ. يرجى المحاولة مرة أخرى.' : 'Failed to load portfolio registry. Please try again.';
      setFetchError(msg);
      showBanner('error', msg);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadAuxiliaryData();
    fetchPortfolios(1, pageSize);
  }, []);

  // Debounced search / filter trigger
  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchPortfolios(1, pageSize);
    }, 250);
    return () => clearTimeout(timeout);
  }, [searchQuery, statusFilter, departmentFilter]);

  // Open Details Drawer and fetch associated initiatives
  const handleOpenDetailDrawer = async (item: PortfolioItem) => {
    setDetailDrawerItem(item);
    setDrawerInitiativesLoading(true);
    setDrawerInitiatives(item.associatedInitiatives || []);

    try {
      const res = await apiFetch(`/api/portfolios/${item.id}/initiatives`);
      if (res.ok) {
        const initData = await res.json();
        setDrawerInitiatives(Array.isArray(initData) ? initData : []);
      }
    } catch (err) {
      console.warn('Error fetching portfolio initiatives:', err);
    } finally {
      setDrawerInitiativesLoading(false);
    }
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('All');
    setDepartmentFilter('All');
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      nameAr: '',
      description: '',
      descriptionAr: '',
      departmentId: departments.length > 0 ? String(departments[0].id) : '',
      ownerId: users.length > 0 ? String(users[0].id) : '',
      startDate: new Date().toISOString().split('T')[0],
      targetDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'Active'
    });
    setFormValidationErrors({});
    setModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (item: PortfolioItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name || '',
      nameAr: item.nameAr || item.name || '',
      description: item.description || '',
      descriptionAr: item.descriptionAr || item.description || '',
      departmentId: item.departmentId ? String(item.departmentId) : '',
      ownerId: item.ownerId ? String(item.ownerId) : '',
      startDate: item.startDate || '2026-01-01',
      targetDate: item.targetDate || item.endDate || '2026-12-31',
      status: item.status || 'Active'
    });
    setFormValidationErrors({});
    setModalOpen(true);
  };

  // Validate form
  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    const activeName = isAr ? (formData.nameAr.trim() || formData.name.trim()) : (formData.name.trim() || formData.nameAr.trim());

    if (!activeName) {
      errors.name = isAr ? 'اسم المحفظة مطلوب.' : 'Portfolio name is required.';
    }

    if (formData.startDate && formData.targetDate) {
      const start = new Date(formData.startDate);
      const target = new Date(formData.targetDate);
      if (start > target) {
        errors.targetDate = isAr
          ? 'تاريخ الهدف يجب أن يكون بعد تاريخ البداية أو مساوياً له.'
          : 'Target date must be on or after the start date.';
      }
    }

    setFormValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Create or Edit Form
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setFormSubmitting(true);
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
        departmentId: formData.departmentId ? Number(formData.departmentId) : null,
        ownerId: formData.ownerId ? Number(formData.ownerId) : null,
        startDate: formData.startDate,
        targetDate: formData.targetDate,
        endDate: formData.targetDate,
        status: formData.status
      };

      const isEdit = Boolean(editingItem);
      const url = isEdit ? `/api/portfolios/${editingItem!.id}` : '/api/portfolios';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resData = await res.json();

      if (!res.ok) {
        throw new Error(resData.message || (isAr ? 'فشلت العملية' : 'Operation failed'));
      }

      const displayName = isAr ? arName : enName;
      const successMsg = isEdit
        ? isAr
          ? `تم تحديث المحفظة "${displayName}" بنجاح.`
          : `Portfolio "${displayName}" was successfully updated.`
        : isAr
        ? `تم إنشاء المحفظة "${displayName}" بنجاح.`
        : `Portfolio "${displayName}" was successfully created.`;

      showBanner('success', successMsg);
      setModalOpen(false);
      fetchPortfolios(currentPage, pageSize);

      if (detailDrawerItem && editingItem && detailDrawerItem.id === editingItem.id) {
        setDetailDrawerItem({
          ...detailDrawerItem,
          ...resData
        });
      }
    } catch (err: any) {
      console.error('Error saving portfolio:', err);
      const errorMsg = err.message || (isAr ? 'حدث خطأ أثناء حفظ المحفظة.' : 'An error occurred while saving the portfolio.');
      showBanner('error', errorMsg);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Open Safe Delete Confirmation
  const handleOpenDeleteModal = async (item: PortfolioItem) => {
    setItemToDelete(item);
    setDeleteBlockReason(null);

    // If item has initiatives, prepare the blocker details
    if (item.initiativeCount > 0) {
      try {
        const res = await apiFetch(`/api/portfolios/${item.id}/initiatives`);
        if (res.ok) {
          const inits = await res.json();
          setDeleteBlockReason({
            count: item.initiativeCount,
            initiatives: inits
          });
        } else {
          setDeleteBlockReason({
            count: item.initiativeCount,
            initiatives: []
          });
        }
      } catch (e) {
        setDeleteBlockReason({
          count: item.initiativeCount,
          initiatives: []
        });
      }
    }

    setDeleteModalOpen(true);
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;

    const deleteName = pickLocalized(lang, itemToDelete.name, itemToDelete.nameAr);
    if (itemToDelete.initiativeCount > 0) {
      showBanner(
        'error',
        isAr
          ? `لا يمكن حذف المحفظة "${deleteName}" لوجود ${itemToDelete.initiativeCount} مبادرة مرتبطة بها.`
          : `Cannot delete portfolio "${deleteName}" because it has ${itemToDelete.initiativeCount} associated initiative(s).`
      );
      return;
    }

    setDeleteSubmitting(true);
    try {
      const res = await apiFetch(`/api/portfolios/${itemToDelete.id}`, {
        method: 'DELETE'
      });

      const resData = await res.json();

      if (!res.ok) {
        throw new Error(resData.message || (isAr ? 'فشل حذف المحفظة' : 'Failed to delete portfolio'));
      }

      const successMsg = isAr
        ? `تم حذف المحفظة "${deleteName}" بنجاح.`
        : `Portfolio "${deleteName}" was successfully deleted.`;

      showBanner('success', successMsg);
      setDeleteModalOpen(false);
      setItemToDelete(null);

      if (detailDrawerItem && detailDrawerItem.id === itemToDelete.id) {
        setDetailDrawerItem(null);
      }

      fetchPortfolios(currentPage, pageSize);
    } catch (err: any) {
      console.error('Error deleting portfolio:', err);
      const errMsg = err.message || (isAr ? 'حدث خطأ أثناء محاولة حذف المحفظة.' : 'Error while attempting to delete portfolio.');
      showBanner('error', errMsg);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // Pagination Change
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    setCurrentPage(newPage);
    fetchPortfolios(newPage, pageSize);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
    fetchPortfolios(1, newSize);
  };

  return (
    <div className={`space-y-6 ${isAr ? 'text-right' : 'text-left'}`} dir={isAr ? 'rtl' : 'ltr'}>
      {/* ==================== MODULE HEADER ==================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/90 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-500/20">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
                {isAr ? 'إدارة المحافظ' : 'Portfolio Management'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                {isAr
                  ? 'تجميع وتنظيم المبادرات والمشاريع المرتبطة لتمكين مكتب إدارة المشاريع من قيادتها بكفاءة'
                  : 'Group and organize related initiatives and projects to coordinate strategic enterprise delivery'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {canManage && (
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold rounded-lg shadow-sm shadow-blue-600/20 transition-all flex items-center gap-2 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{isAr ? 'محفظة جديدة' : 'New Portfolio'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ==================== SEARCH & FILTERS TOOLBAR ==================== */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          {/* Search Input */}
          <div className="lg:col-span-5 relative">
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
                isAr
                  ? 'البحث باسم المحفظة، الوصف، الإدارة، أو المالك...'
                  : 'Search by portfolio name, description, department, or owner...'
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
              <option value="Active">{isAr ? 'نشط' : 'Active'}</option>
              <option value="Planning">{isAr ? 'قيد التخطيط' : 'Planning'}</option>
              <option value="On Hold">{isAr ? 'معلق' : 'On Hold'}</option>
              <option value="Completed">{isAr ? 'مكتمل' : 'Completed'}</option>
              <option value="Archived">{isAr ? 'مؤرشف' : 'Archived'}</option>
            </select>
          </div>

          {/* Department Filter */}
          <div className="lg:col-span-3">
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full text-xs sm:text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 cursor-pointer"
            >
              <option value="All">{isAr ? 'جميع الإدارات' : 'All Departments'}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {pickLocalized(lang, d.name, d.nameAr)}
                </option>
              ))}
            </select>
          </div>

          {/* Reset Filters Button */}
          <div className="lg:col-span-1 flex justify-end">
            <button
              onClick={handleResetFilters}
              disabled={!searchQuery && statusFilter === 'All' && departmentFilter === 'All'}
              className="w-full sm:w-auto p-2 text-xs text-slate-600 hover:text-blue-600 border border-slate-200 hover:border-blue-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1 cursor-pointer"
              title={isAr ? 'إعادة ضبط التصفية' : 'Reset filters'}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="lg:hidden text-xs">{isAr ? 'إعادة ضبط' : 'Reset'}</span>
            </button>
          </div>
        </div>

        {/* Active Filters Display */}
        {(searchQuery || statusFilter !== 'All' || departmentFilter !== 'All') && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span className="font-medium">{isAr ? 'التصفيات النشطة:' : 'Active Filters:'}</span>
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                <span>{isAr ? `بحث: "${searchQuery}"` : `Search: "${searchQuery}"`}</span>
                <X className="w-3 h-3 cursor-pointer" onClick={() => setSearchQuery('')} />
              </span>
            )}
            {statusFilter !== 'All' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                <span>{isAr ? `الحالة: ${translateStatus(statusFilter, 'ar')}` : `Status: ${statusFilter}`}</span>
                <X className="w-3 h-3 cursor-pointer" onClick={() => setStatusFilter('All')} />
              </span>
            )}
            {departmentFilter !== 'All' && (() => {
              const matchedDept = departments.find((d) => String(d.id) === departmentFilter);
              return (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                <span>
                  {isAr ? 'الإدارة: ' : 'Dept: '}
                  {matchedDept ? pickLocalized(lang, matchedDept.name, matchedDept.nameAr) : departmentFilter}
                </span>
                <X className="w-3 h-3 cursor-pointer" onClick={() => setDepartmentFilter('All')} />
              </span>
              );
            })()}
            <button
              onClick={handleResetFilters}
              className="text-blue-600 hover:underline font-medium cursor-pointer"
            >
              {isAr ? 'مسح الكل' : 'Clear all'}
            </button>
          </div>
        )}
      </div>

      {/* ==================== PORTFOLIO REGISTRY TABLE ==================== */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
            <p className="text-sm text-slate-500">
              {isAr ? 'جارٍ تحميل سجل المحافظ...' : 'Loading portfolio registry...'}
            </p>
          </div>
        ) : fetchError ? (
          <div className="p-8 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
            <p className="text-sm font-semibold text-slate-800">{fetchError}</p>
            <button
              onClick={() => fetchPortfolios(currentPage, pageSize)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 cursor-pointer"
            >
              {isAr ? 'إعادة المحاولة' : 'Retry'}
            </button>
          </div>
        ) : portfolios.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                {isAr ? 'لا توجد محافظ مطابقة' : 'No portfolios found'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                {searchQuery || statusFilter !== 'All' || departmentFilter !== 'All'
                  ? isAr
                    ? 'لم يتم العثور على محافظ تطابق معايير البحث والتصفية المحددة. جرب مسح معايير التصفية.'
                    : 'No portfolios matched your selected search criteria. Try clearing the filters.'
                  : isAr
                  ? 'لم يتم تسجيل أي محفظة حتى الآن. ابدأ بإنشاء أول محفظة في النظام.'
                  : 'No portfolios have been registered yet. Create the first portfolio to get started.'}
              </p>
            </div>
            {searchQuery || statusFilter !== 'All' || departmentFilter !== 'All' ? (
              <button
                onClick={handleResetFilters}
                className="px-3.5 py-1.5 border border-slate-200 text-xs font-semibold text-slate-700 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                {isAr ? 'مسح معايير التصفية' : 'Clear filters'}
              </button>
            ) : canManage ? (
              <button
                onClick={handleOpenCreateModal}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAr ? 'إنشاء أول محفظة' : 'Create first portfolio'}</span>
              </button>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-slate-200/80 text-xs font-semibold text-slate-600">
                  <th className="py-3.5 px-4 w-14 text-start">{isAr ? 'المعرف' : 'ID'}</th>
                  <th className="py-3.5 px-4 text-start">{isAr ? 'المحفظة' : 'Portfolio'}</th>
                  <th className="py-3.5 px-4 text-start">{isAr ? 'الإدارة' : 'Department'}</th>
                  <th className="py-3.5 px-4 text-start">{isAr ? 'المالك' : 'Owner'}</th>
                  <th className="py-3.5 px-4 text-start">{isAr ? 'الجدول الزمني' : 'Timeline'}</th>
                  <th className="py-3.5 px-4 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="py-3.5 px-4 text-center">{isAr ? 'المبادرات' : 'Initiatives'}</th>
                  <th className="py-3.5 px-4 text-end">{isAr ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 text-sm">
                {portfolios.map((p) => {
                  const pName = pickLocalized(lang, p.name, p.nameAr);
                  const pDesc = pickLocalized(lang, p.description, p.descriptionAr);
                  const pDept = pickLocalized(lang, p.departmentName, p.departmentNameAr);
                  const pOwner = pickLocalized(lang, p.ownerName, p.ownerNameAr);
                  return (
                  <tr
                    key={p.id}
                    onClick={() => handleOpenDetailDrawer(p)}
                    className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                  >
                    {/* ID */}
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-500 tabular-nums">
                      #{p.id}
                    </td>

                    {/* Portfolio Name & Description */}
                    <td className="py-3.5 px-4 max-w-xs sm:max-w-sm">
                      <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
                        <span>{pName}</span>
                      </div>
                      {pDesc && (
                        <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                          {pDesc}
                        </div>
                      )}
                    </td>

                    {/* Department */}
                    <td className="py-3.5 px-4 text-xs text-slate-700 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{pDept || (isAr ? 'عام على مستوى المؤسسة' : 'Enterprise-Wide')}</span>
                      </div>
                    </td>

                    {/* Owner */}
                    <td className="py-3.5 px-4 text-xs text-slate-700 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-mono text-[10px] font-bold inline-flex items-center justify-center shrink-0">
                          {getInitials(pOwner)}
                        </span>
                        <span>{pOwner || (isAr ? 'غير محدد' : 'Unassigned')}</span>
                      </div>
                    </td>

                    {/* Dates */}
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{p.startDate}</span>
                        <span className="text-slate-400">→</span>
                        <span className="font-medium text-slate-800">{p.targetDate || p.endDate}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {renderStatusBadge(p.status)}
                    </td>

                    {/* Initiative Count Badge (Feature 5) */}
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full font-mono text-xs font-bold tabular-nums ${
                          p.initiativeCount > 0
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                        title={
                          isAr
                            ? `${p.initiativeCount} مبادرة مرتبطة`
                            : `${p.initiativeCount} linked initiative(s)`
                        }
                      >
                        <Layers className="w-3 h-3 me-1" />
                        {p.initiativeCount}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-end" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => handleOpenDetailDrawer(p)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                          title={isAr ? 'عرض التفاصيل' : 'View details'}
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>

                        {canManage && (
                          <>
                            <button
                              onClick={() => handleOpenEditModal(p)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                              title={isAr ? 'تعديل' : 'Edit'}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleOpenDeleteModal(p)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                              title={isAr ? 'حذف' : 'Delete'}
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
        )}

        {/* ==================== PAGINATION CONTROLS ==================== */}
        {!loading && portfolios.length > 0 && (
          <div className="px-4 py-3 bg-[#F8FAFC] border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
            {/* Range info */}
            <div className="flex items-center gap-2">
              <span>
                {isAr
                  ? `عرض ${(currentPage - 1) * pageSize + 1} إلى ${Math.min(
                      currentPage * pageSize,
                      totalItems
                    )} من إجمالي ${totalItems} محفظة`
                  : `Showing ${(currentPage - 1) * pageSize + 1} to ${Math.min(
                      currentPage * pageSize,
                      totalItems
                    )} of ${totalItems} portfolios`}
              </span>

              {/* Page size selector */}
              <div className="flex items-center gap-1 ml-2">
                <span className="text-slate-400">|</span>
                <span>{isAr ? 'في الصفحة:' : 'Per page:'}</span>
                <select
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="border border-slate-200 rounded px-1.5 py-0.5 bg-white text-xs text-slate-700 cursor-pointer"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                </select>
              </div>
            </div>

            {/* Page navigation buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="p-1.5 rounded border border-slate-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title={isAr ? 'الصفحة السابقة' : 'Previous page'}
              >
                {isAr ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
              </button>

              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pg) => {
                if (
                  totalPages > 7 &&
                  pg !== 1 &&
                  pg !== totalPages &&
                  Math.abs(pg - currentPage) > 1
                ) {
                  if (pg === 2 || pg === totalPages - 1) {
                    return (
                      <span key={pg} className="px-1 text-slate-400">
                        ...
                      </span>
                    );
                  }
                  return null;
                }

                return (
                  <button
                    key={pg}
                    onClick={() => handlePageChange(pg)}
                    className={`min-w-7 h-7 px-2 rounded text-xs font-semibold transition-colors cursor-pointer ${
                      currentPage === pg
                        ? 'bg-blue-600 text-white'
                        : 'border border-slate-200 hover:bg-white text-slate-700'
                    }`}
                  >
                    {pg}
                  </button>
                );
              })}

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded border border-slate-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title={isAr ? 'الصفحة التالية' : 'Next page'}
              >
                {isAr ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ==================== PORTFOLIO DETAILS DRAWER ==================== */}
      {detailDrawerItem && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setDetailDrawerItem(null)}
          />

          {/* Drawer content */}
          <div
            className={`relative w-full max-w-xl bg-white shadow-2xl h-full flex flex-col z-10 overflow-hidden ${
              isAr ? 'text-right' : 'text-left'
            }`}
          >
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {pickLocalized(lang, detailDrawerItem.name, detailDrawerItem.nameAr)}
                  </h2>
                  <span className="text-xs text-slate-500 font-mono">
                    {isAr ? `المعرف #${detailDrawerItem.id}` : `ID #${detailDrawerItem.id}`} · {renderStatusBadge(detailDrawerItem.status)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {canManage && (
                  <button
                    onClick={() => {
                      const item = detailDrawerItem;
                      setDetailDrawerItem(null);
                      handleOpenEditModal(item);
                    }}
                    className="p-2 text-slate-500 hover:text-blue-600 hover:bg-white rounded-lg border border-slate-200 cursor-pointer"
                    title={isAr ? 'تعديل المحفظة' : 'Edit portfolio'}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setDetailDrawerItem(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Description */}
              {pickLocalized(lang, detailDrawerItem.description, detailDrawerItem.descriptionAr) && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    {isAr ? 'الوصف' : 'Description'}
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200/60 leading-relaxed">
                    {pickLocalized(lang, detailDrawerItem.description, detailDrawerItem.descriptionAr)}
                  </p>
                </div>
              )}

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/60">
                  <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    {isAr ? 'الإدارة' : 'Department'}
                  </span>
                  <p className="text-xs font-semibold text-slate-800 mt-1">
                    {pickLocalized(lang, detailDrawerItem.departmentName, detailDrawerItem.departmentNameAr) || (isAr ? 'عام على مستوى المؤسسة' : 'Enterprise-Wide')}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/60">
                  <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    {isAr ? 'مالك المحفظة' : 'Portfolio Owner'}
                  </span>
                  <p className="text-xs font-semibold text-slate-800 mt-1">
                    {pickLocalized(lang, detailDrawerItem.ownerName, detailDrawerItem.ownerNameAr) || (isAr ? 'غير محدد' : 'Unassigned')}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/60">
                  <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {isAr ? 'تاريخ البداية' : 'Start Date'}
                  </span>
                  <p className="text-xs font-mono font-semibold text-slate-800 mt-1">
                    {detailDrawerItem.startDate || '—'}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/60">
                  <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {isAr ? 'تاريخ الهدف / الانتهاء' : 'Target / End Date'}
                  </span>
                  <p className="text-xs font-mono font-semibold text-slate-800 mt-1">
                    {detailDrawerItem.targetDate || detailDrawerItem.endDate || '—'}
                  </p>
                </div>
              </div>

              {/* Associated Initiatives Section (Story 2.9 & 2.10) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-blue-600" />
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      {isAr ? 'المبادرات المرتبطة' : 'Associated Initiatives'}
                    </h4>
                  </div>
                  <span className="px-2 py-0.5 text-xs font-mono font-bold bg-blue-100 text-blue-800 rounded-full">
                    {drawerInitiatives.length}
                  </span>
                </div>

                {drawerInitiativesLoading ? (
                  <div className="p-6 text-center text-xs text-slate-400 space-y-2 bg-slate-50 rounded-lg border border-slate-200/60">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-blue-600" />
                    <p>{isAr ? 'جارٍ تحميل المبادرات...' : 'Loading associated initiatives...'}</p>
                  </div>
                ) : drawerInitiatives.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-slate-200/60">
                    <Layers className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                    <p>{isAr ? 'لا توجد مبادرات مرتبطة بهذه المحفظة حالياً.' : 'No initiatives are currently linked to this portfolio.'}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {drawerInitiatives.map((init) => {
                      const initName = pickLocalized(lang, init.name, init.nameAr);
                      const initDesc = pickLocalized(lang, init.description, init.descriptionAr);
                      const initOwner = pickLocalized(lang, init.ownerName, init.ownerNameAr);
                      return (
                      <div
                        key={init.id}
                        className="p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:shadow-xs transition-all flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] text-slate-400">#{init.id}</span>
                            <span className="font-semibold text-xs text-slate-900 truncate">
                              {initName}
                            </span>
                          </div>
                          {initDesc && (
                            <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                              {initDesc}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                            <span>{initOwner || (isAr ? 'غير محدد' : 'Unassigned')}</span>
                            <span>·</span>
                            <span>{init.targetDate || '—'}</span>
                            {init.projectCount !== undefined && (
                              <>
                                <span>·</span>
                                <span className="font-medium text-slate-600">
                                  {init.projectCount} {isAr ? 'مشاريع' : 'projects'}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            {translateStatus(init.status, lang)}
                          </span>
                          {onNavigateToInitiatives && (
                            <button
                              type="button"
                              onClick={() => {
                                setDetailDrawerItem(null);
                                onNavigateToInitiatives(detailDrawerItem.id, init.id);
                              }}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md cursor-pointer transition-colors"
                              title={isAr ? 'فتح في سجل المبادرات' : 'Open in initiatives registry'}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-mono">
                {isAr ? 'مكتب إدارة المشاريع - نكسورا' : 'NEXORA PMO System'}
              </span>
              <button
                type="button"
                onClick={() => setDetailDrawerItem(null)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== CREATE / EDIT PORTFOLIO MODAL ==================== */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => !formSubmitting && setModalOpen(false)}
          />

          {/* Modal Container */}
          <div
            className={`relative w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-10 ${
              isAr ? 'text-right' : 'text-left'
            }`}
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingItem
                      ? isAr
                        ? 'تعديل المحفظة'
                        : 'Edit Portfolio'
                      : isAr
                      ? 'إنشاء محفظة جديدة'
                      : 'Create New Portfolio'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {isAr
                      ? 'أدخل بيانات المحفظة الاستراتيجية وخصص القسم والمالك والتواريخ'
                      : 'Specify portfolio details, department assignment, owner, and timeline'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !formSubmitting && setModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleFormSubmit} className="p-4 sm:p-5 space-y-4">
              {/* Portfolio Name (Required) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isAr ? 'اسم المحفظة' : 'Portfolio Name'}{' '}
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={isAr ? formData.nameAr : formData.name}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData(isAr ? { ...formData, nameAr: val } : { ...formData, name: val });
                    if (formValidationErrors.name) {
                      setFormValidationErrors({ ...formValidationErrors, name: '' });
                    }
                  }}
                  placeholder={
                    isAr ? 'مثال: محفظة التحول الرقمي' : 'e.g. Digital Transformation Portfolio'
                  }
                  className={`w-full text-xs sm:text-sm border rounded-lg px-3 py-2 bg-slate-50/50 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 ${
                    formValidationErrors.name
                      ? 'border-rose-400 bg-rose-50/30'
                      : 'border-slate-200'
                  }`}
                  disabled={formSubmitting}
                />
                {formValidationErrors.name && (
                  <p className="text-[11px] text-rose-600 mt-1 font-medium">
                    {formValidationErrors.name}
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isAr ? 'الوصف' : 'Description'}
                </label>
                <textarea
                  value={isAr ? formData.descriptionAr : formData.description}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData(isAr ? { ...formData, descriptionAr: val } : { ...formData, description: val });
                  }}
                  rows={3}
                  placeholder={
                    isAr
                      ? 'وصف أهداف المحفظة ونطاق عملها...'
                      : 'Describe the purpose and scope of this strategic portfolio...'
                  }
                  className="w-full text-xs sm:text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 resize-none"
                  disabled={formSubmitting}
                />
              </div>

              {/* Department & Owner */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Department */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isAr ? 'الإدارة' : 'Department'}
                  </label>
                  <select
                    value={formData.departmentId}
                    onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 cursor-pointer"
                    disabled={formSubmitting}
                  >
                    <option value="">{isAr ? 'عام على مستوى المؤسسة' : 'Enterprise-Wide (None)'}</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {pickLocalized(lang, d.name, d.nameAr)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Owner */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isAr ? 'مالك المحفظة' : 'Portfolio Owner'}
                  </label>
                  <select
                    value={formData.ownerId}
                    onChange={(e) => setFormData({ ...formData, ownerId: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 cursor-pointer"
                    disabled={formSubmitting}
                  >
                    <option value="">{isAr ? 'غير محدد' : 'Unassigned'}</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {pickLocalized(lang, u.fullName, u.fullNameAr)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dates & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Start Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isAr ? 'تاريخ البداية' : 'Start Date'}
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    disabled={formSubmitting}
                  />
                </div>

                {/* Target Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isAr ? 'تاريخ الهدف / النهاية' : 'Target Date'}
                  </label>
                  <input
                    type="date"
                    value={formData.targetDate}
                    onChange={(e) => {
                      setFormData({ ...formData, targetDate: e.target.value });
                      if (formValidationErrors.targetDate) {
                        setFormValidationErrors({ ...formValidationErrors, targetDate: '' });
                      }
                    }}
                    className={`w-full text-xs border rounded-lg px-3 py-2 bg-slate-50/50 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 ${
                      formValidationErrors.targetDate
                        ? 'border-rose-400 bg-rose-50/30'
                        : 'border-slate-200'
                    }`}
                    disabled={formSubmitting}
                  />
                  {formValidationErrors.targetDate && (
                    <p className="text-[10px] text-rose-600 mt-0.5 font-medium">
                      {formValidationErrors.targetDate}
                    </p>
                  )}
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isAr ? 'الحالة' : 'Status'}
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 cursor-pointer"
                    disabled={formSubmitting}
                  >
                    <option value="Active">{isAr ? 'نشط' : 'Active'}</option>
                    <option value="Planning">{isAr ? 'قيد التخطيط' : 'Planning'}</option>
                    <option value="On Hold">{isAr ? 'معلق' : 'On Hold'}</option>
                    <option value="Completed">{isAr ? 'مكتمل' : 'Completed'}</option>
                    <option value="Archived">{isAr ? 'مؤرشف' : 'Archived'}</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={formSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors disabled:opacity-50"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold rounded-lg shadow-sm shadow-blue-500/20 cursor-pointer transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {formSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>
                    {editingItem
                      ? isAr
                        ? 'حفظ التعديلات'
                        : 'Save Changes'
                      : isAr
                      ? 'إنشاء المحفظة'
                      : 'Create Portfolio'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== SAFE DELETE CONFIRMATION MODAL (Story 2.7 & 2.8) ==================== */}
      {deleteModalOpen && itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => !deleteSubmitting && setDeleteModalOpen(false)}
          />

          {/* Modal Container */}
          <div
            className={`relative w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 p-5 z-10 ${
              isAr ? 'text-right' : 'text-left'
            }`}
          >
            {/* Blocker Alert if Associated Initiatives Exist */}
            {itemToDelete.initiativeCount > 0 ? (
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                  <ShieldAlert className="w-6 h-6" />
                </div>

                <div className="text-center">
                  <h3 className="text-base font-bold text-slate-900">
                    {isAr ? 'لا يمكن حذف هذه المحفظة' : 'Cannot Delete Portfolio'}
                  </h3>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    {isAr
                      ? `تحتوي المحفظة "${pickLocalized(lang, itemToDelete.name, itemToDelete.nameAr)}" على ${itemToDelete.initiativeCount} مبادرة مرتبطة بها. للحفاظ على سلامة البيانات، يجب إعادة تعيين هذه المبادرات أو حذفها قبل حذف المحفظة.`
                      : `The portfolio "${pickLocalized(lang, itemToDelete.name, itemToDelete.nameAr)}" currently contains ${itemToDelete.initiativeCount} associated initiative(s). To preserve data integrity, please reassign or delete these initiatives first.`}
                  </p>
                </div>

                {deleteBlockReason && deleteBlockReason.initiatives.length > 0 && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-40 overflow-y-auto space-y-1.5 text-xs">
                    <p className="font-semibold text-slate-700">
                      {isAr ? 'المبادرات المرتبطة:' : 'Associated Initiatives:'}
                    </p>
                    {deleteBlockReason.initiatives.map((init) => (
                      <div
                        key={init.id}
                        className="flex items-center justify-between text-[11px] text-slate-600 bg-white p-1.5 rounded border border-slate-100"
                      >
                        <span className="truncate max-w-[200px]">{pickLocalized(lang, init.name, init.nameAr)}</span>
                        <span className="font-mono text-[10px] text-slate-400">{translateStatus(init.status, lang)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setDeleteModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                  >
                    {isAr ? 'فهمت، إلغاء' : 'Understood, Close'}
                  </button>
                </div>
              </div>
            ) : (
              /* Safe Deletion Allowed (0 initiatives) */
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-6 h-6" />
                </div>

                <div className="text-center">
                  <h3 className="text-base font-bold text-slate-900">
                    {isAr ? 'تأكيد حذف المحفظة' : 'Confirm Portfolio Deletion'}
                  </h3>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    {isAr
                      ? `هل أنت متأكد من رغبتك في حذف المحفظة "${pickLocalized(lang, itemToDelete.name, itemToDelete.nameAr)}"؟ لا توجد مبادرات مرتبطة بها، ويمكن حذفها بأمان.`
                      : `Are you sure you want to delete the portfolio "${pickLocalized(lang, itemToDelete.name, itemToDelete.nameAr)}"? It has zero associated initiatives and can be deleted safely.`}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setDeleteModalOpen(false)}
                    disabled={deleteSubmitting}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    disabled={deleteSubmitting}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-semibold rounded-lg shadow-sm shadow-rose-500/20 cursor-pointer transition-all flex items-center gap-1.5"
                  >
                    {deleteSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{isAr ? 'تأكيد الحذف' : 'Confirm Deletion'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
