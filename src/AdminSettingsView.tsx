import React, { useState, useEffect } from 'react';
import { apiFetch } from './apiClient';
import {
  Sliders,
  Eye,
  EyeOff,
  Plus,
  Save,
  RotateCcw,
  Trash2,
  Edit2,
  ShieldCheck,
  Compass,
  FolderKanban,
  Building2,
  Briefcase,
  Layers,
  LayoutDashboard,
  Network,
  ListTodo,
  CheckSquare,
  Sparkles,
  Type,
  FileText,
  Hash,
  Calendar,
  ToggleLeft,
  List,
  CheckCircle2,
  X,
  ExternalLink,
  UserCheck,
  Check,
  AlertTriangle,
  AlertCircle,
  Loader2,
  ArrowUpDown,
  Tag,
  Lock,
  Search,
  Users
} from 'lucide-react';
import {
  AdminSystemSettings,
  ScreenFieldConfig,
  ScreenSchemaConfig,
  DEFAULT_SCREEN_VISIBILITY,
  DEFAULT_SCREEN_SCHEMAS,
  DEFAULT_SYSTEM_ROLES,
  DEFAULT_SCREEN_ROLE_PERMISSIONS,
  FieldInputType
} from './types/adminSettings';
import { Language, translations, translateRole, translateOptionLabel } from './i18n';

interface AdminSettingsViewProps {
  lang: Language;
  currentUserRole?: string;
  currentUserName?: string;
  isAdminAccount?: boolean;
  initialTab?: 'fields' | 'screens' | 'roles';
  showBanner: (type: 'success' | 'error', text: string) => void;
  onNavigateToSection: (section: string) => void;
  onSettingsUpdated: (settings: AdminSystemSettings) => void;
}

export const AdminSettingsView: React.FC<AdminSettingsViewProps> = ({
  lang,
  currentUserRole = 'PMO Manager',
  currentUserName,
  isAdminAccount = true,
  initialTab,
  showBanner,
  onNavigateToSection,
  onSettingsUpdated
}) => {
  const isAdmin = isAdminAccount;
  const t = translations[lang];
  const resolvedUserName = currentUserName || (lang === 'ar' ? 'حمادة الدالي' : 'Hamada El Daley');
  const formatAdminActorName = (name?: string) => {
    const val = (name || '').trim();
    if (!val) return resolvedUserName;
    if (val === 'Hamada El Daley' && lang === 'ar') return 'حمادة الدالي';
    if (val === 'حمادة الدالي' && lang === 'en') return 'Hamada El Daley';
    return val;
  };

  // Primary Tab: 'screens' (Visibility & Menus) | 'fields' (Field Studio & Form Builder) | 'roles' (Role Screen Access)
  const [activeTab, setActiveTab] = useState<'screens' | 'fields' | 'roles'>(initialTab || 'fields');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Loading & Saving States
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Roles available for Role-Screen Access Matrix
  const [availableRoles, setAvailableRoles] = useState<string[]>([...DEFAULT_SYSTEM_ROLES]);
  const [roleMatrixSearch, setRoleMatrixSearch] = useState<string>('');
  const [roleMatrixCategoryFilter, setRoleMatrixCategoryFilter] = useState<'all' | 'core' | 'strategic' | 'registry'>('all');

  // Settings State
  const [settings, setSettings] = useState<AdminSystemSettings>({
    menuVisibility: DEFAULT_SCREEN_VISIBILITY.reduce((acc, item) => {
      acc[item.id] = item.visible;
      return acc;
    }, {} as Record<string, boolean>),
    screenRolePermissions: JSON.parse(JSON.stringify(DEFAULT_SCREEN_ROLE_PERMISSIONS)),
    screenLabels: DEFAULT_SCREEN_VISIBILITY.reduce((acc, item) => {
      acc[item.id] = { ar: item.nameAr, en: item.nameEn };
      return acc;
    }, {} as Record<string, { ar: string; en: string }>),
    screenSchemas: DEFAULT_SCREEN_SCHEMAS,
    lastUpdatedBy: lang === 'ar' ? 'حمادة الدالي' : 'Hamada El Daley',
    lastUpdatedAt: new Date().toISOString()
  });

  // Screen Category Filter for Visibility Tab
  const [screenCategoryFilter, setScreenCategoryFilter] = useState<'all' | 'core' | 'strategic' | 'registry'>('all');

  // Selected Screen for Field Customizer
  const [selectedScreenId, setSelectedScreenId] = useState<string>('strategic-plans');

  // Field Edit / Create Modal State
  const [fieldModalOpen, setFieldModalOpen] = useState<boolean>(false);
  const [editingFieldKey, setEditingFieldKey] = useState<string | null>(null);
  const [fieldFormData, setFieldFormData] = useState<Partial<ScreenFieldConfig>>({
    key: '',
    labelAr: '',
    labelEn: '',
    type: 'text',
    required: false,
    visible: true,
    isCustom: true,
    options: [],
    placeholder: '',
    defaultValue: '',
    helpText: ''
  });
  const [modalOptionsTag, setModalOptionsTag] = useState<string>('');
  const [modalOptionsList, setModalOptionsList] = useState<string[]>([]);

  // Dedicated Dropdown Options Modal State
  const [optionsModalOpen, setOptionsModalOpen] = useState<boolean>(false);
  const [optionsModalFieldKey, setOptionsModalFieldKey] = useState<string | null>(null);
  const [optionsModalFieldLabel, setOptionsModalFieldLabel] = useState<string>('');
  const [optionsList, setOptionsList] = useState<string[]>([]);
  const [newOptionInput, setNewOptionInput] = useState<string>('');
  const [batchOptionsText, setBatchOptionsText] = useState<string>('');
  const [optionsViewMode, setOptionsViewMode] = useState<'tags' | 'batch'>('tags');
  // Delete Confirmation Modal State (No window.confirm!)
  const [deleteConfirmField, setDeleteConfirmField] = useState<ScreenFieldConfig | null>(null);
  const [isDeletingField, setIsDeletingField] = useState<boolean>(false);

  // Reset Confirmation Modal State ('all' | 'screen' | null)
  const [resetConfirmModal, setResetConfirmModal] = useState<'all' | 'screen' | null>(null);

  // Fetch Settings & Roles on Mount
  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    fetchSettings();
    fetchRoles();
  }, [isAdmin]);

  const fetchRoles = async () => {
    try {
      const res = await apiFetch('/api/roles');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const names = data
            .map((r: any) => String(r?.name || '').trim())
            .filter(Boolean);
          if (names.length > 0) {
            setAvailableRoles(names);
          }
        }
      }
    } catch {
      // keep default roles
    }
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        const normalized: AdminSystemSettings = {
          ...data,
          screenRolePermissions: {
            ...DEFAULT_SCREEN_ROLE_PERMISSIONS,
            ...(data.screenRolePermissions || {})
          }
        };
        setSettings(normalized);
        onSettingsUpdated(normalized);
      }
    } catch (err) {
      console.error('Failed to load admin settings:', err);
      showBanner('error', lang === 'ar' ? 'تعذر تحميل إعدادات النظام' : 'Failed to load system settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAll = async () => {
    try {
      setSaving(true);
      const res = await apiFetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          updatedBy: resolvedUserName
        })
      });

      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        onSettingsUpdated(updated);
        setHasUnsavedChanges(false);
        showBanner(
          'success',
          lang === 'ar'
            ? 'تم حفظ وتطبيق كافة إعدادات الشاشات والحقول بنجاح في النظام!'
            : 'All screen and field customization settings saved successfully!'
        );
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      showBanner('error', lang === 'ar' ? 'حدث خطأ أثناء حفظ الإعدادات' : 'Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setResetConfirmModal('all');
  };

  // Reset fields for the currently selected screen
  const handleResetCurrentScreenFields = () => {
    setResetConfirmModal('screen');
  };

  const handleExecuteReset = async () => {
    if (!resetConfirmModal) return;

    if (resetConfirmModal === 'all') {
      try {
        setSaving(true);
        const res = await apiFetch('/api/admin/settings/reset', { method: 'POST' });
        if (res.ok) {
          const resetData = await res.json();
          setSettings(resetData);
          onSettingsUpdated(resetData);
          setHasUnsavedChanges(false);
          showBanner(
            'success',
            lang === 'ar'
              ? 'تمت استعادة إعدادات الشاشات والحقول الافتراضية بنجاح'
              : 'Default screen and field settings restored'
          );
        }
      } catch (err) {
        console.error('Reset error:', err);
        showBanner('error', lang === 'ar' ? 'تعذر استعادة الإعدادات' : 'Failed to reset settings');
      } finally {
        setSaving(false);
        setResetConfirmModal(null);
      }
    } else if (resetConfirmModal === 'screen') {
      try {
        setSaving(true);
        const res = await apiFetch(`/api/admin/screens/${selectedScreenId}/reset`, { method: 'POST' });
        const defaultSchema = DEFAULT_SCREEN_SCHEMAS[selectedScreenId];
        const screenSchemaToUse = res.ok ? await res.json() : (defaultSchema || currentScreenSchema);

        const updated = {
          ...settings,
          screenSchemas: {
            ...settings.screenSchemas,
            [selectedScreenId]: screenSchemaToUse
          }
        };
        setSettings(updated);
        onSettingsUpdated(updated);
        setHasUnsavedChanges(false);
        showBanner(
          'success',
          lang === 'ar' ? 'تمت استعادة حقول هذه الشاشة إلى الحالة الافتراضية' : 'Screen fields reset to defaults'
        );
      } catch (err) {
        console.error('Reset screen error:', err);
      } finally {
        setSaving(false);
        setResetConfirmModal(null);
      }
    }
  };

  // Toggle Screen Visibility
  const handleToggleScreenVisibility = (screenId: string) => {
    const current = settings.menuVisibility[screenId] ?? true;
    const updated = {
      ...settings,
      menuVisibility: {
        ...settings.menuVisibility,
        [screenId]: !current
      }
    };
    setSettings(updated);
    setHasUnsavedChanges(true);
  };

  // Change Screen Label
  const handleScreenLabelChange = (screenId: string, val: string, langKey: 'ar' | 'en') => {
    const currentLabels = settings.screenLabels[screenId] || {
      ar: screenId,
      en: screenId
    };
    const updated = {
      ...settings,
      screenLabels: {
        ...settings.screenLabels,
        [screenId]: {
          ...currentLabels,
          [langKey]: val
        }
      }
    };
    setSettings(updated);
    setHasUnsavedChanges(true);
  };

  // Bulk visibility controls
  const handleShowAllScreens = () => {
    const newVis = { ...settings.menuVisibility };
    DEFAULT_SCREEN_VISIBILITY.forEach((item) => {
      newVis[item.id] = true;
    });
    setSettings({ ...settings, menuVisibility: newVis });
    setHasUnsavedChanges(true);
  };

  const handleHideSecondaryScreens = () => {
    const newVis = { ...settings.menuVisibility };
    newVis['workstreams'] = false;
    newVis['milestones'] = false;
    newVis['activities'] = false;
    setSettings({ ...settings, menuVisibility: newVis });
    setHasUnsavedChanges(true);
  };

  // Role-Based Screen Access Handlers
  const configurableRoleScreens = DEFAULT_SCREEN_VISIBILITY.filter((s) => !s.adminOnly);

  const getAllowedRolesForScreen = (screenId: string): string[] => {
    const configured = settings.screenRolePermissions?.[screenId];
    if (Array.isArray(configured)) {
      return configured;
    }
    return [...availableRoles];
  };

  const isRoleAllowedForScreen = (screenId: string, roleName: string): boolean => {
    return getAllowedRolesForScreen(screenId).includes(roleName);
  };

  const handleToggleScreenRole = (screenId: string, roleName: string) => {
    const currentRoles = getAllowedRolesForScreen(screenId);
    const exists = currentRoles.includes(roleName);
    const nextRoles = exists
      ? currentRoles.filter((r) => r !== roleName)
      : [...currentRoles, roleName];

    setSettings({
      ...settings,
      screenRolePermissions: {
        ...(settings.screenRolePermissions || DEFAULT_SCREEN_ROLE_PERMISSIONS),
        [screenId]: nextRoles
      }
    });
    setHasUnsavedChanges(true);
  };

  const handleSetScreenRolesPreset = (screenId: string, preset: 'all' | 'pmo' | 'none') => {
    let nextRoles: string[] = [];
    if (preset === 'all') {
      nextRoles = [...availableRoles];
    } else if (preset === 'pmo') {
      nextRoles = availableRoles.filter((r) => r === 'PMO Manager');
    }
    setSettings({
      ...settings,
      screenRolePermissions: {
        ...(settings.screenRolePermissions || DEFAULT_SCREEN_ROLE_PERMISSIONS),
        [screenId]: nextRoles
      }
    });
    setHasUnsavedChanges(true);
  };

  const handleToggleAllScreensForRole = (roleName: string, allow: boolean) => {
    const nextMap: Record<string, string[]> = {
      ...(settings.screenRolePermissions || DEFAULT_SCREEN_ROLE_PERMISSIONS)
    };
    configurableRoleScreens.forEach((screen) => {
      const curr = Array.isArray(nextMap[screen.id]) ? nextMap[screen.id] : [...availableRoles];
      if (allow) {
        if (!curr.includes(roleName)) {
          nextMap[screen.id] = [...curr, roleName];
        } else {
          nextMap[screen.id] = curr;
        }
      } else {
        nextMap[screen.id] = curr.filter((r) => r !== roleName);
      }
    });
    setSettings({
      ...settings,
      screenRolePermissions: nextMap
    });
    setHasUnsavedChanges(true);
  };

  const handleResetRolePermissions = () => {
    const resetMap: Record<string, string[]> = {};
    configurableRoleScreens.forEach((screen) => {
      resetMap[screen.id] = [...availableRoles];
    });
    setSettings({
      ...settings,
      screenRolePermissions: resetMap
    });
    setHasUnsavedChanges(true);
  };

  // Current Screen Schema
  const currentScreenSchema = settings.screenSchemas[selectedScreenId] || {
    screenId: selectedScreenId,
    nameAr: selectedScreenId,
    nameEn: selectedScreenId,
    category: 'strategic',
    fields: []
  };

  // 1. DELETE THE WHOLE FIELD (Full Control: custom or system fields - with in-app modal confirmation & immediate backend persistence)
  const handleDeleteFieldClick = (field: ScreenFieldConfig) => {
    setDeleteConfirmField(field);
  };

  const handleExecuteDeleteField = async () => {
    if (!deleteConfirmField) return;
    const fieldKey = deleteConfirmField.key;
    const fieldLabel =
      lang === 'ar'
        ? deleteConfirmField.labelAr || deleteConfirmField.key
        : deleteConfirmField.labelEn || deleteConfirmField.key;

    try {
      setIsDeletingField(true);

      // Call backend DELETE endpoint
      await apiFetch(`/api/admin/screens/${selectedScreenId}/fields/${fieldKey}`, {
        method: 'DELETE'
      });

      // Filter out from local state
      const remainingFields = currentScreenSchema.fields.filter((f) => f.key !== fieldKey);
      const updatedScreenSchema = {
        ...currentScreenSchema,
        fields: remainingFields
      };
      const updated = {
        ...settings,
        screenSchemas: {
          ...settings.screenSchemas,
          [selectedScreenId]: updatedScreenSchema
        }
      };

      setSettings(updated);
      onSettingsUpdated(updated);
      setDeleteConfirmField(null);
      setHasUnsavedChanges(false);

      showBanner(
        'success',
        lang === 'ar'
          ? `تم حذف الحقل "${fieldLabel}" بالكامل بنجاح من الشاشة!`
          : `Field "${fieldLabel}" was deleted successfully!`
      );
    } catch (err) {
      console.error('Delete field error:', err);
      // Fallback local deletion
      const remainingFields = currentScreenSchema.fields.filter((f) => f.key !== fieldKey);
      const updatedScreenSchema = {
        ...currentScreenSchema,
        fields: remainingFields
      };
      const updated = {
        ...settings,
        screenSchemas: {
          ...settings.screenSchemas,
          [selectedScreenId]: updatedScreenSchema
        }
      };
      setSettings(updated);
      onSettingsUpdated(updated);
      setDeleteConfirmField(null);
      showBanner(
        'success',
        lang === 'ar' ? `تم حذف الحقل "${fieldLabel}"` : `Field "${fieldLabel}" deleted`
      );
    } finally {
      setIsDeletingField(false);
    }
  };

  // 2. CHANGE FIELD TYPE (Directly from table or modal)
  const handleFieldTypeChange = (fieldKey: string, newType: FieldInputType) => {
    const fields = currentScreenSchema.fields.map((f) => {
      if (f.key === fieldKey) {
        let options = f.options || [];
        let optionsEn = f.optionsEn || [];
        if (newType === 'select' && options.length === 0) {
          options = lang === 'ar' ? ['خيار أول', 'خيار ثان', 'خيار ثالث'] : ['Option 1', 'Option 2', 'Option 3'];
          optionsEn = ['Option 1', 'Option 2', 'Option 3'];
        }
        return {
          ...f,
          type: newType,
          options,
          optionsEn
        };
      }
      return f;
    });

    const updated = {
      ...settings,
      screenSchemas: {
        ...settings.screenSchemas,
        [selectedScreenId]: {
          ...currentScreenSchema,
          fields
        }
      }
    };
    setSettings(updated);
    setHasUnsavedChanges(true);
    showBanner(
      'success',
      lang === 'ar'
        ? `تم تغيير نوع الحقل إلى "${getFieldTypeName(newType)}"`
        : `Field type changed to "${getFieldTypeName(newType)}"`
    );
  };

  // 3. EDIT DROPDOWN VALUES MODAL HANDLERS
  const handleOpenDropdownOptionsModal = (field: ScreenFieldConfig) => {
    setOptionsModalFieldKey(field.key);
    setOptionsModalFieldLabel(lang === 'ar' ? (field.labelAr || field.key) : (field.labelEn || field.key));
    const localizedOpts =
      lang === 'en' && field.optionsEn && field.optionsEn.length > 0
        ? [...field.optionsEn]
        : (field.options || []).map((o) => translateOptionLabel(o, lang));
    const currentOpts =
      localizedOpts.length > 0
        ? localizedOpts
        : lang === 'ar'
        ? ['خيار أول', 'خيار ثان']
        : ['Option 1', 'Option 2'];
    setOptionsList(currentOpts);
    setBatchOptionsText(currentOpts.join('\n'));
    setNewOptionInput('');
    setOptionsViewMode('tags');
    setOptionsModalOpen(true);
  };

  const handleAddOptionToModal = () => {
    if (!newOptionInput.trim()) return;
    const trimmed = newOptionInput.trim();
    if (!optionsList.includes(trimmed)) {
      const updated = [...optionsList, trimmed];
      setOptionsList(updated);
      setBatchOptionsText(updated.join('\n'));
    }
    setNewOptionInput('');
  };

  const handleRemoveOptionFromModal = (indexToRemove: number) => {
    const updated = optionsList.filter((_, idx) => idx !== indexToRemove);
    setOptionsList(updated);
    setBatchOptionsText(updated.join('\n'));
  };

  const handleSaveDropdownOptions = () => {
    if (!optionsModalFieldKey) return;

    let finalOptions: string[];
    if (optionsViewMode === 'batch') {
      finalOptions = batchOptionsText
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      finalOptions = optionsList.filter((s) => s.trim());
    }

    if (finalOptions.length === 0) {
      finalOptions = [lang === 'ar' ? 'خيار افتراضي' : 'Default Option'];
    }

    const fields = currentScreenSchema.fields.map((f) => {
      if (f.key === optionsModalFieldKey) {
        if (lang === 'en') {
          return {
            ...f,
            options: f.options && f.options.length > 0 ? f.options : finalOptions,
            optionsEn: finalOptions,
            defaultValueEn: finalOptions.includes(f.defaultValueEn || '') ? f.defaultValueEn : (finalOptions[0] || '')
          };
        }
        return {
          ...f,
          options: finalOptions,
          defaultValue: finalOptions.includes(f.defaultValue) ? f.defaultValue : (finalOptions[0] || '')
        };
      }
      return f;
    });

    const updated = {
      ...settings,
      screenSchemas: {
        ...settings.screenSchemas,
        [selectedScreenId]: {
          ...currentScreenSchema,
          fields
        }
      }
    };
    setSettings(updated);
    setHasUnsavedChanges(true);
    setOptionsModalOpen(false);
    showBanner(
      'success',
      lang === 'ar'
        ? `تم تحديث قيم القائمة المنسدلة بنجاح (${finalOptions.length} خيارات)`
        : `Dropdown options updated (${finalOptions.length} options)`
    );
  };

  // Toggle Field Visibility / Required
  const handleToggleFieldVisibility = (fieldKey: string) => {
    const fields = currentScreenSchema.fields.map((f) =>
      f.key === fieldKey ? { ...f, visible: !f.visible } : f
    );
    const updated = {
      ...settings,
      screenSchemas: {
        ...settings.screenSchemas,
        [selectedScreenId]: {
          ...currentScreenSchema,
          fields
        }
      }
    };
    setSettings(updated);
    setHasUnsavedChanges(true);
  };

  const handleToggleFieldRequired = (fieldKey: string) => {
    const fields = currentScreenSchema.fields.map((f) =>
      f.key === fieldKey ? { ...f, required: !f.required } : f
    );
    const updated = {
      ...settings,
      screenSchemas: {
        ...settings.screenSchemas,
        [selectedScreenId]: {
          ...currentScreenSchema,
          fields
        }
      }
    };
    setSettings(updated);
    setHasUnsavedChanges(true);
  };

  const handleInlineFieldLabelChange = (fieldKey: string, val: string, fieldLang: 'ar' | 'en') => {
    const fields = currentScreenSchema.fields.map((f) => {
      if (f.key === fieldKey) {
        return fieldLang === 'ar' ? { ...f, labelAr: val } : { ...f, labelEn: val };
      }
      return f;
    });
    const updated = {
      ...settings,
      screenSchemas: {
        ...settings.screenSchemas,
        [selectedScreenId]: {
          ...currentScreenSchema,
          fields
        }
      }
    };
    setSettings(updated);
    setHasUnsavedChanges(true);
  };

  // Add / Edit Full Field Modal Handlers
  const handleOpenAddFieldModal = () => {
    setEditingFieldKey(null);
    setFieldFormData({
      key: `cf_${Date.now()}`,
      labelAr: '',
      labelEn: '',
      type: 'text',
      required: false,
      visible: true,
      isCustom: true,
      options: [],
      optionsEn: [],
      placeholder: '',
      placeholderEn: '',
      defaultValue: '',
      defaultValueEn: '',
      helpText: ''
    });
    setModalOptionsList(lang === 'ar' ? ['خيار أول', 'خيار ثان'] : ['Option 1', 'Option 2']);
    setModalOptionsTag('');
    setFieldModalOpen(true);
  };

  const handleOpenEditFieldModal = (field: ScreenFieldConfig) => {
    setEditingFieldKey(field.key);
    setFieldFormData({ ...field });
    const displayOpts =
      lang === 'en' && field.optionsEn && field.optionsEn.length > 0
        ? field.optionsEn
        : (field.options || []).map((o) => translateOptionLabel(o, lang));
    setModalOptionsList(displayOpts);
    setModalOptionsTag('');
    setFieldModalOpen(true);
  };

  const handleAddModalOptionTag = () => {
    if (!modalOptionsTag.trim()) return;
    const trimmed = modalOptionsTag.trim();
    if (!modalOptionsList.includes(trimmed)) {
      setModalOptionsList([...modalOptionsList, trimmed]);
    }
    setModalOptionsTag('');
  };

  const handleRemoveModalOptionTag = (idx: number) => {
    setModalOptionsList(modalOptionsList.filter((_, i) => i !== idx));
  };

  const handleSaveFieldFromModal = () => {
    if (!fieldFormData.labelAr?.trim() && !fieldFormData.labelEn?.trim()) {
      showBanner('error', lang === 'ar' ? 'يرجى إدخال اسم الحقل' : 'Field label is required');
      return;
    }

    const labelArVal = fieldFormData.labelAr?.trim() || fieldFormData.labelEn?.trim() || '';
    const labelEnVal = fieldFormData.labelEn?.trim() || fieldFormData.labelAr?.trim() || '';

    const fieldToSave: ScreenFieldConfig = {
      key: fieldFormData.key || `cf_${Date.now()}`,
      labelAr: labelArVal,
      labelEn: labelEnVal,
      type: fieldFormData.type || 'text',
      required: Boolean(fieldFormData.required),
      visible: fieldFormData.visible !== false,
      isCustom: fieldFormData.isCustom !== false,
      options:
        fieldFormData.type === 'select'
          ? (lang === 'en' && fieldFormData.options && fieldFormData.options.length > 0
              ? fieldFormData.options
              : modalOptionsList)
          : [],
      optionsEn:
        fieldFormData.type === 'select'
          ? (lang === 'en'
              ? modalOptionsList
              : (fieldFormData.optionsEn && fieldFormData.optionsEn.length > 0
                  ? fieldFormData.optionsEn
                  : modalOptionsList.map((o) => translateOptionLabel(o, 'en'))))
          : [],
      placeholder: fieldFormData.placeholder || '',
      placeholderEn: fieldFormData.placeholderEn || '',
      defaultValue: fieldFormData.defaultValue || '',
      defaultValueEn: fieldFormData.defaultValueEn || '',
      helpText: fieldFormData.helpText || ''
    };

    let updatedFields: ScreenFieldConfig[];
    if (editingFieldKey) {
      updatedFields = currentScreenSchema.fields.map((f) =>
        f.key === editingFieldKey ? fieldToSave : f
      );
    } else {
      updatedFields = [...currentScreenSchema.fields, fieldToSave];
    }

    const updated = {
      ...settings,
      screenSchemas: {
        ...settings.screenSchemas,
        [selectedScreenId]: {
          ...currentScreenSchema,
          fields: updatedFields
        }
      }
    };
    setSettings(updated);
    setHasUnsavedChanges(true);
    setFieldModalOpen(false);
    showBanner(
      'success',
      editingFieldKey
        ? lang === 'ar'
          ? 'تم تعديل الحقل بنجاح'
          : 'Field updated'
        : lang === 'ar'
        ? 'تمت إضافة الحقل الجديد بنجاح إلى الشاشة'
        : 'New field added to screen'
    );
  };

  // Helper icon for screen ID
  const getScreenIcon = (id: string) => {
    switch (id) {
      case 'strategic-planning':
      case 'strategic-plans':
        return <Compass className="w-5 h-5 text-amber-500" />;
      case 'departments':
        return <Building2 className="w-5 h-5 text-blue-500" />;
      case 'portfolios':
        return <Briefcase className="w-5 h-5 text-indigo-500" />;
      case 'initiatives':
      case 'strategic-initiatives':
        return <Compass className="w-5 h-5 text-emerald-500" />;
      case 'projects':
        return <FolderKanban className="w-5 h-5 text-cyan-500" />;
      case 'project-workspace':
        return <Layers className="w-5 h-5 text-violet-500" />;
      case 'dashboard':
        return <LayoutDashboard className="w-5 h-5 text-rose-500" />;
      case 'hierarchy':
        return <Network className="w-5 h-5 text-amber-600" />;
      case 'workstreams':
        return <GitBranchIcon className="w-5 h-5 text-teal-500" />;
      case 'milestones':
        return <ListTodo className="w-5 h-5 text-orange-500" />;
      case 'activities':
      case 'strategic-activities':
        return <CheckSquare className="w-5 h-5 text-green-500" />;
      default:
        return <Layers className="w-5 h-5 text-slate-500" />;
    }
  };

  const getFieldTypeName = (type: FieldInputType) => {
    switch (type) {
      case 'text':
        return lang === 'ar' ? 'نص عادي' : 'Text';
      case 'textarea':
        return lang === 'ar' ? 'نص طويل' : 'Textarea';
      case 'number':
        return lang === 'ar' ? 'رقم' : 'Number';
      case 'date':
        return lang === 'ar' ? 'تاريخ' : 'Date';
      case 'select':
        return lang === 'ar' ? 'قائمة منسدلة' : 'Dropdown';
      case 'boolean':
        return lang === 'ar' ? 'قيمة منطقية' : 'Boolean';
      default:
        return type;
    }
  };

  const filteredScreens = DEFAULT_SCREEN_VISIBILITY.filter((s) => {
    if (screenCategoryFilter === 'all') return true;
    return s.category === screenCategoryFilter;
  });

  const visibleCount = Object.values(settings.menuVisibility).filter(Boolean).length;
  const hiddenCount = Object.values(settings.menuVisibility).filter((v) => !v).length;
  const totalCustomFieldsCount = Object.values(settings.screenSchemas).reduce(
    (acc, s) => acc + s.fields.filter((f) => f.isCustom).length,
    0
  );

  if (!isAdmin) {
    return (
      <div className="bg-white border border-rose-200 rounded-2xl p-10 text-center max-w-xl mx-auto mt-10 shadow-xs space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">
          {lang === 'ar' ? 'وصول مقيد لحساب مدير النظام فقط' : 'Admin Account Access Required'}
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          {lang === 'ar'
            ? 'لا تملك الصلاحيات اللازمة لعرض استوديو الشاشات والتحكم في ظهور الشاشات. هذه الميزة متاحة لحساب مدير النظام فقط.'
            : 'You do not have permission to access Screen Visibility or Field Studio. This module is restricted to the Admin account.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Banner & Admin Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-indigo-900/50 relative overflow-hidden">
        <div className="absolute top-0 end-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 start-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                <ShieldCheck className="w-3.5 h-3.5" />
                {lang === 'ar' ? 'حساب مدير النظام الأعلى' : 'Super Admin Account'}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <UserCheck className="w-3.5 h-3.5" />
                {resolvedUserName} ({translateRole(currentUserRole, lang)})
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <Sliders className="w-8 h-8 text-indigo-400" />
              <span>
                {lang === 'ar'
                  ? 'استوديو تخصيص الشاشات والحقول'
                  : 'Screen & Field Customization Studio'}
              </span>
            </h1>

            <p className="text-slate-300 text-sm sm:text-base max-w-3xl leading-relaxed">
              {lang === 'ar'
                ? 'تحكم كامل وشامل: حذف أي حقل بالكامل من الشاشة، تغيير نوع الحقل فورياً (نص، قائمة، رقم، تاريخ، مفتاح)، وتعديل قيم وخيارات القوائم المنسدلة بسهولة وحفظها فورياً.'
                : 'Full administrative control: delete the whole field, change field types dynamically, and edit dropdown list options and values.'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {hasUnsavedChanges && (
              <span className="text-xs px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-200 border border-amber-500/30 font-medium animate-pulse">
                {lang === 'ar' ? 'توجد تعديلات غير محفوظة' : 'Unsaved changes'}
              </span>
            )}

            <button
              onClick={handleResetDefaults}
              disabled={saving}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-slate-400" />
              <span>{lang === 'ar' ? 'استعادة كل شيء للافتراضي' : 'Reset Everything'}</span>
            </button>

            <button
              onClick={handleSaveAll}
              disabled={saving}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-lg transition-all cursor-pointer ${
                hasUnsavedChanges
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/30 scale-102 ring-2 ring-blue-400'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
              }`}
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{lang === 'ar' ? 'حفظ وتطبيق التغييرات' : 'Save & Apply Changes'}</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80 text-xs sm:text-sm">
          <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-800/60">
            <span className="text-slate-400 block mb-1">
              {lang === 'ar' ? 'الشاشات المعروضة' : 'Visible Screens'}
            </span>
            <span className="text-xl font-bold text-emerald-400 tabular-nums">
              {visibleCount}
            </span>
          </div>

          <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-800/60">
            <span className="text-slate-400 block mb-1">
              {lang === 'ar' ? 'الشاشات المخفية' : 'Hidden Screens'}
            </span>
            <span className="text-xl font-bold text-amber-400 tabular-nums">
              {hiddenCount}
            </span>
          </div>

          <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-800/60">
            <span className="text-slate-400 block mb-1">
              {lang === 'ar' ? 'حقول الشاشة الحالية' : 'Current Screen Fields'}
            </span>
            <span className="text-xl font-bold text-indigo-400 tabular-nums">
              {currentScreenSchema.fields.length}
            </span>
          </div>

          <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-800/60">
            <span className="text-slate-400 block mb-1">
              {lang === 'ar' ? 'المدير المسؤول' : 'Admin In Charge'}
            </span>
            <span className="text-sm font-semibold text-slate-200 truncate block">
              {formatAdminActorName(settings.lastUpdatedBy)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('fields')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'fields'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-4 h-4 text-indigo-600" />
            <span>
              {lang === 'ar' ? '1. استوديو تخصيص وتعديل الحقول' : '1. Field Customizer Studio'}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-mono tabular-nums">
              {currentScreenSchema.fields.length} {lang === 'ar' ? 'حقول' : 'fields'}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('screens')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'screens'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Eye className="w-4 h-4 text-blue-600" />
            <span>{lang === 'ar' ? '2. التحكم في ظهور الشاشات' : '2. Screen Visibility'}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-mono tabular-nums">
              {DEFAULT_SCREEN_VISIBILITY.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('roles')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'roles'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>{lang === 'ar' ? '3. صلاحيات الشاشات حسب الدور' : '3. Role Screen Access'}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-mono tabular-nums">
              {availableRoles.length}
            </span>
          </button>
        </div>

        {activeTab === 'fields' ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetCurrentScreenFields}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>{lang === 'ar' ? 'استعادة حقول الشاشة الافتراضية' : 'Reset Screen Fields'}</span>
            </button>

            <button
              onClick={handleOpenAddFieldModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>
                {lang === 'ar' ? 'إضافة حقل جديد للشاشة' : 'Add New Field to Screen'}
              </span>
            </button>
          </div>
        ) : activeTab === 'screens' ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleShowAllScreens}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              {lang === 'ar' ? 'إظهار كافة الشاشات' : 'Show All'}
            </button>
            <button
              onClick={handleHideSecondaryScreens}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              {lang === 'ar' ? 'إخفاء المسارات والأنشطة الثانوية' : 'Hide Secondary'}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetRolePermissions}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>{lang === 'ar' ? 'السماح لجميع الأدوار افتراضياً' : 'Allow All Roles (Default)'}</span>
            </button>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* TAB 1: FIELD CUSTOMIZER STUDIO (Full Control)                  */}
      {/* ============================================================== */}
      {activeTab === 'fields' && (
        <div className="space-y-6">
          {/* Screen Selection Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-600" />
                  <span>{lang === 'ar' ? 'اختر الشاشة المراد تعديل حقولها بالكامل:' : 'Select Screen to Fully Customize:'}</span>
                </h3>
                <p className="text-xs text-slate-500">
                  {lang === 'ar'
                    ? 'يمكنك حذف أي حقل بالكامل، تغيير نوع الحقل (نص، قائمة، رقم، تاريخ، مفتاح)، وتعديل خيارات القوائم المنسدلة فورياً.'
                    : 'Delete any field, change field types, and edit dropdown options in real time.'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                  <span>{lang === 'ar' ? 'إجمالي الحقول: ' : 'Total: '}</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {currentScreenSchema.fields.length}
                  </span>
                  <span className="ms-2 text-indigo-600 font-mono">
                    ({currentScreenSchema.fields.filter((f) => f.type === 'select').length} {lang === 'ar' ? 'قوائم منسدلة' : 'dropdowns'})
                  </span>
                </span>
              </div>
            </div>

            {/* Screen Picker Tabs */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
              {Object.keys(settings.screenSchemas).map((screenKey) => {
                const schema = settings.screenSchemas[screenKey];
                const isSelected = selectedScreenId === screenKey;
                return (
                  <button
                    key={screenKey}
                    onClick={() => setSelectedScreenId(screenKey)}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20 scale-102 ring-2 ring-indigo-400/40'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {getScreenIcon(screenKey)}
                    <span>{lang === 'ar' ? schema.nameAr : schema.nameEn}</span>
                    <span
                      className={`text-xs px-1.5 py-0.2 rounded font-mono ${
                        isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {schema.fields.length}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fields Management Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/70">
              <div>
                <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-indigo-600" />
                  <span>
                    {lang === 'ar'
                      ? `حقول شاشة: ${currentScreenSchema.nameAr}`
                      : `Fields for: ${currentScreenSchema.nameEn}`}
                  </span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {lang === 'ar'
                    ? 'تحكم كامل: عدّل الاسم، غيّر نوع الحقل من القائمة المنسدلة، اضغط على "تعديل القيم" لأي قائمة لتغيير خياراتها، أو احذف الحقل بالكامل.'
                    : 'Full control: edit label, change type from dropdown, click "Edit Values" to modify dropdown items, or delete the whole field.'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenAddFieldModal}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'إضافة حقل جديد' : 'Add New Field'}</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4 text-start">{lang === 'ar' ? 'المفتاح' : 'Key'}</th>
                    <th className="py-3 px-4 text-start">
                      {lang === 'ar' ? 'اسم الحقل بالعربية' : 'Arabic Label'}
                    </th>
                    <th className="py-3 px-4 text-start">
                      {lang === 'ar' ? 'اسم الحقل بالإنجليزية' : 'English Label'}
                    </th>
                    <th className="py-3 px-4 text-start min-w-[180px]">
                      {lang === 'ar' ? 'نوع الحقل' : 'Field Type'}
                    </th>
                    <th className="py-3 px-4 text-start min-w-[200px]">
                      {lang === 'ar' ? 'خيارات القائمة المنسدلة' : 'Dropdown Options'}
                    </th>
                    <th className="py-3 px-3 text-center">
                      {lang === 'ar' ? 'إلزامي؟' : 'Required'}
                    </th>
                    <th className="py-3 px-3 text-center">
                      {lang === 'ar' ? 'الظهور' : 'Visible'}
                    </th>
                    <th className="py-3 px-4 text-center">
                      {lang === 'ar' ? 'حذف / إجراءات' : 'Actions'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentScreenSchema.fields.map((field) => (
                    <tr
                      key={field.key}
                      className={`hover:bg-slate-50/90 transition-colors ${
                        !field.visible ? 'bg-slate-50/50 opacity-60' : ''
                      }`}
                    >
                      {/* Key */}
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                        <span className="bg-slate-100 px-2 py-1 rounded text-slate-700 border border-slate-200">
                          {field.key}
                        </span>
                      </td>

                      {/* Arabic Label (Editable) */}
                      <td className="py-3.5 px-4">
                        <input
                          type="text"
                          value={field.labelAr}
                          onChange={(e) =>
                            handleInlineFieldLabelChange(field.key, e.target.value, 'ar')
                          }
                          className="w-full min-w-[150px] px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </td>

                      {/* English Label (Editable) */}
                      <td className="py-3.5 px-4">
                        <input
                          type="text"
                          value={field.labelEn}
                          onChange={(e) =>
                            handleInlineFieldLabelChange(field.key, e.target.value, 'en')
                          }
                          className="w-full min-w-[150px] px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </td>

                      {/* 2. CHANGE FIELD TYPE (Direct interactive dropdown in table!) */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <select
                          value={field.type}
                          onChange={(e) =>
                            handleFieldTypeChange(field.key, e.target.value as FieldInputType)
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50/40 text-indigo-950 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
                        >
                          <option value="text">{lang === 'ar' ? 'نص عادي' : 'Text'}</option>
                          <option value="textarea">{lang === 'ar' ? 'نص طويل' : 'Textarea'}</option>
                          <option value="number">{lang === 'ar' ? 'رقم' : 'Number'}</option>
                          <option value="date">{lang === 'ar' ? 'تاريخ' : 'Date'}</option>
                          <option value="select">{lang === 'ar' ? 'قائمة منسدلة' : 'Dropdown'}</option>
                          <option value="boolean">{lang === 'ar' ? 'قيمة منطقية' : 'Boolean'}</option>
                        </select>
                      </td>

                      {/* 3. DROPDOWN VALUES: View & Edit button */}
                      <td className="py-3.5 px-4">
                        {field.type === 'select' ? (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-mono border border-purple-200">
                                {(field.options || []).length} {lang === 'ar' ? 'خيارات' : 'options'}
                              </span>

                              <button
                                type="button"
                                onClick={() => handleOpenDropdownOptionsModal(field)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-2xs transition-colors cursor-pointer"
                                title={lang === 'ar' ? 'تعديل خيارات وقيم هذه القائمة' : 'Edit dropdown values'}
                              >
                                <List className="w-3.5 h-3.5" />
                                <span>{lang === 'ar' ? 'تعديل القيم' : 'Edit Values'}</span>
                              </button>
                            </div>

                            {/* Preview chips of options */}
                            <div className="flex items-center gap-1 flex-wrap max-w-xs">
                              {(lang === 'en' && field.optionsEn?.length ? field.optionsEn : (field.options || []).map((o) => translateOptionLabel(o, lang))).slice(0, 3).map((opt, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 truncate max-w-[90px]"
                                  title={opt}
                                >
                                  {opt}
                                </span>
                              ))}
                              {(field.options || []).length > 3 && (
                                <span className="text-[10px] text-slate-400">
                                  +{(field.options || []).length - 3}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            {lang === 'ar' ? '— ليس قائمة منسدلة —' : '— Not a dropdown —'}
                          </span>
                        )}
                      </td>

                      {/* Required */}
                      <td className="py-3.5 px-3 text-center">
                        <button
                          onClick={() => handleToggleFieldRequired(field.key)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            field.required
                              ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 border border-rose-200'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'
                          }`}
                        >
                          {field.required
                            ? lang === 'ar'
                              ? 'إلزامي'
                              : 'Required'
                            : lang === 'ar'
                            ? 'اختياري'
                            : 'Optional'}
                        </button>
                      </td>

                      {/* Visible */}
                      <td className="py-3.5 px-3 text-center">
                        <button
                          onClick={() => handleToggleFieldVisibility(field.key)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                            field.visible
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-200'
                              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          }`}
                        >
                          {field.visible ? (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              <span>{lang === 'ar' ? 'معروض' : 'Show'}</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3.5 h-3.5" />
                              <span>{lang === 'ar' ? 'مخفي' : 'Hide'}</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* 1. DELETE WHOLE FIELD BUTTON & Edit */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditFieldModal(field)}
                            title={lang === 'ar' ? 'تعديل خصائص الحقل بالكامل' : 'Full field settings'}
                            className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer border border-indigo-100"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Delete Whole Field Button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteFieldClick(field)}
                            title={lang === 'ar' ? 'حذف الحقل بالكامل من الشاشة' : 'Delete whole field'}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors cursor-pointer border border-rose-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom Actions Bar */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-xs text-slate-600 font-medium">
                {lang === 'ar'
                  ? '💡 كافة التغييرات على الحقول والأنواع وقيم القوائم تنعكس مباشرة في نماذج الإدخال وشاشات النظام.'
                  : '💡 Field modifications, types, and dropdown values apply immediately across all application forms.'}
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveAll}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'حفظ إعدادات الحقول' : 'Save Field Schema'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Live Form Preview Section */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h4 className="text-base font-bold text-slate-900">
                  {lang === 'ar'
                    ? `معاينة حية لشكل نموذج: ${currentScreenSchema.nameAr}`
                    : `Live Form Preview: ${currentScreenSchema.nameEn}`}
                </h4>
              </div>
              <span className="text-xs text-slate-400">
                {lang === 'ar' ? 'معاينة تجريبية تفاعلية للتحقق من الحقول والقوائم' : 'Interactive Preview'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {currentScreenSchema.fields
                .filter((f) => f.visible)
                .map((field) => (
                  <div
                    key={field.key}
                    className={`p-3.5 rounded-xl border ${
                      field.isCustom
                        ? 'bg-indigo-50/40 border-indigo-200/80'
                        : 'bg-slate-50/50 border-slate-200'
                    }`}
                  >
                    <label className="text-xs font-bold text-slate-800 flex items-center justify-between mb-1.5">
                      <span className="flex items-center gap-1.5">
                        <span className="text-indigo-600">
                          {field.type === 'text' && <Type className="w-3.5 h-3.5" />}
                          {field.type === 'textarea' && <FileText className="w-3.5 h-3.5" />}
                          {field.type === 'number' && <Hash className="w-3.5 h-3.5" />}
                          {field.type === 'date' && <Calendar className="w-3.5 h-3.5" />}
                          {field.type === 'select' && <List className="w-3.5 h-3.5 text-purple-600" />}
                          {field.type === 'boolean' && <ToggleLeft className="w-3.5 h-3.5 text-pink-600" />}
                        </span>
                        <span>{lang === 'ar' ? field.labelAr : field.labelEn}</span>
                      </span>
                      {field.required && (
                        <span className="text-rose-500 text-xs font-bold">*</span>
                      )}
                    </label>

                    {field.type === 'textarea' ? (
                      <textarea
                        rows={2}
                        disabled
                        placeholder={
                          (lang === 'en' ? field.placeholderEn || field.placeholder : field.placeholder) ||
                          (lang === 'ar' ? 'أدخل التفاصيل...' : 'Enter details...')
                        }
                        className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white text-slate-400 cursor-not-allowed"
                      />
                    ) : field.type === 'select' ? (
                      <select
                        className="w-full text-xs p-2.5 rounded-lg border border-purple-300 bg-white text-slate-800 font-medium focus:outline-none cursor-pointer"
                        defaultValue={
                          lang === 'en'
                            ? field.defaultValueEn || (field.optionsEn && field.optionsEn[0]) || translateOptionLabel(field.defaultValue || '', lang)
                            : field.defaultValue || (field.options && field.options[0]) || ''
                        }
                      >
                        {(lang === 'en' && field.optionsEn?.length ? field.optionsEn : (field.options || []).map((o) => translateOptionLabel(o, lang))).map((opt, idx) => (
                          <option key={idx} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : field.type === 'boolean' ? (
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                          defaultChecked={Boolean(field.defaultValue)}
                        />
                        <span className="text-xs text-slate-700 font-semibold">
                          {lang === 'ar' ? 'تفعيل / تشغيل' : 'Enable / Toggle'}
                        </span>
                      </div>
                    ) : (
                      <input
                        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                        placeholder={(lang === 'en' ? field.placeholderEn || field.placeholder : field.placeholder) || (lang === 'ar' ? 'قيمة مدخلة' : 'Input value')}
                        className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 font-medium"
                      />
                    )}

                    <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-slate-200/50 text-[10px] text-slate-400">
                      <span>{field.key}</span>
                      <span className="font-semibold text-indigo-600 font-mono">
                        {getFieldTypeName(field.type)}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: SCREEN VISIBILITY & LABELS CONTROLLER                     */}
      {/* ============================================================== */}
      {activeTab === 'screens' && (
        <div className="space-y-6">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'all', labelAr: `كافة الشاشات (${DEFAULT_SCREEN_VISIBILITY.length})`, labelEn: `All Screens (${DEFAULT_SCREEN_VISIBILITY.length})` },
              { id: 'strategic', labelAr: 'التخطيط الاستراتيجي', labelEn: 'Strategic Planning' },
              { id: 'core', labelAr: 'المساحات ولوحات المؤشرات', labelEn: 'Core & Dashboards' },
              { id: 'registry', labelAr: 'سجلات مكتب إدارة المشاريع', labelEn: 'PMO Registries' }
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setScreenCategoryFilter(cat.id as any)}
                className={`text-xs sm:text-sm font-semibold px-3.5 py-1.5 rounded-full transition-colors cursor-pointer ${
                  screenCategoryFilter === cat.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {lang === 'ar' ? cat.labelAr : cat.labelEn}
              </button>
            ))}
          </div>

          {/* Screens Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredScreens.map((screen) => {
              const isVisible = settings.menuVisibility[screen.id] ?? screen.visible;
              const currentLabel = settings.screenLabels[screen.id] || {
                ar: screen.nameAr,
                en: screen.nameEn
              };

              return (
                <div
                  key={screen.id}
                  className={`bg-white rounded-2xl border transition-all shadow-sm hover:shadow-md flex flex-col justify-between p-5 relative overflow-hidden ${
                    isVisible
                      ? 'border-slate-200'
                      : 'border-slate-200/60 bg-slate-50/70 opacity-80'
                  }`}
                >
                  {/* Top Header */}
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2.5 rounded-xl border ${
                            isVisible
                              ? 'bg-blue-50 border-blue-100'
                              : 'bg-slate-100 border-slate-200'
                          }`}
                        >
                          {getScreenIcon(screen.id)}
                        </div>
                        <div>
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                            {lang === 'ar' ? 'المعرّف:' : 'ID:'} {screen.id}
                          </span>
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                              screen.category === 'strategic'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : screen.category === 'core'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {screen.category === 'strategic'
                              ? (lang === 'ar' ? 'تخطيط استراتيجي' : 'Strategic Planning')
                              : screen.category === 'core'
                              ? (lang === 'ar' ? 'مساحة عمل' : 'Core Workspace')
                              : (lang === 'ar' ? 'سجل مكتب المشاريع' : 'PMO Registry')}
                          </span>
                        </div>
                      </div>

                      {/* Toggle Button */}
                      <button
                        onClick={() => handleToggleScreenVisibility(screen.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                          isVisible
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                      >
                        {isVisible ? (
                          <>
                            <Eye className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{lang === 'ar' ? 'معروضة' : 'Visible'}</span>
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                            <span>{lang === 'ar' ? 'مخفية' : 'Hidden'}</span>
                          </>
                        )}
                      </button>
                    </div>

                    <p className="text-xs text-slate-500 mb-4 line-clamp-2">
                      {lang === 'ar' ? screen.descriptionAr : screen.descriptionEn}
                    </p>

                    {/* Rename Field Inputs */}
                    <div className="space-y-2.5 pt-3 border-t border-slate-100">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                          {lang === 'ar' ? 'اسم الشاشة بالعربية' : 'Screen Name (Arabic)'}
                        </label>
                        <input
                          type="text"
                          value={currentLabel.ar}
                          onChange={(e) => handleScreenLabelChange(screen.id, e.target.value, 'ar')}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                          {lang === 'ar' ? 'اسم الشاشة بالإنجليزية' : 'Screen Name (English)'}
                        </label>
                        <input
                          type="text"
                          value={currentLabel.en}
                          onChange={(e) => handleScreenLabelChange(screen.id, e.target.value, 'en')}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Footer actions */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <button
                      onClick={() => onNavigateToSection(screen.id)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                    >
                      <span>{lang === 'ar' ? 'الانتقال للشاشة' : 'Open Screen'}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>

                    {settings.screenSchemas[screen.id] && (
                      <button
                        onClick={() => {
                          setSelectedScreenId(screen.id);
                          setActiveTab('fields');
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'تخصيص الحقول' : 'Customize Fields'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: ROLE-BASED SCREEN ACCESS MATRIX                         */}
      {/* ============================================================== */}
      {activeTab === 'roles' && (
        <div className="space-y-6">
          {/* Explanatory Header & Filter Controls */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {lang === 'ar'
                    ? 'مصفوفة صلاحيات عرض الشاشات حسب الدور الوظيفي'
                    : 'Role-Based Screen Visibility Matrix'}
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  {lang === 'ar'
                    ? 'حدد لكل شاشة في النظام الأدوار المسموح لها برؤيتها والوصول إليها. اضغط حفظ وتطبيق لتفعيل التعديلات فوراً.'
                    : 'Define for each screen which user roles are permitted to view and access it. Save changes to apply permissions across all sessions.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={roleMatrixSearch}
                    onChange={(e) => setRoleMatrixSearch(e.target.value)}
                    placeholder={lang === 'ar' ? 'ابحث باسم الشاشة...' : 'Filter screens...'}
                    className="ps-9 pe-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white min-w-[210px]"
                  />
                </div>
              </div>
            </div>

            {/* Category Segmented Filter */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {[
                  { id: 'all', labelAr: `كافة الشاشات (${configurableRoleScreens.length})`, labelEn: `All Screens (${configurableRoleScreens.length})` },
                  { id: 'strategic', labelAr: 'التخطيط الاستراتيجي', labelEn: 'Strategic Planning' },
                  { id: 'core', labelAr: 'المساحات ولوحات المؤشرات', labelEn: 'Core & Dashboards' },
                  { id: 'registry', labelAr: 'سجلات مكتب المشاريع', labelEn: 'PMO Registries' }
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setRoleMatrixCategoryFilter(cat.id as any)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      roleMatrixCategoryFilter === cat.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {lang === 'ar' ? cat.labelAr : cat.labelEn}
                  </button>
                ))}
              </div>

              {hasUnsavedChanges && (
                <button
                  type="button"
                  onClick={handleSaveAll}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'حفظ صلاحيات الأدوار' : 'Save Role Permissions'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Matrix Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-start border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="py-4 px-5 text-start text-xs font-bold text-slate-700 min-w-[260px]">
                      {lang === 'ar' ? 'الشاشة / الوحدة' : 'Screen / Module'}
                    </th>
                    {availableRoles.map((roleName) => {
                      const allowedCount = configurableRoleScreens.filter((s) =>
                        isRoleAllowedForScreen(s.id, roleName)
                      ).length;
                      return (
                        <th key={roleName} className="py-4 px-4 text-center min-w-[170px] border-s border-slate-200/80">
                          <div className="flex flex-col items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-900">
                              {translateRole(roleName, lang)}
                            </span>
                            <span className="text-[11px] font-mono tabular-nums text-slate-500">
                              {allowedCount} / {configurableRoleScreens.length}{' '}
                              {lang === 'ar' ? 'شاشة' : 'screens'}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <button
                                type="button"
                                onClick={() => handleToggleAllScreensForRole(roleName, true)}
                                className="px-2 py-0.5 text-[11px] font-semibold rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
                              >
                                {lang === 'ar' ? 'تفعيل الكل' : 'All'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleAllScreensForRole(roleName, false)}
                                className="px-2 py-0.5 text-[11px] font-semibold rounded bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
                              >
                                {lang === 'ar' ? 'إيقاف الكل' : 'None'}
                              </button>
                            </div>
                          </div>
                        </th>
                      );
                    })}
                    <th className="py-4 px-4 text-center text-xs font-bold text-slate-700 min-w-[160px] border-s border-slate-200/80">
                      {lang === 'ar' ? 'تعيين سريع' : 'Quick Preset'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80">
                  {configurableRoleScreens
                    .filter((screen) => {
                      if (
                        roleMatrixCategoryFilter !== 'all' &&
                        screen.category !== roleMatrixCategoryFilter
                      ) {
                        return false;
                      }
                      const q = roleMatrixSearch.trim().toLowerCase();
                      if (!q) return true;
                      const label = settings.screenLabels[screen.id] || {
                        ar: screen.nameAr,
                        en: screen.nameEn
                      };
                      return (
                        screen.id.toLowerCase().includes(q) ||
                        label.ar.toLowerCase().includes(q) ||
                        label.en.toLowerCase().includes(q)
                      );
                    })
                    .map((screen) => {
                      const labelObj = settings.screenLabels[screen.id] || {
                        ar: screen.nameAr,
                        en: screen.nameEn
                      };
                      const displayName = lang === 'ar' ? labelObj.ar || screen.nameAr : labelObj.en || screen.nameEn;
                      const isGloballyVisible = settings.menuVisibility[screen.id] ?? screen.visible;
                      const categoryText =
                        screen.category === 'strategic'
                          ? lang === 'ar'
                            ? 'تخطيط استراتيجي'
                            : 'Strategic Planning'
                          : screen.category === 'core'
                          ? lang === 'ar'
                            ? 'أساسية ولوحات'
                            : 'Core & Dashboards'
                          : lang === 'ar'
                          ? 'سجل المشاريع'
                          : 'PMO Registry';

                      return (
                        <tr key={screen.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-5">
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 shrink-0 mt-0.5">
                                {getScreenIcon(screen.id)}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-900">
                                  {displayName}
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                                  <span>{categoryText}</span>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono text-[11px]">{screen.id}</span>
                                  {!isGloballyVisible && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <button
                                        type="button"
                                        onClick={() => handleToggleScreenVisibility(screen.id)}
                                        className="text-amber-700 hover:underline font-medium cursor-pointer"
                                        title={
                                          lang === 'ar'
                                            ? 'مخفية عالمياً من تبويب ظهور الشاشات — اضغط لإظهارها'
                                            : 'Globally hidden in Screen Visibility — click to enable'
                                        }
                                      >
                                        {lang === 'ar' ? 'مخفية عالمياً (تفعيل)' : 'Globally hidden (Enable)'}
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {availableRoles.map((roleName) => {
                            const allowed = isRoleAllowedForScreen(screen.id, roleName);
                            return (
                              <td
                                key={`${screen.id}-${roleName}`}
                                className="py-3.5 px-4 text-center border-s border-slate-100"
                              >
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={allowed}
                                  aria-label={`${displayName} - ${translateRole(roleName, lang)}`}
                                  onClick={() => handleToggleScreenRole(screen.id, roleName)}
                                  className={`inline-flex items-center justify-center gap-2 min-h-[40px] min-w-[116px] px-3 py-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                                    allowed
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                      : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200 hover:text-slate-700'
                                  }`}
                                >
                                  {allowed ? (
                                    <>
                                      <Eye className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                      <span>{lang === 'ar' ? 'مسموح' : 'Visible'}</span>
                                    </>
                                  ) : (
                                    <>
                                      <EyeOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                      <span>{lang === 'ar' ? 'مخفي' : 'Hidden'}</span>
                                    </>
                                  )}
                                </button>
                              </td>
                            );
                          })}

                          <td className="py-3.5 px-4 text-center border-s border-slate-100">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleSetScreenRolesPreset(screen.id, 'all')}
                                className="px-2.5 py-1.5 text-[11px] font-semibold rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                              >
                                {lang === 'ar' ? 'الكل' : 'All'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetScreenRolesPreset(screen.id, 'pmo')}
                                className="px-2.5 py-1.5 text-[11px] font-semibold rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
                              >
                                {lang === 'ar' ? 'مدير PMO' : 'PMO Only'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetScreenRolesPreset(screen.id, 'none')}
                                className="px-2 py-1.5 text-[11px] font-semibold rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                              >
                                {lang === 'ar' ? 'إخفاء' : 'None'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                  {/* Locked Admin-Account-Only Screens Notice Rows */}
                  {[
                    {
                      id: 'admin-settings',
                      nameAr: 'تخصيص الشاشات والحقول',
                      nameEn: 'Screen & Field Studio'
                    },
                    {
                      id: 'role-permissions',
                      nameAr: 'صلاحيات الشاشات للأدوار',
                      nameEn: 'Role Screen Access'
                    },
                    {
                      id: 'database-connection',
                      nameAr: 'اتصال قاعدة بيانات MySQL',
                      nameEn: 'MySQL Database Connection'
                    },
                    {
                      id: 'users',
                      nameAr: '08. المستخدمون والأدوار',
                      nameEn: '08. Users & Roles'
                    }
                  ].map((lockedScreen) => (
                    <tr key={lockedScreen.id} className="bg-slate-50/60 text-slate-500">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 shrink-0">
                            <Lock className="w-4 h-4 text-slate-500" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-slate-700">
                              {lang === 'ar' ? lockedScreen.nameAr : lockedScreen.nameEn}
                            </div>
                            <div className="text-xs text-slate-500">
                              {lang === 'ar'
                                ? 'حساب مدير النظام فقط · مقفل للأمان'
                                : 'Admin account only · Locked for security'}
                            </div>
                          </div>
                        </div>
                      </td>
                      {availableRoles.map((roleName) => (
                        <td
                          key={`${lockedScreen.id}-${roleName}`}
                          className="py-3.5 px-4 text-center border-s border-slate-100 text-xs text-slate-400"
                        >
                          <span className="inline-flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            <span>{lang === 'ar' ? 'حساب الأدمن' : 'Admin Only'}</span>
                          </span>
                        </td>
                      ))}
                      <td className="py-3.5 px-4 text-center border-s border-slate-100 text-xs text-slate-400">
                        {lang === 'ar' ? 'مقفل' : 'Locked'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. MODAL: DEDICATED DROPDOWN VALUES MANAGER                     */}
      {/* ============================================================== */}
      {optionsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-purple-900 to-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-500/20 rounded-lg border border-purple-400/30">
                  <List className="w-5 h-5 text-purple-300" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>{lang === 'ar' ? 'إدارة وتعديل قيم القائمة المنسدلة' : 'Dropdown Options Manager'}</span>
                  </h3>
                  <p className="text-xs text-purple-200">
                    {lang === 'ar' ? `للحقل: ${optionsModalFieldLabel}` : `Field: ${optionsModalFieldLabel}`}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setOptionsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-purple-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Mode Toggle: Visual Tags vs Batch Paste */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setOptionsViewMode('tags')}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      optionsViewMode === 'tags'
                        ? 'bg-white text-purple-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {lang === 'ar' ? 'العناصر المرئية' : 'Visual Tags'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBatchOptionsText(optionsList.join('\n'));
                      setOptionsViewMode('batch');
                    }}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      optionsViewMode === 'batch'
                        ? 'bg-white text-purple-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {lang === 'ar' ? 'التحرير المجمع' : 'Batch Text'}
                  </button>
                </div>

                <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200">
                  {optionsList.length} {lang === 'ar' ? 'خيارات حالية' : 'items'}
                </span>
              </div>

              {optionsViewMode === 'tags' ? (
                <div className="space-y-4">
                  {/* Add New Option Input */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      {lang === 'ar' ? 'إضافة خيار جديد للقائمة:' : 'Add New Option:'}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newOptionInput}
                        onChange={(e) => setNewOptionInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddOptionToModal();
                          }
                        }}
                        placeholder={lang === 'ar' ? 'اكتب الخيار واضغط إضافة أو Enter...' : 'Type option and press Add...'}
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                      />
                      <button
                        type="button"
                        onClick={handleAddOptionToModal}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'إضافة' : 'Add'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Options List with Delete */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      {lang === 'ar' ? 'القيم الحالية في القائمة (اضغط × للحذف):' : 'Current Dropdown Values (Click × to remove):'}
                    </label>
                    <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 min-h-[100px] max-h-[220px] overflow-y-auto">
                      {optionsList.length === 0 ? (
                        <span className="text-xs text-slate-400 italic m-auto">
                          {lang === 'ar' ? 'لا توجد خيارات مضافة بعد' : 'No options added yet'}
                        </span>
                      ) : (
                        optionsList.map((opt, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-purple-200 text-purple-900 shadow-2xs group"
                          >
                            <span className="text-slate-400 font-mono text-[10px]">{idx + 1}.</span>
                            <span>{opt}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveOptionFromModal(idx)}
                              className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors cursor-pointer"
                              title={lang === 'ar' ? 'حذف هذا الخيار' : 'Remove option'}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Batch text mode */
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    {lang === 'ar'
                      ? 'أدخل أو عدّل الخيارات (كل سطر يمثل خياراً منفصلاً):'
                      : 'Enter or edit options (one per line):'}
                  </label>
                  <textarea
                    rows={8}
                    value={batchOptionsText}
                    onChange={(e) => {
                      setBatchOptionsText(e.target.value);
                      const parsed = e.target.value
                        .split(/[\n,]/)
                        .map((s) => s.trim())
                        .filter(Boolean);
                      setOptionsList(parsed);
                    }}
                    placeholder={lang === 'ar' ? `خيار 1\nخيار 2\nخيار 3` : `Option 1\nOption 2\nOption 3`}
                    className="w-full p-3 rounded-xl border border-slate-300 text-xs font-mono text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 leading-relaxed"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    {lang === 'ar'
                      ? 'يمكنك لصق قائمة طويلة مفصولة بأسطر أو فواصل دفعة واحدة.'
                      : 'You can paste multi-line or comma-separated options directly.'}
                  </p>
                </div>
              )}

              {/* Live Preview Dropdown in Modal */}
              <div className="pt-3 border-t border-slate-200">
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {lang === 'ar' ? 'معاينة القائمة المنسدلة الناتجة:' : 'Preview Resulting Dropdown:'}
                </label>
                <select className="w-full px-3 py-2 rounded-xl border border-purple-300 bg-purple-50/50 text-xs font-bold text-purple-950 focus:outline-none">
                  {optionsList.map((opt, idx) => (
                    <option key={idx} value={opt}>
                      {translateOptionLabel(opt, lang)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setOptionsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>

              <button
                type="button"
                onClick={handleSaveDropdownOptions}
                className="px-5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-500/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{lang === 'ar' ? 'تطبيق وحفظ الخيارات' : 'Apply Options'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: ADD / EDIT FULL FIELD                                   */}
      {/* ============================================================== */}
      {fieldModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-500/20 rounded-lg border border-indigo-400/30">
                  <Sliders className="w-5 h-5 text-indigo-300" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingFieldKey
                      ? lang === 'ar'
                        ? 'تعديل بيانات الحقل ونوعه'
                        : 'Edit Field Properties & Type'
                      : lang === 'ar'
                      ? 'إضافة حقل جديد للشاشة'
                      : 'Add New Field to Screen'}
                  </h3>
                  <p className="text-xs text-slate-300">
                    {lang === 'ar' ? currentScreenSchema.nameAr : currentScreenSchema.nameEn}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setFieldModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs sm:text-sm">
              {/* Field Key */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {lang === 'ar' ? 'مفتاح الحقل البرمجي' : 'Field Key'}
                </label>
                <input
                  type="text"
                  value={fieldFormData.key}
                  disabled={Boolean(editingFieldKey)}
                  onChange={(e) =>
                    setFieldFormData({ ...fieldFormData, key: e.target.value.replace(/\s+/g, '_') })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-xs text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. cf_funding_partner"
                />
              </div>

              {/* Label AR */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {lang === 'ar' ? 'اسم الحقل بالعربية' : 'Arabic Label (Required)'}
                </label>
                <input
                  type="text"
                  value={fieldFormData.labelAr}
                  onChange={(e) => setFieldFormData({ ...fieldFormData, labelAr: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={lang === 'ar' ? "مثال: جهة الشراكة أو الأولوية" : "e.g. Strategic Partner"}
                />
              </div>

              {/* Label EN */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {lang === 'ar' ? 'اسم الحقل بالإنجليزية' : 'English Label'}
                </label>
                <input
                  type="text"
                  value={fieldFormData.labelEn}
                  onChange={(e) => setFieldFormData({ ...fieldFormData, labelEn: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Strategic Partner"
                />
              </div>

              {/* 2. CHANGE FIELD TYPE in Modal */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {lang === 'ar' ? 'نوع الحقل:' : 'Field Type:'}
                </label>
                <select
                  value={fieldFormData.type}
                  onChange={(e) => {
                    const newType = e.target.value as FieldInputType;
                    setFieldFormData({ ...fieldFormData, type: newType });
                    if (newType === 'select' && modalOptionsList.length === 0) {
                      setModalOptionsList(lang === 'ar' ? ['خيار أول', 'خيار ثان', 'خيار ثالث'] : ['Option 1', 'Option 2', 'Option 3']);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-indigo-300 text-xs sm:text-sm font-bold text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-indigo-50/40"
                >
                  <option value="text">{lang === 'ar' ? 'نص عادي' : 'Text'}</option>
                  <option value="textarea">{lang === 'ar' ? 'نص طويل' : 'Textarea'}</option>
                  <option value="number">{lang === 'ar' ? 'رقم' : 'Number'}</option>
                  <option value="date">{lang === 'ar' ? 'تاريخ' : 'Date'}</option>
                  <option value="select">{lang === 'ar' ? 'قائمة منسدلة' : 'Dropdown'}</option>
                  <option value="boolean">{lang === 'ar' ? 'قيمة منطقية' : 'Boolean'}</option>
                </select>
              </div>

              {/* 3. DROPDOWN OPTIONS MANAGER in Modal */}
              {fieldFormData.type === 'select' && (
                <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-purple-950 block">
                      {lang === 'ar' ? 'قيم وخيارات القائمة المنسدلة:' : 'Dropdown Options & Values:'}
                    </label>
                    <span className="text-[11px] font-mono text-purple-700 font-semibold">
                      {modalOptionsList.length} {lang === 'ar' ? 'خيارات' : 'options'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={modalOptionsTag}
                      onChange={(e) => setModalOptionsTag(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddModalOptionTag();
                        }
                      }}
                      placeholder={lang === 'ar' ? 'أضف خياراً واضغط Enter أو إضافة' : 'Add option and press Enter'}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-purple-300 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddModalOptionTag}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition-colors cursor-pointer"
                    >
                      {lang === 'ar' ? 'إضافة' : 'Add'}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto">
                    {modalOptionsList.map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-white border border-purple-200 text-purple-900 shadow-2xs"
                      >
                        <span>{tag}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveModalOptionTag(idx)}
                          className="text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Placeholder */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {lang === 'ar' ? 'نص تلميح الإدخال' : 'Placeholder'}
                </label>
                <input
                  type="text"
                  value={(lang === 'en' ? fieldFormData.placeholderEn : fieldFormData.placeholder) || ''}
                  onChange={(e) =>
                    setFieldFormData(
                      lang === 'en'
                        ? { ...fieldFormData, placeholderEn: e.target.value }
                        : { ...fieldFormData, placeholder: e.target.value }
                    )
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={lang === 'ar' ? "نص توضيحي يظهر داخل الحقل" : "Hint or sample text shown inside field"}
                />
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fieldFormData.required}
                    onChange={(e) =>
                      setFieldFormData({ ...fieldFormData, required: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      {lang === 'ar' ? 'حقل إلزامي' : 'Required Field'}
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      {lang === 'ar' ? 'يجب تعبئته قبل الحفظ' : 'Must be filled'}
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fieldFormData.visible}
                    onChange={(e) =>
                      setFieldFormData({ ...fieldFormData, visible: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      {lang === 'ar' ? 'حقل معروض' : 'Visible Field'}
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      {lang === 'ar' ? 'يظهر في واجهة المستخدم' : 'Shown in UI'}
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              {editingFieldKey ? (
                <button
                  type="button"
                  onClick={() => {
                    const target = currentScreenSchema.fields.find((f) => f.key === editingFieldKey);
                    setFieldModalOpen(false);
                    if (target) {
                      handleDeleteFieldClick(target);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 hover:border-rose-300 border border-rose-200 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'حذف هذا الحقل نهائياً' : 'Delete this field'}</span>
                </button>
              ) : <div />}

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setFieldModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>

                <button
                  onClick={handleSaveFieldFromModal}
                  className="px-5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                >
                  {editingFieldKey
                    ? lang === 'ar'
                      ? 'تحديث الحقل'
                      : 'Update Field'
                    : lang === 'ar'
                    ? 'إضافة الحقل'
                    : 'Add Field'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* IN-APP MODAL: Delete Field Confirmation (Eliminates window.confirm!)       */}
      {/* ========================================================================= */}
      {deleteConfirmField && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-rose-100 overflow-hidden text-start">
            <div className="p-6">
              <div className="flex items-center gap-3.5 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200 shadow-inner">
                  <Trash2 className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {lang === 'ar' ? 'تأكيد حذف الحقل بالكامل' : 'Confirm Field Deletion'}
                  </h3>
                  <p className="text-xs text-rose-600 font-semibold mt-0.5">
                    {lang === 'ar' ? 'إجراء حذف نهائي فوري من الشاشة' : 'Permanent immediate action'}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5 mb-5 text-xs text-slate-700">
                <p className="leading-relaxed">
                  {lang === 'ar' ? (
                    <>
                      هل أنت متأكد من رغبتك في حذف الحقل{' '}
                      <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-300">
                        {deleteConfirmField.labelAr}
                      </span>{' '}
                      <span className="text-slate-500 font-mono text-[11px]">({deleteConfirmField.key})</span>{' '}
                      بالكامل من شاشة{' '}
                      <span className="font-bold text-slate-900">{currentScreenSchema.nameAr}</span>؟
                    </>
                  ) : (
                    <>
                      Are you sure you want to completely delete the field{' '}
                      <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-300">
                        {deleteConfirmField.labelEn}
                      </span>{' '}
                      from screen <span className="font-bold text-slate-900">{currentScreenSchema.nameEn}</span>?
                    </>
                  )}
                </p>

                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>
                    {lang === 'ar'
                      ? 'سيتم حذف الحقل فوراً من قاعدة البيانات وإخفاؤه من كافة النماذج.'
                      : 'The field will be permanently deleted from the database and hidden from all forms.'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-1 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isDeletingField}
                  onClick={() => setDeleteConfirmField(null)}
                  className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="button"
                  disabled={isDeletingField}
                  onClick={handleExecuteDeleteField}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isDeletingField ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{lang === 'ar' ? 'جاري الحذف...' : 'Deleting...'}</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>{lang === 'ar' ? 'نعم، حذف الحقل الآن' : 'Yes, Delete Field'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* IN-APP MODAL: Reset Defaults Confirmation (Eliminates window.confirm!)     */}
      {/* ========================================================================= */}
      {resetConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-amber-200 overflow-hidden text-start">
            <div className="p-6">
              <div className="flex items-center gap-3.5 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200 shadow-inner">
                  <RotateCcw className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {resetConfirmModal === 'all'
                      ? (lang === 'ar' ? 'استعادة إعدادات النظام بالكامل' : 'Reset All System Settings')
                      : (lang === 'ar' ? `استعادة حقول شاشة "${currentScreenSchema.nameAr}"` : `Reset Fields for "${currentScreenSchema.nameEn}"`)}
                  </h3>
                  <p className="text-xs text-amber-700 font-semibold mt-0.5">
                    {lang === 'ar' ? 'الرجوع إلى الحالة الافتراضية للنظام' : 'Restore system defaults'}
                  </p>
                </div>
              </div>

              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 text-xs text-slate-700 mb-5 leading-relaxed">
                {resetConfirmModal === 'all'
                  ? (lang === 'ar'
                      ? 'هل أنت متأكد من استعادة كافة الإعدادات والشاشات والحقول الافتراضية للنظام بالكامل؟ سيتم إعادة جميع الحقول المحذوفة إلى حالتها الأصلية.'
                      : 'Are you sure you want to reset all screens and fields back to system defaults?')
                  : (lang === 'ar'
                      ? `هل أنت متأكد من استعادة الحقول الافتراضية لشاشة "${currentScreenSchema.nameAr}"؟ سيتم إعادة الحقول الأساسية المحذوفة وإلغاء أي تعديلات مخصصة عليها.`
                      : `Are you sure you want to reset fields for "${currentScreenSchema.nameEn}" back to default?`)}
              </div>

              <div className="flex items-center justify-end gap-3 pt-1 border-t border-slate-100">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setResetConfirmModal(null)}
                  className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleExecuteReset}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{lang === 'ar' ? 'جاري الاستعادة...' : 'Restoring...'}</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4" />
                      <span>{lang === 'ar' ? 'تأكيد الاستعادة' : 'Confirm Reset'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Simple Fallback Icon for Workstreams
const GitBranchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="6" y1="3" x2="6" y2="15" />
    <circle cx="18" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M18 9a9 9 0 0 1-9 9" />
  </svg>
);
