import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from './apiClient';
import {
  Users,
  Search,
  Plus,
  Edit2,
  Eye,
  EyeOff,
  Shield,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  UserX,
  Mail,
  User,
  Lock,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  X,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { Language, pickLocalized, translateRole, translateRoleDescription } from './i18n';

export interface RoleOption {
  id: number;
  name: string;
  description: string;
  descriptionAr?: string;
}

export interface ManagedUserItem {
  id: number;
  fullName: string;
  fullNameAr?: string;
  email: string;
  username: string;
  roleId: number;
  roleName: string;
  roleDescription?: string;
  roleDescriptionAr?: string;
  isActive: boolean;
}

interface UserManagementViewProps {
  lang: Language;
  currentUserRole?: string;
  currentUserId?: number;
  isAdminAccount?: boolean;
  showBanner: (type: 'success' | 'error', text: string) => void;
  onUsersChanged?: () => void;
}

const getInitials = (name?: string | null): string => {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

const getRoleBadgeClasses = (roleName: string): string => {
  if (roleName === 'PMO Manager') {
    return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  }
  if (roleName === 'Project Manager') {
    return 'bg-blue-50 text-blue-700 border-blue-200';
  }
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  lang,
  currentUserRole = '',
  currentUserId,
  isAdminAccount,
  showBanner,
  onUsersChanged
}) => {
  const isAr = lang === 'ar';
  const isAdmin =
    isAdminAccount !== undefined
      ? isAdminAccount
      : (currentUserRole || '').trim().toLowerCase() === 'pmo manager';

  // Data & Pagination State
  const [users, setUsers] = useState<ManagedUserItem[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Filters State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Detail Drawer State
  const [detailUser, setDetailUser] = useState<ManagedUserItem | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);

  // Create / Edit Modal State
  const [formModalOpen, setFormModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<ManagedUserItem | null>(null);
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [formServerError, setFormServerError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [formData, setFormData] = useState<{
    fullName: string;
    fullNameAr: string;
    username: string;
    email: string;
    password: string;
    roleId: string;
    isActive: boolean;
  }>({
    fullName: '',
    fullNameAr: '',
    username: '',
    email: '',
    password: '',
    roleId: '',
    isActive: true
  });

  // Activation / Deactivation Confirmation Modal State
  const [statusCandidate, setStatusCandidate] = useState<{
    user: ManagedUserItem;
    nextActive: boolean;
  } | null>(null);
  const [statusSubmitting, setStatusSubmitting] = useState<boolean>(false);

  const fetchRoles = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await apiFetch('/api/roles');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setRoles(data);
      }
    } catch {
      // ignore; roles are also returned in /api/users paginated payload
    }
  }, [isAdmin]);

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(currentPage));
      params.set('pageSize', String(pageSize));
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (roleFilter !== 'All') params.set('roleId', roleFilter);
      if (statusFilter !== 'All') params.set('status', statusFilter.toLowerCase());

      const res = await apiFetch(`/api/users?${params.toString()}`);
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(
          errBody.message ||
            (isAr ? 'تعذر تحميل سجل المستخدمين.' : 'Unable to load user directory.')
        );
      }
      const data = await res.json();
      setUsers(Array.isArray(data.items) ? data.items : []);
      setTotalItems(typeof data.total === 'number' ? data.total : 0);
      setTotalPages(typeof data.totalPages === 'number' ? Math.max(1, data.totalPages) : 1);
      if (typeof data.page === 'number' && data.page !== currentPage) {
        setCurrentPage(data.page);
      }
      if (Array.isArray(data.roles) && data.roles.length > 0) {
        setRoles(data.roles);
      }
    } catch (err: any) {
      const msg =
        err.message ||
        (isAr ? 'تعذر الاتصال بخدمة إدارة المستخدمين.' : 'Unable to reach user management service.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, currentPage, pageSize, searchQuery, roleFilter, statusFilter, isAr]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter, statusFilter, pageSize]);

  if (!isAdmin) {
    return (
      <div className="bg-white border border-rose-200 rounded-2xl p-10 text-center max-w-xl mx-auto mt-10 shadow-xs space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">
          {isAr ? 'وصول مقيد للمسؤولين فقط' : 'Administrator Access Required'}
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          {isAr
            ? 'لا تملك الصلاحيات اللازمة لعرض أو إدارة حسابات المستخدمين والأدوار. يرجى التواصل مع مدير مكتب إدارة المشاريع.'
            : 'You do not have permission to view or manage system user accounts and roles. Please contact a PMO Manager.'}
        </p>
      </div>
    );
  }

  const hasActiveFilters =
    searchQuery.trim() !== '' || roleFilter !== 'All' || statusFilter !== 'All';

  const clearFilters = () => {
    setSearchQuery('');
    setRoleFilter('All');
    setStatusFilter('All');
    setCurrentPage(1);
  };

  const handleOpenDetails = async (user: ManagedUserItem) => {
    setDetailUser(user);
    setDetailLoading(true);
    try {
      const res = await apiFetch(`/api/users/${user.id}`);
      if (res.ok) {
        const fresh = await res.json();
        setDetailUser(fresh);
      }
    } catch {
      // keep summary view
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    const defaultRole = roles.find((r) => r.name === 'Team Member') || roles[0];
    setEditingUser(null);
    setFormData({
      fullName: '',
      fullNameAr: '',
      username: '',
      email: '',
      password: '',
      roleId: defaultRole ? String(defaultRole.id) : '',
      isActive: true
    });
    setValidationErrors({});
    setFormServerError(null);
    setShowPassword(false);
    setFormModalOpen(true);
  };

  const handleOpenEditModal = (user: ManagedUserItem) => {
    setEditingUser(user);
    setFormData({
      fullName: user.fullName,
      fullNameAr: user.fullNameAr || user.fullName,
      username: user.username,
      email: user.email,
      password: '',
      roleId: String(user.roleId),
      isActive: user.isActive
    });
    setValidationErrors({});
    setFormServerError(null);
    setShowPassword(false);
    setFormModalOpen(true);
  };

  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};
    const activeFullName = isAr
      ? formData.fullNameAr.trim() || formData.fullName.trim()
      : formData.fullName.trim() || formData.fullNameAr.trim();
    if (!activeFullName) {
      errs.fullName = isAr ? 'الاسم الكامل مطلوب' : 'Full name is required';
    }
    if (!formData.username.trim()) {
      errs.username = isAr ? 'اسم المستخدم مطلوب' : 'Username is required';
    }
    if (!formData.email.trim()) {
      errs.email = isAr ? 'البريد الإلكتروني مطلوب' : 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errs.email = isAr ? 'صيغة البريد الإلكتروني غير صالحة' : 'Please enter a valid email address';
    }
    if (!formData.roleId) {
      errs.roleId = isAr ? 'الدور الوظيفي مطلوب' : 'Role selection is required';
    }
    if (!editingUser) {
      if (!formData.password) {
        errs.password = isAr ? 'كلمة المرور مطلوبة' : 'Password is required';
      } else if (formData.password.length < 6) {
        errs.password = isAr
          ? 'يجب أن تكون كلمة المرور 6 أحرف على الأقل'
          : 'Password must be at least 6 characters long';
      }
    } else if (formData.password && formData.password.length < 6) {
      errs.password = isAr
        ? 'يجب أن تكون كلمة المرور 6 أحرف على الأقل'
        : 'Password must be at least 6 characters long';
    }

    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormServerError(null);
    if (!validateForm()) return;

    setFormSubmitting(true);
    try {
      const payload: Record<string, any> = {
        fullName: formData.fullName.trim() || formData.fullNameAr.trim(),
        fullNameAr: formData.fullNameAr.trim() || formData.fullName.trim(),
        username: formData.username.trim(),
        email: formData.email.trim(),
        roleId: Number(formData.roleId),
        isActive: formData.isActive
      };
      if (formData.password) {
        payload.password = formData.password;
      }

      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const msg =
          errBody.message ||
          (isAr ? 'تعذر حفظ بيانات المستخدم.' : 'Failed to save user account.');
        setFormServerError(msg);
        return;
      }

      const saved = await res.json();
      setFormModalOpen(false);
      if (detailUser && detailUser.id === saved.id) {
        setDetailUser(saved);
      }
      const savedDisplayName = pickLocalized(lang, saved.fullName, saved.fullNameAr);
      showBanner(
        'success',
        editingUser
          ? isAr
            ? `تم تحديث حساب "${savedDisplayName}" بنجاح.`
            : `Updated user account "${savedDisplayName}" successfully.`
          : isAr
          ? `تم إنشاء حساب "${savedDisplayName}" بنجاح.`
          : `Created user account "${savedDisplayName}" successfully.`
      );
      await fetchUsers();
      onUsersChanged?.();
    } catch {
      setFormServerError(
        isAr ? 'تعذر الاتصال بخدمة حفظ الحسابات.' : 'Unable to reach user account service.'
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleConfirmToggleStatus = async () => {
    if (!statusCandidate) return;
    setStatusSubmitting(true);
    try {
      const res = await apiFetch(`/api/users/${statusCandidate.user.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: statusCandidate.nextActive })
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        showBanner(
          'error',
          errBody.message ||
            (isAr ? 'تعذر تحديث حالة الحساب.' : 'Failed to update account status.')
        );
        return;
      }

      const updated: ManagedUserItem = await res.json();
      if (detailUser && detailUser.id === updated.id) {
        setDetailUser(updated);
      }
      const updatedDisplayName = pickLocalized(lang, updated.fullName, updated.fullNameAr);
      showBanner(
        'success',
        updated.isActive
          ? isAr
            ? `تم تفعيل حساب "${updatedDisplayName}" بنجاح.`
            : `Activated user account "${updatedDisplayName}".`
          : isAr
          ? `تم تعطيل حساب "${updatedDisplayName}" وإيقاف وصوله للنظام.`
          : `Deactivated user account "${updatedDisplayName}".`
      );
      setStatusCandidate(null);
      await fetchUsers();
      onUsersChanged?.();
    } catch {
      showBanner(
        'error',
        isAr ? 'تعذر الاتصال بخدمة تحديث حالة الحساب.' : 'Unable to update user account status.'
      );
    } finally {
      setStatusSubmitting(false);
    }
  };

  const activeOnPageCount = users.filter((u) => u.isActive).length;
  const inactiveOnPageCount = users.filter((u) => !u.isActive).length;
  const startIndex = (currentPage - 1) * pageSize;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/90 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>
              {isAr
                ? 'حوكمة الوصول والأدوار والصلاحيات'
                : 'Identity Governance & Role-Based Access Control'}
            </span>
          </div>
          <h1 className="text-2xl font-bold font-display text-slate-900 tracking-tight flex items-center gap-2.5">
            <Users className="w-7 h-7 text-blue-600 shrink-0" />
            <span>{isAr ? 'إدارة المستخدمين والأدوار' : 'User & Role Management'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-3xl">
            {isAr
              ? 'عرض حسابات المستخدمين، إنشاء وتحديث الحسابات، تعيين الأدوار الوظيفية، وتفعيل أو تعطيل صلاحية الدخول.'
              : 'View registered system accounts, create and update users, assign authorization roles, and activate or deactivate access.'}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs hover:shadow transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isAr ? 'مستخدم جديد' : 'New User'}</span>
          </button>
        </div>
      </div>

      {/* 2. Summary Ribbon */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 block mb-1">
            {isAr ? 'إجمالي الحسابات المطابقة' : 'Total Matching Accounts'}
          </span>
          <span className="text-2xl font-bold font-mono text-slate-900">{totalItems}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 block mb-1">
            {isAr ? 'حسابات نشطة (الصفحة الحالية)' : 'Active (Current Page)'}
          </span>
          <span className="text-2xl font-bold font-mono text-emerald-600">
            {activeOnPageCount}
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 block mb-1">
            {isAr ? 'حسابات معطلة (الصفحة الحالية)' : 'Inactive (Current Page)'}
          </span>
          <span className="text-2xl font-bold font-mono text-rose-600">
            {inactiveOnPageCount}
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 block mb-1">
            {isAr ? 'الأدوار المعتمدة بالنظام' : 'Configured System Roles'}
          </span>
          <span className="text-2xl font-bold font-mono text-indigo-600">{roles.length}</span>
        </div>
      </div>

      {/* 3. Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute top-3 start-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isAr
                  ? 'البحث بالاسم أو اسم المستخدم أو البريد الإلكتروني...'
                  : 'Search by full name, username, or email address...'
              }
              className="w-full ps-10 pe-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:border-blue-600"
            >
              <option value="All">{isAr ? 'كافة الأدوار' : 'All Roles'}</option>
              {roles.map((r) => (
                <option key={r.id} value={String(r.id)}>
                  {translateRole(r.name, lang)}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:border-blue-600"
            >
              <option value="All">{isAr ? 'كافة الحالات' : 'All Statuses'}</option>
              <option value="active">{isAr ? 'نشط' : 'Active'}</option>
              <option value="inactive">{isAr ? 'معطل' : 'Inactive'}</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="px-3 py-2 text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isAr ? 'مسح الفلاتر' : 'Reset'}</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
          <span>
            {isAr
              ? `تم العثور على ${totalItems} مستخدم`
              : `Found ${totalItems} user account(s)`}
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

      {/* 4. User Registry Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
            <p className="text-xs text-slate-500 font-medium">
              {isAr ? 'جارٍ تحميل سجل المستخدمين...' : 'Loading user accounts...'}
            </p>
          </div>
        ) : error ? (
          <div className="p-12 text-center space-y-3">
            <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
            <p className="text-sm font-bold text-rose-700">{error}</p>
            <button
              type="button"
              onClick={fetchUsers}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
            >
              {isAr ? 'إعادة المحاولة' : 'Retry'}
            </button>
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Users className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">
              {hasActiveFilters
                ? isAr
                  ? 'لا توجد حسابات مطابقة لمعايير البحث'
                  : 'No user accounts match the selected criteria'
                : isAr
                ? 'لا توجد حسابات مستخدمين مسجلة'
                : 'No user accounts found'}
            </h3>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
              >
                {isAr ? 'مسح الفلاتر' : 'Clear Filters'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                {isAr ? 'إضافة مستخدم جديد' : 'Add New User'}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-start border-collapse text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-4 text-start w-16">{isAr ? 'المعرف' : 'ID'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'المستخدم' : 'User'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'اسم المستخدم' : 'Username'}</th>
                    <th className="py-3.5 px-4 text-start">
                      {isAr ? 'البريد الإلكتروني' : 'Email'}
                    </th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'الدور الوظيفي' : 'Role'}</th>
                    <th className="py-3.5 px-4 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                    <th className="py-3.5 px-4 text-end">{isAr ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {users.map((u) => {
                    const isSelf = currentUserId === u.id;
                    return (
                      <tr
                        key={u.id}
                        onClick={() => handleOpenDetails(u)}
                        className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                      >
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-500">
                          #{u.id}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold font-mono text-xs flex items-center justify-center shrink-0">
                              {getInitials(pickLocalized(lang, u.fullName, u.fullNameAr))}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
                                <span className="truncate">{pickLocalized(lang, u.fullName, u.fullNameAr)}</span>
                                {isSelf && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold">
                                    {isAr ? 'أنت' : 'You'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">@{u.username}</td>
                        <td className="py-3.5 px-4 text-slate-600">{u.email}</td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getRoleBadgeClasses(
                              u.roleName
                            )}`}
                          >
                            <Shield className="w-3 h-3" />
                            <span>{translateRole(u.roleName, lang)}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                              u.isActive
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {u.isActive ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : (
                              <UserX className="w-3 h-3" />
                            )}
                            <span>
                              {u.isActive
                                ? isAr
                                  ? 'نشط'
                                  : 'Active'
                                : isAr
                                ? 'معطل'
                                : 'Inactive'}
                            </span>
                          </span>
                        </td>
                        <td
                          className="py-3.5 px-4 text-end whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenDetails(u)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              title={isAr ? 'عرض التفاصيل' : 'View Details'}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(u)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                              title={isAr ? 'تعديل المستخدم والدور' : 'Edit User & Role'}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              disabled={isSelf && u.isActive}
                              onClick={() =>
                                setStatusCandidate({ user: u, nextActive: !u.isActive })
                              }
                              className={`p-1.5 rounded-lg transition-colors ${
                                isSelf && u.isActive
                                  ? 'text-slate-300 cursor-not-allowed'
                                  : u.isActive
                                  ? 'text-slate-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer'
                                  : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 cursor-pointer'
                              }`}
                              title={
                                isSelf && u.isActive
                                  ? isAr
                                    ? 'لا يمكنك تعطيل حسابك النشط'
                                    : 'Cannot deactivate your own active account'
                                  : u.isActive
                                  ? isAr
                                    ? 'تعطيل الحساب'
                                    : 'Deactivate Account'
                                  : isAr
                                  ? 'تفعيل الحساب'
                                  : 'Activate Account'
                              }
                            >
                              {u.isActive ? (
                                <UserX className="w-4 h-4" />
                              ) : (
                                <UserCheck className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Bar */}
            <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
              <div>
                {isAr
                  ? `عرض ${startIndex + 1} إلى ${Math.min(startIndex + users.length, totalItems)} من إجمالي ${totalItems} حساب`
                  : `Showing ${startIndex + 1} to ${Math.min(startIndex + users.length, totalItems)} of ${totalItems} accounts`}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors flex items-center gap-1 font-semibold"
                >
                  <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
                  <span>{isAr ? 'السابق' : 'Previous'}</span>
                </button>
                <span className="px-3 py-1.5 font-mono font-bold text-slate-700">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors flex items-center gap-1 font-semibold"
                >
                  <span>{isAr ? 'التالي' : 'Next'}</span>
                  <ChevronRight className="w-4 h-4 rtl:rotate-180" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 5. User Details Drawer */}
      {detailUser && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex justify-end animate-in fade-in duration-150"
          onClick={() => setDetailUser(null)}
        >
          <div
            className="w-full max-w-lg bg-white h-full shadow-2xl border-s border-slate-200 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-200 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-bold font-mono text-base flex items-center justify-center shrink-0">
                  {getInitials(pickLocalized(lang, detailUser.fullName, detailUser.fullNameAr))}
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-slate-900 truncate">
                    {pickLocalized(lang, detailUser.fullName, detailUser.fullNameAr)}
                  </h2>
                  <p className="text-xs font-mono text-slate-500">@{detailUser.username}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailUser(null)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-5">
              {detailLoading ? (
                <div className="py-10 text-center">
                  <Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                        {isAr ? 'الدور الوظيفي' : 'Assigned Role'}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getRoleBadgeClasses(
                          detailUser.roleName
                        )}`}
                      >
                        <Shield className="w-3.5 h-3.5" />
                        <span>{translateRole(detailUser.roleName, lang)}</span>
                      </span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                        {isAr ? 'حالة الحساب' : 'Account Status'}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          detailUser.isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {detailUser.isActive
                          ? isAr
                            ? 'نشط'
                            : 'Active'
                          : isAr
                          ? 'معطل'
                          : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
                    <div>
                      <span className="text-slate-500 block mb-0.5">
                        {isAr ? 'البريد الإلكتروني' : 'Email Address'}
                      </span>
                      <span className="font-semibold text-slate-900">{detailUser.email}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-0.5">
                        {isAr ? 'اسم المستخدم' : 'Username'}
                      </span>
                      <span className="font-mono font-semibold text-slate-900">
                        @{detailUser.username}
                      </span>
                    </div>
                    {(detailUser.roleDescription || detailUser.roleDescriptionAr) && (
                      <div>
                        <span className="text-slate-500 block mb-0.5">
                          {isAr ? 'نطاق صلاحيات الدور' : 'Role Scope & Permissions'}
                        </span>
                        <span className="text-slate-700 leading-relaxed">
                          {translateRoleDescription(
                            detailUser.roleName,
                            lang,
                            detailUser.roleDescription,
                            detailUser.roleDescriptionAr
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
              {currentUserId !== detailUser.id || !detailUser.isActive ? (
                <button
                  type="button"
                  onClick={() =>
                    setStatusCandidate({
                      user: detailUser,
                      nextActive: !detailUser.isActive
                    })
                  }
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                    detailUser.isActive
                      ? 'text-rose-600 border-rose-200 hover:bg-rose-50'
                      : 'text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                  }`}
                >
                  {detailUser.isActive ? (
                    <>
                      <UserX className="w-4 h-4" />
                      <span>{isAr ? 'تعطيل الحساب' : 'Deactivate'}</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4" />
                      <span>{isAr ? 'تفعيل الحساب' : 'Activate'}</span>
                    </>
                  )}
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = detailUser;
                    setDetailUser(null);
                    handleOpenEditModal(target);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>{isAr ? 'تعديل المستخدم' : 'Edit User'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDetailUser(null)}
                  className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  {isAr ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Create / Edit User Modal */}
      {formModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {editingUser
                      ? isAr
                        ? 'تحديث بيانات المستخدم'
                        : 'Update User Account'
                      : isAr
                      ? 'إنشاء حساب مستخدم جديد'
                      : 'Create New User Account'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {isAr
                      ? 'تحديد البيانات الأساسية والدور الوظيفي وحالة الحساب'
                      : 'Configure user identity, role assignment, and account status'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFormModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-6 space-y-4">
              {formServerError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formServerError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isAr ? 'الاسم الكامل' : 'Full Name'} <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 absolute start-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={isAr ? formData.fullNameAr : formData.fullName}
                    onChange={(e) =>
                      setFormData(
                        isAr
                          ? { ...formData, fullNameAr: e.target.value }
                          : { ...formData, fullName: e.target.value }
                      )
                    }
                    className="w-full ps-9 pe-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white"
                    placeholder={isAr ? 'مثال: سارة المنصور' : 'e.g. Sarah Connor'}
                  />
                </div>
                {validationErrors.fullName && (
                  <p className="text-[11px] text-rose-600 mt-1">{validationErrors.fullName}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isAr ? 'اسم المستخدم' : 'Username'} <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute start-3 top-2.5 text-xs text-slate-400 font-mono">
                      @
                    </span>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="w-full ps-8 pe-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white font-mono"
                      placeholder="s.connor"
                    />
                  </div>
                  {validationErrors.username && (
                    <p className="text-[11px] text-rose-600 mt-1">{validationErrors.username}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isAr ? 'البريد الإلكتروني' : 'Email Address'}{' '}
                    <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 absolute start-3 top-3 text-slate-400" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full ps-9 pe-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white"
                      placeholder="s.connor@enterprise.org"
                    />
                  </div>
                  {validationErrors.email && (
                    <p className="text-[11px] text-rose-600 mt-1">{validationErrors.email}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isAr ? 'الدور الوظيفي' : 'Assigned Role'}{' '}
                    <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.roleId}
                    onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white font-semibold"
                  >
                    <option value="">{isAr ? 'اختر الدور...' : 'Select role...'}</option>
                    {roles.map((r) => (
                      <option key={r.id} value={String(r.id)}>
                        {translateRole(r.name, lang)}
                      </option>
                    ))}
                  </select>
                  {validationErrors.roleId && (
                    <p className="text-[11px] text-rose-600 mt-1">{validationErrors.roleId}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {editingUser
                      ? isAr
                        ? 'كلمة المرور الجديدة (اختياري)'
                        : 'New Password (Optional)'
                      : isAr
                      ? 'كلمة المرور'
                      : 'Password'}{' '}
                    {!editingUser && <span className="text-rose-500">*</span>}
                  </label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 absolute start-3 top-3 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder={
                        editingUser
                          ? isAr
                            ? 'اتركه فارغاً للإبقاء على الحالية'
                            : 'Leave blank to keep current'
                          : '••••••••'
                      }
                      className="w-full ps-9 pe-9 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute end-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  {validationErrors.password && (
                    <p className="text-[11px] text-rose-600 mt-1">{validationErrors.password}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <div className="text-xs font-semibold text-slate-800">
                    {isAr ? 'حالة تفعيل الحساب' : 'Account Active Status'}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {isAr
                      ? 'يمكن للحسابات النشطة فقط تسجيل الدخول إلى النظام'
                      : 'Only active accounts are permitted to authenticate and access the system'}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  disabled={editingUser?.id === currentUserId && formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 accent-blue-600 cursor-pointer"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setFormModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {formSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>
                    {editingUser
                      ? isAr
                        ? 'حفظ التعديلات'
                        : 'Save Changes'
                      : isAr
                      ? 'إنشاء الحساب'
                      : 'Create Account'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Activate / Deactivate Confirmation Modal */}
      {statusCandidate && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  statusCandidate.nextActive
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                    : 'bg-rose-50 border-rose-200 text-rose-600'
                }`}
              >
                {statusCandidate.nextActive ? (
                  <UserCheck className="w-5 h-5" />
                ) : (
                  <UserX className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {statusCandidate.nextActive
                    ? isAr
                      ? 'تأكيد تفعيل حساب المستخدم'
                      : 'Confirm Account Activation'
                    : isAr
                    ? 'تأكيد تعطيل حساب المستخدم'
                    : 'Confirm Account Deactivation'}
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {statusCandidate.nextActive
                    ? isAr
                      ? `سيتمكن المستخدم "${pickLocalized(lang, statusCandidate.user.fullName, statusCandidate.user.fullNameAr)}" (@${statusCandidate.user.username}) من تسجيل الدخول والوصول إلى النظام مجدداً.`
                      : `User "${pickLocalized(lang, statusCandidate.user.fullName, statusCandidate.user.fullNameAr)}" (@${statusCandidate.user.username}) will regain permission to sign in and access assigned features.`
                    : isAr
                    ? `سيتم منع المستخدم "${pickLocalized(lang, statusCandidate.user.fullName, statusCandidate.user.fullNameAr)}" (@${statusCandidate.user.username}) من تسجيل الدخول أو استخدام النظام مع الاحتفاظ بسجلاته.`
                    : `User "${pickLocalized(lang, statusCandidate.user.fullName, statusCandidate.user.fullNameAr)}" (@${statusCandidate.user.username}) will be blocked from signing in and all active sessions will be rejected.`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStatusCandidate(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={statusSubmitting}
                onClick={handleConfirmToggleStatus}
                className={`px-4 py-2 text-xs font-bold text-white rounded-lg cursor-pointer disabled:opacity-50 flex items-center gap-1.5 ${
                  statusCandidate.nextActive
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {statusSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {statusCandidate.nextActive
                    ? isAr
                      ? 'تفعيل الحساب'
                      : 'Activate Account'
                    : isAr
                    ? 'تعطيل الحساب'
                    : 'Deactivate Account'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
