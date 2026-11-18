import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from './apiClient';
import {
  Building2,
  Search,
  Plus,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Briefcase,
  Layers,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  FileText,
  RotateCcw,
  CheckCircle2,
  User,
  ExternalLink,
  ShieldAlert,
  Loader2,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { Language, pickLocalized, translateStatus, translations } from './i18n';

export interface RelatedPortfolio {
  id: number;
  name: string;
  nameAr?: string;
  description?: string;
  descriptionAr?: string;
  status: string;
  startDate?: string;
  endDate?: string;
  targetDate?: string;
  ownerName?: string | null;
  ownerNameAr?: string | null;
  initiativeCount?: number;
}

export interface RelatedInitiative {
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
  portfolioId?: number;
  portfolioName?: string | null;
  portfolioNameAr?: string | null;
  ownerName?: string | null;
  ownerNameAr?: string | null;
  projectCount?: number;
}

export interface DepartmentItem {
  id: number;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  managerId: number | null;
  responsibleManagerId: number | null;
  responsibleManagerName: string | null;
  responsibleManagerNameAr?: string | null;
  isActive: boolean;
  portfolioCount: number;
  initiativeCount: number;
  associatedPortfolios?: RelatedPortfolio[];
  associatedInitiatives?: RelatedInitiative[];
}

interface UserOption {
  id: number;
  fullName: string;
  fullNameAr?: string;
}

export interface DepartmentManagementViewProps {
  lang: Language;
  currentUserRole?: string;
  showBanner: (type: 'success' | 'error', text: string) => void;
  onNavigateToPortfolio?: (portfolioId: number) => void;
  onNavigateToInitiative?: (initiativeId: number) => void;
}

export const DepartmentManagementView: React.FC<DepartmentManagementViewProps> = ({
  lang,
  currentUserRole = 'PMO Manager',
  showBanner,
  onNavigateToPortfolio,
  onNavigateToInitiative
}) => {
  const isAr = lang === 'ar';
  const t = translations[lang];

  // RBAC permissions: PMO Manager has department governance management rights
  const canManage = useMemo(() => {
    const role = (currentUserRole || '').trim().toLowerCase();
    return role === 'pmo manager';
  }, [currentUserRole]);

  // State: Data
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // State: Search & Filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('All');

  // State: Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // State: Details Drawer & Relationships
  const [detailDrawerItem, setDetailDrawerItem] = useState<DepartmentItem | null>(null);
  const [relationshipsLoading, setRelationshipsLoading] = useState<boolean>(false);
  const [relatedPortfolios, setRelatedPortfolios] = useState<RelatedPortfolio[]>([]);
  const [relatedInitiatives, setRelatedInitiatives] = useState<RelatedInitiative[]>([]);
  const [activeDrawerTab, setActiveDrawerTab] = useState<'overview' | 'portfolios' | 'initiatives'>('overview');

  // State: Create / Edit Modal
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<DepartmentItem | null>(null);
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [formValidationErrors, setFormValidationErrors] = useState<{ [key: string]: string }>({});
  const [formData, setFormData] = useState<{
    name: string;
    nameAr: string;
    description: string;
    descriptionAr: string;
    responsibleManagerId: string;
    isActive: boolean;
  }>({
    name: '',
    nameAr: '',
    description: '',
    descriptionAr: '',
    responsibleManagerId: '',
    isActive: true
  });

  // State: Safe Delete Modal
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const [itemToDelete, setItemToDelete] = useState<DepartmentItem | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState<boolean>(false);
  const [deleteBlockData, setDeleteBlockData] = useState<{
    portfolios: { id: number; name: string; nameAr?: string; status: string }[];
    initiatives: { id: number; name: string; nameAr?: string; status: string }[];
  } | null>(null);

  // Avatar initials helper
  const getInitials = (name?: string | null) => {
    if (!name) return 'UN';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Load users for responsible manager selection
  const loadUsers = async () => {
    if (!canManage) return;
    try {
      const res = await apiFetch('/api/users/options');
      if (res.ok) {
        const uData = await res.json();
        setUsers(Array.isArray(uData) ? uData : []);
      }
    } catch (err) {
      console.warn('Failed to load users for department managers:', err);
    }
  };

  // Fetch departments with search, status, and pagination
  const fetchDepartments = async (page = currentPage, currentSize = pageSize) => {
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
      if (activeFilter === 'Active') {
        params.append('isActive', 'true');
      } else if (activeFilter === 'Inactive') {
        params.append('isActive', 'false');
      }

      const res = await apiFetch(`/api/departments?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load departments: ${res.statusText}`);
      }

      const data = await res.json();
      if (data && Array.isArray(data.items)) {
        setDepartments(data.items);
        setTotalItems(data.total || data.items.length);
        setCurrentPage(data.page || page);
        setTotalPages(data.totalPages || 1);
      } else if (Array.isArray(data)) {
        setDepartments(data);
        setTotalItems(data.length);
        setTotalPages(Math.ceil(data.length / currentSize) || 1);
      } else {
        setDepartments([]);
        setTotalItems(0);
        setTotalPages(1);
      }
    } catch (error: any) {
      console.error('Error fetching departments:', error);
      const msg = isAr ? 'فشل تحميل سجل الإدارات. يرجى المحاولة مرة أخرى.' : 'Failed to load department registry. Please try again.';
      setFetchError(msg);
      showBanner('error', msg);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadUsers();
    fetchDepartments(1, pageSize);
  }, []);

  // Debounced search / filter trigger
  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchDepartments(1, pageSize);
    }, 250);
    return () => clearTimeout(timeout);
  }, [searchQuery, activeFilter]);

  // Open Details Drawer and load related records (Story 3.9 & 3.10)
  const handleOpenDetailDrawer = async (item: DepartmentItem) => {
    setDetailDrawerItem(item);
    setActiveDrawerTab('overview');
    setRelationshipsLoading(true);
    setRelatedPortfolios(item.associatedPortfolios || []);
    setRelatedInitiatives(item.associatedInitiatives || []);

    try {
      const res = await apiFetch(`/api/departments/${item.id}/relationships`);
      if (res.ok) {
        const relData = await res.json();
        setRelatedPortfolios(Array.isArray(relData.portfolios) ? relData.portfolios : []);
        setRelatedInitiatives(Array.isArray(relData.initiatives) ? relData.initiatives : []);
      }
    } catch (err) {
      console.warn('Error fetching department relationships:', err);
    } finally {
      setRelationshipsLoading(false);
    }
  };

  // Clear / Reset search
  const handleResetFilters = () => {
    setSearchQuery('');
    setActiveFilter('All');
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      nameAr: '',
      description: '',
      descriptionAr: '',
      responsibleManagerId: users.length > 0 ? String(users[0].id) : '',
      isActive: true
    });
    setFormValidationErrors({});
    setModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (item: DepartmentItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name || '',
      nameAr: item.nameAr || item.name || '',
      description: item.description || '',
      descriptionAr: item.descriptionAr || item.description || '',
      responsibleManagerId: item.responsibleManagerId || item.managerId ? String(item.responsibleManagerId || item.managerId) : '',
      isActive: item.isActive !== undefined ? item.isActive : true
    });
    setFormValidationErrors({});
    setModalOpen(true);
  };

  // Validate Form (Story 3.4)
  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    const activeName = isAr ? (formData.nameAr.trim() || formData.name.trim()) : (formData.name.trim() || formData.nameAr.trim());

    if (!activeName) {
      errors.name = isAr ? 'اسم الإدارة مطلوب.' : 'Department name is required.';
    } else {
      const trimmed = activeName.toLowerCase();
      const duplicate = departments.some(
        (d) =>
          (!editingItem || d.id !== editingItem.id) &&
          (d.name.trim().toLowerCase() === trimmed || (d.nameAr || '').trim().toLowerCase() === trimmed)
      );
      if (duplicate) {
        errors.name = isAr
          ? 'يوجد قسم بهذا الاسم مسبقاً.'
          : 'A department with this name already exists.';
      }
    }

    setFormValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Form (Create or Update)
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
        responsibleManagerId: formData.responsibleManagerId ? Number(formData.responsibleManagerId) : null,
        managerId: formData.responsibleManagerId ? Number(formData.responsibleManagerId) : null,
        isActive: formData.isActive
      };

      const isEdit = Boolean(editingItem);
      const url = isEdit ? `/api/departments/${editingItem!.id}` : '/api/departments';
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
          ? `تم تحديث الإدارة "${displayName}" بنجاح.`
          : `Department "${displayName}" was successfully updated.`
        : isAr
        ? `تم إنشاء الإدارة "${displayName}" بنجاح.`
        : `Department "${displayName}" was successfully created.`;

      showBanner('success', successMsg);
      setModalOpen(false);
      fetchDepartments(currentPage, pageSize);

      if (detailDrawerItem && editingItem && detailDrawerItem.id === editingItem.id) {
        setDetailDrawerItem({
          ...detailDrawerItem,
          ...resData
        });
      }
    } catch (err: any) {
      console.error('Error saving department:', err);
      const errorMsg = err.message || (isAr ? 'حدث خطأ أثناء حفظ الإدارة.' : 'An error occurred while saving the department.');
      showBanner('error', errorMsg);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Open Safe Delete Confirmation (Story 3.7 & 3.8)
  const handleOpenDeleteModal = async (item: DepartmentItem) => {
    setItemToDelete(item);
    setDeleteBlockData(null);

    const hasRelations = item.portfolioCount > 0 || item.initiativeCount > 0;
    if (hasRelations) {
      try {
        const res = await apiFetch(`/api/departments/${item.id}/relationships`);
        if (res.ok) {
          const relData = await res.json();
          setDeleteBlockData({
            portfolios: Array.isArray(relData.portfolios) ? relData.portfolios : [],
            initiatives: Array.isArray(relData.initiatives) ? relData.initiatives : []
          });
        } else {
          setDeleteBlockData({ portfolios: [], initiatives: [] });
        }
      } catch (e) {
        setDeleteBlockData({ portfolios: [], initiatives: [] });
      }
    }

    setDeleteModalOpen(true);
  };

  // Confirm Safe Delete
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;

    const itemName = pickLocalized(lang, itemToDelete.name, itemToDelete.nameAr);
    if (itemToDelete.portfolioCount > 0 || itemToDelete.initiativeCount > 0) {
      showBanner(
        'error',
        isAr
          ? `لا يمكن حذف الإدارة "${itemName}" لوجود سجلات مرتبطة بها.`
          : `Cannot delete department "${itemName}" because it has associated records.`
      );
      return;
    }

    setDeleteSubmitting(true);
    try {
      const res = await apiFetch(`/api/departments/${itemToDelete.id}`, {
        method: 'DELETE'
      });

      const resData = await res.json();

      if (!res.ok) {
        throw new Error(resData.message || (isAr ? 'فشل حذف الإدارة' : 'Failed to delete department'));
      }

      const successMsg = isAr
        ? `تم حذف الإدارة "${itemName}" بنجاح.`
        : `Department "${itemName}" was successfully deleted.`;

      showBanner('success', successMsg);
      setDeleteModalOpen(false);
      setItemToDelete(null);

      if (detailDrawerItem && detailDrawerItem.id === itemToDelete.id) {
        setDetailDrawerItem(null);
      }

      fetchDepartments(currentPage, pageSize);
    } catch (err: any) {
      console.error('Error deleting department:', err);
      const errMsg = err.message || (isAr ? 'حدث خطأ أثناء محاولة حذف الإدارة.' : 'Error while attempting to delete department.');
      showBanner('error', errMsg);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // Pagination Change
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    setCurrentPage(newPage);
    fetchDepartments(newPage, pageSize);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
    fetchDepartments(1, newSize);
  };

  return (
    <div className={`space-y-6 ${isAr ? 'text-right' : 'text-left'}`} dir={isAr ? 'rtl' : 'ltr'}>
      {/* ==================== MODULE HEADER ==================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/90 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
                {isAr ? 'إدارة الإدارات والأقسام' : 'Department Management'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                {isAr
                  ? 'الهيكل التنظيمي للمؤسسة لربط المحافظ والمبادرات والمشاريع وتعيين المدراء المسؤولين'
                  : 'Organizational hierarchy linking strategic portfolios, initiatives, and responsible department managers'}
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
              <span>{isAr ? 'إدارة جديدة' : 'New Department'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ==================== SEARCH & FILTERS TOOLBAR ==================== */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          {/* Search Input (Story 3.5 & 3.6) */}
          <div className="lg:col-span-8 relative">
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
                  ? 'البحث باسم الإدارة، الوصف، أو المدير المسؤول...'
                  : 'Search by department name, description, or responsible manager...'
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

          {/* Active Status Filter */}
          <div className="lg:col-span-3">
            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
              className="w-full text-xs sm:text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 cursor-pointer"
            >
              <option value="All">{isAr ? 'جميع الحالات' : 'All Statuses'}</option>
              <option value="Active">{isAr ? 'نشط فقط' : 'Active Only'}</option>
              <option value="Inactive">{isAr ? 'غير نشط' : 'Inactive Only'}</option>
            </select>
          </div>

          {/* Reset Filters Button */}
          <div className="lg:col-span-1 flex justify-end">
            <button
              onClick={handleResetFilters}
              disabled={!searchQuery && activeFilter === 'All'}
              className="w-full sm:w-auto p-2 text-xs text-slate-600 hover:text-blue-600 border border-slate-200 hover:border-blue-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1 cursor-pointer"
              title={isAr ? 'إعادة ضبط التصفية' : 'Reset search'}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="lg:hidden text-xs">{isAr ? 'إعادة ضبط' : 'Reset'}</span>
            </button>
          </div>
        </div>

        {/* Active Filters Display */}
        {(searchQuery || activeFilter !== 'All') && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span className="font-medium">{isAr ? 'التصفيات النشطة:' : 'Active Filters:'}</span>
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                <span>{isAr ? `بحث: "${searchQuery}"` : `Search: "${searchQuery}"`}</span>
                <X className="w-3 h-3 cursor-pointer" onClick={() => setSearchQuery('')} />
              </span>
            )}
            {activeFilter !== 'All' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                <span>
                  {isAr
                    ? `الحالة: ${translateStatus(activeFilter, 'ar')}`
                    : `Status: ${activeFilter}`}
                </span>
                <X className="w-3 h-3 cursor-pointer" onClick={() => setActiveFilter('All')} />
              </span>
            )}
            <button
              onClick={handleResetFilters}
              className="text-blue-600 hover:underline font-medium cursor-pointer"
            >
              {isAr ? 'مسح الكل' : 'Clear all'}
            </button>
          </div>
        )}
      </div>

      {/* ==================== DEPARTMENT REGISTRY TABLE (Story 3.1 & 3.2) ==================== */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
            <p className="text-sm text-slate-500">
              {isAr ? 'جارٍ تحميل سجل الإدارات...' : 'Loading department registry...'}
            </p>
          </div>
        ) : fetchError ? (
          <div className="p-8 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
            <p className="text-sm font-semibold text-slate-800">{fetchError}</p>
            <button
              onClick={() => fetchDepartments(currentPage, pageSize)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 cursor-pointer"
            >
              {isAr ? 'إعادة المحاولة' : 'Retry'}
            </button>
          </div>
        ) : departments.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                {isAr ? 'لا توجد إدارات مطابقة' : 'No departments found'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                {searchQuery || activeFilter !== 'All'
                  ? isAr
                    ? 'لم يتم العثور على أي إدارة تطابق معايير البحث الحالية. جرب مسح معايير البحث.'
                    : 'No departments matched your search query. Try clearing the search filter.'
                  : isAr
                  ? 'لم يتم تسجيل أي إدارة حتى الآن. ابدأ بإنشاء أول إدارة في النظام.'
                  : 'No departments have been registered yet. Create the first department to establish your organizational structure.'}
              </p>
            </div>
            {searchQuery || activeFilter !== 'All' ? (
              <button
                onClick={handleResetFilters}
                className="px-3.5 py-1.5 border border-slate-200 text-xs font-semibold text-slate-700 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                {isAr ? 'مسح معايير البحث' : 'Clear search'}
              </button>
            ) : canManage ? (
              <button
                onClick={handleOpenCreateModal}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAr ? 'إنشاء أول إدارة' : 'Create first department'}</span>
              </button>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-slate-200/80 text-xs font-semibold text-slate-600">
                  <th className="py-3.5 px-4 w-14 text-start">{isAr ? 'المعرف' : 'ID'}</th>
                  <th className="py-3.5 px-4 text-start">{isAr ? 'الإدارة' : 'Department'}</th>
                  <th className="py-3.5 px-4 text-start">{isAr ? 'المدير المسؤول' : 'Responsible Manager'}</th>
                  <th className="py-3.5 px-4 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="py-3.5 px-4 text-center">{isAr ? 'المحافظ' : 'Portfolios'}</th>
                  <th className="py-3.5 px-4 text-center">{isAr ? 'المبادرات' : 'Initiatives'}</th>
                  <th className="py-3.5 px-4 text-end">{isAr ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 text-sm">
                {departments.map((d) => {
                  const deptName = pickLocalized(lang, d.name, d.nameAr);
                  const deptDesc = pickLocalized(lang, d.description, d.descriptionAr);
                  const mgrName = pickLocalized(lang, d.responsibleManagerName, d.responsibleManagerNameAr);
                  return (
                  <tr
                    key={d.id}
                    onClick={() => handleOpenDetailDrawer(d)}
                    className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                  >
                    {/* ID */}
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-500 tabular-nums">
                      #{d.id}
                    </td>

                    {/* Department Name & Description */}
                    <td className="py-3.5 px-4 max-w-xs sm:max-w-md">
                      <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {deptName}
                      </div>
                      {deptDesc && (
                        <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                          {deptDesc}
                        </div>
                      )}
                    </td>

                    {/* Responsible Manager */}
                    <td className="py-3.5 px-4 text-xs text-slate-700 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-mono text-[10px] font-bold inline-flex items-center justify-center shrink-0">
                          {getInitials(mgrName)}
                        </span>
                        <span>{mgrName || (isAr ? 'غير محدد' : 'Unassigned')}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                          d.isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        {d.isActive ? (isAr ? 'نشط' : 'Active') : isAr ? 'غير نشط' : 'Inactive'}
                      </span>
                    </td>

                    {/* Portfolios Count */}
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full font-mono text-xs font-bold tabular-nums ${
                          d.portfolioCount > 0
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                        title={
                          isAr
                            ? `${d.portfolioCount} محفظة مرتبطة`
                            : `${d.portfolioCount} linked portfolio(s)`
                        }
                      >
                        <Briefcase className="w-3 h-3 me-1" />
                        {d.portfolioCount}
                      </span>
                    </td>

                    {/* Initiatives Count */}
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full font-mono text-xs font-bold tabular-nums ${
                          d.initiativeCount > 0
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                        title={
                          isAr
                            ? `${d.initiativeCount} مبادرة مرتبطة`
                            : `${d.initiativeCount} linked initiative(s)`
                        }
                      >
                        <Layers className="w-3 h-3 me-1" />
                        {d.initiativeCount}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-end" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => handleOpenDetailDrawer(d)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                          title={isAr ? 'عرض التفاصيل والعلاقات' : 'View details & relationships'}
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>

                        {canManage && (
                          <>
                            <button
                              onClick={() => handleOpenEditModal(d)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                              title={isAr ? 'تعديل' : 'Edit'}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleOpenDeleteModal(d)}
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
        {!loading && departments.length > 0 && (
          <div className="px-4 py-3 bg-[#F8FAFC] border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
            {/* Range info */}
            <div className="flex items-center gap-2">
              <span>
                {isAr
                  ? `عرض ${(currentPage - 1) * pageSize + 1} إلى ${Math.min(
                      currentPage * pageSize,
                      totalItems
                    )} من إجمالي ${totalItems} إدارة`
                  : `Showing ${(currentPage - 1) * pageSize + 1} to ${Math.min(
                      currentPage * pageSize,
                      totalItems
                    )} of ${totalItems} departments`}
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

      {/* ==================== DEPARTMENT DETAILS DRAWER & RELATIONSHIPS (Story 3.9 & 3.10) ==================== */}
      {detailDrawerItem && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setDetailDrawerItem(null)}
          />

          {/* Drawer container */}
          <div
            className={`relative w-full max-w-xl bg-white shadow-2xl h-full flex flex-col z-10 overflow-hidden ${
              isAr ? 'text-right' : 'text-left'
            }`}
          >
            {/* Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {pickLocalized(lang, detailDrawerItem.name, detailDrawerItem.nameAr)}
                  </h2>
                  <span className="text-xs text-slate-500 font-mono">
                    {isAr ? `المعرف #${detailDrawerItem.id}` : `ID #${detailDrawerItem.id}`} ·{' '}
                    {detailDrawerItem.isActive
                      ? isAr
                        ? 'نشط'
                        : 'Active'
                      : isAr
                      ? 'غير نشط'
                      : 'Inactive'}
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
                    title={isAr ? 'تعديل الإدارة' : 'Edit department'}
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

            {/* Sub-tabs inside drawer */}
            <div className="px-5 border-b border-slate-200 flex items-center gap-4 bg-white text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveDrawerTab('overview')}
                className={`py-3 border-b-2 cursor-pointer transition-colors ${
                  activeDrawerTab === 'overview'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {isAr ? 'نظرة عامة' : 'Overview'}
              </button>
              <button
                type="button"
                onClick={() => setActiveDrawerTab('portfolios')}
                className={`py-3 border-b-2 cursor-pointer transition-colors flex items-center gap-1.5 ${
                  activeDrawerTab === 'portfolios'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>{isAr ? 'المحافظ المرتبطة' : 'Linked Portfolios'}</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 text-[10px] font-mono">
                  {relatedPortfolios.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveDrawerTab('initiatives')}
                className={`py-3 border-b-2 cursor-pointer transition-colors flex items-center gap-1.5 ${
                  activeDrawerTab === 'initiatives'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>{isAr ? 'المبادرات المرتبطة' : 'Linked Initiatives'}</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 text-[10px] font-mono">
                  {relatedInitiatives.length}
                </span>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {relationshipsLoading ? (
                <div className="p-12 text-center space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
                  <p className="text-xs text-slate-500">
                    {isAr ? 'جارٍ تحميل العلاقات...' : 'Loading relationships...'}
                  </p>
                </div>
              ) : (
                <>
                  {/* TAB 1: OVERVIEW */}
                  {activeDrawerTab === 'overview' && (
                    <div className="space-y-6">
                      {/* Description */}
                      {pickLocalized(lang, detailDrawerItem.description, detailDrawerItem.descriptionAr) && (
                        <div>
                          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                            {isAr ? 'الوصف والنطاق' : 'Description & Scope'}
                          </h4>
                          <p className="text-xs sm:text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200/60 leading-relaxed">
                            {pickLocalized(lang, detailDrawerItem.description, detailDrawerItem.descriptionAr)}
                          </p>
                        </div>
                      )}

                      {/* Details Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/60">
                          <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {isAr ? 'المدير المسؤول' : 'Responsible Manager'}
                          </span>
                          <p className="text-xs font-semibold text-slate-800 mt-1">
                            {pickLocalized(lang, detailDrawerItem.responsibleManagerName, detailDrawerItem.responsibleManagerNameAr) || (isAr ? 'غير محدد' : 'Unassigned')}
                          </p>
                        </div>

                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/60">
                          <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                            {isAr ? 'الحالة التشغيلية' : 'Operational Status'}
                          </span>
                          <p className="text-xs font-semibold text-slate-800 mt-1">
                            {detailDrawerItem.isActive
                              ? isAr
                                ? 'نشط في النظام'
                                : 'Active in System'
                              : isAr
                              ? 'معطل / غير نشط'
                              : 'Inactive / Archived'}
                          </p>
                        </div>

                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/60">
                          <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                            <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                            {isAr ? 'عدد المحافظ' : 'Portfolios Count'}
                          </span>
                          <p className="text-xs font-mono font-bold text-blue-700 mt-1">
                            {relatedPortfolios.length} {isAr ? 'محفظة' : 'portfolio(s)'}
                          </p>
                        </div>

                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/60">
                          <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5 text-slate-400" />
                            {isAr ? 'عدد المبادرات' : 'Initiatives Count'}
                          </span>
                          <p className="text-xs font-mono font-bold text-indigo-700 mt-1">
                            {relatedInitiatives.length} {isAr ? 'مبادرة' : 'initiative(s)'}
                          </p>
                        </div>
                      </div>

                      {/* Quick Summary of Associated PMO Work */}
                      <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/40">
                        <h4 className="text-xs font-bold text-blue-900 mb-1">
                          {isAr ? 'ملخص الارتباط المؤسسي' : 'Organizational Work Summary'}
                        </h4>
                        <p className="text-xs text-blue-700 leading-relaxed">
                          {isAr
                            ? `ترتبط هذه الإدارة بـ ${relatedPortfolios.length} محفظة استراتيجية و ${relatedInitiatives.length} مبادرة تنفيذية. استخدم التبويبات أعلاه لاستعراض السجلات أو الانتقال المباشر إليها.`
                            : `This department oversees ${relatedPortfolios.length} strategic portfolio(s) and ${relatedInitiatives.length} delivery initiative(s). Use the tabs above to review records or navigate directly.`}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: PORTFOLIOS */}
                  {activeDrawerTab === 'portfolios' && (
                    <div className="space-y-3">
                      {relatedPortfolios.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-slate-200/60">
                          <Briefcase className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                          <p>
                            {isAr
                              ? 'لا توجد محافظ استراتيجية مرتبطة بهذه الإدارة حالياً.'
                              : 'No strategic portfolios are linked to this department.'}
                          </p>
                        </div>
                      ) : (
                        relatedPortfolios.map((p) => {
                          const portName = pickLocalized(lang, p.name, p.nameAr);
                          const portDesc = pickLocalized(lang, p.description, p.descriptionAr);
                          const portOwner = pickLocalized(lang, p.ownerName, p.ownerNameAr);
                          return (
                          <div
                            key={p.id}
                            className="p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:shadow-xs transition-all flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[10px] text-slate-400">#{p.id}</span>
                                <span className="font-semibold text-xs text-slate-900 truncate">
                                  {portName}
                                </span>
                              </div>
                              {portDesc && (
                                <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                                  {portDesc}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                                <span>{portOwner || (isAr ? 'غير محدد' : 'Unassigned')}</span>
                                <span>·</span>
                                <span>{p.targetDate || p.endDate || '—'}</span>
                                {p.initiativeCount !== undefined && (
                                  <>
                                    <span>·</span>
                                    <span className="font-medium text-slate-600">
                                      {p.initiativeCount} {isAr ? 'مبادرات' : 'initiatives'}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                {translateStatus(p.status, lang)}
                              </span>
                              {onNavigateToPortfolio && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDetailDrawerItem(null);
                                    onNavigateToPortfolio(p.id);
                                  }}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md cursor-pointer transition-colors"
                                  title={isAr ? 'فتح المحفظة' : 'Open portfolio'}
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* TAB 3: INITIATIVES */}
                  {activeDrawerTab === 'initiatives' && (
                    <div className="space-y-3">
                      {relatedInitiatives.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-slate-200/60">
                          <Layers className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                          <p>
                            {isAr
                              ? 'لا توجد مبادرات مرتبطة بهذه الإدارة حالياً.'
                              : 'No initiatives are linked to this department.'}
                          </p>
                        </div>
                      ) : (
                        relatedInitiatives.map((i) => {
                          const initName = pickLocalized(lang, i.name, i.nameAr);
                          const initDesc = pickLocalized(lang, i.description, i.descriptionAr);
                          const initPort = pickLocalized(lang, i.portfolioName, i.portfolioNameAr);
                          const initOwner = pickLocalized(lang, i.ownerName, i.ownerNameAr);
                          return (
                          <div
                            key={i.id}
                            className="p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:shadow-xs transition-all flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[10px] text-slate-400">#{i.id}</span>
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
                                <span>{initPort || (isAr ? 'محفظة' : 'Portfolio')}</span>
                                <span>·</span>
                                <span>{initOwner || (isAr ? 'غير محدد' : 'Unassigned')}</span>
                                {i.progressPercentage !== undefined && (
                                  <>
                                    <span>·</span>
                                    <span className="font-medium text-blue-600">
                                      {i.progressPercentage}%
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                {translateStatus(i.status, lang)}
                              </span>
                              {onNavigateToInitiative && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDetailDrawerItem(null);
                                    onNavigateToInitiative(i.id);
                                  }}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md cursor-pointer transition-colors"
                                  title={isAr ? 'فتح المبادرة' : 'Open initiative'}
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
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

      {/* ==================== CREATE / EDIT MODAL (Story 3.3 & 3.4) ==================== */}
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
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingItem
                      ? isAr
                        ? 'تعديل الإدارة'
                        : 'Edit Department'
                      : isAr
                      ? 'إنشاء إدارة جديدة'
                      : 'Create New Department'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {isAr
                      ? 'حدد اسم الإدارة، الوصف، والمدير المسؤول لربطها بالهيكل التنظيمي'
                      : 'Define department name, description, and assign the responsible manager'}
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
              {/* Department Name (Required & Unique) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isAr ? 'اسم الإدارة' : 'Department Name'}{' '}
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
                    isAr ? 'مثال: تقنية المعلومات أو الموارد البشرية' : 'e.g. Information Technology or Corporate Finance'
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
                      ? 'وصف مسؤوليات الإدارة ونطاق إشرافها في المؤسسة...'
                      : 'Describe department scope and organizational responsibilities...'
                  }
                  className="w-full text-xs sm:text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 resize-none"
                  disabled={formSubmitting}
                />
              </div>

              {/* Responsible Manager */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isAr ? 'المدير المسؤول' : 'Responsible Manager'}
                </label>
                <select
                  value={formData.responsibleManagerId}
                  onChange={(e) => setFormData({ ...formData, responsibleManagerId: e.target.value })}
                  className="w-full text-xs sm:text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 cursor-pointer"
                  disabled={formSubmitting}
                >
                  <option value="">{isAr ? 'غير محدد (بدون تعيين)' : 'Unassigned (None)'}</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {pickLocalized(lang, u.fullName, u.fullNameAr)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200/60">
                <div>
                  <span className="text-xs font-semibold text-slate-800">
                    {isAr ? 'حالة الإدارة' : 'Department Status'}
                  </span>
                  <p className="text-[11px] text-slate-500">
                    {formData.isActive
                      ? isAr
                        ? 'الإدارة نشطة ومتاحة للربط بالمحافظ والمشاريع'
                        : 'Active and available for linking to PMO structures'
                      : isAr
                      ? 'الإدارة معطلة / غير نشطة'
                      : 'Inactive / archived department'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                  className={`text-2xl transition-colors cursor-pointer ${
                    formData.isActive ? 'text-blue-600' : 'text-slate-400'
                  }`}
                >
                  {formData.isActive ? (
                    <ToggleRight className="w-8 h-8" />
                  ) : (
                    <ToggleLeft className="w-8 h-8" />
                  )}
                </button>
              </div>

              {/* Buttons */}
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
                      ? 'إنشاء الإدارة'
                      : 'Create Department'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== SAFE DELETE CONFIRMATION MODAL (Story 3.7 & 3.8) ==================== */}
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
            {/* Blocker Alert if Associated Records Exist */}
            {itemToDelete.portfolioCount > 0 || itemToDelete.initiativeCount > 0 ? (
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                  <ShieldAlert className="w-6 h-6" />
                </div>

                <div className="text-center">
                  <h3 className="text-base font-bold text-slate-900">
                    {isAr ? 'لا يمكن حذف هذه الإدارة' : 'Cannot Delete Department'}
                  </h3>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    {isAr
                      ? `ترتبط الإدارة "${pickLocalized(lang, itemToDelete.name, itemToDelete.nameAr)}" حالياً بـ ${itemToDelete.portfolioCount} محفظة و ${itemToDelete.initiativeCount} مبادرة. لحماية سلامة البيانات المؤسسية، يجب إعادة تعيين هذه السجلات أو حذفها قبل إزالة الإدارة.`
                      : `The department "${pickLocalized(lang, itemToDelete.name, itemToDelete.nameAr)}" is currently associated with ${itemToDelete.portfolioCount} portfolio(s) and ${itemToDelete.initiativeCount} initiative(s). To protect organizational data integrity, please reassign or delete the associated records first.`}
                  </p>
                </div>

                {deleteBlockData && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-44 overflow-y-auto space-y-2 text-xs">
                    {deleteBlockData.portfolios.length > 0 && (
                      <div>
                        <span className="font-semibold text-slate-700 block mb-1">
                          {isAr ? 'المحافظ المرتبطة:' : 'Associated Portfolios:'}
                        </span>
                        <div className="space-y-1">
                          {deleteBlockData.portfolios.map((p) => (
                            <div
                              key={p.id}
                              className="flex items-center justify-between text-[11px] text-slate-600 bg-white p-1 rounded border border-slate-100"
                            >
                              <span className="truncate max-w-[200px]">{pickLocalized(lang, p.name, p.nameAr)}</span>
                              <span className="font-mono text-[10px] text-slate-400">{translateStatus(p.status, lang)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {deleteBlockData.initiatives.length > 0 && (
                      <div>
                        <span className="font-semibold text-slate-700 block mb-1">
                          {isAr ? 'المبادرات المرتبطة:' : 'Associated Initiatives:'}
                        </span>
                        <div className="space-y-1">
                          {deleteBlockData.initiatives.map((i) => (
                            <div
                              key={i.id}
                              className="flex items-center justify-between text-[11px] text-slate-600 bg-white p-1 rounded border border-slate-100"
                            >
                              <span className="truncate max-w-[200px]">{pickLocalized(lang, i.name, i.nameAr)}</span>
                              <span className="font-mono text-[10px] text-slate-400">{translateStatus(i.status, lang)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
              /* Safe Deletion Allowed (0 associated records) */
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-6 h-6" />
                </div>

                <div className="text-center">
                  <h3 className="text-base font-bold text-slate-900">
                    {isAr ? 'تأكيد حذف الإدارة' : 'Confirm Department Deletion'}
                  </h3>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    {isAr
                      ? `هل أنت متأكد من رغبتك في حذف الإدارة "${pickLocalized(lang, itemToDelete.name, itemToDelete.nameAr)}"؟ لا توجد محافظ أو مبادرات مرتبطة بها، ويمكن حذفها بأمان.`
                      : `Are you sure you want to delete the department "${pickLocalized(lang, itemToDelete.name, itemToDelete.nameAr)}"? It has zero associated portfolios or initiatives and can be removed safely.`}
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
