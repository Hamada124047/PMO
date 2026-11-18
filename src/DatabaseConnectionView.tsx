import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Database,
  Download,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  Save,
  Unplug,
  Upload,
  Wrench
} from 'lucide-react';
import { apiFetch } from './apiClient';
import { Language } from './i18n';

interface MySqlPublicConfig {
  enabled: boolean;
  host: string;
  port: number;
  database: string;
  username: string;
  hasPassword: boolean;
  ssl: boolean;
  autoSync: boolean;
  autoCreateSchema: boolean;
  lastConnectedAt: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  serverVersion: string | null;
  connectionStringPreview: string;
  dotnetAppsettingsSynced: boolean;
}

interface MySqlTestResult {
  connected: boolean;
  latencyMs: number;
  serverVersion: string | null;
  databaseExists: boolean;
  tables: string[];
  tableRowCounts: Record<string, number>;
  message: string;
  errorCode?: string;
}

interface DatabaseConnectionViewProps {
  lang: Language;
  isAdminAccount?: boolean;
  showBanner: (type: 'success' | 'error', text: string) => void;
  onDataPulledFromMySql?: () => void;
}

const TABLE_DESCRIPTIONS: Record<string, { en: string; ar: string }> = {
  Roles: { en: 'System roles & access definitions', ar: 'الأدوار الوظيفية وصلاحيات النظام' },
  Users: { en: 'Organizational accounts & credentials', ar: 'حسابات المستخدمين وبيانات الدخول' },
  Departments: { en: 'Organizational units & governance owners', ar: 'الإدارات التنظيمية والمديرون المسؤولون' },
  Portfolios: { en: 'Strategic investment portfolios', ar: 'المحافظ الاستثمارية والاستراتيجية' },
  Initiatives: { en: 'Cross-department strategic initiatives', ar: 'المبادرات الاستراتيجية' },
  Projects: { en: 'Deliverable PMO projects & budgets', ar: 'المشاريع والميزانيات المعتمدة' },
  Workstreams: { en: 'Functional execution workstreams', ar: 'مسارات العمل التنفيذية' },
  Milestones: { en: 'Key delivery checkpoints & dates', ar: 'المعالم الزمنية الرئيسية' },
  Activities: { en: 'Tasks, subtasks & progress roll-ups', ar: 'الأنشطة والمهام الفرعية ونسب الإنجاز' },
  TaskDependencies: { en: 'Predecessor & successor schedule links', ar: 'الاعتماديات الزمنية بين الأنشطة' },
  StrategicPlans: { en: 'Strategic planning cycles & goals', ar: 'الخطط الاستراتيجية والأهداف' },
  StrategicInitiatives: { en: 'Strategic planning initiative records', ar: 'مبادرات التخطيط الاستراتيجي' },
  StrategicActivities: { en: 'Strategic planning activities & chatter', ar: 'أنشطة التخطيط الاستراتيجي' },
  AdminSystemSettingsStore: { en: 'Screen visibility, fields & role access rules', ar: 'إعدادات الشاشات والحقول وصلاحيات الأدوار' }
};

export const DatabaseConnectionView: React.FC<DatabaseConnectionViewProps> = ({
  lang,
  isAdminAccount = false,
  showBanner,
  onDataPulledFromMySql
}) => {
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncingAction, setSyncingAction] = useState<'init-schema' | 'push' | 'pull' | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [config, setConfig] = useState<MySqlPublicConfig | null>(null);
  const [expectedTables, setExpectedTables] = useState<string[]>([]);
  const [liveStatus, setLiveStatus] = useState<MySqlTestResult | null>(null);

  // Mode toggle matching screenshot: 'server' (MySQL Server Auth) vs 'local' (Local MySQL)
  const [authMode, setAuthMode] = useState<'server' | 'local'>('local');

  // Editable form state
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState('3306');
  const [database, setDatabase] = useState('pmo_portfolio_db');
  const [username, setUsername] = useState('root');
  const [password, setPassword] = useState('root');
  const [showPassword, setShowPassword] = useState(false);
  const [ssl, setSsl] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [autoCreateSchema, setAutoCreateSchema] = useState(true);
  const [initialSyncMode, setInitialSyncMode] = useState<'auto' | 'push' | 'pull' | 'schema-only'>('auto');
  const [connectionStringInput, setConnectionStringInput] = useState('');

  const loadConfig = async () => {
    if (!isAdminAccount) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch('/api/admin/database/config');
      if (res.ok) {
        const data = await res.json();
        const cfg: MySqlPublicConfig = data.config;
        setConfig(cfg);
        setExpectedTables(
          Array.isArray(data.expectedTables) ? data.expectedTables : Object.keys(TABLE_DESCRIPTIONS)
        );
        setLiveStatus(data.liveStatus || null);

        const rawLoadedHost = cfg.host || 'localhost';
        const loadedHost =
          /^\(localdb\)|\\/.test(rawLoadedHost) ? 'localhost' : rawLoadedHost;
        const loadedPort = Number(cfg.port || 3306);
        const loadedSsl = Boolean(cfg.ssl);

        setHost(loadedHost);
        setPort(String(loadedPort));
        setDatabase(cfg.database || 'pmo_portfolio_db');
        setUsername(cfg.username || 'root');
        setPassword(cfg.hasPassword ? '__UNCHANGED__' : '');
        setSsl(loadedSsl);
        setAutoSync(cfg.autoSync !== false);
        setAutoCreateSchema(cfg.autoCreateSchema !== false);

        const looksLocal =
          (loadedHost === 'localhost' || loadedHost === '127.0.0.1') &&
          loadedPort === 3306 &&
          !loadedSsl;
        setAuthMode(looksLocal ? 'local' : 'server');
      } else {
        const err = await res.json().catch(() => ({}));
        showBanner(
          'error',
          err.message ||
            (lang === 'ar'
              ? 'تعذر تحميل إعدادات قاعدة البيانات.'
              : 'Failed to load MySQL configuration.')
        );
      }
    } catch {
      showBanner('error', lang === 'ar' ? 'تعذر الاتصال بالخادم.' : 'Unable to reach server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminAccount]);

  const handleSelectAuthMode = (mode: 'server' | 'local') => {
    setAuthMode(mode);
    if (mode === 'local') {
      if (!host.trim() || /^\(localdb\)|\\|:/.test(host.trim())) {
        setHost('localhost');
      }
      setPort('3306');
      if (!username.trim()) setUsername('root');
      setSsl(false);
      setAutoCreateSchema(true);
      setAutoSync(true);
    }
  };

  const buildPayload = () => ({
    host: host.trim() || 'localhost',
    port: authMode === 'local' ? 3306 : Number(port) || 3306,
    database: database.trim() || 'pmo_portfolio_db',
    username: username.trim() || 'root',
    password,
    ssl: authMode === 'local' ? false : ssl,
    autoSync,
    autoCreateSchema
  });

  const handleParseConnectionString = () => {
    const raw = connectionStringInput.trim();
    if (!raw) return;

    if (/^mysql(2)?:\/\//i.test(raw)) {
      try {
        const u = new URL(raw.replace(/^mysql2:\/\//i, 'mysql://'));
        if (u.hostname) setHost(u.hostname);
        if (u.port) setPort(u.port);
        if (u.pathname && u.pathname !== '/') setDatabase(u.pathname.replace(/^\/+/, ''));
        if (u.username) setUsername(decodeURIComponent(u.username));
        if (u.password) setPassword(decodeURIComponent(u.password));
        const sslParam = u.searchParams.get('ssl') || u.searchParams.get('sslmode');
        if (sslParam) setSsl(sslParam.toLowerCase() !== 'false' && sslParam.toLowerCase() !== 'disabled');
        setAuthMode('server');
        showBanner(
          'success',
          lang === 'ar' ? 'تم استخراج بيانات الاتصال من الرابط بنجاح' : 'Connection details parsed from URI'
        );
        return;
      } catch {
        showBanner('error', lang === 'ar' ? 'صيغة رابط MySQL غير صالحة' : 'Invalid MySQL connection URI');
        return;
      }
    }

    const parts = raw.split(';').map((p) => p.trim()).filter(Boolean);
    let matched = 0;
    for (const part of parts) {
      const idx = part.indexOf('=');
      if (idx === -1) continue;
      const k = part.slice(0, idx).trim().toLowerCase();
      const v = part.slice(idx + 1).trim();
      if (['server', 'host', 'data source', 'datasource'].includes(k)) {
        setHost(v);
        matched++;
      } else if (k === 'port') {
        setPort(v);
        matched++;
      } else if (['database', 'initial catalog', 'db'].includes(k)) {
        setDatabase(v);
        matched++;
      } else if (['user', 'uid', 'user id', 'username'].includes(k)) {
        setUsername(v);
        matched++;
      } else if (['password', 'pwd', 'pass'].includes(k)) {
        setPassword(v);
        matched++;
      } else if (['sslmode', 'ssl mode', 'ssl'].includes(k)) {
        setSsl(v.toLowerCase() !== 'none' && v.toLowerCase() !== 'false' && v.toLowerCase() !== 'disabled');
        matched++;
      }
    }

    if (matched > 0) {
      setAuthMode('server');
      showBanner('success', lang === 'ar' ? 'تم تطبيق نص الاتصال على الحقول' : 'Connection string applied to fields');
    } else {
      showBanner('error', lang === 'ar' ? 'لم يتم التعرف على حقول نص الاتصال' : 'Could not recognize connection string parameters');
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const res = await apiFetch('/api/admin/database/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload())
      });
      const data: MySqlTestResult = await res.json();
      setLiveStatus(data);
      showBanner(data.connected ? 'success' : 'error', data.message);
    } catch {
      showBanner('error', lang === 'ar' ? 'فشل اختبار الاتصال بخادم MySQL.' : 'Failed to test MySQL connection.');
    } finally {
      setTesting(false);
    }
  };

  const handleConnectAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnecting(true);
    try {
      const res = await apiFetch('/api/admin/database/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...buildPayload(),
          initialSyncMode
        })
      });
      const data = await res.json();
      if (data.config) setConfig(data.config);
      if (data.testResult) setLiveStatus(data.testResult);

      if (res.ok && data.success) {
        if (data.config?.hasPassword) setPassword('__UNCHANGED__');
        showBanner(
          'success',
          data.message ||
            (lang === 'ar'
              ? 'تم الاتصال بقاعدة بيانات MySQL مباشرة بنجاح'
              : 'Connected directly to MySQL successfully')
        );
        if (initialSyncMode === 'pull' || initialSyncMode === 'auto') {
          onDataPulledFromMySql?.();
        }
      } else {
        showBanner(
          'error',
          data.message ||
            (lang === 'ar' ? 'تعذر الاتصال بقاعدة بيانات MySQL' : 'Failed to connect to MySQL database')
        );
      }
    } catch {
      showBanner('error', lang === 'ar' ? 'حدث خطأ أثناء الاتصال بقاعدة البيانات.' : 'Error connecting to MySQL database.');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await apiFetch('/api/admin/database/disconnect', {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok && data.config) {
        setConfig(data.config);
        setLiveStatus(null);
        showBanner(
          'success',
          data.message ||
            (lang === 'ar' ? 'تم فصل الاتصال المباشر بـ MySQL' : 'Direct MySQL connection disabled')
        );
      }
    } catch {
      showBanner('error', lang === 'ar' ? 'تعذر قطع الاتصال.' : 'Failed to disconnect MySQL.');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSyncAction = async (action: 'init-schema' | 'push' | 'pull') => {
    setSyncingAction(action);
    try {
      const res = await apiFetch('/api/admin/database/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...buildPayload(),
          action
        })
      });
      const data = await res.json();
      if (data.config) setConfig(data.config);
      if (data.testResult) setLiveStatus(data.testResult);

      if (res.ok && data.success) {
        showBanner('success', data.message);
        if (action === 'pull') {
          onDataPulledFromMySql?.();
        }
      } else {
        showBanner('error', data.message || (lang === 'ar' ? 'فشلت عملية المزامنة مع MySQL.' : 'MySQL sync operation failed.'));
      }
    } catch {
      showBanner('error', lang === 'ar' ? 'تعذر تنفيذ المزامنة مع MySQL.' : 'Failed to execute MySQL sync.');
    } finally {
      setSyncingAction(null);
    }
  };

  if (!isAdminAccount) {
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
            ? 'إدارة الاتصال المباشر بقاعدة بيانات MySQL متاحة حصرياً لحساب مدير النظام.'
            : 'Direct MySQL database connection settings are strictly restricted to the primary Admin account.'}
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <span className="text-sm font-medium">
          {lang === 'ar' ? 'جاري تحميل إعدادات قاعدة بيانات MySQL...' : 'Loading MySQL connection configuration...'}
        </span>
      </div>
    );
  }

  const isConnectedLive = Boolean(config?.enabled && liveStatus?.connected);
  const tableRowsMap = liveStatus?.tableRowCounts || {};
  const tablesList = expectedTables.length > 0 ? expectedTables : Object.keys(TABLE_DESCRIPTIONS);
  const activePortDisplay = authMode === 'local' ? '3306' : port || '3306';
  const activeTargetText = `${host.trim() || 'localhost'}:${activePortDisplay} (${database.trim() || 'pmo_portfolio_db'})`;

  return (
    <div className="max-w-xl mx-auto py-4 space-y-5">
      {/* Main Clean Connection Card matching reference screenshot */}
      <form
        onSubmit={handleConnectAndSave}
        className="bg-white border border-indigo-400 rounded-2xl p-6 shadow-xs space-y-5"
      >
        {/* Card Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-indigo-600 shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-bold text-slate-900">
                  {lang === 'ar' ? 'خادم MySQL' : 'MySQL Server'}
                </h1>
                {config?.enabled && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wide bg-indigo-600 text-white">
                    {lang === 'ar' ? 'نشط' : 'ACTIVE'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {lang === 'ar'
                  ? 'المشغّل: mysql2 (MySQL 8.x) • مصادقة الخادم واتصال محلي مباشر'
                  : 'Driver: mysql2 (MySQL 8.x) • Server Auth & Local MySQL'}
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold shrink-0 ${
              isConnectedLive
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : config?.enabled
                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {isConnectedLive
              ? lang === 'ar'
                ? 'متصل'
                : 'Online'
              : config?.enabled
              ? lang === 'ar'
                ? 'غير قابل للوصول'
                : 'Unreachable'
              : lang === 'ar'
              ? 'غير متصل'
              : 'Offline'}
          </span>
        </div>

        {/* Inner Gray Configuration Panel */}
        <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
          {/* Authentication / Connection Mode Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              {lang === 'ar' ? 'وضع المصادقة والاتصال:' : 'Authentication Mode:'}
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleSelectAuthMode('server')}
                className={`px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center border ${
                  authMode === 'server'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {lang === 'ar' ? 'مصادقة خادم MySQL' : 'MySQL Server Auth'}
              </button>

              <button
                type="button"
                onClick={() => handleSelectAuthMode('local')}
                className={`px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center border leading-tight ${
                  authMode === 'local'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span>{lang === 'ar' ? 'MySQL محلي' : 'Local MySQL'}</span>
                <span className="block text-[11px] font-medium opacity-90">
                  {lang === 'ar' ? '(localhost:3306)' : '(localhost:3306)'}
                </span>
              </button>
            </div>
          </div>

          {/* Instance / Host Field */}
          {authMode === 'local' ? (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                {lang === 'ar' ? 'عنوان خادم MySQL المحلي:' : 'MySQL Host / Local Instance:'}
              </label>
              <input
                type="text"
                required
                dir="ltr"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="localhost"
                className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500"
              />
              <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                {lang === 'ar'
                  ? 'مثال: localhost أو 127.0.0.1 (يستخدم المنفذ الافتراضي 3306)'
                  : 'Example: localhost or 127.0.0.1 (Uses default port 3306)'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  {lang === 'ar' ? 'عنوان الخادم (Host):' : 'Host / Server:'}
                </label>
                <input
                  type="text"
                  required
                  dir="ltr"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="localhost"
                  className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  {lang === 'ar' ? 'المنفذ (Port):' : 'Port:'}
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={65535}
                  dir="ltr"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="3306"
                  className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Database Name */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {lang === 'ar' ? 'اسم قاعدة البيانات:' : 'Database Name:'}
            </label>
            <input
              type="text"
              required
              dir="ltr"
              value={database}
              onChange={(e) => setDatabase(e.target.value)}
              placeholder="pmo_portfolio_db"
              className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500"
            />
          </div>

          {/* Credentials (Username & Password) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                {lang === 'ar' ? 'اسم المستخدم:' : 'Username:'}
              </label>
              <input
                type="text"
                required
                dir="ltr"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="root"
                className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                {lang === 'ar' ? 'كلمة المرور:' : 'Password:'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  dir="ltr"
                  value={password === '__UNCHANGED__' ? '' : password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    password === '__UNCHANGED__'
                      ? lang === 'ar'
                        ? 'محفوظة'
                        : 'Saved (type to change)'
                      : '••••••••'
                  }
                  className="w-full px-3.5 pe-10 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 end-0 px-3 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {authMode === 'server' && (
            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-slate-700 pt-0.5">
              <input
                type="checkbox"
                checked={ssl}
                onChange={(e) => setSsl(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>{lang === 'ar' ? 'تفعيل تشفير SSL/TLS للخادم البعيد' : 'Require SSL/TLS encryption'}</span>
            </label>
          )}

          {/* Indigo Info Callout Box matching screenshot */}
          <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3.5 text-xs text-indigo-700 leading-relaxed">
            {authMode === 'local' ? (
              <>
                <strong className="font-semibold text-indigo-800">
                  {lang === 'ar' ? 'اتصال MySQL المحلي: ' : 'Local MySQL Connection: '}
                </strong>
                {lang === 'ar'
                  ? 'يتصل مباشرة بخادم MySQL 8.x المحلي على المنفذ 3306، وينشئ قاعدة البيانات والجداول تلقائياً مع مزامنة فورية للبيانات.'
                  : 'Connects directly to your local MySQL 8.x instance on port 3306, auto-creates the schema if needed, and syncs appsettings.json.'}
              </>
            ) : (
              <>
                <strong className="font-semibold text-indigo-800">
                  {lang === 'ar' ? 'مصادقة خادم MySQL: ' : 'MySQL Server Authentication: '}
                </strong>
                {lang === 'ar'
                  ? 'يتصل عبر TCP/IP بأي خادم MySQL محلي أو سحابي باستخدام اسم المستخدم وكلمة المرور مع تهيئة تلقائية للجداول.'
                  : 'Connects directly via TCP/IP to any remote or cloud MySQL server using your credentials and automatically maintains the PMO schema.'}
              </>
            )}
          </div>

          {/* Live Test / Connection Feedback */}
          {(liveStatus?.message || config?.lastError) && (
            <div
              className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs ${
                liveStatus?.connected
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {liveStatus?.connected ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              )}
              <div className="space-y-0.5">
                <div className="font-semibold">{liveStatus?.message || config?.lastError}</div>
                {liveStatus?.serverVersion && (
                  <div className="text-[11px] opacity-80 font-mono tabular-nums">
                    MySQL {liveStatus.serverVersion} · {liveStatus.latencyMs} ms
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Hairline Active Target Footer */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3 text-xs">
            <span className="text-slate-500">
              {lang === 'ar' ? 'الهدف النشط:' : 'Active Target:'}
            </span>
            <span className="font-mono font-semibold text-slate-900 tabular-nums truncate" dir="ltr">
              {activeTargetText}
            </span>
          </div>
        </div>

        {/* Bottom Primary Buttons matching screenshot */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <button
              type="submit"
              disabled={connecting || testing}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{lang === 'ar' ? 'حفظ واتصال MySQL' : 'Save MySQL'}</span>
            </button>

            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing || connecting}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span>{lang === 'ar' ? 'اختبار MySQL' : 'Test MySQL'}</span>
            </button>
          </div>

          {config?.enabled && (
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unplug className="w-3.5 h-3.5" />}
              <span>{lang === 'ar' ? 'قطع الاتصال' : 'Disconnect'}</span>
            </button>
          )}
        </div>
      </form>

      {/* Collapsible Advanced Sync & Table Inspector */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <button
          type="button"
          onClick={() => setShowAdvanced((prev) => !prev)}
          aria-expanded={showAdvanced}
          className="w-full px-5 py-3.5 flex items-center justify-between text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <span>
            {lang === 'ar'
              ? `خيارات متقدمة وفحص الجداول (${tablesList.length})`
              : `Advanced Sync Options & Table Inspector (${tablesList.length})`}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-slate-500 transition-transform ${
              showAdvanced ? 'rotate-180' : ''
            }`}
          />
        </button>

        {showAdvanced && (
          <div className="p-5 border-t border-slate-100 space-y-5">
            {/* Quick Import Connection String */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                {lang === 'ar'
                  ? 'استيراد من نص الاتصال (اختياري)'
                  : 'Import from Connection String (Optional)'}
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={connectionStringInput}
                  onChange={(e) => setConnectionStringInput(e.target.value)}
                  dir="ltr"
                  placeholder="Server=localhost;Port=3306;Database=pmo_portfolio_db;User=root;Password=root;"
                  className="flex-1 px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleParseConnectionString}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer shrink-0"
                >
                  {lang === 'ar' ? 'تطبيق' : 'Apply'}
                </button>
              </div>
            </div>

            {/* Sync Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {lang === 'ar' ? 'استراتيجية المزامنة عند الحفظ' : 'Initial Sync on Save'}
                </label>
                <select
                  value={initialSyncMode}
                  onChange={(e) => setInitialSyncMode(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500"
                >
                  <option value="auto">
                    {lang === 'ar'
                      ? 'تلقائي (سحب إن وُجدت بيانات، وإلا دفع)'
                      : 'Auto (Pull if DB has rows, else Push)'}
                  </option>
                  <option value="push">
                    {lang === 'ar' ? 'دفع بيانات النظام إلى MySQL' : 'Push app data → MySQL'}
                  </option>
                  <option value="pull">
                    {lang === 'ar' ? 'سحب البيانات من MySQL' : 'Pull MySQL → app'}
                  </option>
                  <option value="schema-only">
                    {lang === 'ar' ? 'تهيئة الجداول فقط' : 'Initialize schema only'}
                  </option>
                </select>
              </div>

              <div className="flex flex-col justify-end gap-2">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={autoCreateSchema}
                    onChange={(e) => setAutoCreateSchema(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>
                    {lang === 'ar' ? 'إنشاء قاعدة البيانات والجداول تلقائياً' : 'Auto-create database & tables'}
                  </span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={autoSync}
                    onChange={(e) => setAutoSync(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>
                    {lang === 'ar' ? 'مزامنة تلقائية عند كل تعديل' : 'Live write-through sync on every save'}
                  </span>
                </label>
              </div>
            </div>

            {/* Manual Sync Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleSyncAction('init-schema')}
                disabled={syncingAction !== null}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                {syncingAction === 'init-schema' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Wrench className="w-3.5 h-3.5 text-slate-600" />
                )}
                <span>{lang === 'ar' ? 'تهيئة الجداول' : 'Initialize Schema'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleSyncAction('push')}
                disabled={syncingAction !== null}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                {syncingAction === 'push' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5 text-indigo-600" />
                )}
                <span>{lang === 'ar' ? 'دفع إلى MySQL' : 'Push → MySQL'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleSyncAction('pull')}
                disabled={syncingAction !== null}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                {syncingAction === 'pull' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                )}
                <span>{lang === 'ar' ? 'سحب من MySQL' : 'Pull MySQL → App'}</span>
              </button>
            </div>

            {/* Table Row Inspector */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-start border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                    <th className="py-2.5 px-4 text-start">{lang === 'ar' ? 'الجدول' : 'Table'}</th>
                    <th className="py-2.5 px-4 text-end">{lang === 'ar' ? 'السجلات' : 'Rows'}</th>
                    <th className="py-2.5 px-4 text-end">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tablesList.map((tbl) => {
                    const existsInDb = Object.prototype.hasOwnProperty.call(tableRowsMap, tbl);
                    const count = tableRowsMap[tbl];
                    return (
                      <tr key={tbl} className="hover:bg-slate-50/70">
                        <td className="py-2 px-4 font-mono font-semibold text-slate-800">{tbl}</td>
                        <td className="py-2 px-4 text-end font-mono tabular-nums text-slate-700">
                          {existsInDb ? count : '—'}
                        </td>
                        <td className="py-2 px-4 text-end font-semibold">
                          {liveStatus?.connected ? (
                            existsInDb ? (
                              <span className="text-emerald-700">{lang === 'ar' ? 'جاهز' : 'Ready'}</span>
                            ) : (
                              <span className="text-amber-700">{lang === 'ar' ? 'معلق' : 'Pending'}</span>
                            )
                          ) : (
                            <span className="text-slate-400">{lang === 'ar' ? 'غير متصل' : 'Offline'}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
