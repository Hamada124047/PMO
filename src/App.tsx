import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  LayoutDashboard,
  Network,
  Building2,
  Briefcase,
  Compass,
  FolderKanban,
  CheckSquare,
  Search,
  Plus,
  Edit2,
  Trash2,
  ChevronRight,
  ChevronDown,
  LogOut,
  RotateCcw,
  AlertTriangle,
  GitBranch,
  Diamond,
  Layers,
  Globe,
  Languages,
  User,
  UserPlus,
  Users,
  Shield,
  ShieldCheck,
  ArrowRight,
  Lock,
  Key,
  KeyRound,
  Eye,
  EyeOff,
  Mail,
  Loader2,
  CheckCircle2,
  Activity,
  Sparkles,
  Cpu,
  Sliders,
  TrendingUp,
  Calendar,
  Database
} from 'lucide-react';
import { ProjectWorkspaceView, WorkspaceTab } from './ProjectWorkspaceView';
import { StrategicPlanningView } from './StrategicPlanningView';
import { PmoManagementView } from './PmoManagementView';
import { AdminSettingsView } from './AdminSettingsView';
import { DatabaseConnectionView } from './DatabaseConnectionView';
import { InitiativeManagementView } from './InitiativeManagementView';
import { PortfolioManagementView } from './PortfolioManagementView';
import { DepartmentManagementView } from './DepartmentManagementView';
import { ProgressTrackingView } from './ProgressTrackingView';
import { OverdueActivityView } from './OverdueActivityView';
import { ActivitySearchView } from './ActivitySearchView';
import { PmoDashboardView } from './PmoDashboardView';
import { ProjectManagementView } from './ProjectManagementView';
import { ActivityManagementView } from './ActivityManagementView';
import { UserManagementView } from './UserManagementView';
import { ProjectSchedulingView } from './ProjectSchedulingView';
import { ExecutiveDashboardView } from './ExecutiveDashboardView';
import {
  apiFetch,
  getActiveAuthToken,
  setActiveAuthToken,
  setUnauthorizedHandler,
  setBootstrappingAuth
} from './apiClient';
import {
  AdminSystemSettings,
  DEFAULT_SCREEN_SCHEMAS,
  DEFAULT_SCREEN_VISIBILITY,
  DEFAULT_SCREEN_ROLE_PERMISSIONS
} from './types/adminSettings';
import { NexoraLogo, NexoraLogoIcon } from './NexoraLogo';
import {
  Language,
  translations,
  pickLocalized,
  translateStatus,
  translatePriority,
  translateRole
} from './i18n';

export interface AuthUser {
  userId: number;
  fullName: string;
  fullNameAr?: string;
  username: string;
  email: string;
  role: 'PMO Manager' | 'Project Manager' | 'Team Member';
  token: string;
}

export interface UserRecord {
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

export interface Department {
  id: number;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  isActive: boolean;
  portfolioCount: number;
  initiativeCount: number;
}

export interface Portfolio {
  id: number;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  departmentId: number | null;
  departmentName?: string | null;
  departmentNameAr?: string | null;
  ownerId: number | null;
  ownerName?: string | null;
  ownerNameAr?: string | null;
  startDate: string;
  endDate: string;
  status: string;
  initiativeCount: number;
}

export interface Initiative {
  id: number;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  departmentId: number | null;
  departmentName?: string | null;
  departmentNameAr?: string | null;
  portfolioId: number;
  portfolioName?: string | null;
  portfolioNameAr?: string | null;
  ownerId: number | null;
  ownerName?: string | null;
  ownerNameAr?: string | null;
  startDate: string;
  targetDate: string;
  status: string;
  priority: string;
  progressPercentage: number;
  projectCount: number;
}

export interface Project {
  id: number;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  initiativeId: number;
  initiativeName?: string | null;
  initiativeNameAr?: string | null;
  portfolioId?: number | null;
  portfolioName?: string | null;
  portfolioNameAr?: string | null;
  departmentId?: number | null;
  departmentName?: string | null;
  departmentNameAr?: string | null;
  projectManagerId: number | null;
  projectManagerName?: string | null;
  projectManagerNameAr?: string | null;
  startDate: string;
  endDate: string;
  status: string;
  priority: string;
  progressPercentage: number;
  workstreamCount?: number;
  milestoneCount?: number;
  activityCount: number;
  overdueActivityCount?: number;
}

export interface Workstream {
  id: number;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  projectId: number;
  projectName?: string | null;
  projectNameAr?: string | null;
  ownerId: number | null;
  ownerName?: string | null;
  ownerNameAr?: string | null;
  startDate: string;
  endDate: string;
  status: string;
  progressPercentage: number;
  activityCount: number;
  milestoneCount: number;
}

export interface Milestone {
  id: number;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  projectId: number;
  projectName?: string | null;
  projectNameAr?: string | null;
  workstreamId: number | null;
  workstreamName?: string | null;
  workstreamNameAr?: string | null;
  ownerId: number | null;
  ownerName?: string | null;
  ownerNameAr?: string | null;
  plannedDate: string;
  actualDate: string | null;
  status: 'Planned' | 'In Progress' | 'Completed' | 'Delayed';
  isDelayed: boolean;
  linkedActivityCount: number;
}

export interface DependencyRef {
  dependencyId: number;
  relatedTaskId: number;
  relatedTaskName: string;
  relatedTaskNameAr?: string;
  relatedTaskStatus: string;
  dependencyType: string;
}

export interface Activity {
  id: number;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  projectId: number;
  projectName?: string | null;
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
  assignedUserName?: string | null;
  assignedUserNameAr?: string | null;
  startDate: string;
  dueDate: string;
  status: 'Not Started' | 'In Progress' | 'Completed';
  priority: string;
  progressPercentage: number;
  isOverdue: boolean;
  subtaskCount: number;
  completedSubtaskCount: number;
  predecessors?: DependencyRef[];
  successors?: DependencyRef[];
}

export interface TaskDependency {
  id: number;
  predecessorTaskId: number;
  predecessorTaskName: string;
  predecessorTaskNameAr?: string;
  predecessorStatus: string;
  successorTaskId: number;
  successorTaskName: string;
  successorTaskNameAr?: string;
  successorStatus: string;
  dependencyType: string;
}

export interface DashboardSummary {
  totalDepartments: number;
  totalPortfolios: number;
  totalInitiatives: number;
  totalProjects: number;
  totalWorkstreams: number;
  totalMilestones: number;
  totalActivities: number;
  totalSubtasks: number;
  activeProjects: number;
  completedProjects: number;
  overdueActivities: number;
  delayedMilestones: number;
  projectsByStatus: { status: string; count: number }[];
  initiativesByDepartment: { departmentName: string; departmentNameAr?: string; count: number }[];
  activitiesByStatus: { status: string; count: number }[];
  activitiesByWorkstream: { workstreamName: string; workstreamNameAr?: string; count: number }[];
  milestonesByStatus: { status: string; count: number }[];
  projectsWithOverdueActivities: Project[];
  upcomingMilestones: Milestone[];
  projectsApproachingEndDate: Project[];
}

type NavSection =
  | 'admin-settings'
  | 'role-permissions'
  | 'database-connection'
  | 'strategic-planning'
  | 'pmo-management'
  | 'pmo-dashboard'
  | 'progress-tracking'
  | 'overdue-activities'
  | 'activity-search'
  | 'dashboard'
  | 'project-workspace'
  | 'hierarchy'
  | 'departments'
  | 'portfolios'
  | 'initiatives'
  | 'projects'
  | 'workstreams'
  | 'milestones'
  | 'activities'
  | 'scheduling'
  | 'users'
  | 'profile';

/**
 * Menu visibility configuration.
 * Change flags to true whenever unhiding is requested.
 */
export const MENU_VISIBILITY: Record<NavSection, boolean> = {
  'admin-settings': true,
  'role-permissions': true,
  'database-connection': true,
  // Strategic Planning enterprise module:
  'strategic-planning': true,
  // PMO Management enterprise module:
  'pmo-management': true,
  // PMO Dashboard enterprise module:
  'pmo-dashboard': true,
  // Progress Tracking enterprise module:
  'progress-tracking': true,
  // Overdue Activities enterprise module:
  'overdue-activities': true,
  // Activity Search enterprise module:
  'activity-search': true,
  // Visible menus:
  departments: true,
  portfolios: true,
  initiatives: true,
  projects: true,
  activities: true,
  scheduling: true,
  users: true,
  profile: true,
  // Temporarily hidden menus (ready to unhide on request):
  dashboard: true,
  'project-workspace': true,
  hierarchy: true,
  workstreams: false,
  milestones: false
};

const getInitialSection = (): NavSection => {
  if (MENU_VISIBILITY['dashboard']) return 'dashboard';
  if (MENU_VISIBILITY['pmo-dashboard']) return 'pmo-dashboard';
  if (MENU_VISIBILITY['strategic-planning']) return 'strategic-planning';
  if (MENU_VISIBILITY['pmo-management']) return 'pmo-management';
  if (MENU_VISIBILITY['departments']) return 'departments';
  if (MENU_VISIBILITY['portfolios']) return 'portfolios';
  return 'initiatives';
};

const getInitials = (name?: string | null): string => {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

const INITIAL_DEMO_USERS: UserRecord[] = [
  { id: 7, fullName: 'Hamada El Daley', fullNameAr: 'حمادة الدالي', email: 'hamadamanus2@gmail.com', username: 'Hamada El Daley', roleId: 1, roleName: 'PMO Manager', isActive: true },
  { id: 1, fullName: 'Elena Vance', fullNameAr: 'إلينا فانس', email: 'elena.vance@enterprise.org', username: 'pmo.admin', roleId: 1, roleName: 'PMO Manager', isActive: true },
  { id: 2, fullName: 'Marcus Sterling', fullNameAr: 'ماركوس ستيرلينغ', email: 'marcus.sterling@enterprise.org', username: 'm.sterling', roleId: 2, roleName: 'Project Manager', isActive: true },
  { id: 3, fullName: 'Clara Chen', fullNameAr: 'كلارا تشين', email: 'clara.chen@enterprise.org', username: 'c.chen', roleId: 2, roleName: 'Project Manager', isActive: true },
  { id: 4, fullName: 'David Alverez', fullNameAr: 'ديفيد ألفاريز', email: 'david.alverez@enterprise.org', username: 'd.alverez', roleId: 3, roleName: 'Team Member', isActive: true },
  { id: 5, fullName: 'Sophia Patel', fullNameAr: 'صوفيا باتيل', email: 'sophia.patel@enterprise.org', username: 's.patel', roleId: 3, roleName: 'Team Member', isActive: true },
  { id: 6, fullName: "Liam O'Connor", fullNameAr: 'ليام أوكونور', email: 'liam.oconnor@enterprise.org', username: 'l.oconnor', roleId: 3, roleName: 'Team Member', isActive: true }
];

const getStoredSessionUser = (): AuthUser | null => {
  if (typeof window === 'undefined') return null;
  if (localStorage.getItem('pmo_explicit_logout') === 'true') return null;
  const saved = localStorage.getItem('pmo_session_user');
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved);
    if (
      parsed &&
      parsed.userId &&
      parsed.fullName &&
      typeof parsed.token === 'string' &&
      parsed.token.includes('.')
    ) {
      return parsed as AuthUser;
    }
  } catch {
    // invalid JSON
  }
  localStorage.removeItem('pmo_session_user');
  return null;
};

const initialStoredSession = getStoredSessionUser();
if (initialStoredSession?.token) {
  setActiveAuthToken(initialStoredSession.token);
}

export default function App() {
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('pmo_lang');
    return saved === 'ar' ? 'ar' : 'en';
  });

  useEffect(() => {
    localStorage.setItem('pmo_lang', lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    document.title =
      lang === 'ar'
        ? 'نكسورا | نظام إدارة المحافظ والمشاريع'
        : 'NEXORA | PMO Governance & Portfolio Management';
  }, [lang]);

  const t = translations[lang];

  // Dynamic Admin System Settings (Screen Visibility & Field Schemas)
  const [systemSettings, setSystemSettings] = useState<AdminSystemSettings>({
    menuVisibility: {
      'admin-settings': true,
      'strategic-planning': true,
      'pmo-management': true,
      'pmo-dashboard': true,
      'progress-tracking': true,
      'overdue-activities': true,
      'activity-search': true,
      departments: true,
      portfolios: true,
      initiatives: true,
      projects: true,
      'project-workspace': true,
      dashboard: true,
      hierarchy: true,
      workstreams: false,
      milestones: false,
      activities: true,
      scheduling: true,
      users: true
    },
    screenRolePermissions: JSON.parse(JSON.stringify(DEFAULT_SCREEN_ROLE_PERMISSIONS)),
    screenLabels: DEFAULT_SCREEN_VISIBILITY.reduce((acc, item) => {
      acc[item.id] = { ar: item.nameAr, en: item.nameEn };
      return acc;
    }, {} as Record<string, { ar: string; en: string }>),
    screenSchemas: DEFAULT_SCREEN_SCHEMAS,
    lastUpdatedBy: 'Hamada El Daley',
    lastUpdatedAt: new Date().toISOString()
  });

  // Fetch admin settings on mount
  useEffect(() => {
    apiFetch('/api/admin/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.menuVisibility) {
          setSystemSettings({
            ...data,
            screenRolePermissions: {
              ...DEFAULT_SCREEN_ROLE_PERMISSIONS,
              ...(data.screenRolePermissions || {})
            }
          });
        }
      })
      .catch((err) => console.error('Failed to load system settings:', err));
  }, []);

  // Live synchronize global MENU_VISIBILITY map whenever systemSettings update
  useEffect(() => {
    if (systemSettings?.menuVisibility) {
      Object.keys(systemSettings.menuVisibility).forEach((k) => {
        (MENU_VISIBILITY as any)[k] = systemSettings.menuVisibility[k];
      });
    }
  }, [systemSettings]);

  const isAdminAccount = (user?: {
    username?: string | null;
    email?: string | null;
  } | null): boolean => {
    if (!user) return false;
    const username = (user.username || '').trim().toLowerCase();
    const email = (user.email || '').trim().toLowerCase();
    return (
      username === 'hamada el daley' ||
      username === 'hamada.admin' ||
      username === 'admin' ||
      email === 'hamadamanus2@gmail.com'
    );
  };

  const isScreenVisible = (
    key: string,
    userOverride?: {
      username?: string | null;
      email?: string | null;
      role?: string | null;
    } | null
  ): boolean => {
    const targetUser = userOverride !== undefined ? userOverride : currentUser;
    if (key === 'profile') return true;
    if (key === 'admin-settings' || key === 'role-permissions' || key === 'database-connection') {
      return isAdminAccount(targetUser);
    }
    if (key === 'users') {
      return (
        isAdminAccount(targetUser) &&
        systemSettings.menuVisibility?.['users'] !== false
      );
    }
    if (systemSettings.menuVisibility?.[key] === false) {
      return false;
    }
    const allowedRoles = systemSettings.screenRolePermissions?.[key];
    if (Array.isArray(allowedRoles) && targetUser?.role) {
      return allowedRoles.includes(targetUser.role);
    }
    return true;
  };

  const getFirstVisibleSection = (
    userOverride?: {
      username?: string | null;
      email?: string | null;
      role?: string | null;
    } | null
  ): NavSection => {
    const candidateOrder: NavSection[] = [
      'dashboard',
      'pmo-dashboard',
      'strategic-planning',
      'pmo-management',
      'progress-tracking',
      'overdue-activities',
      'activity-search',
      'departments',
      'portfolios',
      'initiatives',
      'projects',
      'activities',
      'scheduling',
      'project-workspace',
      'hierarchy',
      'workstreams',
      'milestones'
    ];
    for (const sec of candidateOrder) {
      if (isScreenVisible(sec, userOverride)) {
        return sec;
      }
    }
    return 'profile';
  };

  const getScreenNavLabel = (key: string, fallback: string): string => {
    const labelObj = systemSettings.screenLabels?.[key];
    if (labelObj) {
      return lang === 'ar' ? labelObj.ar || fallback : labelObj.en || fallback;
    }
    return fallback;
  };

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(initialStoredSession);
  const [authBootstrapping, setAuthBootstrapping] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('pmo_explicit_logout') !== 'true';
  });

  useEffect(() => {
    setActiveAuthToken(currentUser?.token || null);
  }, [currentUser]);

  // Login Screen & Account Management State
  const [authMode, setAuthMode] = useState<'saved' | 'register' | 'manual' | 'forgot'>('manual');
  const [savedAccounts, setSavedAccounts] = useState<UserRecord[]>(INITIAL_DEMO_USERS);
  const [quickLoggingInId, setQuickLoggingInId] = useState<number | null>(null);

  const [loginUsername, setLoginUsername] = useState('Hamada El Daley');
  const [loginPassword, setLoginPassword] = useState('PMO@2026@@');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Forgot Password State
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotVerifiedUser, setForgotVerifiedUser] = useState<{
    userId: number;
    username: string;
    fullName: string;
    maskedEmail: string;
    roleName: string;
  } | null>(null);
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [isVerifyingForgot, setIsVerifyingForgot] = useState(false);
  const [isResettingForgot, setIsResettingForgot] = useState(false);
  const [showForgotNewPass, setShowForgotNewPass] = useState(false);
  const [showForgotConfirmPass, setShowForgotConfirmPass] = useState(false);

  // Register Form State
  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('Pass123!');
  const [registerError, setRegisterError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  // Admin User Role Management Modal
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [updatingUserRoleId, setUpdatingUserRoleId] = useState<number | null>(null);

  // Personal Profile & Password Reset Page State
  const [profileTab, setProfileTab] = useState<'details' | 'security'>('details');
  const [profileFullName, setProfileFullName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  // Password Reset Inside Profile
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const [activeSection, setActiveSection] = useState<NavSection>(getInitialSection);

  const [workspaceProjectId, setWorkspaceProjectId] = useState<number>(1);
  const [workspaceInitialTab, setWorkspaceInitialTab] = useState<WorkspaceTab>('overview');
  const [activityMgmtProjectId, setActivityMgmtProjectId] = useState<number | null>(null);
  const [schedulingProjectId, setSchedulingProjectId] = useState<number | null>(null);
  const [pmoModuleMenuOpen, setPmoModuleMenuOpen] = useState<boolean>(true);
  const [pmoTopDropdownOpen, setPmoTopDropdownOpen] = useState<boolean>(false);
  const pmoTopDropdownRef = useRef<HTMLDivElement | null>(null);
  const [planningMenuOpen, setPlanningMenuOpen] = useState<boolean>(true);
  const [planningTopDropdownOpen, setPlanningTopDropdownOpen] = useState<boolean>(false);
  const planningTopDropdownRef = useRef<HTMLDivElement | null>(null);
  const [hierarchyMenuOpen, setHierarchyMenuOpen] = useState<boolean>(true);
  const [hierarchyTopDropdownOpen, setHierarchyTopDropdownOpen] = useState<boolean>(false);
  const hierarchyTopDropdownRef = useRef<HTMLDivElement | null>(null);
  const [adminControlsMenuOpen, setAdminControlsMenuOpen] = useState<boolean>(true);
  const [adminControlsTopDropdownOpen, setAdminControlsTopDropdownOpen] = useState<boolean>(false);
  const adminControlsTopDropdownRef = useRef<HTMLDivElement | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState<boolean>(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isPmoSubSection = (section: NavSection): boolean =>
    section === 'pmo-management' ||
    section === 'pmo-dashboard' ||
    section === 'progress-tracking' ||
    section === 'overdue-activities' ||
    section === 'activity-search';

  const isPlanningSubSection = (section: NavSection): boolean =>
    section === 'strategic-planning' ||
    section === 'dashboard' ||
    section === 'project-workspace';

  const isHierarchySubSection = (section: NavSection): boolean =>
    section === 'hierarchy' ||
    section === 'departments' ||
    section === 'portfolios' ||
    section === 'initiatives' ||
    section === 'projects' ||
    section === 'activities' ||
    section === 'scheduling';

  const isAdminControlsSubSection = (section: NavSection): boolean =>
    section === 'admin-settings' ||
    section === 'role-permissions' ||
    section === 'database-connection' ||
    section === 'users';

  useEffect(() => {
    if (isPmoSubSection(activeSection)) {
      setPmoModuleMenuOpen(true);
    }
    if (isPlanningSubSection(activeSection)) {
      setPlanningMenuOpen(true);
    }
    if (isHierarchySubSection(activeSection)) {
      setHierarchyMenuOpen(true);
    }
    if (isAdminControlsSubSection(activeSection)) {
      setAdminControlsMenuOpen(true);
    }
    setPmoTopDropdownOpen(false);
    setPlanningTopDropdownOpen(false);
    setHierarchyTopDropdownOpen(false);
    setAdminControlsTopDropdownOpen(false);
    setUserMenuOpen(false);
  }, [activeSection]);

  useEffect(() => {
    if (
      !pmoTopDropdownOpen &&
      !planningTopDropdownOpen &&
      !hierarchyTopDropdownOpen &&
      !adminControlsTopDropdownOpen &&
      !userMenuOpen
    ) {
      return;
    }
    const handlePointerDown = (e: MouseEvent) => {
      if (pmoTopDropdownRef.current && !pmoTopDropdownRef.current.contains(e.target as Node)) {
        setPmoTopDropdownOpen(false);
      }
      if (
        planningTopDropdownRef.current &&
        !planningTopDropdownRef.current.contains(e.target as Node)
      ) {
        setPlanningTopDropdownOpen(false);
      }
      if (
        hierarchyTopDropdownRef.current &&
        !hierarchyTopDropdownRef.current.contains(e.target as Node)
      ) {
        setHierarchyTopDropdownOpen(false);
      }
      if (
        adminControlsTopDropdownRef.current &&
        !adminControlsTopDropdownRef.current.contains(e.target as Node)
      ) {
        setAdminControlsTopDropdownOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPmoTopDropdownOpen(false);
        setPlanningTopDropdownOpen(false);
        setHierarchyTopDropdownOpen(false);
        setAdminControlsTopDropdownOpen(false);
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    pmoTopDropdownOpen,
    planningTopDropdownOpen,
    hierarchyTopDropdownOpen,
    adminControlsTopDropdownOpen,
    userMenuOpen
  ]);

  const showBanner = (type: 'success' | 'error', text: string) => {
    setBanner({ type, text });
    setTimeout(() => setBanner(null), 4000);
  };

  const isSectionRestricted = (
    section: NavSection,
    user?: { username?: string | null; email?: string | null; role?: string | null } | null
  ): boolean => {
    if (
      section === 'users' ||
      section === 'admin-settings' ||
      section === 'role-permissions' ||
      section === 'database-connection'
    ) {
      return !isAdminAccount(user);
    }
    if (section !== 'profile' && user) {
      return !isScreenVisible(section, user);
    }
    return false;
  };

  const navigateToSection = (section: NavSection) => {
    if (currentUser && isSectionRestricted(section, currentUser)) {
      const adminOnlyTarget =
        section === 'users' ||
        section === 'admin-settings' ||
        section === 'role-permissions' ||
        section === 'database-connection';
      showBanner(
        'error',
        adminOnlyTarget
          ? lang === 'ar'
            ? 'تم رفض الوصول: هذه الشاشة مقيدة بحساب مدير النظام فقط.'
            : 'Access denied: This module is restricted to the Admin account.'
          : lang === 'ar'
          ? 'تم رفض الوصول: هذه الشاشة غير متاحة لدورك الحالي.'
          : 'Access denied: This screen is not enabled for your current role.'
      );
      setActiveSection(getFirstVisibleSection(currentUser));
      return;
    }
    setActiveSection(section);
  };

  useEffect(() => {
    if (currentUser) {
      if (!isScreenVisible(activeSection, currentUser)) {
        setActiveSection(getFirstVisibleSection(currentUser));
      }
      return;
    }
    if (activeSection !== 'project-workspace' && !MENU_VISIBILITY[activeSection]) {
      setActiveSection(getInitialSection());
    }
  }, [activeSection, currentUser?.username, currentUser?.email, currentUser?.role, systemSettings]);

  // Data state
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [workstreams, setWorkstreams] = useState<Workstream[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [dependencies, setDependencies] = useState<TaskDependency[]>([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Hierarchy Drill-Down State
  const [drillDeptId, setDrillDeptId] = useState<number | null>(1);
  const [drillPortfolioId, setDrillPortfolioId] = useState<number | null>(1);
  const [drillInitiativeId, setDrillInitiativeId] = useState<number | null>(1);
  const [drillProjectId, setDrillProjectId] = useState<number | null>(1);

  // Modal CRUD State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalEntityType, setModalEntityType] = useState<
    'department' | 'portfolio' | 'initiative' | 'project' | 'workstream' | 'milestone' | 'activity' | null
  >(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formState, setFormState] = useState<Record<string, any>>({});
  const [formError, setFormError] = useState('');

  // Permissions helper based on Role
  const canManageStructure =
    currentUser?.role === 'PMO Manager' || currentUser?.role === 'Project Manager';
  const canDeleteStructure = currentUser?.role === 'PMO Manager';

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [
        dashRes,
        usersRes,
        deptRes,
        portRes,
        initRes,
        projRes,
        wsRes,
        msRes,
        actRes,
        depRes
      ] = await Promise.all([
        apiFetch('/api/dashboard'),
        apiFetch('/api/auth/users'),
        apiFetch('/api/departments'),
        apiFetch('/api/portfolios'),
        apiFetch('/api/initiatives'),
        apiFetch('/api/projects'),
        apiFetch('/api/workstreams'),
        apiFetch('/api/milestones'),
        apiFetch('/api/activities'),
        apiFetch('/api/dependencies')
      ]);

      if (dashRes.ok) setDashboard(await dashRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
      if (deptRes.ok) setDepartments(await deptRes.json());
      if (portRes.ok) setPortfolios(await portRes.json());
      if (initRes.ok) setInitiatives(await initRes.json());
      if (projRes.ok) setProjects(await projRes.json());
      if (wsRes.ok) setWorkstreams(await wsRes.json());
      if (msRes.ok) setMilestones(await msRes.json());
      if (actRes.ok) setActivities(await actRes.json());
      if (depRes.ok) setDependencies(await depRes.json());
    } catch (err) {
      console.error('Failed to fetch PMO data:', err);
    } finally {
      setLoading(false);
    }
  };

  const clearWorkspaceSessionState = () => {
    setActiveAuthToken(null);
    setCurrentUser(null);
    localStorage.removeItem('pmo_session_user');
    setDashboard(null);
    setUsers([]);
    setDepartments([]);
    setPortfolios([]);
    setInitiatives([]);
    setProjects([]);
    setWorkstreams([]);
    setMilestones([]);
    setActivities([]);
    setDependencies([]);
    setModalOpen(false);
    setRoleModalOpen(false);
    setActiveSection(getInitialSection());
  };

  // Register 401 unauthorized auto-signout handler
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearWorkspaceSessionState();
      setLoginError(
        lang === 'ar'
          ? 'انتهت صلاحية الجلسة أو تم إبطالها. يرجى تسجيل الدخول مرة أخرى.'
          : 'Your session has expired or was invalidated. Please sign in again.'
      );
    });
    return () => {
      setUnauthorizedHandler(null);
    };
  }, [lang]);

  // Verify existing HMAC token or acquire a valid signed session on initial load
  useEffect(() => {
    let cancelled = false;
    const bootstrapAuth = async () => {
      if (typeof window !== 'undefined' && localStorage.getItem('pmo_explicit_logout') === 'true') {
        if (!cancelled) setAuthBootstrapping(false);
        return;
      }

      setBootstrappingAuth(true);
      try {
        if (initialStoredSession?.token) {
          const meRes = await apiFetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${initialStoredSession.token}` }
          });
          if (meRes.ok) {
            const verified = await meRes.json();
            const refreshedUser: AuthUser = {
              userId: verified.userId,
              fullName: verified.fullName,
              fullNameAr: verified.fullNameAr,
              username: verified.username,
              email: verified.email,
              role: verified.role,
              token: initialStoredSession.token
            };
            setActiveAuthToken(refreshedUser.token);
            localStorage.setItem('pmo_session_user', JSON.stringify(refreshedUser));
            if (!cancelled) setCurrentUser(refreshedUser);
            return;
          }
          localStorage.removeItem('pmo_session_user');
          setActiveAuthToken(null);
          if (!cancelled) setCurrentUser(null);
          return;
        }

        // First visit without explicit logout: obtain real signed session for default admin
        const quickRes = await apiFetch('/api/auth/quick-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'Hamada El Daley' })
        });
        if (quickRes.ok) {
          const user: AuthUser = await quickRes.json();
          setActiveAuthToken(user.token);
          localStorage.setItem('pmo_session_user', JSON.stringify(user));
          if (!cancelled) setCurrentUser(user);
        } else if (!cancelled) {
          setCurrentUser(null);
        }
      } catch {
        if (!cancelled) setCurrentUser(null);
      } finally {
        setBootstrappingAuth(false);
        if (!cancelled) setAuthBootstrapping(false);
      }
    };

    bootstrapAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshSavedAccounts = async () => {
    try {
      const res = await apiFetch('/api/auth/users');
      if (res.ok) {
        const data: UserRecord[] = await res.json();
        if (Array.isArray(data)) {
          setSavedAccounts(data.filter((u) => u.isActive));
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (currentUser && !authBootstrapping) {
      fetchAllData();
    }
  }, [currentUser, authBootstrapping]);

  useEffect(() => {
    refreshSavedAccounts();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const identifier = loginUsername.trim();
    if (!identifier || !loginPassword) {
      setLoginError(
        lang === 'ar'
          ? 'يرجى إدخال اسم المستخدم/البريد الإلكتروني وكلمة المرور.'
          : 'Please enter both username/email and password.'
      );
      return;
    }

    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: identifier, password: loginPassword })
      });

      if (res.ok) {
        const user: AuthUser = await res.json();
        setActiveAuthToken(user.token);
        setCurrentUser(user);
        setActiveSection(getFirstVisibleSection(user));
        localStorage.setItem('pmo_session_user', JSON.stringify(user));
        localStorage.removeItem('pmo_explicit_logout');
        return;
      }

      const err = await res.json().catch(() => ({}));
      setLoginError(
        err.message ||
          (lang === 'ar'
            ? 'بيانات الدخول غير صحيحة أو الحساب غير مفعل.'
            : 'Invalid username/email or password.')
      );
    } catch {
      setLoginError(
        lang === 'ar'
          ? 'تعذر الاتصال بخدمة المصادقة. يرجى المحاولة مرة أخرى.'
          : 'Unable to reach authentication service. Please try again.'
      );
    }
  };

  const handleQuickLogin = async (account: UserRecord) => {
    setQuickLoggingInId(account.id);
    setLoginError('');
    try {
      const res = await apiFetch('/api/auth/quick-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: account.id, username: account.username })
      });
      if (res.ok) {
        const user: AuthUser = await res.json();
        setActiveAuthToken(user.token);
        setCurrentUser(user);
        setActiveSection(getFirstVisibleSection(user));
        localStorage.setItem('pmo_session_user', JSON.stringify(user));
        localStorage.removeItem('pmo_explicit_logout');
        return;
      }
      const err = await res.json().catch(() => ({}));
      setLoginError(
        err.message ||
          (lang === 'ar' ? 'تعذر تسجيل الدخول بهذا الحساب.' : 'Unable to sign in with this account.')
      );
    } catch {
      setLoginError(
        lang === 'ar'
          ? 'تعذر الاتصال بخدمة المصادقة. يرجى المحاولة مرة أخرى.'
          : 'Unable to reach authentication service. Please try again.'
      );
    } finally {
      setQuickLoggingInId(null);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError('');
    setIsRegistering(true);

    if (!regFullName.trim() || !regUsername.trim() || !regEmail.trim() || !regPassword) {
      setRegisterError(
        lang === 'ar' ? 'يرجى تعبئة جميع الحقول المطلوبة.' : 'Please fill in all required fields.'
      );
      setIsRegistering(false);
      return;
    }

    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: regFullName.trim(),
          username: regUsername.trim(),
          email: regEmail.trim(),
          password: regPassword,
          roleName: 'Team Member'
        })
      });

      if (!res.ok) {
        const err = await res.json();
        setRegisterError(
          err.message || (lang === 'ar' ? 'تعذر إتمام التسجيل.' : 'Registration failed.')
        );
        setIsRegistering(false);
        return;
      }

      const user: AuthUser = await res.json();
      setActiveAuthToken(user.token);
      const newRec: UserRecord = {
        id: user.userId,
        fullName: user.fullName,
        fullNameAr: user.fullNameAr,
        email: user.email,
        username: user.username,
        roleId: user.role === 'PMO Manager' ? 1 : user.role === 'Project Manager' ? 2 : 3,
        roleName: user.role,
        isActive: true
      };
      setSavedAccounts((prev) => [newRec, ...prev.filter((u) => u.id !== newRec.id)]);
      setCurrentUser(user);
      setActiveSection(getFirstVisibleSection(user));
      localStorage.setItem('pmo_session_user', JSON.stringify(user));
      localStorage.removeItem('pmo_explicit_logout');
      const displayName = pickLocalized(lang, user.fullName, user.fullNameAr);
      showBanner(
        'success',
        lang === 'ar'
          ? `مرحباً ${displayName}! تم إنشاء الحساب بنجاح.`
          : `Welcome, ${displayName}! Account created successfully.`
      );
    } catch {
      setRegisterError(
        lang === 'ar'
          ? 'تعذر الاتصال بخدمة التسجيل.'
          : 'Unable to reach registration service.'
      );
    } finally {
      setIsRegistering(false);
    }
  };

  const handleUpdateUserRole = async (userId: number, newRole: string) => {
    setUpdatingUserRoleId(userId);
    try {
      const res = await apiFetch(`/api/auth/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleName: newRole })
      });
      if (res.ok) {
        const updated = await res.json();
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId ? { ...u, roleName: updated.roleName, roleId: updated.roleId } : u
          )
        );
        setSavedAccounts((prev) =>
          prev.map((u) =>
            u.id === userId ? { ...u, roleName: updated.roleName, roleId: updated.roleId } : u
          )
        );
        if (currentUser && currentUser.userId === userId) {
          const updatedUser: AuthUser = { ...currentUser, role: updated.roleName };
          setCurrentUser(updatedUser);
          localStorage.setItem('pmo_session_user', JSON.stringify(updatedUser));
        }
        showBanner(
          'success',
          lang === 'ar'
            ? `تم تحديث دور المستخدم إلى ${translateRole(newRole, lang)} بنجاح`
            : `Updated user role to ${newRole} successfully.`
        );
      } else {
        const err = await res.json().catch(() => ({}));
        showBanner(
          'error',
          err.message || (lang === 'ar' ? 'تعذر تحديث دور المستخدم.' : 'Failed to update user role.')
        );
      }
    } catch {
      showBanner('error', lang === 'ar' ? 'حدث خطأ أثناء تحديث دور المستخدم.' : 'Error updating user role.');
    } finally {
      setUpdatingUserRoleId(null);
    }
  };

  const handleQuickRoleSwitch = async (username: string) => {
    try {
      const res = await apiFetch('/api/auth/quick-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      if (res.ok) {
        const user: AuthUser = await res.json();
        setRoleModalOpen(false);
        setActiveAuthToken(user.token);
        setCurrentUser(user);
        setActiveSection(getFirstVisibleSection(user));
        localStorage.setItem('pmo_session_user', JSON.stringify(user));
        localStorage.removeItem('pmo_explicit_logout');
        return;
      }
      const err = await res.json().catch(() => ({}));
      showBanner(
        'error',
        err.message || (lang === 'ar' ? 'تعذر تبديل جلسة المستخدم.' : 'Unable to switch user session.')
      );
    } catch {
      showBanner('error', lang === 'ar' ? 'تعذر تبديل جلسة المستخدم.' : 'Unable to switch user session.');
    }
  };

  const handleLogout = async () => {
    const tokenToRevoke = getActiveAuthToken() || currentUser?.token;
    if (tokenToRevoke) {
      try {
        await apiFetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenToRevoke}` }
        });
      } catch {
        // proceed with local logout even if network call fails
      }
    }
    localStorage.setItem('pmo_explicit_logout', 'true');
    clearWorkspaceSessionState();
    setAuthMode('manual');
    setLoginError('');
    setRegisterError('');
    setForgotError('');
    setForgotSuccess('');
  };

  const handleVerifyForgotUser = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setForgotError('');
    setForgotSuccess('');
    if (!forgotIdentifier.trim()) {
      setForgotError(
        lang === 'ar'
          ? 'الرجاء إدخال اسم المستخدم أو البريد الإلكتروني'
          : 'Please enter your username or email address.'
      );
      return;
    }
    setIsVerifyingForgot(true);
    try {
      const res = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: forgotIdentifier.trim() })
      });
      if (!res.ok) {
        const err = await res.json();
        setForgotError(
          err.message ||
            (lang === 'ar'
              ? 'لم يتم العثور على حساب مطابق لبيانات الإدخال'
              : 'No matching account found with these details.')
        );
        setForgotVerifiedUser(null);
        return;
      }
      const data = await res.json();
      setForgotVerifiedUser(data);
    } catch {
      setForgotError(
        lang === 'ar' ? 'تعذر الاتصال بخدمة التحقق من الحساب' : 'Unable to reach verification service.'
      );
    } finally {
      setIsVerifyingForgot(false);
    }
  };

  const handleResetForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');
    if (!forgotNewPassword || !forgotConfirmPassword) {
      setForgotError(
        lang === 'ar' ? 'يرجى إدخال كلمة المرور وتأكيدها' : 'Please enter and confirm your new password.'
      );
      return;
    }
    if (forgotNewPassword.length < 6) {
      setForgotError(
        lang === 'ar'
          ? 'يجب ألا تقل كلمة المرور عن 6 أحرف أو أرقام'
          : 'Password must be at least 6 characters long.'
      );
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError(
        lang === 'ar' ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match.'
      );
      return;
    }

    setIsResettingForgot(true);
    try {
      const identifier = forgotVerifiedUser ? forgotVerifiedUser.username : forgotIdentifier.trim();
      const res = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, newPassword: forgotNewPassword })
      });
      if (!res.ok) {
        const err = await res.json();
        setForgotError(
          err.message || (lang === 'ar' ? 'تعذر إعادة تعيين كلمة المرور.' : 'Failed to reset password.')
        );
        return;
      }
      const data = await res.json();
      setForgotSuccess(t.passwordResetSuccess);
      setLoginUsername(data.username || identifier);
      setLoginPassword(forgotNewPassword);
    } catch {
      setForgotError(
        lang === 'ar' ? 'تعذر الاتصال بخدمة إعادة التعيين' : 'Unable to reach password reset service.'
      );
    } finally {
      setIsResettingForgot(false);
    }
  };

  const handleOpenProfile = () => {
    if (!currentUser) return;
    setProfileFullName(currentUser.fullName);
    setProfileEmail(currentUser.email);
    setProfileTab('details');
    setProfileError('');
    setProfileSuccess('');
    setCurrentPasswordInput('');
    setNewPasswordInput('');
    setConfirmPasswordInput('');
    setPasswordError('');
    setPasswordSuccess('');
    setShowCurrentPass(false);
    setShowNewPass(false);
    setShowConfirmPass(false);
    setActiveSection('profile');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setProfileError('');
    setProfileSuccess('');
    if (!profileFullName.trim() || !profileEmail.trim()) {
      setProfileError(
        lang === 'ar' ? 'جميع حقول الملف الشخصي مطلوبة' : 'Full name and email are required.'
      );
      return;
    }

    setProfileSaving(true);
    try {
      const res = await apiFetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.userId,
          fullName: profileFullName.trim(),
          email: profileEmail.trim()
        })
      });
      if (!res.ok) {
        const err = await res.json();
        setProfileError(
          err.message || (lang === 'ar' ? 'تعذر تحديث الملف الشخصي.' : 'Failed to update profile.')
        );
        return;
      }
      const updated = await res.json();
      const updatedAuth: AuthUser = {
        ...currentUser,
        fullName: updated.fullName,
        fullNameAr: updated.fullNameAr || currentUser.fullNameAr,
        email: updated.email
      };
      setCurrentUser(updatedAuth);
      localStorage.setItem('pmo_session_user', JSON.stringify(updatedAuth));
      setSavedAccounts((prev) =>
        prev.map((acc) =>
          acc.id === currentUser.userId
            ? { ...acc, fullName: updated.fullName, email: updated.email }
            : acc
        )
      );
      setUsers((prev) =>
        prev.map((u) =>
          u.id === currentUser.userId
            ? { ...u, fullName: updated.fullName, email: updated.email }
            : u
        )
      );
      setProfileSuccess(t.profileUpdatedSuccess);
      showBanner('success', t.profileUpdatedSuccess);
    } catch {
      setProfileError(
        lang === 'ar' ? 'تعذر الاتصال بخدمة الملف الشخصي.' : 'Failed to communicate with profile service.'
      );
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setPasswordError('');
    setPasswordSuccess('');
    if (!currentPasswordInput || !newPasswordInput || !confirmPasswordInput) {
      setPasswordError(
        lang === 'ar' ? 'يرجى ملء جميع حقول كلمة المرور' : 'All password fields are required.'
      );
      return;
    }
    if (newPasswordInput.length < 6) {
      setPasswordError(
        lang === 'ar'
          ? 'يجب ألا تقل كلمة المرور عن 6 أحرف أو أرقام'
          : 'New password must be at least 6 characters long.'
      );
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordError(
        lang === 'ar'
          ? 'كلمة المرور الجديدة وتأكيدها غير متطابقتين'
          : 'New password and confirmation do not match.'
      );
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.userId,
          currentPassword: currentPasswordInput,
          newPassword: newPasswordInput
        })
      });
      if (!res.ok) {
        const err = await res.json();
        setPasswordError(
          err.message || (lang === 'ar' ? 'تعذر تحديث كلمة المرور.' : 'Failed to update password.')
        );
        return;
      }
      setPasswordSuccess(t.passwordChangedSuccess);
      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      showBanner('success', t.passwordChangedSuccess);
    } catch {
      setPasswordError(
        lang === 'ar' ? 'تعذر الاتصال بخدمة الأمان.' : 'Failed to communicate with security service.'
      );
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleResetSeed = async () => {
    await apiFetch('/api/reset-seed', { method: 'POST' });
    await fetchAllData();
  };

  // Filtered Lists
  const filteredDepartments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return departments.filter((d) => {
      const matchSearch =
        !q ||
        d.name.toLowerCase().includes(q) ||
        (d.nameAr || '').toLowerCase().includes(q) ||
        (d.description || '').toLowerCase().includes(q) ||
        (d.descriptionAr || '').toLowerCase().includes(q);
      const matchStatus =
        statusFilter === 'All' ||
        (statusFilter === 'Active' && d.isActive) ||
        (statusFilter === 'Inactive' && !d.isActive);
      return matchSearch && matchStatus;
    });
  }, [departments, searchQuery, statusFilter]);

  const filteredPortfolios = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return portfolios.filter((p) => {
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.nameAr || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        (p.descriptionAr || '').toLowerCase().includes(q) ||
        (p.departmentName || '').toLowerCase().includes(q) ||
        (p.departmentNameAr || '').toLowerCase().includes(q);
      const matchStatus = statusFilter === 'All' || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [portfolios, searchQuery, statusFilter]);

  const filteredInitiatives = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return initiatives.filter((i) => {
      const matchSearch =
        !q ||
        i.name.toLowerCase().includes(q) ||
        (i.nameAr || '').toLowerCase().includes(q) ||
        (i.description || '').toLowerCase().includes(q) ||
        (i.descriptionAr || '').toLowerCase().includes(q) ||
        (i.portfolioName || '').toLowerCase().includes(q) ||
        (i.portfolioNameAr || '').toLowerCase().includes(q) ||
        (i.departmentName || '').toLowerCase().includes(q) ||
        (i.departmentNameAr || '').toLowerCase().includes(q);
      const matchStatus = statusFilter === 'All' || i.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [initiatives, searchQuery, statusFilter]);

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return projects.filter((pr) => {
      const matchSearch =
        !q ||
        pr.name.toLowerCase().includes(q) ||
        (pr.nameAr || '').toLowerCase().includes(q) ||
        (pr.description || '').toLowerCase().includes(q) ||
        (pr.descriptionAr || '').toLowerCase().includes(q) ||
        (pr.initiativeName || '').toLowerCase().includes(q) ||
        (pr.initiativeNameAr || '').toLowerCase().includes(q) ||
        (pr.projectManagerName || '').toLowerCase().includes(q) ||
        (pr.projectManagerNameAr || '').toLowerCase().includes(q);
      const matchStatus = statusFilter === 'All' || pr.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [projects, searchQuery, statusFilter]);

  const filteredWorkstreams = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return workstreams.filter((w) => {
      const matchSearch =
        !q ||
        w.name.toLowerCase().includes(q) ||
        (w.nameAr || '').toLowerCase().includes(q) ||
        (w.description || '').toLowerCase().includes(q) ||
        (w.descriptionAr || '').toLowerCase().includes(q) ||
        (w.projectName || '').toLowerCase().includes(q) ||
        (w.projectNameAr || '').toLowerCase().includes(q) ||
        (w.ownerName || '').toLowerCase().includes(q) ||
        (w.ownerNameAr || '').toLowerCase().includes(q);
      const matchStatus = statusFilter === 'All' || w.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [workstreams, searchQuery, statusFilter]);

  const filteredMilestones = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return milestones.filter((m) => {
      const matchSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        (m.nameAr || '').toLowerCase().includes(q) ||
        (m.description || '').toLowerCase().includes(q) ||
        (m.descriptionAr || '').toLowerCase().includes(q) ||
        (m.projectName || '').toLowerCase().includes(q) ||
        (m.projectNameAr || '').toLowerCase().includes(q) ||
        (m.workstreamName || '').toLowerCase().includes(q) ||
        (m.workstreamNameAr || '').toLowerCase().includes(q);
      const matchStatus = statusFilter === 'All' || m.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [milestones, searchQuery, statusFilter]);

  const filteredActivities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activities.filter((a) => {
      const matchSearch =
        !q ||
        a.name.toLowerCase().includes(q) ||
        (a.nameAr || '').toLowerCase().includes(q) ||
        (a.description || '').toLowerCase().includes(q) ||
        (a.descriptionAr || '').toLowerCase().includes(q) ||
        (a.projectName || '').toLowerCase().includes(q) ||
        (a.projectNameAr || '').toLowerCase().includes(q) ||
        (a.workstreamName || '').toLowerCase().includes(q) ||
        (a.workstreamNameAr || '').toLowerCase().includes(q) ||
        (a.assignedUserName || '').toLowerCase().includes(q) ||
        (a.assignedUserNameAr || '').toLowerCase().includes(q);
      const matchStatus = statusFilter === 'All' || a.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [activities, searchQuery, statusFilter]);

  // Modal Open Helpers
  const openCreateModal = (
    type:
      | 'department'
      | 'portfolio'
      | 'initiative'
      | 'project'
      | 'workstream'
      | 'milestone'
      | 'activity',
    defaults: Record<string, any> = {}
  ) => {
    setFormError('');
    setModalEntityType(type);
    setEditingId(null);

    if (type === 'department') {
      setFormState({ name: '', description: '', isActive: true, ...defaults });
    } else if (type === 'portfolio') {
      setFormState({
        name: '',
        description: '',
        departmentId: departments[0]?.id || '',
        ownerId: users[0]?.id || '',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        status: 'Active',
        ...defaults
      });
    } else if (type === 'initiative') {
      setFormState({
        name: '',
        description: '',
        portfolioId: portfolios[0]?.id || '',
        departmentId: departments[0]?.id || '',
        ownerId: users[1]?.id || users[0]?.id || '',
        startDate: '2026-02-01',
        targetDate: '2026-10-31',
        status: 'In Progress',
        priority: 'High',
        progressPercentage: 25,
        ...defaults
      });
    } else if (type === 'project') {
      setFormState({
        name: '',
        description: '',
        initiativeId: initiatives[0]?.id || '',
        projectManagerId: users[1]?.id || users[0]?.id || '',
        startDate: '2026-03-01',
        endDate: '2026-09-30',
        status: 'In Progress',
        priority: 'High',
        progressPercentage: 40,
        ...defaults
      });
    } else if (type === 'workstream') {
      const defaultProjId = defaults.projectId || projects[0]?.id || 1;
      setFormState({
        name: '',
        description: '',
        projectId: defaultProjId,
        ownerId: users[1]?.id || users[0]?.id || '',
        startDate: '2026-03-01',
        endDate: '2026-08-30',
        status: 'In Progress',
        progressPercentage: 50,
        ...defaults
      });
    } else if (type === 'milestone') {
      const defaultProjId = defaults.projectId || projects[0]?.id || 1;
      const projWs = workstreams.filter((w) => w.projectId === Number(defaultProjId));
      setFormState({
        name: '',
        description: '',
        projectId: defaultProjId,
        workstreamId: projWs[0]?.id || null,
        ownerId: users[1]?.id || users[0]?.id || '',
        plannedDate: '2026-10-15',
        actualDate: null,
        status: 'Planned',
        ...defaults
      });
    } else if (type === 'activity') {
      const defaultProjId = defaults.projectId || projects[0]?.id || 1;
      const projWs = workstreams.filter((w) => w.projectId === Number(defaultProjId));
      setFormState({
        name: '',
        description: '',
        projectId: defaultProjId,
        workstreamId: projWs[0]?.id || null,
        milestoneId: null,
        parentActivityId: defaults.parentActivityId ?? null,
        assignedUserId: users[3]?.id || users[0]?.id || '',
        startDate: '2026-05-01',
        dueDate: '2026-10-25',
        status: 'In Progress',
        priority: 'Medium',
        progressPercentage: 50,
        ...defaults
      });
    }
    setModalOpen(true);
  };

  const openEditModal = (
    type:
      | 'department'
      | 'portfolio'
      | 'initiative'
      | 'project'
      | 'workstream'
      | 'milestone'
      | 'activity',
    item: Record<string, any>
  ) => {
    setFormError('');
    setModalEntityType(type);
    setEditingId(item.id);
    setFormState({ ...item });
    setModalOpen(true);
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalEntityType) return;
    setFormError('');

    const endpointMap: Record<string, string> = {
      department: '/api/departments',
      portfolio: '/api/portfolios',
      initiative: '/api/initiatives',
      project: '/api/projects',
      workstream: '/api/workstreams',
      milestone: '/api/milestones',
      activity: '/api/activities'
    };

    const baseUrl = endpointMap[modalEntityType];
    const url = editingId ? `${baseUrl}/${editingId}` : baseUrl;
    const method = editingId ? 'PUT' : 'POST';

    try {
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formState)
      });

      if (!res.ok) {
        const err = await res.json();
        setFormError(
          err.message ||
            (lang === 'ar'
              ? 'فشل التحقق. يرجى التأكد من الحقول المطلوبة.'
              : 'Validation failed. Please check required fields.')
        );
        return;
      }

      const entityLabel =
        modalEntityType === 'department'
          ? t.department
          : modalEntityType === 'portfolio'
          ? t.portfolio
          : modalEntityType === 'initiative'
          ? t.initiative
          : modalEntityType === 'project'
          ? t.project
          : modalEntityType === 'workstream'
          ? t.workstream
          : modalEntityType === 'milestone'
          ? t.milestone
          : t.activity;

      setModalOpen(false);
      const savedDisplayName = pickLocalized(lang, formState.name, formState.nameAr);
      showBanner(
        'success',
        lang === 'ar'
          ? `تم ${editingId ? 'تحديث' : 'إنشاء'} ${entityLabel} "${savedDisplayName}" بنجاح.`
          : `${entityLabel} "${savedDisplayName}" ${editingId ? 'updated' : 'created'} successfully.`
      );
      await fetchAllData();
    } catch {
      setFormError(
        lang === 'ar' ? 'حدث خطأ في الشبكة أثناء حفظ السجل.' : 'Network error while saving record.'
      );
    }
  };

  const handleDeleteRecord = async (
    type:
      | 'department'
      | 'portfolio'
      | 'initiative'
      | 'project'
      | 'workstream'
      | 'milestone'
      | 'activity',
    id: number,
    name?: string
  ) => {
    const endpointMap: Record<string, string> = {
      department: '/api/departments',
      portfolio: '/api/portfolios',
      initiative: '/api/initiatives',
      project: '/api/projects',
      workstream: '/api/workstreams',
      milestone: '/api/milestones',
      activity: '/api/activities'
    };

    const entityLabel =
      type === 'department'
        ? t.department
        : type === 'portfolio'
        ? t.portfolio
        : type === 'initiative'
        ? t.initiative
        : type === 'project'
        ? t.project
        : type === 'workstream'
        ? t.workstream
        : type === 'milestone'
        ? t.milestone
        : t.activity;

    const res = await apiFetch(`${endpointMap[type]}/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showBanner(
        'error',
        err.message || (lang === 'ar' ? `تعذر حذف ${entityLabel}.` : `Unable to delete ${entityLabel}.`)
      );
      return;
    }
    showBanner(
      'success',
      lang === 'ar'
        ? `تم حذف ${entityLabel}${name ? ` "${name}"` : ''}.`
        : `Deleted ${entityLabel}${name ? ` "${name}"` : ''}.`
    );
    await fetchAllData();
  };

  const handleQuickActivityStatusChange = async (
    activity: Activity,
    newStatus: Activity['status']
  ) => {
    const res = await apiFetch(`/api/activities/${activity.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...activity,
        status: newStatus,
        progressPercentage:
          newStatus === 'Completed'
            ? 100
            : newStatus === 'Not Started'
            ? 0
            : activity.progressPercentage || 50
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showBanner(
        'error',
        err.message || (lang === 'ar' ? 'تعذر تحديث حالة النشاط.' : 'Unable to update activity status.')
      );
      return;
    }
    const actName = pickLocalized(lang, activity.name, activity.nameAr);
    const translatedSt = translateStatus(newStatus, lang);
    showBanner(
      'success',
      lang === 'ar'
        ? `تم تحديث حالة النشاط "${actName}" إلى ${translatedSt} وإعادة احتساب التقدم.`
        : `Task "${actName}" status updated to ${translatedSt}. Progress recalculated.`
    );
    await fetchAllData();
  };

  if (authBootstrapping) {
    return (
      <div className="min-h-screen bg-[#090E1A] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-slate-200">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="text-xs font-medium text-slate-400">
            {lang === 'ar' ? 'جارٍ التحقق من الجلسة...' : 'Verifying authenticated session...'}
          </span>
        </div>
      </div>
    );
  }

  // ==================== LOGIN SCREEN ====================
  if (!currentUser) {
    const getRoleStyle = (roleName?: string) => {
      if (roleName === 'PMO Manager') {
        return {
          cardBorder: 'hover:border-indigo-500 hover:ring-2 hover:ring-indigo-500/10',
          avatarBg: 'bg-gradient-to-br from-indigo-600 via-indigo-700 to-blue-800 text-white shadow-indigo-500/25',
          badge: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
          roleIcon: Shield,
          desc: lang === 'ar' ? 'صلاحيات كاملة للمحافظ والمشاريع' : 'Executive Portfolio & Governance'
        };
      }
      if (roleName === 'Project Manager') {
        return {
          cardBorder: 'hover:border-emerald-500 hover:ring-2 hover:ring-emerald-500/10',
          avatarBg: 'bg-gradient-to-br from-emerald-600 via-teal-700 to-teal-800 text-white shadow-emerald-500/25',
          badge: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
          roleIcon: Briefcase,
          desc: lang === 'ar' ? 'تخطيط المشاريع والمسارات والجداول' : 'Project & Schedule Planning'
        };
      }
      return {
        cardBorder: 'hover:border-sky-500 hover:ring-2 hover:ring-sky-500/10',
        avatarBg: 'bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-700 text-white shadow-sky-500/25',
        badge: 'bg-sky-50 text-sky-700 border-sky-200/80',
        roleIcon: CheckSquare,
        desc: lang === 'ar' ? 'تنفيذ الأنشطة والمهام وتحديث التقدم' : 'Task Execution & Progress Updates'
      };
    };

    return (
      <div className="min-h-screen bg-[#090E1A] flex flex-col justify-center items-center p-3 sm:p-6 lg:p-8 relative">
        {/* Subtle structural background grid (pure CSS, no JavaScript) */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
            backgroundSize: '24px 24px'
          }}
        />

        <div className="w-full max-w-5xl bg-white border border-slate-800/80 rounded-2xl lg:rounded-3xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 shadow-2xl shadow-black/40 relative z-10">
          {/* Left Executive Brand Panel (5 cols) */}
          <div className="lg:col-span-5 bg-[#0C1322] text-white p-7 sm:p-9 flex flex-col justify-between border-b lg:border-b-0 lg:border-e border-slate-800">
            <div>
              {/* Brand Header */}
              <div className="pb-6 border-b border-slate-800/80">
                <NexoraLogo size="lg" theme="dark" showSubtitle={true} subtitle={t.systemSubtitle} lang={lang} />
              </div>

              {/* Enterprise Strategic Value Pillars */}
              <div className="mt-8 space-y-6">
                <div>
                  <h2 className="text-xs font-semibold tracking-wider uppercase text-cyan-400">
                    {lang === 'ar' ? 'منظومة الحوكمة المؤسسية' : 'Enterprise Governance Solution'}
                  </h2>
                  <p className="text-sm font-medium text-slate-200 mt-1">
                    {lang === 'ar'
                      ? 'إدارة متكاملة للمحافظ والمبادرات والمشاريع الاستراتيجية ومسارات العمل'
                      : 'Unified portfolio, program, and strategic initiative management.'}
                  </p>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="flex items-start gap-3.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-slate-100">
                        {lang === 'ar' ? 'المواءمة الاستراتيجية' : 'Strategic Alignment'}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                        {lang === 'ar'
                          ? 'ربط الأهداف والقطاعات بالمحافظ الاستثمارية والمشاريع الميدانية.'
                          : 'Connect organizational goals with executive portfolios and deliverable roadmaps.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-slate-100">
                        {lang === 'ar' ? 'حوكمة المسار الحرج والمحطات' : 'Governance & Critical Path'}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                        {lang === 'ar'
                          ? 'متابعة مسارات التنفيذ، بوابات الاعتماد، وحساب التقدم الإجمالي تلقائياً.'
                          : 'Milestone tracking, approval gates, and automatic multi-tier progress rollup.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-slate-100">
                        {lang === 'ar' ? 'صلاحيات متعددة المستويات' : 'Role-Based Access Control'}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                        {lang === 'ar'
                          ? 'أدوار مخصصة لإدارة المحافظ، مديري المشاريع، وفرق العمل التنفيذية.'
                          : 'Differentiated control for PMO Directors, Project Managers, and Task Teams.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Security Note */}
            <div className="pt-6 mt-8 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
              <span>{lang === 'ar' ? 'بيانات مؤمنة ومشفرة بالكامل' : 'Enterprise RBAC · TLS Secured'}</span>
              <span className="font-mono text-slate-400">
                {lang === 'ar' ? 'نكسورا لإدارة المشاريع' : 'NEXORA PMO'}
              </span>
            </div>
          </div>

          {/* Right Authentication Form (7 cols) */}
          <div className="lg:col-span-7 p-6 sm:p-9 flex flex-col justify-between bg-white">
            <div>
              {/* Header & Language Toggle */}
              <div className="flex items-start justify-between gap-4 mb-6 pb-4 border-b border-slate-200/80">
                <div>
                  <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
                    {authMode === 'saved'
                      ? t.savedAccountsTab
                      : authMode === 'register'
                      ? t.createAccountTitle
                      : authMode === 'forgot'
                      ? t.forgotPasswordTitle
                      : t.signInTitle}
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    {authMode === 'saved'
                      ? t.savedAccountsDesc
                      : authMode === 'register'
                      ? t.createAccountDesc
                      : authMode === 'forgot'
                      ? t.forgotPasswordDesc
                      : t.signInDesc}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Globe className="w-3.5 h-3.5 text-blue-600" />
                  <span>{lang === 'en' ? 'العربية' : 'English'}</span>
                </button>
              </div>

              {/* 1-Click Direct Workspace Access Button */}
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => handleQuickLogin(savedAccounts[0] || INITIAL_DEMO_USERS[0])}
                  className="w-full p-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold text-xs shadow-md shadow-blue-500/20 hover:shadow-lg transition-all flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center font-bold text-xs text-white">
                      {getInitials((savedAccounts[0] || INITIAL_DEMO_USERS[0]).fullName)}
                    </div>
                    <div className="text-start">
                      <div className="font-bold text-xs leading-tight">
                        {lang === 'ar' ? 'الدخول المباشر إلى واجهة النظام' : 'Enter Workspace Directly'}
                      </div>
                      <div className="text-[10px] text-blue-100 font-medium">
                        {pickLocalized(lang, (savedAccounts[0] || INITIAL_DEMO_USERS[0]).fullName, (savedAccounts[0] || INITIAL_DEMO_USERS[0]).fullNameAr)} ({translateRole((savedAccounts[0] || INITIAL_DEMO_USERS[0]).roleName || 'PMO Manager', lang)})
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-white/95 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform">
                    <span>{lang === 'ar' ? 'دخول فوري' : 'Open'}</span>
                    <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                  </div>
                </button>
              </div>

              {/* Mode Navigation Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('manual');
                    setLoginError('');
                    setRegisterError('');
                    setForgotError('');
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    authMode === 'manual'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{t.manualSignInTab}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('saved');
                    setLoginError('');
                    setRegisterError('');
                    setForgotError('');
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    authMode === 'saved'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>{t.savedAccountsTab}</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-700 font-mono">
                    {savedAccounts.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setLoginError('');
                    setRegisterError('');
                    setForgotError('');
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    authMode === 'register'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{t.createAccountTab}</span>
                </button>
              </div>

              {/* Errors */}
              {loginError && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}
              {registerError && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{registerError}</span>
                </div>
              )}
              {forgotError && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{forgotError}</span>
                </div>
              )}

              {/* MODE 1: SAVED ACCOUNTS ICONS & CARDS */}
              {authMode === 'saved' && (
                <div className="space-y-4">
                  {/* Dedicated Saved Accounts Icons Bar */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-700">
                        {lang === 'ar' ? 'أيقونات الحسابات للدخول الفوري' : 'Saved Profile Icons (1-Click Entry)'}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {lang === 'ar' ? 'اضغط أيقونتك للدخول مباشرة' : 'Click icon to enter workspace'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 overflow-x-auto pb-2 pt-1 scrollbar-thin">
                      {savedAccounts.map((account) => {
                        const meta = getRoleStyle(account.roleName);
                        const RoleIcon = meta.roleIcon;
                        const isLoggingIn = quickLoggingInId === account.id;

                        return (
                          <button
                            key={`icon-${account.id}`}
                            type="button"
                            onClick={() => handleQuickLogin(account)}
                            disabled={quickLoggingInId !== null}
                            title={`${pickLocalized(lang, account.fullName, account.fullNameAr)} (${translateRole(account.roleName || 'Team Member', lang)})`}
                            className="group flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer shrink-0"
                          >
                            <div className="relative">
                              <div
                                className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-sm tracking-wider text-white shadow-md transition-all group-hover:scale-110 group-hover:shadow-lg ${meta.avatarBg} ${
                                  isLoggingIn ? 'ring-4 ring-blue-500 scale-105' : 'ring-2 ring-white/80'
                                }`}
                              >
                                {isLoggingIn ? (
                                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                                ) : (
                                  getInitials(account.fullName)
                                )}
                              </div>
                              <span className="absolute -bottom-1 -end-1 w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-xs">
                                <RoleIcon className="w-3 h-3 text-slate-700" />
                              </span>
                            </div>
                            <span className="text-[11px] font-semibold text-slate-800 max-w-[70px] truncate group-hover:text-blue-600 transition-colors">
                              {pickLocalized(lang, account.fullName, account.fullNameAr).split(' ')[0]}
                            </span>
                            <span className="text-[9px] font-mono text-slate-400 max-w-[70px] truncate">
                              @{account.username}
                            </span>
                          </button>
                        );
                      })}

                      {/* Create Account Avatar Icon Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('register');
                          setLoginError('');
                          setRegisterError('');
                        }}
                        className="group flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer shrink-0"
                        title={t.createNewAccount}
                      >
                        <div className="w-14 h-14 rounded-2xl border-2 border-dashed border-blue-400/80 bg-blue-50/50 hover:bg-blue-100/70 text-blue-600 flex items-center justify-center shadow-xs transition-all group-hover:scale-110 group-hover:border-blue-600">
                          <UserPlus className="w-6 h-6" />
                        </div>
                        <span className="text-[11px] font-semibold text-blue-600 max-w-[70px] truncate group-hover:underline">
                          {lang === 'ar' ? '+ حساب جديد' : '+ New User'}
                        </span>
                        <span className="text-[9px] text-slate-400 max-w-[70px] truncate">
                          {lang === 'ar' ? 'تسجيل' : 'Register'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* MODE 2: CREATE ACCOUNT FORM */}
              {authMode === 'register' && (
                <form onSubmit={handleRegister} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.fullNameLabel} <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <User className="w-3.5 h-3.5 absolute start-3 top-3 text-slate-400" />
                        <input
                          type="text"
                          value={regFullName}
                          onChange={(e) => setRegFullName(e.target.value)}
                          required
                          placeholder={lang === 'ar' ? 'مثال: سارة علي' : 'e.g. Sarah Connor'}
                          className="w-full ps-9 pe-3 py-2 text-xs bg-[#F8FAFC] border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.usernameLabel} <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute start-3 top-2.5 text-xs text-slate-400 font-mono">@</span>
                        <input
                          type="text"
                          value={regUsername}
                          onChange={(e) => setRegUsername(e.target.value)}
                          required
                          placeholder="s.connor"
                          className="w-full ps-8 pe-3 py-2 text-xs bg-[#F8FAFC] border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white transition-colors font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.emailLabel} <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Mail className="w-3.5 h-3.5 absolute start-3 top-3 text-slate-400" />
                        <input
                          type="email"
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          required
                          placeholder="s.connor@enterprise.org"
                          className="w-full ps-9 pe-3 py-2 text-xs bg-[#F8FAFC] border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.passwordLabel} <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Lock className="w-3.5 h-3.5 absolute start-3 top-3 text-slate-400" />
                        <input
                          type="password"
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          required
                          placeholder="••••••••"
                          className="w-full ps-9 pe-3 py-2 text-xs bg-[#F8FAFC] border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Notice: Role Assigned by Admin Later */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 flex items-start gap-2.5 text-xs">
                    <Shield className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div className="leading-relaxed">
                      <span className="font-semibold text-slate-800">
                        {lang === 'ar' ? 'تعيين الصلاحيات والأدوار:' : 'Role Assignment:'}
                      </span>{' '}
                      <span className="text-slate-600">
                        {lang === 'ar'
                          ? 'سيتم تحديد وتعيين الدور الوظيفي وصلاحيات النظام من قِبل مسؤول النظام لاحقاً.'
                          : 'Your system role and workspace permissions will be assigned by the PMO Administrator account.'}
                      </span>
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="pt-2 flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={isRegistering}
                      className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isRegistering ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>{t.creatingAccount}</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>{t.createAccountButton}</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('saved');
                        setRegisterError('');
                      }}
                      className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      {t.cancel}
                    </button>
                  </div>
                </form>
              )}

              {/* MODE 3: MANUAL CREDENTIAL SIGN IN */}
              {authMode === 'manual' && (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      {t.usernameOrEmail}
                    </label>
                    <div className="relative">
                      <User className="w-3.5 h-3.5 absolute start-3 top-3 text-slate-400" />
                      <input
                        type="text"
                        value={loginUsername}
                        onChange={(e) => setLoginUsername(e.target.value)}
                        required
                        className="w-full ps-9 pe-3 py-2 text-xs bg-[#F8FAFC] border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
                        placeholder="Hamada El Daley"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-700">
                        {t.passwordLabel}
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('forgot');
                          setForgotIdentifier(loginUsername || '');
                          setForgotError('');
                          setForgotSuccess('');
                          setForgotVerifiedUser(null);
                          setForgotNewPassword('');
                          setForgotConfirmPassword('');
                        }}
                        className="text-[11px] font-medium text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                      >
                        {t.forgotPassword}
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-3.5 h-3.5 absolute start-3 top-3 text-slate-400" />
                      <input
                        type={showLoginPassword ? 'text' : 'password'}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                        className="w-full ps-9 pe-10 py-2 text-xs bg-[#F8FAFC] border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute end-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        title={
                          showLoginPassword
                            ? lang === 'ar'
                              ? 'إخفاء كلمة المرور'
                              : 'Hide password'
                            : lang === 'ar'
                            ? 'إظهار كلمة المرور'
                            : 'Show password'
                        }
                      >
                        {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>{t.signInButton}</span>
                  </button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setAuthMode('saved')}
                      className="text-xs text-blue-600 hover:underline cursor-pointer"
                    >
                      {t.orChooseSaved}
                    </button>
                  </div>
                </form>
              )}

              {/* MODE 4: FORGOT PASSWORD / ACCOUNT RECOVERY */}
              {authMode === 'forgot' && (
                <div className="space-y-4">
                  {forgotSuccess ? (
                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-3 animate-in fade-in">
                      <div className="flex items-center gap-2.5 font-semibold text-xs text-emerald-800">
                        <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                        <span>{forgotSuccess}</span>
                      </div>
                      <p className="text-xs text-emerald-700">
                        {lang === 'ar'
                          ? 'تم تحديث كلمة المرور في قاعدة البيانات بنجاح. يمكنك الآن تسجيل الدخول مباشرة.'
                          : 'Your password has been reset successfully in the database. You can now sign in.'}
                      </p>
                      <div className="pt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setAuthMode('manual');
                            setForgotSuccess('');
                          }}
                          className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>{t.signInButton}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAuthMode('saved');
                            setForgotSuccess('');
                          }}
                          className="py-2.5 px-4 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                        >
                          {t.savedAccountsTab}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Step 1: Identifier input with verification */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          {t.usernameOrEmail} <span className="text-rose-500">*</span>
                        </label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <User className="w-3.5 h-3.5 absolute start-3 top-3 text-slate-400" />
                            <input
                              type="text"
                              value={forgotIdentifier}
                              onChange={(e) => {
                                setForgotIdentifier(e.target.value);
                                setForgotVerifiedUser(null);
                                setForgotError('');
                              }}
                              placeholder={lang === 'ar' ? 'أدخل اسم المستخدم أو البريد الإلكتروني' : 'Enter username or email address'}
                              className="w-full ps-9 pe-3 py-2 text-xs bg-[#F8FAFC] border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleVerifyForgotUser()}
                            disabled={isVerifyingForgot || !forgotIdentifier.trim()}
                            className="py-2 px-3.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                          >
                            {isVerifyingForgot ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>{t.verifyingAccount}</span>
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>{t.verifyAccountButton}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Verified User Details Card */}
                      {forgotVerifiedUser && (
                        <div className="p-3 bg-blue-50/70 border border-blue-200/90 rounded-xl flex items-center justify-between gap-3 animate-in fade-in">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                              {getInitials(forgotVerifiedUser.fullName)}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 truncate">
                                <span>{forgotVerifiedUser.fullName}</span>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono truncate">
                                @{forgotVerifiedUser.username} · {forgotVerifiedUser.maskedEmail}
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-200/80 shrink-0">
                            {translateRole(forgotVerifiedUser.roleName, lang)}
                          </span>
                        </div>
                      )}

                      {/* Step 2: New Password Inputs */}
                      <form onSubmit={handleResetForgotPassword} className="space-y-3.5 pt-1">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            {t.newPasswordLabel} <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <KeyRound className="w-3.5 h-3.5 absolute start-3 top-3 text-slate-400" />
                            <input
                              type={showForgotNewPass ? 'text' : 'password'}
                              value={forgotNewPassword}
                              onChange={(e) => setForgotNewPassword(e.target.value)}
                              required
                              placeholder={lang === 'ar' ? 'كلمة المرور الجديدة (6 خانات على الأقل)' : 'New password (min 6 characters)'}
                              className="w-full ps-9 pe-9 py-2 text-xs bg-[#F8FAFC] border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
                            />
                            <button
                              type="button"
                              onClick={() => setShowForgotNewPass(!showForgotNewPass)}
                              className="absolute end-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                              tabIndex={-1}
                            >
                              {showForgotNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            {t.confirmPasswordLabel} <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <Lock className="w-3.5 h-3.5 absolute start-3 top-3 text-slate-400" />
                            <input
                              type={showForgotConfirmPass ? 'text' : 'password'}
                              value={forgotConfirmPassword}
                              onChange={(e) => setForgotConfirmPassword(e.target.value)}
                              required
                              placeholder={lang === 'ar' ? 'تأكيد كلمة المرور الجديدة' : 'Confirm new password'}
                              className="w-full ps-9 pe-9 py-2 text-xs bg-[#F8FAFC] border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
                            />
                            <button
                              type="button"
                              onClick={() => setShowForgotConfirmPass(!showForgotConfirmPass)}
                              className="absolute end-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                              tabIndex={-1}
                            >
                              {showForgotConfirmPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        {/* Reset Buttons */}
                        <div className="pt-2 flex items-center gap-2">
                          <button
                            type="submit"
                            disabled={isResettingForgot || !forgotNewPassword || !forgotConfirmPassword}
                            className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {isResettingForgot ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>{t.resettingPassword}</span>
                              </>
                            ) : (
                              <>
                                <KeyRound className="w-3.5 h-3.5" />
                                <span>{t.resetPasswordButton}</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAuthMode('manual');
                              setForgotError('');
                              setForgotSuccess('');
                            }}
                            className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                          >
                            {t.cancel}
                          </button>
                        </div>
                      </form>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Footer Info */}
            <div className="mt-6 pt-4 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
              <span>
                {authMode === 'register'
                  ? t.alreadyHaveAccount
                  : authMode === 'forgot'
                  ? (lang === 'ar' ? 'تذكرت كلمة المرور؟' : 'Remembered your password?')
                  : t.clickToEnter}
              </span>
              {authMode === 'register' ? (
                <button
                  type="button"
                  onClick={() => setAuthMode('manual')}
                  className="text-blue-600 font-semibold hover:underline cursor-pointer"
                >
                  {t.manualSignInTab}
                </button>
              ) : authMode === 'forgot' ? (
                <button
                  type="button"
                  onClick={() => setAuthMode('manual')}
                  className="text-blue-600 font-semibold hover:underline cursor-pointer"
                >
                  {t.backToSignIn}
                </button>
              ) : authMode === 'manual' ? (
                <button
                  type="button"
                  onClick={() => setAuthMode('saved')}
                  className="text-blue-600 font-semibold hover:underline cursor-pointer"
                >
                  {t.savedAccountsTab}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==================== MAIN WORKSPACE SHELL ====================
  const statusOptionsMap: Record<string, string[]> = {
    departments: ['All', 'Active', 'Inactive'],
    portfolios: ['All', 'Active', 'Planning', 'On Hold', 'Completed'],
    initiatives: ['All', 'Not Started', 'In Progress', 'Completed', 'On Hold'],
    projects: ['All', 'Planned', 'In Progress', 'On Hold', 'Completed'],
    workstreams: ['All', 'Not Started', 'In Progress', 'Completed'],
    milestones: ['All', 'Planned', 'In Progress', 'Completed', 'Delayed'],
    activities: ['All', 'Not Started', 'In Progress', 'Completed']
  };

  const currentStatusOptions = statusOptionsMap[activeSection] || [];

  // Hierarchy selected entities
  const selectedDeptObj = departments.find((d) => d.id === drillDeptId) || null;
  const deptPortfolios = portfolios.filter((p) => p.departmentId === drillDeptId);
  const selectedPortObj = portfolios.find((p) => p.id === drillPortfolioId) || null;
  const portInitiatives = initiatives.filter((i) => i.portfolioId === drillPortfolioId);
  const selectedInitObj = initiatives.find((i) => i.id === drillInitiativeId) || null;
  const initProjects = projects.filter((pr) => pr.initiativeId === drillInitiativeId);
  const selectedProjObj = projects.find((pr) => pr.id === drillProjectId) || null;
  const projActivities = activities.filter((a) => a.projectId === drillProjectId);

  return (
    <div className="min-h-screen flex bg-[#F4F7FB] text-[#0F172A]">
      {/* Sidebar Navigation (264px fixed, Solid Dark Slate Style) */}
      <aside className="sticky top-0 h-screen w-[264px] shrink-0 flex flex-col text-slate-200 bg-slate-900 border-e border-slate-800">
        <div className="px-5 py-4 border-b border-slate-800">
          <NexoraLogo size="md" theme="dark" showSubtitle={true} subtitle={t.secCorePlanning} lang={lang} />
        </div>

        <div className="px-3 py-5 flex-1 space-y-6 overflow-y-auto">
          {/* Unified PMO Module Main Menu */}
          {(isScreenVisible('pmo-management') ||
            isScreenVisible('pmo-dashboard') ||
            isScreenVisible('progress-tracking') ||
            isScreenVisible('overdue-activities') ||
            isScreenVisible('activity-search')) && (
            <div>
              <button
                type="button"
                onClick={() => setPmoModuleMenuOpen((prev) => !prev)}
                aria-expanded={pmoModuleMenuOpen}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  isPmoSubSection(activeSection)
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <FolderKanban className="w-4 h-4 shrink-0 text-blue-400" />
                  <span>{lang === 'ar' ? 'وحدة مكتب إدارة المشاريع' : 'PMO Module'}</span>
                </span>
                {pmoModuleMenuOpen ? (
                  <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" />
                ) : (
                  <ChevronRight className={`w-4 h-4 shrink-0 text-slate-400 ${lang === 'ar' ? 'rotate-180' : ''}`} />
                )}
              </button>

              {pmoModuleMenuOpen && (
                <nav className="mt-1.5 space-y-1 ps-3 ms-3 border-s border-slate-800">
                  {isScreenVisible('pmo-management') && (
                    <button
                      onClick={() => {
                        setActiveSection('pmo-management');
                        setSearchQuery('');
                        setStatusFilter('All');
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        activeSection === 'pmo-management'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <FolderKanban className="w-4 h-4 shrink-0 text-blue-400" />
                      <span>{getScreenNavLabel('pmo-management', lang === 'ar' ? 'إدارة مكتب المشاريع' : 'PMO Management')}</span>
                    </button>
                  )}

                  {isScreenVisible('pmo-dashboard') && (
                    <button
                      onClick={() => {
                        setActiveSection('pmo-dashboard');
                        setSearchQuery('');
                        setStatusFilter('All');
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        activeSection === 'pmo-dashboard'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <LayoutDashboard className="w-4 h-4 shrink-0 text-indigo-400" />
                      <span>{t.pmoDashboard}</span>
                    </button>
                  )}

                  {isScreenVisible('progress-tracking') && (
                    <button
                      onClick={() => {
                        setActiveSection('progress-tracking');
                        setSearchQuery('');
                        setStatusFilter('All');
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        activeSection === 'progress-tracking'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <TrendingUp className="w-4 h-4 shrink-0 text-emerald-400" />
                      <span>{t.progressTracking}</span>
                    </button>
                  )}

                  {isScreenVisible('overdue-activities') && (
                    <button
                      onClick={() => {
                        setActiveSection('overdue-activities');
                        setSearchQuery('');
                        setStatusFilter('All');
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        activeSection === 'overdue-activities'
                          ? 'bg-rose-600 text-white shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>{t.overdueActivities}</span>
                    </button>
                  )}

                  {isScreenVisible('activity-search') && (
                    <button
                      onClick={() => {
                        setActiveSection('activity-search');
                        setSearchQuery('');
                        setStatusFilter('All');
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        activeSection === 'activity-search'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Search className="w-4 h-4 shrink-0 text-sky-400" />
                      <span>{t.activitySearch}</span>
                    </button>
                  )}
                </nav>
              )}
            </div>
          )}

          {/* Unified Planning & Execution Main Menu */}
          {(isScreenVisible('strategic-planning') ||
            isScreenVisible('dashboard') ||
            isScreenVisible('project-workspace')) && (
            <div>
              <button
                type="button"
                onClick={() => setPlanningMenuOpen((prev) => !prev)}
                aria-expanded={planningMenuOpen}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  isPlanningSubSection(activeSection)
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Compass className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>{t.secCorePlanning}</span>
                </span>
                {planningMenuOpen ? (
                  <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" />
                ) : (
                  <ChevronRight className={`w-4 h-4 shrink-0 text-slate-400 ${lang === 'ar' ? 'rotate-180' : ''}`} />
                )}
              </button>

              {planningMenuOpen && (
                <nav className="mt-1.5 space-y-1 ps-3 ms-3 border-s border-slate-800">
                  {isScreenVisible('strategic-planning') && (
                    <button
                      onClick={() => {
                        navigateToSection('strategic-planning');
                        setSearchQuery('');
                        setStatusFilter('All');
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        activeSection === 'strategic-planning'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Compass className="w-4 h-4 shrink-0 text-amber-400" />
                      <span>{getScreenNavLabel('strategic-planning', lang === 'ar' ? 'التخطيط الاستراتيجي' : 'Strategic Planning')}</span>
                    </button>
                  )}

                  {isScreenVisible('dashboard') && (
                    <button
                      onClick={() => {
                        navigateToSection('dashboard');
                        setSearchQuery('');
                        setStatusFilter('All');
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        activeSection === 'dashboard'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <LayoutDashboard className="w-4 h-4 shrink-0 text-indigo-400" />
                      <span>{getScreenNavLabel('dashboard', t.navDashboard)}</span>
                    </button>
                  )}

                  {isScreenVisible('project-workspace') && (
                    <button
                      onClick={() => {
                        navigateToSection('project-workspace');
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        activeSection === 'project-workspace'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Layers className="w-4 h-4 shrink-0 text-sky-400" />
                      <span>{t.projectWorkspace}</span>
                    </button>
                  )}
                </nav>
              )}
            </div>
          )}

          {/* Unified Hierarchy Explorer Main Menu */}
          {(isScreenVisible('hierarchy') ||
            isScreenVisible('departments') ||
            isScreenVisible('portfolios') ||
            isScreenVisible('initiatives') ||
            isScreenVisible('projects') ||
            isScreenVisible('activities') ||
            isScreenVisible('scheduling')) && (
            <div>
              <button
                type="button"
                onClick={() => setHierarchyMenuOpen((prev) => !prev)}
                aria-expanded={hierarchyMenuOpen}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  isHierarchySubSection(activeSection)
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Network className="w-4 h-4 shrink-0 text-cyan-400" />
                  <span>{t.hierarchyExplorer}</span>
                </span>
                {hierarchyMenuOpen ? (
                  <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" />
                ) : (
                  <ChevronRight className={`w-4 h-4 shrink-0 text-slate-400 ${lang === 'ar' ? 'rotate-180' : ''}`} />
                )}
              </button>

              {hierarchyMenuOpen && (
                <nav className="mt-1.5 space-y-1 ps-3 ms-3 border-s border-slate-800">
                  {isScreenVisible('hierarchy') && (
                    <button
                      onClick={() => {
                        navigateToSection('hierarchy');
                        setSearchQuery('');
                        setStatusFilter('All');
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        activeSection === 'hierarchy'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Network className="w-4 h-4 shrink-0 text-cyan-400" />
                      <span>{t.navHierarchy}</span>
                    </button>
                  )}

                  {isScreenVisible('departments') && (
                    <button
                      onClick={() => {
                        navigateToSection('departments');
                        setSearchQuery('');
                        setStatusFilter('All');
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        activeSection === 'departments'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <Building2 className="w-4 h-4 shrink-0" />
                        <span>01. {t.departments}</span>
                      </span>
                      <span
                        className={`text-xs font-mono tabular-nums ${
                          activeSection === 'departments' ? 'text-blue-100' : 'text-slate-400'
                        }`}
                      >
                        {departments.length}
                      </span>
                    </button>
                  )}

                  {isScreenVisible('portfolios') && (
                    <button
                      onClick={() => {
                        navigateToSection('portfolios');
                        setSearchQuery('');
                        setStatusFilter('All');
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        activeSection === 'portfolios'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <Briefcase className="w-4 h-4 shrink-0" />
                        <span>02. {t.portfolios}</span>
                      </span>
                      <span
                        className={`text-xs font-mono tabular-nums ${
                          activeSection === 'portfolios' ? 'text-blue-100' : 'text-slate-400'
                        }`}
                      >
                        {portfolios.length}
                      </span>
                    </button>
                  )}

                  {isScreenVisible('initiatives') && (
                    <button
                      onClick={() => {
                        navigateToSection('initiatives');
                        setSearchQuery('');
                        setStatusFilter('All');
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        activeSection === 'initiatives'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <Compass className="w-4 h-4 shrink-0" />
                        <span>03. {t.initiatives}</span>
                      </span>
                      <span
                        className={`text-xs font-mono tabular-nums ${
                          activeSection === 'initiatives' ? 'text-blue-100' : 'text-slate-400'
                        }`}
                      >
                        {initiatives.length}
                      </span>
                    </button>
                  )}

                  {isScreenVisible('projects') && (
                    <button
                      onClick={() => {
                        navigateToSection('projects');
                        setSearchQuery('');
                        setStatusFilter('All');
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        activeSection === 'projects'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <FolderKanban className="w-4 h-4 shrink-0" />
                        <span>04. {t.projects}</span>
                      </span>
                      <span
                        className={`text-xs font-mono tabular-nums ${
                          activeSection === 'projects' ? 'text-blue-100' : 'text-slate-400'
                        }`}
                      >
                        {projects.length}
                      </span>
                    </button>
                  )}

                  {isScreenVisible('activities') && (
                    <button
                      onClick={() => {
                        navigateToSection('activities');
                        setSearchQuery('');
                        setStatusFilter('All');
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        activeSection === 'activities'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <CheckSquare className="w-4 h-4 shrink-0" />
                        <span>05. {lang === 'ar' ? 'إدارة الأنشطة' : 'Activities'}</span>
                      </span>
                      <span
                        className={`text-xs font-mono tabular-nums ${
                          activeSection === 'activities' ? 'text-blue-100' : 'text-slate-400'
                        }`}
                      >
                        {activities.length}
                      </span>
                    </button>
                  )}

                  {isScreenVisible('scheduling') && (
                    <button
                      onClick={() => {
                        navigateToSection('scheduling');
                        setSearchQuery('');
                        setStatusFilter('All');
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        activeSection === 'scheduling'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <Calendar className="w-4 h-4 shrink-0" />
                        <span>06. {lang === 'ar' ? 'جدولة المشاريع' : 'Scheduling'}</span>
                      </span>
                    </button>
                  )}
                </nav>
              )}
            </div>
          )}

          {(isScreenVisible('workstreams') || isScreenVisible('milestones')) && (
            <div>
              <div className="px-3 mb-2 text-xs font-semibold text-slate-400">
                {t.secPmoRegistry}
              </div>
              <nav className="space-y-1">
                {isScreenVisible('workstreams') && (
                  <button
                    onClick={() => {
                      setActiveSection('workstreams');
                      setSearchQuery('');
                      setStatusFilter('All');
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      activeSection === 'workstreams'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <GitBranch className="w-4 h-4 shrink-0" />
                      <span>{t.workstreams}</span>
                    </span>
                    <span
                      className={`text-xs font-mono tabular-nums ${
                        activeSection === 'workstreams' ? 'text-blue-100' : 'text-slate-400'
                      }`}
                    >
                      {workstreams.length}
                    </span>
                  </button>
                )}

                {isScreenVisible('milestones') && (
                  <button
                    onClick={() => {
                      setActiveSection('milestones');
                      setSearchQuery('');
                      setStatusFilter('All');
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      activeSection === 'milestones'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Diamond className="w-4 h-4 shrink-0 text-amber-400" />
                      <span>{t.milestones}</span>
                    </span>
                    <span
                      className={`text-xs font-mono tabular-nums ${
                        activeSection === 'milestones' ? 'text-blue-100' : 'text-slate-400'
                      }`}
                    >
                      {milestones.length}
                    </span>
                  </button>
                )}
              </nav>
            </div>
          )}

          {/* Unified Admin Controls Main Menu (Admin account only, placed last) */}
          {isAdminAccount(currentUser) &&
            (isScreenVisible('admin-settings') ||
              isScreenVisible('role-permissions') ||
              isScreenVisible('database-connection') ||
              isScreenVisible('users')) && (
              <div className="pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAdminControlsMenuOpen((prev) => !prev)}
                  aria-expanded={adminControlsMenuOpen}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    isAdminControlsSubSection(activeSection)
                      ? 'bg-slate-800 text-white'
                      : 'text-amber-300 hover:bg-slate-800 hover:text-amber-200'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Sliders className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>{lang === 'ar' ? 'أدوات تحكم المدير' : 'Admin Controls'}</span>
                  </span>
                  {adminControlsMenuOpen ? (
                    <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" />
                  ) : (
                    <ChevronRight className={`w-4 h-4 shrink-0 text-slate-400 ${lang === 'ar' ? 'rotate-180' : ''}`} />
                  )}
                </button>

                {adminControlsMenuOpen && (
                  <nav className="mt-1.5 space-y-1 ps-3 ms-3 border-s border-slate-800">
                    {isScreenVisible('admin-settings') && (
                      <button
                        onClick={() => {
                          navigateToSection('admin-settings');
                          setSearchQuery('');
                          setStatusFilter('All');
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer text-start leading-snug ${
                          activeSection === 'admin-settings'
                            ? 'bg-gradient-to-r from-amber-500 to-indigo-600 text-white shadow-sm'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <Sliders className="w-4 h-4 shrink-0 text-amber-400" />
                        <span>
                          {lang === 'ar'
                            ? 'استوديو تخصيص الشاشات والحقول'
                            : 'Screen & Field Customization Studio'}
                        </span>
                      </button>
                    )}

                    {isScreenVisible('role-permissions') && (
                      <button
                        onClick={() => {
                          navigateToSection('role-permissions');
                          setSearchQuery('');
                          setStatusFilter('All');
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                          activeSection === 'role-permissions'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                        <span>
                          {lang === 'ar' ? 'صلاحيات الشاشات للأدوار' : 'Role Screen Access'}
                        </span>
                      </button>
                    )}

                    {isScreenVisible('database-connection') && (
                      <button
                        onClick={() => {
                          navigateToSection('database-connection');
                          setSearchQuery('');
                          setStatusFilter('All');
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                          activeSection === 'database-connection'
                            ? 'bg-sky-600 text-white shadow-sm'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <Database className="w-4 h-4 shrink-0 text-sky-400" />
                        <span>{lang === 'ar' ? 'قاعدة بيانات MySQL' : 'MySQL Database'}</span>
                      </button>
                    )}

                    {isScreenVisible('users') && (
                      <button
                        onClick={() => {
                          navigateToSection('users');
                          setSearchQuery('');
                          setStatusFilter('All');
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                          activeSection === 'users'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <Users className="w-4 h-4 shrink-0 text-indigo-400" />
                          <span>{lang === 'ar' ? 'المستخدمون والأدوار' : 'User & Roles'}</span>
                        </span>
                        <span
                          className={`text-xs font-mono tabular-nums ${
                            activeSection === 'users' ? 'text-blue-100' : 'text-slate-400'
                          }`}
                        >
                          {users.length || savedAccounts.length}
                        </span>
                      </button>
                    )}
                  </nav>
                )}
              </div>
            )}
        </div>

        {/* Compact Sidebar Footer: Personal Profile Tab & Utility Actions */}
        <div className="p-2.5 border-t border-slate-800 bg-slate-900 space-y-1.5">
          <button
            type="button"
            onClick={handleOpenProfile}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeSection === 'profile'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
            title={t.personalProfile}
          >
            <User
              className={`w-4 h-4 shrink-0 ${
                activeSection === 'profile' ? 'text-white' : 'text-blue-400'
              }`}
            />
            <span>{t.personalProfile}</span>
          </button>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
              className="flex items-center justify-center gap-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              title={lang === 'en' ? 'Switch to Arabic' : 'التبديل إلى الإنجليزية'}
            >
              <Languages className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>{lang === 'en' ? 'عربي' : 'EN'}</span>
            </button>
            <button
              type="button"
              onClick={handleResetSeed}
              title={t.clearFilters}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              <span>{t.clearFilters}</span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              title={t.logout}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-slate-800 hover:bg-rose-600 border border-slate-700 hover:border-rose-500 text-slate-200 hover:text-white text-[11px] font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>{t.logout}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Strict 3-Zone Top Bar Contract */}
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between gap-8 shrink-0">
          {/* Zone 1: Single text element wordmark with logo */}
          <a
            href={`#${getFirstVisibleSection(currentUser)}`}
            onClick={(e) => {
              e.preventDefault();
              setActiveSection(getFirstVisibleSection(currentUser));
            }}
            className="flex items-center gap-2 whitespace-nowrap shrink-0 group focus:outline-none"
          >
            <NexoraLogo size="sm" theme="light" lang={lang} />
          </a>

          {/* Zone 2: Navigation links respecting visibility */}
          <nav className="hidden xl:flex items-center gap-5 text-sm font-medium text-slate-600 min-w-0 flex-1 overflow-x-auto">
            {(isScreenVisible('pmo-management') ||
              isScreenVisible('pmo-dashboard') ||
              isScreenVisible('progress-tracking') ||
              isScreenVisible('overdue-activities') ||
              isScreenVisible('activity-search')) && (
              <div className="relative" ref={pmoTopDropdownRef}>
                <button
                  type="button"
                  onClick={() => setPmoTopDropdownOpen((prev) => !prev)}
                  aria-expanded={pmoTopDropdownOpen}
                  className={`hover:text-slate-900 transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                    isPmoSubSection(activeSection)
                      ? activeSection === 'overdue-activities'
                        ? 'text-rose-600 font-semibold underline underline-offset-8'
                        : 'text-blue-600 font-semibold underline underline-offset-8'
                      : ''
                  }`}
                >
                  <FolderKanban className="w-4 h-4 text-blue-500" />
                  <span>{lang === 'ar' ? 'وحدة مكتب إدارة المشاريع' : 'PMO Module'}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${pmoTopDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {pmoTopDropdownOpen && (
                  <div className="absolute top-full start-0 mt-2 w-60 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50">
                    {isScreenVisible('pmo-management') && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSection('pmo-management');
                          setPmoTopDropdownOpen(false);
                        }}
                        className={`w-full px-3.5 py-2 text-start text-sm flex items-center gap-2.5 transition-colors cursor-pointer ${
                          activeSection === 'pmo-management'
                            ? 'bg-blue-50 text-blue-700 font-semibold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <FolderKanban className="w-4 h-4 text-blue-500 shrink-0" />
                        <span>{lang === 'ar' ? 'إدارة مكتب المشاريع' : 'PMO Management'}</span>
                      </button>
                    )}
                    {isScreenVisible('pmo-dashboard') && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSection('pmo-dashboard');
                          setPmoTopDropdownOpen(false);
                        }}
                        className={`w-full px-3.5 py-2 text-start text-sm flex items-center gap-2.5 transition-colors cursor-pointer ${
                          activeSection === 'pmo-dashboard'
                            ? 'bg-blue-50 text-blue-700 font-semibold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <LayoutDashboard className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span>{t.pmoDashboard}</span>
                      </button>
                    )}
                    {isScreenVisible('progress-tracking') && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSection('progress-tracking');
                          setPmoTopDropdownOpen(false);
                        }}
                        className={`w-full px-3.5 py-2 text-start text-sm flex items-center gap-2.5 transition-colors cursor-pointer ${
                          activeSection === 'progress-tracking'
                            ? 'bg-blue-50 text-blue-700 font-semibold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>{t.progressTracking}</span>
                      </button>
                    )}
                    {isScreenVisible('overdue-activities') && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSection('overdue-activities');
                          setPmoTopDropdownOpen(false);
                        }}
                        className={`w-full px-3.5 py-2 text-start text-sm flex items-center gap-2.5 transition-colors cursor-pointer ${
                          activeSection === 'overdue-activities'
                            ? 'bg-rose-50 text-rose-700 font-semibold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                        <span>{t.overdueActivities}</span>
                      </button>
                    )}
                    {isScreenVisible('activity-search') && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSection('activity-search');
                          setPmoTopDropdownOpen(false);
                        }}
                        className={`w-full px-3.5 py-2 text-start text-sm flex items-center gap-2.5 transition-colors cursor-pointer ${
                          activeSection === 'activity-search'
                            ? 'bg-blue-50 text-blue-700 font-semibold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Search className="w-4 h-4 text-sky-500 shrink-0" />
                        <span>{t.activitySearch}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            {(isScreenVisible('strategic-planning') ||
              isScreenVisible('dashboard') ||
              isScreenVisible('project-workspace')) && (
              <div className="relative" ref={planningTopDropdownRef}>
                <button
                  type="button"
                  onClick={() => setPlanningTopDropdownOpen((prev) => !prev)}
                  aria-expanded={planningTopDropdownOpen}
                  className={`hover:text-slate-900 transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                    isPlanningSubSection(activeSection)
                      ? 'text-blue-600 font-semibold underline underline-offset-8'
                      : ''
                  }`}
                >
                  <Compass className="w-4 h-4 text-amber-500" />
                  <span>{t.secCorePlanning}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${
                      planningTopDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {planningTopDropdownOpen && (
                  <div className="absolute top-full start-0 mt-2 w-60 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50">
                    {isScreenVisible('strategic-planning') && (
                      <button
                        type="button"
                        onClick={() => {
                          navigateToSection('strategic-planning');
                          setPlanningTopDropdownOpen(false);
                        }}
                        className={`w-full px-3.5 py-2 text-start text-sm flex items-center gap-2.5 transition-colors cursor-pointer ${
                          activeSection === 'strategic-planning'
                            ? 'bg-blue-50 text-blue-700 font-semibold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Compass className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>{getScreenNavLabel('strategic-planning', lang === 'ar' ? 'التخطيط الاستراتيجي' : 'Strategic Planning')}</span>
                      </button>
                    )}
                    {isScreenVisible('dashboard') && (
                      <button
                        type="button"
                        onClick={() => {
                          navigateToSection('dashboard');
                          setPlanningTopDropdownOpen(false);
                        }}
                        className={`w-full px-3.5 py-2 text-start text-sm flex items-center gap-2.5 transition-colors cursor-pointer ${
                          activeSection === 'dashboard'
                            ? 'bg-blue-50 text-blue-700 font-semibold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <LayoutDashboard className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span>{getScreenNavLabel('dashboard', t.navDashboard)}</span>
                      </button>
                    )}
                    {isScreenVisible('project-workspace') && (
                      <button
                        type="button"
                        onClick={() => {
                          navigateToSection('project-workspace');
                          setPlanningTopDropdownOpen(false);
                        }}
                        className={`w-full px-3.5 py-2 text-start text-sm flex items-center gap-2.5 transition-colors cursor-pointer ${
                          activeSection === 'project-workspace'
                            ? 'bg-blue-50 text-blue-700 font-semibold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Layers className="w-4 h-4 text-sky-500 shrink-0" />
                        <span>{t.projectWorkspace}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            {(isScreenVisible('hierarchy') ||
              isScreenVisible('departments') ||
              isScreenVisible('portfolios') ||
              isScreenVisible('initiatives') ||
              isScreenVisible('projects') ||
              isScreenVisible('activities') ||
              isScreenVisible('scheduling')) && (
              <div className="relative" ref={hierarchyTopDropdownRef}>
                <button
                  type="button"
                  onClick={() => setHierarchyTopDropdownOpen((prev) => !prev)}
                  aria-expanded={hierarchyTopDropdownOpen}
                  className={`hover:text-slate-900 transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                    isHierarchySubSection(activeSection)
                      ? 'text-blue-600 font-semibold underline underline-offset-8'
                      : ''
                  }`}
                >
                  <Network className="w-4 h-4 text-cyan-600" />
                  <span>{t.hierarchyExplorer}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${
                      hierarchyTopDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {hierarchyTopDropdownOpen && (
                  <div className="absolute top-full start-0 mt-2 w-60 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50">
                    {isScreenVisible('hierarchy') && (
                      <button
                        type="button"
                        onClick={() => {
                          navigateToSection('hierarchy');
                          setHierarchyTopDropdownOpen(false);
                        }}
                        className={`w-full px-3.5 py-2 text-start text-sm flex items-center gap-2.5 transition-colors cursor-pointer ${
                          activeSection === 'hierarchy'
                            ? 'bg-blue-50 text-blue-700 font-semibold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Network className="w-4 h-4 text-cyan-600 shrink-0" />
                        <span>{t.navHierarchy}</span>
                      </button>
                    )}
                    {isScreenVisible('departments') && (
                      <button
                        type="button"
                        onClick={() => {
                          navigateToSection('departments');
                          setHierarchyTopDropdownOpen(false);
                        }}
                        className={`w-full px-3.5 py-2 text-start text-sm flex items-center gap-2.5 transition-colors cursor-pointer ${
                          activeSection === 'departments'
                            ? 'bg-blue-50 text-blue-700 font-semibold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Building2 className="w-4 h-4 text-blue-500 shrink-0" />
                        <span>{t.departments}</span>
                      </button>
                    )}
                    {isScreenVisible('portfolios') && (
                      <button
                        type="button"
                        onClick={() => {
                          navigateToSection('portfolios');
                          setHierarchyTopDropdownOpen(false);
                        }}
                        className={`w-full px-3.5 py-2 text-start text-sm flex items-center gap-2.5 transition-colors cursor-pointer ${
                          activeSection === 'portfolios'
                            ? 'bg-blue-50 text-blue-700 font-semibold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Briefcase className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span>{t.portfolios}</span>
                      </button>
                    )}
                    {isScreenVisible('initiatives') && (
                      <button
                        type="button"
                        onClick={() => {
                          navigateToSection('initiatives');
                          setHierarchyTopDropdownOpen(false);
                        }}
                        className={`w-full px-3.5 py-2 text-start text-sm flex items-center gap-2.5 transition-colors cursor-pointer ${
                          activeSection === 'initiatives'
                            ? 'bg-blue-50 text-blue-700 font-semibold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Compass className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>{t.initiatives}</span>
                      </button>
                    )}
                    {isScreenVisible('projects') && (
                      <button
                        type="button"
                        onClick={() => {
                          navigateToSection('projects');
                          setHierarchyTopDropdownOpen(false);
                        }}
                        className={`w-full px-3.5 py-2 text-start text-sm flex items-center gap-2.5 transition-colors cursor-pointer ${
                          activeSection === 'projects'
                            ? 'bg-blue-50 text-blue-700 font-semibold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <FolderKanban className="w-4 h-4 text-cyan-600 shrink-0" />
                        <span>{t.projects}</span>
                      </button>
                    )}
                    {isScreenVisible('activities') && (
                      <button
                        type="button"
                        onClick={() => {
                          navigateToSection('activities');
                          setHierarchyTopDropdownOpen(false);
                        }}
                        className={`w-full px-3.5 py-2 text-start text-sm flex items-center gap-2.5 transition-colors cursor-pointer ${
                          activeSection === 'activities'
                            ? 'bg-blue-50 text-blue-700 font-semibold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <CheckSquare className="w-4 h-4 text-green-600 shrink-0" />
                        <span>{lang === 'ar' ? 'الأنشطة' : 'Activities'}</span>
                      </button>
                    )}
                    {isScreenVisible('scheduling') && (
                      <button
                        type="button"
                        onClick={() => {
                          navigateToSection('scheduling');
                          setHierarchyTopDropdownOpen(false);
                        }}
                        className={`w-full px-3.5 py-2 text-start text-sm flex items-center gap-2.5 transition-colors cursor-pointer ${
                          activeSection === 'scheduling'
                            ? 'bg-blue-50 text-blue-700 font-semibold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
                        <span>{lang === 'ar' ? 'جدولة المشاريع' : 'Scheduling'}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            {isScreenVisible('workstreams') && (
              <button
                onClick={() => setActiveSection('workstreams')}
                className={`hover:text-slate-900 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeSection === 'workstreams'
                    ? 'text-blue-600 font-semibold underline underline-offset-8'
                    : ''
                }`}
              >
                {t.workstreams}
              </button>
            )}
            {isScreenVisible('milestones') && (
              <button
                onClick={() => setActiveSection('milestones')}
                className={`hover:text-slate-900 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeSection === 'milestones'
                    ? 'text-blue-600 font-semibold underline underline-offset-8'
                    : ''
                }`}
              >
                {t.milestones}
              </button>
            )}
            {isAdminAccount(currentUser) &&
              (isScreenVisible('admin-settings') ||
                isScreenVisible('role-permissions') ||
                isScreenVisible('database-connection') ||
                isScreenVisible('users')) && (
                <div className="relative" ref={adminControlsTopDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setAdminControlsTopDropdownOpen((prev) => !prev)}
                    aria-expanded={adminControlsTopDropdownOpen}
                    className={`hover:text-slate-900 transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                      isAdminControlsSubSection(activeSection)
                        ? 'text-amber-600 font-semibold underline underline-offset-8'
                        : 'text-amber-700 font-semibold'
                    }`}
                  >
                    <Sliders className="w-4 h-4 text-amber-500" />
                    <span>{lang === 'ar' ? 'أدوات تحكم المدير' : 'Admin Controls'}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform ${
                        adminControlsTopDropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {adminControlsTopDropdownOpen && (
                    <div className="absolute top-full start-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50">
                      {isScreenVisible('admin-settings') && (
                        <button
                          type="button"
                          onClick={() => {
                            navigateToSection('admin-settings');
                            setAdminControlsTopDropdownOpen(false);
                          }}
                          className={`w-full px-3.5 py-2 text-start text-sm flex items-center gap-2.5 transition-colors cursor-pointer ${
                            activeSection === 'admin-settings'
                              ? 'bg-amber-50 text-amber-800 font-semibold'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <Sliders className="w-4 h-4 text-amber-500 shrink-0" />
                          <span>
                            {lang === 'ar'
                              ? 'استوديو تخصيص الشاشات والحقول'
                              : 'Screen & Field Customization Studio'}
                          </span>
                        </button>
                      )}
                      {isScreenVisible('role-permissions') && (
                        <button
                          type="button"
                          onClick={() => {
                            navigateToSection('role-permissions');
                            setAdminControlsTopDropdownOpen(false);
                          }}
                          className={`w-full px-3.5 py-2 text-start text-sm flex items-center gap-2.5 transition-colors cursor-pointer ${
                            activeSection === 'role-permissions'
                              ? 'bg-emerald-50 text-emerald-700 font-semibold'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            {lang === 'ar' ? 'صلاحيات الشاشات للأدوار' : 'Role Screen Access'}
                          </span>
                        </button>
                      )}
                      {isScreenVisible('database-connection') && (
                        <button
                          type="button"
                          onClick={() => {
                            navigateToSection('database-connection');
                            setAdminControlsTopDropdownOpen(false);
                          }}
                          className={`w-full px-3.5 py-2 text-start text-sm flex items-center gap-2.5 transition-colors cursor-pointer ${
                            activeSection === 'database-connection'
                              ? 'bg-sky-50 text-sky-700 font-semibold'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <Database className="w-4 h-4 text-sky-600 shrink-0" />
                          <span>{lang === 'ar' ? 'قاعدة بيانات MySQL' : 'MySQL Database'}</span>
                        </button>
                      )}
                      {isScreenVisible('users') && (
                        <button
                          type="button"
                          onClick={() => {
                            navigateToSection('users');
                            setAdminControlsTopDropdownOpen(false);
                          }}
                          className={`w-full px-3.5 py-2 text-start text-sm flex items-center gap-2.5 transition-colors cursor-pointer ${
                            activeSection === 'users'
                              ? 'bg-blue-50 text-blue-700 font-semibold'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <Users className="w-4 h-4 text-indigo-500 shrink-0" />
                          <span>{lang === 'ar' ? 'المستخدمون والأدوار' : 'User & Roles'}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
          </nav>

          {/* Zone 3: actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            {isAdminAccount(currentUser) && (
              <button
                type="button"
                onClick={() => setRoleModalOpen(true)}
                className="px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
                title={lang === 'ar' ? 'إدارة وتعيين أدوار المستخدمين' : 'Manage & Assign User Roles'}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>{lang === 'ar' ? 'إدارة الأدوار' : 'Assign Roles'}</span>
              </button>
            )}

            {/* User Icon Dropdown (Profile & Language Switcher under User Icon) */}
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer shadow-xs ${
                  activeSection === 'profile' || userMenuOpen
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'text-slate-700 bg-slate-50 hover:bg-slate-100 border-slate-200'
                }`}
                title={`${pickLocalized(lang, currentUser.fullName, currentUser.fullNameAr)} — ${t.personalProfile}`}
              >
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <User className="w-3.5 h-3.5" />
                </span>
                <span className="max-w-[130px] truncate hidden sm:inline">
                  {pickLocalized(lang, currentUser.fullName, currentUser.fullNameAr)}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-500 transition-transform ${
                    userMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {userMenuOpen && (
                <div
                  role="menu"
                  className="absolute top-full end-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50"
                >
                  <div className="px-3.5 py-2.5 border-b border-slate-100">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {pickLocalized(lang, currentUser.fullName, currentUser.fullNameAr)}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      @{currentUser.username} · {translateRole(currentUser.role, lang)}
                    </div>
                  </div>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setUserMenuOpen(false);
                      handleOpenProfile();
                    }}
                    className={`w-full px-3.5 py-2 text-start text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer ${
                      activeSection === 'profile'
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <User className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>{lang === 'ar' ? 'الملف الشخصي' : 'My Profile'}</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setLang(lang === 'en' ? 'ar' : 'en');
                      setUserMenuOpen(false);
                    }}
                    className="w-full px-3.5 py-2 text-start text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-between gap-2.5 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      <Languages className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>{lang === 'en' ? 'Switch Language' : 'تبديل اللغة'}</span>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/80 text-[11px] font-bold">
                      {lang === 'en' ? 'العربية' : 'English'}
                    </span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setUserMenuOpen(false);
                      handleLogout();
                    }}
                    className="w-full px-3.5 py-2 text-start text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <Users className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>{lang === 'ar' ? 'تبديل الحساب' : 'Switch Account'}</span>
                  </button>

                  <div className="my-1 border-t border-slate-100" />

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setUserMenuOpen(false);
                      handleLogout();
                    }}
                    className="w-full px-3.5 py-2 text-start text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    <span>{t.logout}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Feedback Banner */}
        {banner && (
          <div
            className={`mx-8 mt-4 px-4 py-3 rounded-lg text-xs font-semibold flex items-center justify-between border ${
              banner.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}
          >
            <span>{banner.text}</span>
            <button
              onClick={() => setBanner(null)}
              className="text-xs underline ms-4 cursor-pointer"
            >
              ×
            </button>
          </div>
        )}

        {/* Viewport Content */}
        <main className="flex-1 p-8 max-w-[1440px] w-full mx-auto">
          {loading && !dashboard && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="bg-white border border-slate-200 rounded-xl p-6 h-32 animate-pulse"
                />
              ))}
            </div>
          )}

          {/* ==================== ADMIN SETTINGS & ROLE SCREEN ACCESS VIEW ==================== */}
          {(activeSection === 'admin-settings' || activeSection === 'role-permissions') && (
            <AdminSettingsView
              lang={lang}
              currentUserRole={currentUser?.role}
              currentUserName={pickLocalized(lang, currentUser?.fullName, currentUser?.fullNameAr)}
              isAdminAccount={isAdminAccount(currentUser)}
              initialTab={activeSection === 'role-permissions' ? 'roles' : 'fields'}
              showBanner={showBanner}
              onNavigateToSection={(sec) => setActiveSection(sec as NavSection)}
              onSettingsUpdated={(newSettings) => setSystemSettings(newSettings)}
            />
          )}

          {/* ==================== ADMIN DIRECT MYSQL DATABASE CONNECTION VIEW ==================== */}
          {activeSection === 'database-connection' && (
            <DatabaseConnectionView
              lang={lang}
              isAdminAccount={isAdminAccount(currentUser)}
              showBanner={showBanner}
              onDataPulledFromMySql={() => {
                fetchAllData();
                apiFetch('/api/admin/settings')
                  .then((res) => (res.ok ? res.json() : null))
                  .then((data) => {
                    if (data && data.menuVisibility) {
                      setSystemSettings({
                        ...data,
                        screenRolePermissions: {
                          ...DEFAULT_SCREEN_ROLE_PERMISSIONS,
                          ...(data.screenRolePermissions || {})
                        }
                      });
                    }
                  })
                  .catch(() => undefined);
              }}
            />
          )}

          {/* ==================== STRATEGIC PLANNING ENTERPRISE MODULE ==================== */}
          {activeSection === 'strategic-planning' && (
            <StrategicPlanningView
              lang={lang}
              onNavigateToProjects={() => setActiveSection('pmo-management')}
              showBanner={showBanner}
              currentUserRole={currentUser?.role}
              currentUserName={pickLocalized(lang, currentUser?.fullName, currentUser?.fullNameAr)}
              screenSchemas={systemSettings.screenSchemas}
            />
          )}

          {/* ==================== PMO MANAGEMENT ENTERPRISE SUITE ==================== */}
          {activeSection === 'pmo-management' && (
            <PmoManagementView
              lang={lang}
              onNavigateToStrategicPlanning={() => setActiveSection('strategic-planning')}
              showBanner={showBanner}
            />
          )}

          {/* ==================== USER PROFILE & PASSWORD RESET PAGE ==================== */}
          {activeSection === 'profile' && currentUser && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Page Breadcrumb & Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/90 pb-5">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                    <button
                      type="button"
                      onClick={() => setActiveSection('departments')}
                      className="hover:text-blue-600 transition-colors cursor-pointer"
                    >
                      {lang === 'ar' ? 'الرئيسية' : 'Workspace'}
                    </button>
                    <span>/</span>
                    <span className="text-slate-800 font-semibold">{t.personalProfile}</span>
                  </div>
                  <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                    <User className="w-6 h-6 text-blue-600" />
                    <span>{t.personalProfile}</span>
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    {t.personalProfileDesc}
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  {isScreenVisible('admin-settings') && (
                    <button
                      type="button"
                      onClick={() => setActiveSection('admin-settings')}
                      className="px-3.5 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Sliders className="w-3.5 h-3.5 text-amber-600" />
                      <span>{lang === 'ar' ? 'تخصيص الشاشات والحقول' : 'Screen & Field Studio'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveSection('departments')}
                    className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <ArrowRight className="w-3.5 h-3.5 ltr:rotate-180" />
                    <span>{lang === 'ar' ? 'العودة لمساحة العمل' : 'Back to Workspace'}</span>
                  </button>
                </div>
              </div>

              {/* Grid: Left Column (Identity & Privileges) / Right Column (Details & Password Reset Form) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Card: 4 cols */}
                <div className="lg:col-span-4 space-y-5">
                  {/* Hero Account Card */}
                  <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 text-center relative overflow-hidden">
                    <div className="absolute top-0 inset-x-0 h-20 bg-gradient-to-r from-blue-600 to-indigo-600" />
                    <div className="relative pt-6">
                      <div className="w-20 h-20 mx-auto rounded-2xl bg-white p-1 shadow-md mb-3">
                        <div className="w-full h-full rounded-xl bg-blue-600 text-white font-bold text-xl flex items-center justify-center">
                          {getInitials(currentUser.fullName)}
                        </div>
                      </div>
                      <h2 className="text-base font-bold text-slate-900 truncate">
                        {pickLocalized(lang, currentUser.fullName, currentUser.fullNameAr)}
                      </h2>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                        @{currentUser.username}
                      </div>
                      <div className="mt-3 flex items-center justify-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80">
                          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                          <span>{translateRole(currentUser.role, lang)}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>{lang === 'ar' ? 'نشط' : 'Active'}</span>
                        </span>
                      </div>
                    </div>

                    <div className="mt-6 pt-5 border-t border-slate-100 text-start space-y-2.5 text-xs">
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400">{t.emailLabel}:</span>
                        <span className="font-medium text-slate-800 truncate max-w-[180px]">{currentUser.email}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400">{lang === 'ar' ? 'معرّف المستخدم:' : 'User ID:'}</span>
                        <span className="font-mono text-slate-800">#{currentUser.userId}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400">{lang === 'ar' ? 'مستوى الوصول' : 'Access Level'}:</span>
                        <span className="font-medium text-slate-800">
                          {currentUser.role === 'PMO Manager'
                            ? (lang === 'ar' ? 'إدارة عليا' : 'Executive Governance')
                            : currentUser.role === 'Project Manager'
                            ? (lang === 'ar' ? 'تخطيط ومشاريع' : 'Project Management')
                            : (lang === 'ar' ? 'تنفيذ مهام' : 'Task Execution')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Role Privileges Overview Card */}
                  <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                      <Shield className="w-4 h-4 text-blue-600" />
                      <span>{lang === 'ar' ? 'صلاحيات الدور الوظيفي' : 'Role Privileges & Scope'}</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {currentUser.role === 'PMO Manager'
                        ? (lang === 'ar'
                            ? 'بصفتك مدير مكتب المشاريع، لديك كامل الصلاحيات لإدارة الإدارات، المحافظ الاستراتيجية، المبادرات، المشاريع، ومسارات العمل، بالإضافة لتعيين أدوار مستخدمي النظام.'
                            : 'As a PMO Manager, you have full governance authority across departments, portfolios, initiatives, projects, and workstreams, plus user role management.')
                        : currentUser.role === 'Project Manager'
                        ? (lang === 'ar'
                            ? 'بصفتك مدير مشروع، يمكنك تخطيط وتعديل المبادرات والمشاريع ومسارات العمل والمعالم وجداول المهام التنفيذية.'
                            : 'As a Project Manager, you can plan, schedule, and configure project workstreams, milestones, and assigned activity workflows.')
                        : (lang === 'ar'
                            ? 'بصفتك عضواً في فريق العمل، يمكنك استعراض المشاريع وتحديث حالات المهام ونسب إنجاز الأنشطة المسندة إليك.'
                            : 'As a Team Member, you can view project milestones and update execution progress and completion status for activities.')}
                    </p>
                  </div>
                </div>

                {/* Right Column: 8 cols (Interactive Tabs for Profile Details & Password Reset) */}
                <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 flex flex-col">
                  {/* Tab Selector */}
                  <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-xl mb-6">
                    <button
                      type="button"
                      onClick={() => setProfileTab('details')}
                      className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        profileTab === 'details'
                          ? 'bg-white text-blue-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <User className="w-4 h-4" />
                      <span>{t.profileTab}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setProfileTab('security')}
                      className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        profileTab === 'security'
                          ? 'bg-white text-blue-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <KeyRound className="w-4 h-4" />
                      <span>{t.securityTab}</span>
                    </button>
                  </div>

                  {/* TAB 1: PROFILE DETAILS FORM */}
                  {profileTab === 'details' && (
                    <form onSubmit={handleSaveProfile} className="space-y-5 flex-1 flex flex-col justify-between">
                      <div className="space-y-4">
                        {profileSuccess && (
                          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5 animate-in fade-in">
                            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                            <span>{profileSuccess}</span>
                          </div>
                        )}
                        {profileError && (
                          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5 animate-in fade-in">
                            <AlertTriangle className="w-4.5 h-4.5 text-rose-600 shrink-0" />
                            <span>{profileError}</span>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                              {t.fullNameLabel} <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                              <User className="w-4 h-4 absolute start-3 top-3 text-slate-400" />
                              <input
                                type="text"
                                value={profileFullName}
                                onChange={(e) => setProfileFullName(e.target.value)}
                                required
                                className="w-full ps-9 pe-3 py-2.5 text-xs bg-[#F8FAFC] border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                              {t.emailLabel} <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                              <Mail className="w-4 h-4 absolute start-3 top-3 text-slate-400" />
                              <input
                                type="email"
                                value={profileEmail}
                                onChange={(e) => setProfileEmail(e.target.value)}
                                required
                                className="w-full ps-9 pe-3 py-2.5 text-xs bg-[#F8FAFC] border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                            {t.usernameLabel}
                          </label>
                          <div className="relative">
                            <span className="absolute start-3 top-3 text-xs text-slate-400 font-mono">@</span>
                            <input
                              type="text"
                              value={currentUser.username}
                              disabled
                              className="w-full ps-9 pe-3 py-2.5 text-xs bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-mono cursor-not-allowed"
                            />
                          </div>
                          <span className="text-[11px] text-slate-400 mt-1 block">
                            {lang === 'ar' ? 'اسم المستخدم هو المعرف الثابت للحساب.' : 'Username serves as unique immutable system handle.'}
                          </span>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                          <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-blue-600" />
                            <span>{t.roleLabel}: {translateRole(currentUser.role, lang)}</span>
                          </div>
                          <p className="text-slate-500 text-[11px]">
                            {lang === 'ar'
                              ? 'يتم تعيين وترقية الأدوار الوظيفية من قِبل مسؤول النظام.'
                              : 'Workspace roles are assigned and audited by PMO Administrators.'}
                          </p>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
                        <button
                          type="submit"
                          disabled={profileSaving}
                          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-2 shadow-xs disabled:opacity-50"
                        >
                          {profileSaving ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>{t.updatingProfile}</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              <span>{t.updateProfileButton}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* TAB 2: RESET PASSWORD FORM */}
                  {profileTab === 'security' && (
                    <form onSubmit={handleChangePassword} className="space-y-5 flex-1 flex flex-col justify-between">
                      <div className="space-y-4">
                        {passwordSuccess && (
                          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5 animate-in fade-in">
                            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                            <span>{passwordSuccess}</span>
                          </div>
                        )}
                        {passwordError && (
                          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5 animate-in fade-in">
                            <AlertTriangle className="w-4.5 h-4.5 text-rose-600 shrink-0" />
                            <span>{passwordError}</span>
                          </div>
                        )}

                        <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/90 text-amber-900 text-xs flex items-start gap-2.5">
                          <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <p className="leading-relaxed">
                            {lang === 'ar'
                              ? 'لحماية حسابك، يرجى إدخال كلمة المرور الحالية أولاً ثم اختيار كلمة مرور قوية مكونة من 6 خانات على الأقل.'
                              : 'For account security, verify your current password and choose a new password with at least 6 characters.'}
                          </p>
                        </div>

                        {/* Current Password */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                            {t.currentPasswordLabel} <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <Lock className="w-4 h-4 absolute start-3 top-3 text-slate-400" />
                            <input
                              type={showCurrentPass ? 'text' : 'password'}
                              value={currentPasswordInput}
                              onChange={(e) => setCurrentPasswordInput(e.target.value)}
                              required
                              placeholder="••••••••"
                              className="w-full ps-9 pe-9 py-2.5 text-xs bg-[#F8FAFC] border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
                            />
                            <button
                              type="button"
                              onClick={() => setShowCurrentPass(!showCurrentPass)}
                              className="absolute end-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                              tabIndex={-1}
                            >
                              {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {/* New Password */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                            {t.newPasswordLabel} <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <KeyRound className="w-4 h-4 absolute start-3 top-3 text-slate-400" />
                            <input
                              type={showNewPass ? 'text' : 'password'}
                              value={newPasswordInput}
                              onChange={(e) => setNewPasswordInput(e.target.value)}
                              required
                              placeholder={lang === 'ar' ? 'كلمة المرور الجديدة (6 خانات على الأقل)' : 'New password (min 6 characters)'}
                              className="w-full ps-9 pe-9 py-2.5 text-xs bg-[#F8FAFC] border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPass(!showNewPass)}
                              className="absolute end-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                              tabIndex={-1}
                            >
                              {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {/* Confirm New Password */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                            {t.confirmPasswordLabel} <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <KeyRound className="w-4 h-4 absolute start-3 top-3 text-slate-400" />
                            <input
                              type={showConfirmPass ? 'text' : 'password'}
                              value={confirmPasswordInput}
                              onChange={(e) => setConfirmPasswordInput(e.target.value)}
                              required
                              placeholder={lang === 'ar' ? 'تأكيد كلمة المرور الجديدة' : 'Confirm new password'}
                              className="w-full ps-9 pe-9 py-2.5 text-xs bg-[#F8FAFC] border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPass(!showConfirmPass)}
                              className="absolute end-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                              tabIndex={-1}
                            >
                              {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
                        <button
                          type="submit"
                          disabled={passwordSaving || !currentPasswordInput || !newPasswordInput || !confirmPasswordInput}
                          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-2 shadow-xs disabled:opacity-50"
                        >
                          {passwordSaving ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>{t.changingPassword}</span>
                            </>
                          ) : (
                            <>
                              <KeyRound className="w-4 h-4" />
                              <span>{t.changePasswordButton}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================== PROJECT PLANNING WORKSPACE ==================== */}
          {activeSection === 'project-workspace' && (
            <ProjectWorkspaceView
              lang={lang}
              projects={projects}
              workstreams={workstreams}
              milestones={milestones}
              activities={activities}
              dependencies={dependencies}
              users={users}
              selectedProjectId={workspaceProjectId}
              onSelectProject={(id) => setWorkspaceProjectId(id)}
              initialTab={workspaceInitialTab}
              canManage={canManageStructure}
              canUpdateTask={true}
              onRefresh={fetchAllData}
              onEditWorkstream={(ws, defProjId) =>
                ws
                  ? openEditModal('workstream', ws)
                  : openCreateModal('workstream', { projectId: defProjId })
              }
              onDeleteWorkstream={(id, name) => handleDeleteRecord('workstream', id, name)}
              onEditMilestone={(ms, defProjId) =>
                ms
                  ? openEditModal('milestone', ms)
                  : openCreateModal('milestone', { projectId: defProjId })
              }
              onDeleteMilestone={(id, name) => handleDeleteRecord('milestone', id, name)}
              onEditActivity={(act, defProjId, parentActivityId) =>
                act
                  ? openEditModal('activity', act)
                  : openCreateModal('activity', { projectId: defProjId, parentActivityId })
              }
              onDeleteActivity={(id, name) => handleDeleteRecord('activity', id, name)}
              showBanner={showBanner}
            />
          )}

          {/* ==================== 1. DASHBOARD VIEW ==================== */}
          {activeSection === 'dashboard' && (
            <ExecutiveDashboardView
              lang={lang}
              currentUser={currentUser}
              loading={loading}
              dashboard={dashboard}
              departments={departments}
              portfolios={portfolios}
              initiatives={initiatives}
              projects={projects}
              workstreams={workstreams}
              milestones={milestones}
              activities={activities}
              onRefresh={fetchAllData}
              onNavigateSection={(section) => navigateToSection(section)}
              onOpenProjectWorkspace={(projectId, tab = 'overview') => {
                setWorkspaceProjectId(projectId);
                setWorkspaceInitialTab(tab);
                navigateToSection('project-workspace');
              }}
            />
          )}

          {/* ==================== 2. PMO HIERARCHICAL DRILL-DOWN VIEW ==================== */}
          {activeSection === 'hierarchy' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/90 pb-5">
                <div>
                  <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
                    {t.hierarchyExplorer}
                  </h1>
                  <p className="text-sm text-slate-600 mt-1">
                    {t.departments} → {t.portfolios} → {t.initiatives} → {t.projects} →{' '}
                    {t.activities}
                  </p>
                </div>
              </div>

              {/* Active Breadcrumb Trail */}
              <div className="bg-white border border-slate-200 rounded-xl px-5 py-3.5 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-blue-600">
                  {selectedDeptObj ? pickLocalized(lang, selectedDeptObj.name, selectedDeptObj.nameAr) : t.departments}
                </span>
                {selectedPortObj && (
                  <>
                    <span className="text-slate-400">·</span>
                    <span className="font-semibold text-slate-900">
                      {pickLocalized(lang, selectedPortObj.name, selectedPortObj.nameAr)}
                    </span>
                  </>
                )}
                {selectedInitObj && (
                  <>
                    <span className="text-slate-400">·</span>
                    <span className="font-semibold text-slate-900">
                      {pickLocalized(lang, selectedInitObj.name, selectedInitObj.nameAr)}
                    </span>
                  </>
                )}
                {selectedProjObj && (
                  <>
                    <span className="text-slate-400">·</span>
                    <span className="font-semibold text-slate-900">
                      {pickLocalized(lang, selectedProjObj.name, selectedProjObj.nameAr)}
                    </span>
                  </>
                )}
              </div>

              {/* 5-Column Progressive Drill-Down Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {/* Level 1: Departments */}
                <div className="bg-white border border-slate-200 rounded-xl flex flex-col">
                  <div className="px-4 py-3.5 border-b border-slate-200/80 flex items-center justify-between bg-[#F8FAFC] rounded-t-xl">
                    <span className="text-xs font-bold text-slate-800">01. {t.departments}</span>
                    <span className="text-xs font-mono tabular-nums font-semibold text-slate-500">
                      {departments.length}
                    </span>
                  </div>
                  <div className="p-2 space-y-1 flex-1">
                    {departments.map((d) => {
                      const active = drillDeptId === d.id;
                      return (
                        <button
                          key={d.id}
                          onClick={() => {
                            setDrillDeptId(d.id);
                            const firstPort = portfolios.find((p) => p.departmentId === d.id);
                            const nextPortId = firstPort ? firstPort.id : null;
                            setDrillPortfolioId(nextPortId);
                            const firstInit = initiatives.find(
                              (i) => i.portfolioId === nextPortId
                            );
                            const nextInitId = firstInit ? firstInit.id : null;
                            setDrillInitiativeId(nextInitId);
                            const firstProj = projects.find(
                              (pr) => pr.initiativeId === nextInitId
                            );
                            setDrillProjectId(firstProj ? firstProj.id : null);
                          }}
                          className={`w-full text-start px-3 py-2.5 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                            active
                              ? 'bg-blue-600 text-white font-semibold'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span className="truncate">{pickLocalized(lang, d.name, d.nameAr)}</span>
                          <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-70 rtl:rotate-180" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Level 2: Portfolios */}
                <div className="bg-white border border-slate-200 rounded-xl flex flex-col">
                  <div className="px-4 py-3.5 border-b border-slate-200/80 flex items-center justify-between bg-[#F8FAFC] rounded-t-xl">
                    <span className="text-xs font-bold text-slate-800">02. {t.portfolios}</span>
                    <span className="text-xs font-mono tabular-nums font-semibold text-slate-500">
                      {deptPortfolios.length}
                    </span>
                  </div>
                  <div className="p-2 space-y-1 flex-1">
                    {deptPortfolios.length === 0 ? (
                      <div className="p-4 text-xs text-slate-400">{t.noRecordsFound}</div>
                    ) : (
                      deptPortfolios.map((p) => {
                        const active = drillPortfolioId === p.id;
                        return (
                          <button
                            key={p.id}
                            onClick={() => {
                              setDrillPortfolioId(p.id);
                              const firstInit = initiatives.find((i) => i.portfolioId === p.id);
                              const nextInitId = firstInit ? firstInit.id : null;
                              setDrillInitiativeId(nextInitId);
                              const firstProj = projects.find(
                                (pr) => pr.initiativeId === nextInitId
                              );
                              setDrillProjectId(firstProj ? firstProj.id : null);
                            }}
                            className={`w-full text-start px-3 py-2.5 rounded-lg text-xs transition-colors cursor-pointer ${
                              active
                                ? 'bg-blue-600 text-white font-semibold'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <div className="truncate">{pickLocalized(lang, p.name, p.nameAr)}</div>
                            <div
                              className={`text-[11px] mt-0.5 ${
                                active ? 'text-blue-100' : 'text-slate-500'
                              }`}
                            >
                              {translateStatus(p.status, lang)} · {p.initiativeCount}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Level 3: Initiatives */}
                <div className="bg-white border border-slate-200 rounded-xl flex flex-col">
                  <div className="px-4 py-3.5 border-b border-slate-200/80 flex items-center justify-between bg-[#F8FAFC] rounded-t-xl">
                    <span className="text-xs font-bold text-slate-800">03. {t.initiatives}</span>
                    <span className="text-xs font-mono tabular-nums font-semibold text-slate-500">
                      {portInitiatives.length}
                    </span>
                  </div>
                  <div className="p-2 space-y-1 flex-1">
                    {portInitiatives.length === 0 ? (
                      <div className="p-4 text-xs text-slate-400">{t.noRecordsFound}</div>
                    ) : (
                      portInitiatives.map((i) => {
                        const active = drillInitiativeId === i.id;
                        return (
                          <button
                            key={i.id}
                            onClick={() => {
                              setDrillInitiativeId(i.id);
                              const firstProj = projects.find((pr) => pr.initiativeId === i.id);
                              setDrillProjectId(firstProj ? firstProj.id : null);
                            }}
                            className={`w-full text-start px-3 py-2.5 rounded-lg text-xs transition-colors cursor-pointer ${
                              active
                                ? 'bg-blue-600 text-white font-semibold'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <div className="truncate">{pickLocalized(lang, i.name, i.nameAr)}</div>
                            <div
                              className={`text-[11px] mt-0.5 font-mono tabular-nums ${
                                active ? 'text-blue-100' : 'text-slate-500'
                              }`}
                            >
                              {translateStatus(i.status, lang)} · {i.progressPercentage}%
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Level 4: Projects */}
                <div className="bg-white border border-slate-200 rounded-xl flex flex-col">
                  <div className="px-4 py-3.5 border-b border-slate-200/80 flex items-center justify-between bg-[#F8FAFC] rounded-t-xl">
                    <span className="text-xs font-bold text-slate-800">04. {t.projects}</span>
                    <span className="text-xs font-mono tabular-nums font-semibold text-slate-500">
                      {initProjects.length}
                    </span>
                  </div>
                  <div className="p-2 space-y-1 flex-1">
                    {initProjects.length === 0 ? (
                      <div className="p-4 text-xs text-slate-400">{t.noRecordsFound}</div>
                    ) : (
                      initProjects.map((pr) => {
                        const active = drillProjectId === pr.id;
                        return (
                          <button
                            key={pr.id}
                            onClick={() => setDrillProjectId(pr.id)}
                            className={`w-full text-start px-3 py-2.5 rounded-lg text-xs transition-colors cursor-pointer ${
                              active
                                ? 'bg-blue-600 text-white font-semibold'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <div className="truncate">{pickLocalized(lang, pr.name, pr.nameAr)}</div>
                            <div
                              className={`text-[11px] mt-0.5 font-mono tabular-nums ${
                                active ? 'text-blue-100' : 'text-slate-500'
                              }`}
                            >
                              {translateStatus(pr.status, lang)} · {pr.progressPercentage}%
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Level 5: Activities */}
                <div className="bg-white border border-slate-200 rounded-xl flex flex-col">
                  <div className="px-4 py-3.5 border-b border-slate-200/80 flex items-center justify-between bg-[#F8FAFC] rounded-t-xl">
                    <span className="text-xs font-bold text-slate-800">05. {t.activities}</span>
                    <span className="text-xs font-mono tabular-nums font-semibold text-slate-500">
                      {projActivities.length}
                    </span>
                  </div>
                  <div className="p-3 divide-y divide-slate-200/70 flex-1">
                    {projActivities.length === 0 ? (
                      <div className="p-4 text-xs text-slate-400">{t.noRecordsFound}</div>
                    ) : (
                      projActivities.map((a) => (
                        <div key={a.id} className="py-2.5 first:pt-0 last:pb-0 text-xs space-y-1">
                          <div className="font-semibold text-slate-900 leading-snug">
                            {pickLocalized(lang, a.name, a.nameAr)}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {pickLocalized(lang, a.assignedUserName, a.assignedUserNameAr) || t.unassignedOption} ·{' '}
                            <span className="font-mono tabular-nums">{a.dueDate}</span>
                          </div>
                          <div className="flex items-center justify-between pt-0.5">
                            <span
                              className={`text-[11px] font-semibold ${
                                a.status === 'Completed'
                                  ? 'text-emerald-700'
                                  : a.status === 'In Progress'
                                  ? 'text-blue-600'
                                  : 'text-slate-600'
                              }`}
                            >
                              {translateStatus(a.status, lang)}
                            </span>
                            <span className="font-mono tabular-nums text-[11px] font-bold text-slate-700">
                              {a.progressPercentage}%
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== INITIATIVE MANAGEMENT (EPIC 01) ==================== */}
          {activeSection === 'initiatives' && (
            <InitiativeManagementView
              lang={lang}
              currentUserRole={currentUser?.role}
              showBanner={showBanner}
              onNavigateToProjects={(initiativeId?: number, projectId?: number) => {
                if (projectId) {
                  setWorkspaceProjectId(projectId);
                  setWorkspaceInitialTab('overview');
                  setActiveSection('project-workspace');
                } else {
                  setActiveSection('projects');
                }
              }}
            />
          )}

          {/* ==================== PORTFOLIO MANAGEMENT (EPIC 02) ==================== */}
          {activeSection === 'portfolios' && (
            <PortfolioManagementView
              lang={lang}
              currentUserRole={currentUser?.role}
              showBanner={showBanner}
              onNavigateToInitiatives={(portfolioId?: number, initiativeId?: number) => {
                setActiveSection('initiatives');
              }}
            />
          )}

          {/* ==================== DEPARTMENT MANAGEMENT (EPIC 03) ==================== */}
          {activeSection === 'departments' && (
            <DepartmentManagementView
              lang={lang}
              currentUserRole={currentUser?.role}
              showBanner={showBanner}
              onNavigateToPortfolio={(portfolioId) => {
                setActiveSection('portfolios');
              }}
              onNavigateToInitiative={(initiativeId) => {
                setActiveSection('initiatives');
              }}
            />
          )}

          {/* ==================== PROGRESS TRACKING (EPIC 04) ==================== */}
          {activeSection === 'progress-tracking' && (
            <ProgressTrackingView
              lang={lang}
              currentUserRole={currentUser?.role}
              showBanner={showBanner}
              onNavigateToInitiative={(initiativeId) => {
                setActiveSection('initiatives');
              }}
              onNavigateToProjectWorkspace={(projectId) => {
                setWorkspaceProjectId(projectId);
                setWorkspaceInitialTab('overview');
                setActiveSection('project-workspace');
              }}
            />
          )}

          {/* ==================== OVERDUE ACTIVITY (EPIC 05) ==================== */}
          {activeSection === 'overdue-activities' && (
            <OverdueActivityView
              lang={lang}
              showBanner={showBanner}
              onNavigateToProjectWorkspace={(projectId) => {
                setWorkspaceProjectId(projectId);
                setWorkspaceInitialTab('overview');
                setActiveSection('project-workspace');
              }}
            />
          )}

          {/* ==================== ACTIVITY SEARCH (EPIC 06) ==================== */}
          {activeSection === 'activity-search' && (
            <ActivitySearchView
              lang={lang}
              showBanner={showBanner}
              onNavigateToProjectWorkspace={(projectId) => {
                setWorkspaceProjectId(projectId);
                setWorkspaceInitialTab('overview');
                setActiveSection('project-workspace');
              }}
            />
          )}

          {/* ==================== PMO DASHBOARD (EPIC 07) ==================== */}
          {activeSection === 'pmo-dashboard' && (
            <PmoDashboardView
              lang={lang}
              showBanner={showBanner}
              onNavigateSection={(section) => setActiveSection(section)}
              onNavigateToProjectWorkspace={(projectId) => {
                setWorkspaceProjectId(projectId);
                setWorkspaceInitialTab('overview');
                setActiveSection('project-workspace');
              }}
            />
          )}

          {/* ==================== PROJECT MANAGEMENT (EPIC 08) ==================== */}
          {activeSection === 'projects' && (
            <ProjectManagementView
              lang={lang}
              currentUserRole={currentUser?.role}
              showBanner={showBanner}
              onNavigateToWorkspace={(projectId) => {
                setWorkspaceProjectId(projectId);
                setWorkspaceInitialTab('overview');
                setActiveSection('project-workspace');
              }}
              onManageActivities={(projectId) => {
                setActivityMgmtProjectId(projectId);
                setActiveSection('activities');
              }}
              onPlanSchedule={(projectId) => {
                setSchedulingProjectId(projectId);
                setActiveSection('scheduling');
              }}
            />
          )}

          {/* ==================== ACTIVITY MANAGEMENT (EPIC 09) ==================== */}
          {activeSection === 'activities' && (
            <ActivityManagementView
              lang={lang}
              currentUserRole={currentUser?.role}
              initialProjectId={activityMgmtProjectId}
              showBanner={showBanner}
              onDataChanged={fetchAllData}
              onNavigateToWorkspace={(projectId) => {
                setWorkspaceProjectId(projectId);
                setWorkspaceInitialTab('overview');
                setActiveSection('project-workspace');
              }}
            />
          )}

          {/* ==================== PROJECT PLANNING & SCHEDULING (EPIC 11) ==================== */}
          {activeSection === 'scheduling' && (
            <ProjectSchedulingView
              lang={lang}
              currentUserRole={currentUser?.role}
              initialProjectId={schedulingProjectId}
              showBanner={showBanner}
              onDataChanged={fetchAllData}
              onNavigateToProjectWorkspace={(projectId) => {
                setWorkspaceProjectId(projectId);
                setWorkspaceInitialTab('overview');
                setActiveSection('project-workspace');
              }}
            />
          )}

          {/* ==================== USER & ROLE MANAGEMENT (EPIC 10) ==================== */}
          {activeSection === 'users' && (
            <UserManagementView
              lang={lang}
              currentUserRole={currentUser?.role}
              currentUserId={currentUser?.userId}
              isAdminAccount={isAdminAccount(currentUser)}
              showBanner={showBanner}
              onUsersChanged={() => {
                refreshSavedAccounts();
                fetchAllData();
              }}
            />
          )}

          {/* ==================== SEARCH & FILTER BAR FOR ENTITY CRUD VIEWS ==================== */}
          {[
            'workstreams',
            'milestones'
          ].includes(activeSection) && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/90 pb-5">
                <div>
                  <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
                    {activeSection === 'workstreams' ? t.workstreams : t.milestones}
                  </h1>
                  <p className="text-sm text-slate-600 mt-1">{t.systemSubtitle}</p>
                </div>

                <div className="flex items-center gap-3">
                  {canManageStructure && (
                    <button
                      onClick={() =>
                        openCreateModal(
                          activeSection === 'workstreams' ? 'workstream' : 'milestone'
                        )
                      }
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{t.createNew}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Search & Segmented Status Filter Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative w-full md:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t.searchPlaceholder}
                    className="w-full ps-9 pe-3.5 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-600 transition-colors"
                  />
                </div>

                {currentStatusOptions.length > 0 && (
                  <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto">
                    {currentStatusOptions.map((st) => (
                      <button
                        key={st}
                        onClick={() => setStatusFilter(st)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          statusFilter === st
                            ? 'bg-white text-slate-900 shadow-xs font-semibold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {st === 'All' ? t.allStatuses : translateStatus(st, lang)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 6. PROJECTS TABLE */}
              {activeSection === 'projects' && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-start border-collapse">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-slate-200/80 text-xs font-semibold text-slate-600">
                        <th className="py-3.5 px-4 w-14 text-start">{lang === 'ar' ? 'المعرّف' : 'ID'}</th>
                        <th className="py-3.5 px-4 text-start">{t.projects}</th>
                        <th className="py-3.5 px-4 text-start">{t.initiativeLabel}</th>
                        <th className="py-3.5 px-4 text-start">{t.projectManager}</th>
                        <th className="py-3.5 px-4 text-start">{t.scheduleWindow}</th>
                        <th className="py-3.5 px-4 text-start">
                          {t.priorityLabel} · {t.statusFilterLabel}
                        </th>
                        <th className="py-3.5 px-4 text-end">{t.overallProgress}</th>
                        <th className="py-3.5 px-4 text-end">{t.actions}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/70 text-sm">
                      {filteredProjects.map((pr) => (
                        <tr key={pr.id} className="hover:bg-blue-50/30 transition-colors">
                          <td className="py-3.5 px-4 font-mono text-xs text-slate-500 tabular-nums">
                            {pr.id}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900">
                              {pickLocalized(lang, pr.name, pr.nameAr)}
                            </div>
                            <div className="text-xs text-slate-500 line-clamp-1">
                              {pickLocalized(lang, pr.description, pr.descriptionAr)}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-700">
                            {pickLocalized(lang, pr.initiativeName, pr.initiativeNameAr)}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-700">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 font-mono text-[10px] font-bold inline-flex items-center justify-center shrink-0">
                                {getInitials(pr.projectManagerName)}
                              </span>
                              <span>
                                {pickLocalized(lang, pr.projectManagerName, pr.projectManagerNameAr) || t.unassignedOption}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                            {pr.startDate} → {pr.endDate}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-700 whitespace-nowrap">
                            <span className="font-semibold">
                              {translatePriority(pr.priority, lang)}
                            </span>
                            <span className="mx-1.5">·</span>
                            <span className="text-blue-600 font-semibold">
                              {translateStatus(pr.status, lang)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-end font-mono text-xs font-bold tabular-nums">
                            {pr.progressPercentage}%
                          </td>
                          <td className="py-3.5 px-4 text-end whitespace-nowrap">
                            <div className="inline-flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setWorkspaceProjectId(pr.id);
                                  setWorkspaceInitialTab('overview');
                                  setActiveSection('project-workspace');
                                }}
                                className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-xs font-semibold cursor-pointer transition-colors"
                              >
                                {t.openWorkspace}
                              </button>
                              {canManageStructure && (
                                <button
                                  onClick={() => openEditModal('project', pr)}
                                  className="p-1.5 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100 cursor-pointer"
                                  title={t.edit}
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {canDeleteStructure && (
                                <button
                                  onClick={() =>
                                    handleDeleteRecord(
                                      'project',
                                      pr.id,
                                      pickLocalized(lang, pr.name, pr.nameAr)
                                    )
                                  }
                                  className="p-1.5 text-slate-500 hover:text-rose-600 rounded hover:bg-rose-50 cursor-pointer"
                                  title={t.delete}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 6B. WORKSTREAMS TABLE */}
              {activeSection === 'workstreams' && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-start border-collapse">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-slate-200/80 text-xs font-semibold text-slate-600">
                        <th className="py-3.5 px-4 w-14 text-start">{lang === 'ar' ? 'المعرّف' : 'ID'}</th>
                        <th className="py-3.5 px-4 text-start">{t.workstreams}</th>
                        <th className="py-3.5 px-4 text-start">{t.projectLabel}</th>
                        <th className="py-3.5 px-4 text-start">{t.ownerLabel}</th>
                        <th className="py-3.5 px-4 text-start">{t.scheduleWindow}</th>
                        <th className="py-3.5 px-4 text-start">{t.statusFilterLabel}</th>
                        <th className="py-3.5 px-4 text-end">{t.overallProgress}</th>
                        <th className="py-3.5 px-4 text-end">{t.actions}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/70 text-sm">
                      {filteredWorkstreams.map((ws) => (
                        <tr key={ws.id} className="hover:bg-blue-50/30 transition-colors">
                          <td className="py-3.5 px-4 font-mono text-xs text-slate-500 tabular-nums">
                            {ws.id}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900">
                              {pickLocalized(lang, ws.name, ws.nameAr)}
                            </div>
                            <div className="text-xs text-slate-500">
                              {pickLocalized(lang, ws.description, ws.descriptionAr)}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-xs font-medium text-slate-800">
                            {pickLocalized(lang, ws.projectName, ws.projectNameAr)}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-700">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-mono text-[10px] font-bold inline-flex items-center justify-center shrink-0">
                                {getInitials(ws.ownerName)}
                              </span>
                              <span>{pickLocalized(lang, ws.ownerName, ws.ownerNameAr) || t.unassignedOption}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-slate-600">
                            {ws.startDate} → {ws.endDate}
                          </td>
                          <td className="py-3.5 px-4 text-xs font-semibold text-blue-600">
                            {translateStatus(ws.status, lang)}
                          </td>
                          <td className="py-3.5 px-4 text-end font-mono tabular-nums text-xs font-bold">
                            {ws.progressPercentage}%
                          </td>
                          <td className="py-3.5 px-4 text-end">
                            <div className="inline-flex items-center gap-2">
                              {canManageStructure && (
                                <button
                                  onClick={() => openEditModal('workstream', ws)}
                                  className="p-1.5 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100 cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {canDeleteStructure && (
                                <button
                                  onClick={() =>
                                    handleDeleteRecord(
                                      'workstream',
                                      ws.id,
                                      pickLocalized(lang, ws.name, ws.nameAr)
                                    )
                                  }
                                  className="p-1.5 text-slate-500 hover:text-rose-600 rounded hover:bg-rose-50 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 6C. MILESTONES TABLE */}
              {activeSection === 'milestones' && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-start border-collapse">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-slate-200/80 text-xs font-semibold text-slate-600">
                        <th className="py-3.5 px-4 w-14 text-start">{lang === 'ar' ? 'المعرّف' : 'ID'}</th>
                        <th className="py-3.5 px-4 text-start">{t.milestones}</th>
                        <th className="py-3.5 px-4 text-start">
                          {t.projectLabel} · {t.workstreams}
                        </th>
                        <th className="py-3.5 px-4 text-start">{t.ownerLabel}</th>
                        <th className="py-3.5 px-4 text-start">
                          {t.plannedDateLabel} / {t.actualDateLabel}
                        </th>
                        <th className="py-3.5 px-4 text-start">{t.statusFilterLabel}</th>
                        <th className="py-3.5 px-4 text-end">{t.actions}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/70 text-sm">
                      {filteredMilestones.map((ms) => (
                        <tr key={ms.id} className="hover:bg-blue-50/30 transition-colors">
                          <td className="py-3.5 px-4 font-mono text-xs text-slate-500 tabular-nums">
                            {ms.id}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                              <span className="text-amber-600">◆</span>
                              <span>{pickLocalized(lang, ms.name, ms.nameAr)}</span>
                            </div>
                            <div className="text-xs text-slate-500">
                              {pickLocalized(lang, ms.description, ms.descriptionAr)}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-700">
                            <span className="font-semibold text-slate-900">
                              {pickLocalized(lang, ms.projectName, ms.projectNameAr)}
                            </span>
                            {ms.workstreamName && (
                              <span> · {pickLocalized(lang, ms.workstreamName, ms.workstreamNameAr)}</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-700">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-mono text-[10px] font-bold inline-flex items-center justify-center shrink-0">
                                {getInitials(ms.ownerName)}
                              </span>
                              <span>{pickLocalized(lang, ms.ownerName, ms.ownerNameAr) || t.unassignedOption}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-slate-700">
                            <div>{ms.plannedDate}</div>
                            {ms.actualDate && (
                              <div className="text-emerald-700 font-semibold">
                                ✓ {ms.actualDate}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs font-semibold">
                            <span
                              className={
                                ms.status === 'Completed'
                                  ? 'text-emerald-700'
                                  : ms.status === 'Delayed' || ms.isDelayed
                                  ? 'text-rose-600'
                                  : ms.status === 'In Progress'
                                  ? 'text-blue-600'
                                  : 'text-slate-600'
                              }
                            >
                              {translateStatus(ms.status, lang)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-end">
                            <div className="inline-flex items-center gap-2">
                              {canManageStructure && (
                                <button
                                  onClick={() => openEditModal('milestone', ms)}
                                  className="p-1.5 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100 cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {canDeleteStructure && (
                                <button
                                  onClick={() =>
                                    handleDeleteRecord(
                                      'milestone',
                                      ms.id,
                                      pickLocalized(lang, ms.name, ms.nameAr)
                                    )
                                  }
                                  className="p-1.5 text-slate-500 hover:text-rose-600 rounded hover:bg-rose-50 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ==================== MODAL FOR CREATE / EDIT ==================== */}
      {modalOpen && modalEntityType && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-6 shadow-xl">
            <h2 className="font-display text-lg font-bold text-slate-900 mb-1">
              {editingId ? t.editRecord : t.createRecord} —{' '}
              {modalEntityType === 'department'
                ? t.department
                : modalEntityType === 'portfolio'
                ? t.portfolio
                : modalEntityType === 'initiative'
                ? t.initiative
                : modalEntityType === 'project'
                ? t.project
                : modalEntityType === 'workstream'
                ? t.workstream
                : modalEntityType === 'milestone'
                ? t.milestone
                : t.activity}
            </h2>
            <p className="text-xs text-slate-500 mb-4">{t.modalDesc}</p>

            {formError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveModal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.name} *
                </label>
                <input
                  type="text"
                  required
                  value={formState.name || ''}
                  onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.description}
                </label>
                <textarea
                  rows={2}
                  value={formState.description || ''}
                  onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>

              {modalEntityType === 'department' && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="deptActive"
                    checked={Boolean(formState.isActive)}
                    onChange={(e) => setFormState({ ...formState, isActive: e.target.checked })}
                    className="accent-blue-600"
                  />
                  <label htmlFor="deptActive" className="text-xs font-medium text-slate-700">
                    {t.departmentIsActive}
                  </label>
                </div>
              )}

              {modalEntityType === 'portfolio' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.department}
                      </label>
                      <select
                        value={formState.departmentId || ''}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            departmentId: e.target.value ? Number(e.target.value) : null
                          })
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      >
                        <option value="">{t.enterpriseWide}</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {pickLocalized(lang, d.name, d.nameAr)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.portfolioOwner}
                      </label>
                      <select
                        value={formState.ownerId || ''}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            ownerId: e.target.value ? Number(e.target.value) : null
                          })
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      >
                        <option value="">{t.unassigned}</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {pickLocalized(lang, u.fullName, u.fullNameAr)} ({translateRole(u.roleName, lang)})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.startDate}
                      </label>
                      <input
                        type="date"
                        required
                        value={formState.startDate || ''}
                        onChange={(e) => setFormState({ ...formState, startDate: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.endDate}
                      </label>
                      <input
                        type="date"
                        required
                        value={formState.endDate || ''}
                        onChange={(e) => setFormState({ ...formState, endDate: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.status}
                      </label>
                      <select
                        value={formState.status || 'Active'}
                        onChange={(e) => setFormState({ ...formState, status: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      >
                        <option value="Active">{translateStatus('Active', lang)}</option>
                        <option value="Planning">{translateStatus('Planning', lang)}</option>
                        <option value="On Hold">{translateStatus('On Hold', lang)}</option>
                        <option value="Completed">{translateStatus('Completed', lang)}</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {modalEntityType === 'initiative' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.portfolio} *
                      </label>
                      <select
                        required
                        value={formState.portfolioId || ''}
                        onChange={(e) =>
                          setFormState({ ...formState, portfolioId: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      >
                        {portfolios.map((p) => (
                          <option key={p.id} value={p.id}>
                            {pickLocalized(lang, p.name, p.nameAr)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.department}
                      </label>
                      <select
                        value={formState.departmentId || ''}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            departmentId: e.target.value ? Number(e.target.value) : null
                          })
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      >
                        <option value="">{t.noneOption}</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {pickLocalized(lang, d.name, d.nameAr)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.owner}
                      </label>
                      <select
                        value={formState.ownerId || ''}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            ownerId: e.target.value ? Number(e.target.value) : null
                          })
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      >
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {pickLocalized(lang, u.fullName, u.fullNameAr)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.startDate}
                      </label>
                      <input
                        type="date"
                        required
                        value={formState.startDate || ''}
                        onChange={(e) => setFormState({ ...formState, startDate: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.targetDate}
                      </label>
                      <input
                        type="date"
                        required
                        value={formState.targetDate || ''}
                        onChange={(e) => setFormState({ ...formState, targetDate: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.status}
                      </label>
                      <select
                        value={formState.status || 'In Progress'}
                        onChange={(e) => setFormState({ ...formState, status: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      >
                        <option value="Not Started">{translateStatus('Not Started', lang)}</option>
                        <option value="In Progress">{translateStatus('In Progress', lang)}</option>
                        <option value="On Hold">{translateStatus('On Hold', lang)}</option>
                        <option value="Completed">{translateStatus('Completed', lang)}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.priority}
                      </label>
                      <select
                        value={formState.priority || 'Medium'}
                        onChange={(e) => setFormState({ ...formState, priority: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      >
                        <option value="Low">{translatePriority('Low', lang)}</option>
                        <option value="Medium">{translatePriority('Medium', lang)}</option>
                        <option value="High">{translatePriority('High', lang)}</option>
                        <option value="Critical">{translatePriority('Critical', lang)}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.progressPercent}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={formState.progressPercentage ?? 0}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            progressPercentage: Number(e.target.value)
                          })
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>
                </>
              )}

              {modalEntityType === 'project' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.parentInitiative} *
                      </label>
                      <select
                        required
                        value={formState.initiativeId || ''}
                        onChange={(e) =>
                          setFormState({ ...formState, initiativeId: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      >
                        {initiatives.map((i) => (
                          <option key={i.id} value={i.id}>
                            {pickLocalized(lang, i.name, i.nameAr)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.projectManager}
                      </label>
                      <select
                        value={formState.projectManagerId || ''}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            projectManagerId: e.target.value ? Number(e.target.value) : null
                          })
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      >
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {pickLocalized(lang, u.fullName, u.fullNameAr)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.startDate}
                      </label>
                      <input
                        type="date"
                        required
                        value={formState.startDate || ''}
                        onChange={(e) => setFormState({ ...formState, startDate: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.endDate}
                      </label>
                      <input
                        type="date"
                        required
                        value={formState.endDate || ''}
                        onChange={(e) => setFormState({ ...formState, endDate: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.status}
                      </label>
                      <select
                        value={formState.status || 'In Progress'}
                        onChange={(e) => setFormState({ ...formState, status: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      >
                        <option value="Planned">{translateStatus('Planned', lang)}</option>
                        <option value="In Progress">{translateStatus('In Progress', lang)}</option>
                        <option value="On Hold">{translateStatus('On Hold', lang)}</option>
                        <option value="Completed">{translateStatus('Completed', lang)}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.priority}
                      </label>
                      <select
                        value={formState.priority || 'Medium'}
                        onChange={(e) => setFormState({ ...formState, priority: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      >
                        <option value="Low">{translatePriority('Low', lang)}</option>
                        <option value="Medium">{translatePriority('Medium', lang)}</option>
                        <option value="High">{translatePriority('High', lang)}</option>
                        <option value="Critical">{translatePriority('Critical', lang)}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.progressPercent}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={formState.progressPercentage ?? 0}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            progressPercentage: Number(e.target.value)
                          })
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>
                </>
              )}

              {modalEntityType === 'workstream' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.project} *
                      </label>
                      <select
                        required
                        value={formState.projectId || ''}
                        onChange={(e) =>
                          setFormState({ ...formState, projectId: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      >
                        {projects.map((pr) => (
                          <option key={pr.id} value={pr.id}>
                            {pickLocalized(lang, pr.name, pr.nameAr)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.workstreamOwner}
                      </label>
                      <select
                        value={formState.ownerId || ''}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            ownerId: e.target.value ? Number(e.target.value) : null
                          })
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      >
                        <option value="">{t.unassigned}</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {pickLocalized(lang, u.fullName, u.fullNameAr)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.startDate}
                      </label>
                      <input
                        type="date"
                        required
                        value={formState.startDate || ''}
                        onChange={(e) => setFormState({ ...formState, startDate: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.endDate}
                      </label>
                      <input
                        type="date"
                        required
                        value={formState.endDate || ''}
                        onChange={(e) => setFormState({ ...formState, endDate: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.status}
                      </label>
                      <select
                        value={formState.status || 'In Progress'}
                        onChange={(e) => setFormState({ ...formState, status: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      >
                        <option value="Planned">{translateStatus('Planned', lang)}</option>
                        <option value="In Progress">{translateStatus('In Progress', lang)}</option>
                        <option value="Completed">{translateStatus('Completed', lang)}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.progressPercent}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={formState.progressPercentage ?? 0}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            progressPercentage: Number(e.target.value)
                          })
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>
                </>
              )}

              {modalEntityType === 'milestone' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.project} *
                      </label>
                      <select
                        required
                        value={formState.projectId || ''}
                        onChange={(e) => {
                          const newProjId = Number(e.target.value);
                          setFormState({
                            ...formState,
                            projectId: newProjId,
                            workstreamId: null
                          });
                        }}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      >
                        {projects.map((pr) => (
                          <option key={pr.id} value={pr.id}>
                            {pickLocalized(lang, pr.name, pr.nameAr)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.workstreamOptional}
                      </label>
                      <select
                        value={formState.workstreamId || ''}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            workstreamId: e.target.value ? Number(e.target.value) : null
                          })
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      >
                        <option value="">{t.noneProjectLevel}</option>
                        {workstreams
                          .filter((w) => w.projectId === Number(formState.projectId))
                          .map((w) => (
                            <option key={w.id} value={w.id}>
                              {pickLocalized(lang, w.name, w.nameAr)}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.owner}
                      </label>
                      <select
                        value={formState.ownerId || ''}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            ownerId: e.target.value ? Number(e.target.value) : null
                          })
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      >
                        <option value="">{t.unassigned}</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {pickLocalized(lang, u.fullName, u.fullNameAr)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.milestoneStatus}
                      </label>
                      <select
                        value={formState.status || 'Planned'}
                        onChange={(e) => setFormState({ ...formState, status: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      >
                        <option value="Planned">{translateStatus('Planned', lang)}</option>
                        <option value="In Progress">{translateStatus('In Progress', lang)}</option>
                        <option value="Completed">{translateStatus('Completed', lang)}</option>
                        <option value="Delayed">{translateStatus('Delayed', lang)}</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.plannedDate} *
                      </label>
                      <input
                        type="date"
                        required
                        value={formState.plannedDate || ''}
                        onChange={(e) =>
                          setFormState({ ...formState, plannedDate: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.actualDateOptional}
                      </label>
                      <input
                        type="date"
                        value={formState.actualDate || ''}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            actualDate: e.target.value ? e.target.value : null
                          })
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>
                </>
              )}

              {modalEntityType === 'activity' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.project} *
                      </label>
                      <select
                        required
                        value={formState.projectId || ''}
                        onChange={(e) => {
                          const newProjId = Number(e.target.value);
                          setFormState({
                            ...formState,
                            projectId: newProjId,
                            workstreamId: null,
                            milestoneId: null,
                            parentActivityId: null
                          });
                        }}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      >
                        {projects.map((pr) => (
                          <option key={pr.id} value={pr.id}>
                            {pickLocalized(lang, pr.name, pr.nameAr)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.workstream}
                      </label>
                      <select
                        value={formState.workstreamId || ''}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            workstreamId: e.target.value ? Number(e.target.value) : null
                          })
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      >
                        <option value="">{t.unassigned}</option>
                        {workstreams
                          .filter((w) => w.projectId === Number(formState.projectId))
                          .map((w) => (
                            <option key={w.id} value={w.id}>
                              {pickLocalized(lang, w.name, w.nameAr)}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.milestoneOptional}
                      </label>
                      <select
                        value={formState.milestoneId || ''}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            milestoneId: e.target.value ? Number(e.target.value) : null
                          })
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      >
                        <option value="">{t.noneOption}</option>
                        {milestones
                          .filter((m) => m.projectId === Number(formState.projectId))
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {pickLocalized(lang, m.name, m.nameAr)} ({m.plannedDate})
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.parentActivityForSubtask}
                      </label>
                      <select
                        value={formState.parentActivityId || ''}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            parentActivityId: e.target.value ? Number(e.target.value) : null
                          })
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      >
                        <option value="">{t.topLevelActivityNoParent}</option>
                        {activities
                          .filter(
                            (a) =>
                              a.projectId === Number(formState.projectId) &&
                              !a.parentActivityId &&
                              a.id !== editingId
                          )
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              {pickLocalized(lang, a.name, a.nameAr)}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.assignedUser}
                      </label>
                      <select
                        value={formState.assignedUserId || ''}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            assignedUserId: e.target.value ? Number(e.target.value) : null
                          })
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      >
                        <option value="">{t.unassigned}</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {pickLocalized(lang, u.fullName, u.fullNameAr)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.startDate}
                      </label>
                      <input
                        type="date"
                        required
                        value={formState.startDate || ''}
                        onChange={(e) => setFormState({ ...formState, startDate: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.dueDate}
                      </label>
                      <input
                        type="date"
                        required
                        value={formState.dueDate || ''}
                        onChange={(e) => setFormState({ ...formState, dueDate: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.taskStatus}
                      </label>
                      <select
                        value={formState.status || 'Not Started'}
                        onChange={(e) => setFormState({ ...formState, status: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      >
                        <option value="Not Started">{translateStatus('Not Started', lang)}</option>
                        <option value="In Progress">{translateStatus('In Progress', lang)}</option>
                        <option value="Completed">{translateStatus('Completed', lang)}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.priority}
                      </label>
                      <select
                        value={formState.priority || 'Medium'}
                        onChange={(e) => setFormState({ ...formState, priority: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      >
                        <option value="Low">{translatePriority('Low', lang)}</option>
                        <option value="Medium">{translatePriority('Medium', lang)}</option>
                        <option value="High">{translatePriority('High', lang)}</option>
                        <option value="Critical">{translatePriority('Critical', lang)}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t.progressPercent}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={formState.progressPercentage ?? 0}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            progressPercentage: Number(e.target.value)
                          })
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg border border-slate-300 cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer transition-colors"
                >
                  {editingId ? t.saveChanges : t.createRecord}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL FOR ADMIN USER ROLE ASSIGNMENT ==================== */}
      {roleModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl p-6 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100/80 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {lang === 'ar' ? 'إدارة وتعيين أدوار المستخدمين' : 'Manage & Assign User Roles'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {lang === 'ar'
                      ? 'يمكن لمدير مكتب المشاريع تعيين الأدوار والصلاحيات للمستخدمين المسجلين.'
                      : 'PMO Administrators can assign and update workspace access roles for all users.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRoleModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer text-lg"
              >
                ×
              </button>
            </div>

            <div className="py-4 overflow-y-auto flex-1 space-y-3">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
                {lang === 'ar' ? 'المستخدمون المسجلون بالنظام' : 'Registered System Accounts'} ({(users.length > 0 ? users : savedAccounts).length})
              </div>

              <div className="space-y-2">
                {(users.length > 0 ? users : savedAccounts).map((u) => {
                  const isUpdating = updatingUserRoleId === u.id;
                  const currentRole = u.roleName || 'Team Member';
                  return (
                    <div
                      key={u.id}
                      className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-300">
                          {getInitials(u.fullName)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-slate-900 truncate">
                              {pickLocalized(lang, u.fullName, u.fullNameAr)}
                            </span>
                            {currentUser?.username === u.username && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold">
                                {lang === 'ar' ? 'أنت' : 'You'}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate flex items-center gap-2 mt-0.5">
                            <span>@{u.username}</span>
                            <span>•</span>
                            <span>{u.email}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <label className="text-[11px] font-medium text-slate-500 sm:sr-only">
                          {t.roleLabel}:
                        </label>
                        <select
                          disabled={isUpdating}
                          value={currentRole}
                          onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 hover:border-blue-500 focus:outline-none focus:border-blue-600 cursor-pointer disabled:opacity-50"
                        >
                          <option value="PMO Manager">{t.pmoManagerRole}</option>
                          <option value="Project Manager">{t.projectManagerRole}</option>
                          <option value="Team Member">{t.teamMemberRole}</option>
                        </select>
                        {isUpdating && <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="text-[11px]">
                {lang === 'ar'
                  ? 'يتم تطبيق الصلاحيات المحدثة فور الحفظ.'
                  : 'Role changes take effect in the active workspace immediately.'}
              </span>
              <button
                type="button"
                onClick={() => setRoleModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
