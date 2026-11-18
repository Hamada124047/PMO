import sql from 'mssql';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const SQLSERVER_CONFIG_FILE = path.resolve(process.cwd(), 'database', 'sqlserver_config.json');
const DOTNET_APPSETTINGS_FILE = path.resolve(
  process.cwd(),
  'backend',
  'PmoSystem.Api',
  'appsettings.json'
);

export interface SqlServerConnectionConfig {
  enabled: boolean;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  authMode: 'windows' | 'sql';
  trustedConnection: boolean;
  ssl: boolean;
  autoSync: boolean;
  autoCreateSchema: boolean;
  lastConnectedAt?: string | null;
  lastSyncAt?: string | null;
  lastError?: string | null;
  serverVersion?: string | null;
}

export interface SqlServerPublicConfig {
  enabled: boolean;
  host: string;
  port: number;
  database: string;
  username: string;
  hasPassword: boolean;
  authMode: 'windows' | 'sql';
  trustedConnection: boolean;
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

export interface SqlServerTestResult {
  connected: boolean;
  latencyMs: number;
  serverVersion: string | null;
  databaseExists: boolean;
  tables: string[];
  tableRowCounts: Record<string, number>;
  message: string;
  errorCode?: string;
}

export const CORE_SQL_TABLES = [
  'Roles',
  'Users',
  'Departments',
  'Portfolios',
  'Initiatives',
  'Projects',
  'Workstreams',
  'Milestones',
  'Activities',
  'TaskDependencies',
  'StrategicPlans',
  'StrategicInitiatives',
  'StrategicActivities',
  'AdminSystemSettingsStore'
] as const;

export function isLocalDbOrNamedPipeServer(server: string): boolean {
  const s = String(server || '').trim();
  return (
    /^\(localdb\)/i.test(s) ||
    /^np:/i.test(s) ||
    s.includes('\\')
  );
}

export function parseSqlServerConnectionString(raw: string): Partial<SqlServerConnectionConfig> {
  const trimmed = (raw || '').trim();
  if (!trimmed) return {};

  // URI format: mssql://user:pass@host:1433/db or sqlserver://...
  if (/^(mssql|sqlserver):\/\//i.test(trimmed)) {
    try {
      const normalizedUrl = trimmed.replace(/^(mssql|sqlserver):\/\//i, 'http://');
      const u = new URL(normalizedUrl);
      const encryptParam = u.searchParams.get('encrypt') || u.searchParams.get('ssl');
      const trustedParam =
        u.searchParams.get('trusted_connection') ||
        u.searchParams.get('trustedconnection') ||
        u.searchParams.get('integratedsecurity');
      const isTrusted =
        trustedParam !== null
          ? ['true', 'yes', 'sspi', '1'].includes(trustedParam.toLowerCase())
          : !u.username;
      return {
        host: decodeURIComponent(u.hostname || '(localdb)\\MSSQLLocalDB'),
        port: u.port ? Number(u.port) : 1433,
        database: u.pathname ? decodeURIComponent(u.pathname.replace(/^\/+/, '')) : 'PMO Agile',
        username: decodeURIComponent(u.username || ''),
        password: decodeURIComponent(u.password || ''),
        authMode: isTrusted ? 'windows' : 'sql',
        trustedConnection: isTrusted,
        ssl: encryptParam ? encryptParam.toLowerCase() === 'true' : false
      };
    } catch {
      return {};
    }
  }

  // ADO.NET key=value; format:
  // Server=(localdb)\MSSQLLocalDB;Database=PMO Agile;Trusted_Connection=True;
  const parts = trimmed.split(';').map((p) => p.trim()).filter(Boolean);
  const result: Partial<SqlServerConnectionConfig> = {};
  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim().toLowerCase();
    const val = part.slice(eqIdx + 1).trim();
    if (['server', 'host', 'data source', 'datasource', 'addr', 'address'].includes(key)) {
      let hostVal = val;
      if (hostVal.includes(',') && !hostVal.startsWith('(')) {
        const commaIdx = hostVal.lastIndexOf(',');
        const maybePort = Number(hostVal.slice(commaIdx + 1).trim());
        if (Number.isFinite(maybePort) && maybePort > 0) {
          result.port = maybePort;
          hostVal = hostVal.slice(0, commaIdx).trim();
        }
      }
      result.host = hostVal;
    } else if (['port'].includes(key)) {
      const num = Number(val);
      if (Number.isFinite(num) && num > 0) result.port = num;
    } else if (['database', 'initial catalog', 'db'].includes(key)) {
      result.database = val;
    } else if (['user', 'uid', 'user id', 'username'].includes(key)) {
      result.username = val;
    } else if (['password', 'pwd', 'pass'].includes(key)) {
      result.password = val;
    } else if (['trusted_connection', 'trusted connection', 'integrated security', 'integratedsecurity'].includes(key)) {
      const isWin = ['true', 'yes', 'sspi', '1'].includes(val.toLowerCase());
      result.trustedConnection = isWin;
      result.authMode = isWin ? 'windows' : 'sql';
    } else if (['encrypt', 'ssl', 'sslmode'].includes(key)) {
      result.ssl = ['true', 'yes', 'required', 'require', '1'].includes(val.toLowerCase());
    }
  }

  if (result.authMode === undefined && result.trustedConnection === undefined) {
    if (isLocalDbOrNamedPipeServer(result.host || '') && !result.username) {
      result.authMode = 'windows';
      result.trustedConnection = true;
    } else if (result.username) {
      result.authMode = 'sql';
      result.trustedConnection = false;
    }
  }
  return result;
}

function readDefaultFromDotnetAppsettings(): Partial<SqlServerConnectionConfig> {
  try {
    if (fs.existsSync(DOTNET_APPSETTINGS_FILE)) {
      const json = JSON.parse(fs.readFileSync(DOTNET_APPSETTINGS_FILE, 'utf-8'));
      const connStr = json?.ConnectionStrings?.DefaultConnection;
      if (typeof connStr === 'string' && connStr.trim()) {
        return parseSqlServerConnectionString(connStr);
      }
    }
  } catch {
    // Ignore malformed appsettings
  }
  return {};
}

export function buildDotnetConnectionString(cfg: SqlServerConnectionConfig): string {
  const useWindowsAuth = cfg.authMode === 'windows' || cfg.trustedConnection;
  if (useWindowsAuth) {
    return `Server=${cfg.host};Database=${cfg.database};Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true;`;
  }
  const serverTarget =
    !isLocalDbOrNamedPipeServer(cfg.host) && cfg.port && cfg.port !== 1433
      ? `${cfg.host},${cfg.port}`
      : cfg.host;
  return `Server=${serverTarget};Database=${cfg.database};User Id=${cfg.username};Password=${cfg.password};Encrypt=${cfg.ssl ? 'True' : 'False'};TrustServerCertificate=True;MultipleActiveResultSets=true;`;
}

export function syncDotnetAppsettings(cfg: SqlServerConnectionConfig): boolean {
  try {
    if (!fs.existsSync(DOTNET_APPSETTINGS_FILE)) return false;
    const raw = fs.readFileSync(DOTNET_APPSETTINGS_FILE, 'utf-8');
    const json = JSON.parse(raw);
    if (!json.ConnectionStrings) json.ConnectionStrings = {};
    json.ConnectionStrings.DefaultConnection = buildDotnetConnectionString(cfg);
    fs.writeFileSync(DOTNET_APPSETTINGS_FILE, JSON.stringify(json, null, 2) + '\n', 'utf-8');
    return true;
  } catch {
    return false;
  }
}

export function getDefaultSqlServerConfig(): SqlServerConnectionConfig {
  const fromAppsettings = readDefaultFromDotnetAppsettings();
  const host =
    process.env.SQLSERVER_HOST ||
    process.env.MSSQL_HOST ||
    fromAppsettings.host ||
    '(localdb)\\MSSQLLocalDB';
  const port = Number(process.env.SQLSERVER_PORT || process.env.MSSQL_PORT || fromAppsettings.port || 1433);
  const database =
    process.env.SQLSERVER_DATABASE ||
    process.env.MSSQL_DATABASE ||
    fromAppsettings.database ||
    'PMO Agile';
  const username =
    process.env.SQLSERVER_USER || process.env.MSSQL_USER || fromAppsettings.username || '';
  const password =
    process.env.SQLSERVER_PASSWORD !== undefined
      ? process.env.SQLSERVER_PASSWORD
      : process.env.MSSQL_PASSWORD !== undefined
      ? process.env.MSSQL_PASSWORD
      : fromAppsettings.password ?? '';

  const envAuth = (process.env.SQLSERVER_AUTH_MODE || '').toLowerCase();
  const trustedConnection =
    envAuth === 'sql'
      ? false
      : envAuth === 'windows'
      ? true
      : fromAppsettings.trustedConnection ?? true;

  return {
    enabled: process.env.SQLSERVER_ENABLED === 'true',
    host,
    port: Number.isFinite(port) && port > 0 ? port : 1433,
    database,
    username,
    password,
    authMode: trustedConnection ? 'windows' : 'sql',
    trustedConnection,
    ssl: process.env.SQLSERVER_SSL === 'true' || Boolean(fromAppsettings.ssl),
    autoSync: true,
    autoCreateSchema: true,
    lastConnectedAt: null,
    lastSyncAt: null,
    lastError: null,
    serverVersion: null
  };
}

export function normalizeSqlServerTarget(
  rawHost: string | undefined | null,
  rawPort?: number | string | null
): { host: string; port: number } {
  let host = String(rawHost ?? '').trim();
  const parsedPortNum = Number(rawPort);
  let port = Number.isFinite(parsedPortNum) && parsedPortNum > 0 ? parsedPortNum : 1433;

  // Replace stale MySQL default port 3306 if passed accidentally
  if (port === 3306) {
    port = 1433;
  }

  if (/^(mssql|sqlserver):\/\//i.test(host)) {
    try {
      const u = new URL(host.replace(/^(mssql|sqlserver):\/\//i, 'http://'));
      host = decodeURIComponent(u.hostname || '(localdb)\\MSSQLLocalDB');
      if (u.port) {
        const p = Number(u.port);
        if (Number.isFinite(p) && p > 0) port = p;
      }
      return { host, port };
    } catch {
      // fall through
    }
  }

  // Handle host,port or host:port (excluding IPv6 literals and instance paths)
  if (!isLocalDbOrNamedPipeServer(host)) {
    if (host.includes(',') && !host.startsWith('(')) {
      const idx = host.lastIndexOf(',');
      const hostPart = host.slice(0, idx).trim();
      const portPart = Number(host.slice(idx + 1).trim());
      if (hostPart) host = hostPart;
      if (Number.isFinite(portPart) && portPart > 0 && portPart <= 65535) port = portPart;
    } else if (host.includes(':') && !host.startsWith('[')) {
      const idx = host.lastIndexOf(':');
      const hostPart = host.slice(0, idx).trim();
      const portPart = Number(host.slice(idx + 1).trim());
      if (hostPart) host = hostPart;
      if (Number.isFinite(portPart) && portPart > 0 && portPart <= 65535) port = portPart;
    }
  }

  return { host: host || '(localdb)\\MSSQLLocalDB', port };
}

export function loadSqlServerConfig(): SqlServerConnectionConfig {
  const defaults = getDefaultSqlServerConfig();
  try {
    if (fs.existsSync(SQLSERVER_CONFIG_FILE)) {
      const raw = fs.readFileSync(SQLSERVER_CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      const normalized = normalizeSqlServerTarget(parsed?.host ?? defaults.host, parsed?.port ?? defaults.port);
      const authMode: 'windows' | 'sql' =
        parsed?.authMode === 'sql' || parsed?.trustedConnection === false ? 'sql' : 'windows';
      return {
        ...defaults,
        ...parsed,
        host: normalized.host,
        port: normalized.port,
        authMode,
        trustedConnection: authMode === 'windows'
      };
    }
  } catch {
    // Fallback to defaults
  }
  return defaults;
}

export function saveSqlServerConfig(cfg: SqlServerConnectionConfig): void {
  const dir = path.dirname(SQLSERVER_CONFIG_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(SQLSERVER_CONFIG_FILE, JSON.stringify(cfg, null, 2) + '\n', 'utf-8');
}

export function toPublicSqlServerConfig(cfg: SqlServerConnectionConfig): SqlServerPublicConfig {
  let dotnetSynced = false;
  try {
    if (fs.existsSync(DOTNET_APPSETTINGS_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DOTNET_APPSETTINGS_FILE, 'utf-8'));
      const current = String(raw?.ConnectionStrings?.DefaultConnection || '').toLowerCase();
      dotnetSynced =
        current.includes(`server=${cfg.host.toLowerCase()}`) &&
        current.includes(`database=${cfg.database.toLowerCase()}`);
    }
  } catch {
    dotnetSynced = false;
  }

  const isWinAuth = cfg.authMode === 'windows' || cfg.trustedConnection;
  const connectionStringPreview = isWinAuth
    ? `Server=${cfg.host};Database=${cfg.database};Trusted_Connection=True;TrustServerCertificate=True;`
    : `Server=${cfg.host}${cfg.port && cfg.port !== 1433 ? ',' + cfg.port : ''};Database=${cfg.database};User Id=${cfg.username};Password=${cfg.password ? '******' : '(empty)'};Encrypt=${cfg.ssl ? 'True' : 'False'};TrustServerCertificate=True;`;

  return {
    enabled: Boolean(cfg.enabled),
    host: cfg.host,
    port: Number(cfg.port) || 1433,
    database: cfg.database,
    username: isWinAuth ? 'Windows Authentication' : cfg.username,
    hasPassword: isWinAuth ? false : Boolean(cfg.password),
    authMode: isWinAuth ? 'windows' : 'sql',
    trustedConnection: isWinAuth,
    ssl: Boolean(cfg.ssl),
    autoSync: cfg.autoSync !== false,
    autoCreateSchema: cfg.autoCreateSchema !== false,
    lastConnectedAt: cfg.lastConnectedAt || null,
    lastSyncAt: cfg.lastSyncAt || null,
    lastError: cfg.lastError || null,
    serverVersion: cfg.serverVersion || null,
    connectionStringPreview,
    dotnetAppsettingsSynced: dotnetSynced
  };
}

function escapeBracketId(id: string): string {
  return '[' + id.replace(/\]/g, ']]') + ']';
}

function toSqlDate(val: unknown, fallback = '2026-01-01'): string {
  if (!val) return fallback;
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return val.toISOString().slice(0, 10);
  }
  const str = String(val).trim();
  const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : fallback;
}

function toSqlNullableDate(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return val.toISOString().slice(0, 10);
  }
  const str = String(val).trim();
  const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function formatDateFromRow(val: unknown, fallback = '2026-01-01'): string {
  if (!val) return fallback;
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return val.toISOString().slice(0, 10);
  }
  const str = String(val).trim();
  const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : fallback;
}

interface QueryStatement {
  sql: string;
  params?: Array<string | number | boolean | null>;
}

interface RunnerResultSet {
  recordset: Record<string, any>[];
}

function shouldUseWindowsBridge(cfg: SqlServerConnectionConfig): boolean {
  return (
    cfg.authMode === 'windows' ||
    cfg.trustedConnection ||
    isLocalDbOrNamedPipeServer(cfg.host)
  );
}

function tryLoadMsnodesqlv8Driver(): any | null {
  try {
    return require('mssql/msnodesqlv8');
  } catch {
    return null;
  }
}

async function runBatchViaWindowsSqlClient(
  connectionString: string,
  statements: QueryStatement[],
  useTransaction = false
): Promise<RunnerResultSet[]> {
  if (process.platform !== 'win32') {
    const err: any = new Error(
      'Windows Authentication / SQL Server LocalDB ((localdb)\\MSSQLLocalDB) requires Windows. Run run.bat locally on Windows or configure remote SQL Server TCP credentials.'
    );
    err.code = 'LOCALDB_REQUIRES_WINDOWS';
    throw err;
  }

  const psScript = `
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$rawInput = [Console]::In.ReadToEnd()
$payload = $rawInput | ConvertFrom-Json
Add-Type -AssemblyName System.Data
$conn = New-Object System.Data.SqlClient.SqlConnection($payload.connectionString)
$results = @()
$tx = $null
try {
  $conn.Open()
  if ($payload.useTransaction) {
    $tx = $conn.BeginTransaction()
  }
  foreach ($stmt in $payload.statements) {
    $cmd = $conn.CreateCommand()
    $cmd.CommandTimeout = 30
    if ($tx -ne $null) { $cmd.Transaction = $tx }
    $cmd.CommandText = [string]$stmt.sql
    if ($stmt.params -ne $null) {
      for ($i = 0; $i -lt $stmt.params.Count; $i++) {
        $pVal = $stmt.params[$i]
        $param = $cmd.Parameters.Add("@p$i", [System.Data.SqlDbType]::NVarChar, -1)
        if ($null -eq $pVal) {
          $param.Value = [System.DBNull]::Value
        } else {
          if ($pVal -is [bool]) {
            $cmd.Parameters.Remove($param) | Out-Null
            $cmd.Parameters.AddWithValue("@p$i", [bool]$pVal) | Out-Null
          } elseif ($pVal -is [int] -or $pVal -is [long]) {
            $cmd.Parameters.Remove($param) | Out-Null
            $cmd.Parameters.AddWithValue("@p$i", $pVal) | Out-Null
          } elseif ($pVal -is [double] -or $pVal -is [decimal]) {
            $cmd.Parameters.Remove($param) | Out-Null
            $cmd.Parameters.AddWithValue("@p$i", [decimal]$pVal) | Out-Null
          } else {
            $param.Value = [string]$pVal
          }
        }
      }
    }
    $reader = $cmd.ExecuteReader()
    $rows = @()
    while ($reader.Read()) {
      $obj = [ordered]@{}
      for ($c = 0; $c -lt $reader.FieldCount; $c++) {
        $name = $reader.GetName($c)
        if ($reader.IsDBNull($c)) {
          $obj[$name] = $null
        } else {
          $val = $reader.GetValue($c)
          if ($val -is [DateTime]) {
            $obj[$name] = $val.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
          } else {
            $obj[$name] = $val
          }
        }
      }
      $rows += $obj
    }
    $reader.Close()
    $results += ,@{ recordset = $rows }
  }
  if ($tx -ne $null) { $tx.Commit() }
  [ordered]@{ ok = $true; results = $results } | ConvertTo-Json -Depth 10 -Compress
} catch {
  if ($tx -ne $null) {
    try { $tx.Rollback() } catch {}
  }
  $sqlNum = 0
  if ($_.Exception.InnerException -is [System.Data.SqlClient.SqlException]) {
    $sqlNum = $_.Exception.InnerException.Number
  } elseif ($_.Exception -is [System.Data.SqlClient.SqlException]) {
    $sqlNum = $_.Exception.Number
  }
  [ordered]@{
    ok = $false
    error = $_.Exception.Message
    number = $sqlNum
  } | ConvertTo-Json -Depth 5 -Compress
} finally {
  if ($conn.State -eq [System.Data.ConnectionState]::Open) {
    $conn.Close()
  }
}
`;

  const encodedCommand = Buffer.from(psScript, 'utf16le').toString('base64');
  const inputJson = JSON.stringify({
    connectionString,
    useTransaction,
    statements: statements.map((s) => ({
      sql: s.sql,
      params: s.params ?? []
    }))
  });

  return await new Promise<RunnerResultSet[]>((resolve, reject) => {
    const child = execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-EncodedCommand', encodedCommand],
      { maxBuffer: 64 * 1024 * 1024, timeout: 30000 },
      (err, stdout, stderr) => {
        if (err && !stdout.trim()) {
          reject(new Error(stderr?.trim() || err.message));
          return;
        }
        try {
          const parsed = JSON.parse(stdout.trim() || '{}');
          if (!parsed.ok) {
            const sqlErr: any = new Error(parsed.error || stderr || 'SQL Server execution error.');
            sqlErr.number = parsed.number;
            reject(sqlErr);
            return;
          }
          const rawResults = Array.isArray(parsed.results) ? parsed.results : [];
          resolve(
            rawResults.map((r: any) => ({
              recordset: Array.isArray(r?.recordset) ? r.recordset : []
            }))
          );
        } catch (parseErr: any) {
          reject(new Error(stderr?.trim() || parseErr?.message || 'Failed to parse SQL Server response.'));
        }
      }
    );
    if (child.stdin) {
      child.stdin.write(inputJson, 'utf-8');
      child.stdin.end();
    }
  });
}

function buildSqlConnConfigForNodeDriver(
  cfg: SqlServerConnectionConfig,
  databaseName: string
): sql.config {
  const isWinAuth = cfg.authMode === 'windows' || cfg.trustedConnection;
  return {
    server: cfg.host,
    port: isLocalDbOrNamedPipeServer(cfg.host) ? undefined : Number(cfg.port) || 1433,
    database: databaseName,
    user: isWinAuth ? undefined : cfg.username,
    password: isWinAuth ? undefined : cfg.password,
    connectionTimeout: 6000,
    requestTimeout: 30000,
    options: {
      encrypt: Boolean(cfg.ssl),
      trustServerCertificate: true,
      enableArithAbort: true,
      trustedConnection: isWinAuth
    }
  };
}

async function runBatchOnDatabase(
  cfg: SqlServerConnectionConfig,
  databaseName: string,
  statements: QueryStatement[],
  useTransaction = false
): Promise<RunnerResultSet[]> {
  if (shouldUseWindowsBridge(cfg)) {
    const msnodesql = tryLoadMsnodesqlv8Driver();
    if (msnodesql) {
      const pool = new msnodesql.ConnectionPool({
        ...buildSqlConnConfigForNodeDriver(cfg, databaseName),
        driver: 'msnodesqlv8'
      });
      await pool.connect();
      try {
        const results: RunnerResultSet[] = [];
        const tx = useTransaction ? new msnodesql.Transaction(pool) : null;
        if (tx) await tx.begin();
        try {
          for (const stmt of statements) {
            const req = tx ? new msnodesql.Request(tx) : pool.request();
            (stmt.params || []).forEach((val, idx) => {
              req.input(`p${idx}`, val === undefined ? null : val);
            });
            const res = await req.query(stmt.sql);
            results.push({ recordset: res.recordset || [] });
          }
          if (tx) await tx.commit();
          return results;
        } catch (txErr) {
          if (tx) await tx.rollback().catch(() => undefined);
          throw txErr;
        }
      } finally {
        await pool.close().catch(() => undefined);
      }
    }

    const dotnetStr = buildDotnetConnectionString({
      ...cfg,
      database: databaseName
    });
    return await runBatchViaWindowsSqlClient(dotnetStr, statements, useTransaction);
  }

  // Pure-JS tedious (TCP/IP SQL Auth)
  const pool = new sql.ConnectionPool(buildSqlConnConfigForNodeDriver(cfg, databaseName));
  await pool.connect();
  try {
    const results: RunnerResultSet[] = [];
    const tx = useTransaction ? new sql.Transaction(pool) : null;
    if (tx) await tx.begin();
    try {
      for (const stmt of statements) {
        const req = tx ? new sql.Request(tx) : pool.request();
        (stmt.params || []).forEach((val, idx) => {
          req.input(`p${idx}`, val === undefined ? null : val);
        });
        const res = await req.query(stmt.sql);
        results.push({ recordset: res.recordset || [] });
      }
      if (tx) await tx.commit();
      return results;
    } catch (txErr) {
      if (tx) await tx.rollback().catch(() => undefined);
      throw txErr;
    }
  } finally {
    await pool.close().catch(() => undefined);
  }
}

function mapSqlServerError(err: any, cfg: SqlServerConnectionConfig): string {
  const code = String(err?.code || '');
  const msg = String(err?.message || '');
  const num = Number(err?.number || 0);

  if (code === 'LOCALDB_REQUIRES_WINDOWS') {
    const isWinAuth = cfg.authMode === 'windows' || cfg.trustedConnection;
    return `Cannot connect to ${cfg.host} (${isWinAuth ? 'Windows Authentication' : 'SQL Server Auth'}) from the Linux cloud preview because Microsoft SQL Server LocalDB runs locally on Windows. Run run.bat on your Windows PC to connect directly to ${cfg.host} / "${cfg.database}".`;
  }
  if (num === 18456 || /Login failed/i.test(msg)) {
    return `Authentication failed for database "${cfg.database}" on "${cfg.host}". Verify Windows Authentication permissions or SQL Server credentials.`;
  }
  if (num === 4060 || /Cannot open database/i.test(msg)) {
    return `Database "${cfg.database}" does not exist yet on "${cfg.host}". Enable "Auto-create database & tables" or click Initialize Schema.`;
  }
  if (
    code === 'ESOCKET' ||
    code === 'ECONNREFUSED' ||
    code === 'ETIMEOUT' ||
    num === -1 ||
    num === 2 ||
    num === 53 ||
    /instance failure|named pipes|network-related|error locating server/i.test(msg)
  ) {
    if (isLocalDbOrNamedPipeServer(cfg.host)) {
      return `Could not reach SQL Server LocalDB instance "${cfg.host}". Make sure SQL Server LocalDB is installed and started (run: sqllocaldb start MSSQLLocalDB).`;
    }
    return `Could not connect to SQL Server at ${cfg.host}:${cfg.port}. Verify SQL Server TCP/IP is enabled, firewall allows port ${cfg.port}, and the service is running.`;
  }
  return msg || 'Unable to connect to Microsoft SQL Server.';
}

export async function testSqlServerConnection(
  cfg: SqlServerConnectionConfig
): Promise<SqlServerTestResult> {
  const started = Date.now();
  try {
    const [verRes, dbRes] = await runBatchOnDatabase(cfg, 'master', [
      { sql: "SELECT CAST(SERVERPROPERTY('ProductVersion') AS NVARCHAR(100)) AS version, CAST(SERVERPROPERTY('Edition') AS NVARCHAR(150)) AS edition" },
      { sql: 'SELECT name FROM sys.databases WHERE name = @p0', params: [cfg.database] }
    ]);

    const rawVer = verRes?.recordset?.[0]?.version ? String(verRes.recordset[0].version) : '';
    const edition = verRes?.recordset?.[0]?.edition ? String(verRes.recordset[0].edition) : '';
    const serverVersion = [rawVer, edition].filter(Boolean).join(' · ') || null;
    const databaseExists = (dbRes?.recordset?.length || 0) > 0;

    const tables: string[] = [];
    const tableRowCounts: Record<string, number> = {};

    if (databaseExists) {
      const [tblRes] = await runBatchOnDatabase(cfg, cfg.database, [
        {
          sql: "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = 'dbo' ORDER BY TABLE_NAME"
        }
      ]);
      for (const r of tblRes?.recordset || []) {
        const tblName = String(r.TABLE_NAME || Object.values(r)[0]);
        tables.push(tblName);
      }

      const countStmts: QueryStatement[] = [];
      const countKeys: string[] = [];
      for (const expectedTbl of CORE_SQL_TABLES) {
        const matched = tables.find((t) => t.toLowerCase() === expectedTbl.toLowerCase());
        if (matched) {
          countKeys.push(expectedTbl);
          countStmts.push({
            sql: `SELECT COUNT(*) AS cnt FROM [dbo].${escapeBracketId(matched)}`
          });
        }
      }
      if (countStmts.length > 0) {
        const countResults = await runBatchOnDatabase(cfg, cfg.database, countStmts);
        countResults.forEach((res, idx) => {
          tableRowCounts[countKeys[idx]] = Number(res?.recordset?.[0]?.cnt || 0);
        });
      }
    }

    const latencyMs = Date.now() - started;
    return {
      connected: true,
      latencyMs,
      serverVersion,
      databaseExists,
      tables,
      tableRowCounts,
      message: databaseExists
        ? `Connected to SQL Server ${serverVersion || ''} (${cfg.database}, ${tables.length} tables) in ${latencyMs} ms.`
        : `Connected to SQL Server ${serverVersion || ''}, but database "${cfg.database}" has not been created yet.`
    };
  } catch (err: any) {
    return {
      connected: false,
      latencyMs: Date.now() - started,
      serverVersion: null,
      databaseExists: false,
      tables: [],
      tableRowCounts: {},
      message: mapSqlServerError(err, cfg),
      errorCode: err?.code || (err?.number ? `MSSQL_${err.number}` : 'SQLSERVER_CONNECTION_ERROR')
    };
  }
}

export async function initializeSqlServerSchema(cfg: SqlServerConnectionConfig): Promise<void> {
  // 1. Ensure database exists in master
  const dbBracket = escapeBracketId(cfg.database);
  await runBatchOnDatabase(cfg, 'master', [
    {
      sql: `IF DB_ID(@p0) IS NULL CREATE DATABASE ${dbBracket};`,
      params: [cfg.database]
    }
  ]);

  // 2. Create all 14 tables and upgrade missing columns idempotently in target database
  const ddlStatements: QueryStatement[] = [
    {
      sql: `
      IF OBJECT_ID(N'[dbo].[Roles]', N'U') IS NULL
      BEGIN
        CREATE TABLE [dbo].[Roles] (
          [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          [Name] NVARCHAR(100) NOT NULL,
          [Description] NVARCHAR(500) NULL,
          [DescriptionAr] NVARCHAR(500) NULL,
          CONSTRAINT [UQ_Roles_Name] UNIQUE ([Name])
        );
      END`
    },
    {
      sql: `
      IF OBJECT_ID(N'[dbo].[Users]', N'U') IS NULL
      BEGIN
        CREATE TABLE [dbo].[Users] (
          [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          [FullName] NVARCHAR(150) NOT NULL,
          [FullNameAr] NVARCHAR(150) NULL,
          [Email] NVARCHAR(150) NOT NULL,
          [Username] NVARCHAR(100) NOT NULL,
          [PasswordHash] NVARCHAR(255) NOT NULL,
          [RoleId] INT NOT NULL,
          [IsActive] BIT NOT NULL CONSTRAINT [DF_Users_IsActive] DEFAULT (1),
          [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_Users_CreatedAt] DEFAULT (SYSUTCDATETIME()),
          CONSTRAINT [UQ_Users_Username] UNIQUE ([Username]),
          CONSTRAINT [UQ_Users_Email] UNIQUE ([Email]),
          CONSTRAINT [FK_Users_Roles_RoleId] FOREIGN KEY ([RoleId]) REFERENCES [dbo].[Roles] ([Id]) ON DELETE NO ACTION
        );
      END`
    },
    {
      sql: `
      IF OBJECT_ID(N'[dbo].[Departments]', N'U') IS NULL
      BEGIN
        CREATE TABLE [dbo].[Departments] (
          [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          [Name] NVARCHAR(150) NOT NULL,
          [NameAr] NVARCHAR(150) NULL,
          [Description] NVARCHAR(1000) NULL,
          [DescriptionAr] NVARCHAR(1000) NULL,
          [ManagerId] INT NULL,
          [ResponsibleManagerId] INT NULL,
          [IsActive] BIT NOT NULL CONSTRAINT [DF_Departments_IsActive] DEFAULT (1),
          [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_Departments_CreatedAt] DEFAULT (SYSUTCDATETIME()),
          CONSTRAINT [UQ_Departments_Name] UNIQUE ([Name])
        );
      END`
    },
    {
      sql: `
      IF OBJECT_ID(N'[dbo].[Portfolios]', N'U') IS NULL
      BEGIN
        CREATE TABLE [dbo].[Portfolios] (
          [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          [Name] NVARCHAR(200) NOT NULL,
          [NameAr] NVARCHAR(200) NULL,
          [Description] NVARCHAR(1500) NULL,
          [DescriptionAr] NVARCHAR(1500) NULL,
          [DepartmentId] INT NULL,
          [OwnerId] INT NULL,
          [StartDate] DATE NOT NULL,
          [EndDate] DATE NOT NULL,
          [TargetDate] DATE NULL,
          [Status] NVARCHAR(50) NOT NULL CONSTRAINT [DF_Portfolios_Status] DEFAULT (N'Active'),
          [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_Portfolios_CreatedAt] DEFAULT (SYSUTCDATETIME()),
          CONSTRAINT [FK_Portfolios_Departments_DepartmentId] FOREIGN KEY ([DepartmentId]) REFERENCES [dbo].[Departments] ([Id]) ON DELETE SET NULL,
          CONSTRAINT [FK_Portfolios_Users_OwnerId] FOREIGN KEY ([OwnerId]) REFERENCES [dbo].[Users] ([Id]) ON DELETE SET NULL
        );
      END`
    },
    {
      sql: `
      IF OBJECT_ID(N'[dbo].[Initiatives]', N'U') IS NULL
      BEGIN
        CREATE TABLE [dbo].[Initiatives] (
          [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          [Name] NVARCHAR(200) NOT NULL,
          [NameAr] NVARCHAR(200) NULL,
          [Description] NVARCHAR(1500) NULL,
          [DescriptionAr] NVARCHAR(1500) NULL,
          [DepartmentId] INT NULL,
          [PortfolioId] INT NOT NULL,
          [OwnerId] INT NULL,
          [StartDate] DATE NOT NULL,
          [TargetDate] DATE NOT NULL,
          [Status] NVARCHAR(50) NOT NULL CONSTRAINT [DF_Initiatives_Status] DEFAULT (N'In Progress'),
          [Priority] NVARCHAR(50) NOT NULL CONSTRAINT [DF_Initiatives_Priority] DEFAULT (N'Medium'),
          [ProgressPercentage] INT NOT NULL CONSTRAINT [DF_Initiatives_ProgressPercentage] DEFAULT (0),
          [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_Initiatives_CreatedAt] DEFAULT (SYSUTCDATETIME()),
          CONSTRAINT [FK_Initiatives_Departments_DepartmentId] FOREIGN KEY ([DepartmentId]) REFERENCES [dbo].[Departments] ([Id]) ON DELETE SET NULL,
          CONSTRAINT [FK_Initiatives_Portfolios_PortfolioId] FOREIGN KEY ([PortfolioId]) REFERENCES [dbo].[Portfolios] ([Id]) ON DELETE CASCADE,
          CONSTRAINT [FK_Initiatives_Users_OwnerId] FOREIGN KEY ([OwnerId]) REFERENCES [dbo].[Users] ([Id]) ON DELETE SET NULL
        );
      END`
    },
    {
      sql: `
      IF OBJECT_ID(N'[dbo].[Projects]', N'U') IS NULL
      BEGIN
        CREATE TABLE [dbo].[Projects] (
          [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          [Name] NVARCHAR(200) NOT NULL,
          [NameAr] NVARCHAR(200) NULL,
          [Description] NVARCHAR(1500) NULL,
          [DescriptionAr] NVARCHAR(1500) NULL,
          [InitiativeId] INT NOT NULL,
          [ProjectManagerId] INT NULL,
          [StartDate] DATE NOT NULL,
          [EndDate] DATE NOT NULL,
          [Status] NVARCHAR(50) NOT NULL CONSTRAINT [DF_Projects_Status] DEFAULT (N'In Progress'),
          [Priority] NVARCHAR(50) NOT NULL CONSTRAINT [DF_Projects_Priority] DEFAULT (N'Medium'),
          [ProgressPercentage] INT NOT NULL CONSTRAINT [DF_Projects_ProgressPercentage] DEFAULT (0),
          [Budget] DECIMAL(18,2) NULL CONSTRAINT [DF_Projects_Budget] DEFAULT (0),
          [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_Projects_CreatedAt] DEFAULT (SYSUTCDATETIME()),
          CONSTRAINT [FK_Projects_Initiatives_InitiativeId] FOREIGN KEY ([InitiativeId]) REFERENCES [dbo].[Initiatives] ([Id]) ON DELETE CASCADE,
          CONSTRAINT [FK_Projects_Users_ProjectManagerId] FOREIGN KEY ([ProjectManagerId]) REFERENCES [dbo].[Users] ([Id]) ON DELETE SET NULL
        );
      END`
    },
    {
      sql: `
      IF OBJECT_ID(N'[dbo].[Workstreams]', N'U') IS NULL
      BEGIN
        CREATE TABLE [dbo].[Workstreams] (
          [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          [Name] NVARCHAR(200) NOT NULL,
          [NameAr] NVARCHAR(200) NULL,
          [Description] NVARCHAR(1500) NULL,
          [DescriptionAr] NVARCHAR(1500) NULL,
          [ProjectId] INT NOT NULL,
          [OwnerId] INT NULL,
          [StartDate] DATE NOT NULL,
          [EndDate] DATE NOT NULL,
          [Status] NVARCHAR(50) NOT NULL CONSTRAINT [DF_Workstreams_Status] DEFAULT (N'In Progress'),
          [ProgressPercentage] INT NOT NULL CONSTRAINT [DF_Workstreams_ProgressPercentage] DEFAULT (0),
          [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_Workstreams_CreatedAt] DEFAULT (SYSUTCDATETIME()),
          CONSTRAINT [FK_Workstreams_Projects_ProjectId] FOREIGN KEY ([ProjectId]) REFERENCES [dbo].[Projects] ([Id]) ON DELETE CASCADE,
          CONSTRAINT [FK_Workstreams_Users_OwnerId] FOREIGN KEY ([OwnerId]) REFERENCES [dbo].[Users] ([Id]) ON DELETE SET NULL
        );
      END`
    },
    {
      sql: `
      IF OBJECT_ID(N'[dbo].[Milestones]', N'U') IS NULL
      BEGIN
        CREATE TABLE [dbo].[Milestones] (
          [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          [Name] NVARCHAR(200) NOT NULL,
          [NameAr] NVARCHAR(200) NULL,
          [Description] NVARCHAR(1500) NULL,
          [DescriptionAr] NVARCHAR(1500) NULL,
          [ProjectId] INT NOT NULL,
          [WorkstreamId] INT NULL,
          [OwnerId] INT NULL,
          [PlannedDate] DATE NOT NULL,
          [ActualDate] DATE NULL,
          [Status] NVARCHAR(50) NOT NULL CONSTRAINT [DF_Milestones_Status] DEFAULT (N'Planned'),
          [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_Milestones_CreatedAt] DEFAULT (SYSUTCDATETIME()),
          CONSTRAINT [FK_Milestones_Projects_ProjectId] FOREIGN KEY ([ProjectId]) REFERENCES [dbo].[Projects] ([Id]) ON DELETE CASCADE,
          CONSTRAINT [FK_Milestones_Workstreams_WorkstreamId] FOREIGN KEY ([WorkstreamId]) REFERENCES [dbo].[Workstreams] ([Id]) ON DELETE NO ACTION,
          CONSTRAINT [FK_Milestones_Users_OwnerId] FOREIGN KEY ([OwnerId]) REFERENCES [dbo].[Users] ([Id]) ON DELETE SET NULL
        );
      END`
    },
    {
      sql: `
      IF OBJECT_ID(N'[dbo].[Activities]', N'U') IS NULL
      BEGIN
        CREATE TABLE [dbo].[Activities] (
          [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          [Name] NVARCHAR(200) NOT NULL,
          [NameAr] NVARCHAR(200) NULL,
          [Description] NVARCHAR(1500) NULL,
          [DescriptionAr] NVARCHAR(1500) NULL,
          [ProjectId] INT NOT NULL,
          [WorkstreamId] INT NULL,
          [MilestoneId] INT NULL,
          [ParentActivityId] INT NULL,
          [AssignedUserId] INT NULL,
          [StartDate] DATE NOT NULL,
          [DueDate] DATE NOT NULL,
          [Status] NVARCHAR(50) NOT NULL CONSTRAINT [DF_Activities_Status] DEFAULT (N'Not Started'),
          [Priority] NVARCHAR(50) NOT NULL CONSTRAINT [DF_Activities_Priority] DEFAULT (N'Medium'),
          [ProgressPercentage] INT NOT NULL CONSTRAINT [DF_Activities_ProgressPercentage] DEFAULT (0),
          [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_Activities_CreatedAt] DEFAULT (SYSUTCDATETIME()),
          CONSTRAINT [FK_Activities_Projects_ProjectId] FOREIGN KEY ([ProjectId]) REFERENCES [dbo].[Projects] ([Id]) ON DELETE CASCADE,
          CONSTRAINT [FK_Activities_Workstreams_WorkstreamId] FOREIGN KEY ([WorkstreamId]) REFERENCES [dbo].[Workstreams] ([Id]) ON DELETE NO ACTION,
          CONSTRAINT [FK_Activities_Milestones_MilestoneId] FOREIGN KEY ([MilestoneId]) REFERENCES [dbo].[Milestones] ([Id]) ON DELETE NO ACTION,
          CONSTRAINT [FK_Activities_Activities_ParentActivityId] FOREIGN KEY ([ParentActivityId]) REFERENCES [dbo].[Activities] ([Id]) ON DELETE NO ACTION,
          CONSTRAINT [FK_Activities_Users_AssignedUserId] FOREIGN KEY ([AssignedUserId]) REFERENCES [dbo].[Users] ([Id]) ON DELETE SET NULL
        );
      END`
    },
    {
      sql: `
      IF OBJECT_ID(N'[dbo].[TaskDependencies]', N'U') IS NULL
      BEGIN
        CREATE TABLE [dbo].[TaskDependencies] (
          [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          [PredecessorTaskId] INT NOT NULL,
          [SuccessorTaskId] INT NOT NULL,
          [DependencyType] NVARCHAR(30) NOT NULL CONSTRAINT [DF_TaskDependencies_Type] DEFAULT (N'FinishToStart'),
          [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_TaskDependencies_CreatedAt] DEFAULT (SYSUTCDATETIME()),
          CONSTRAINT [UQ_TaskDependencies_Pred_Succ] UNIQUE ([PredecessorTaskId], [SuccessorTaskId]),
          CONSTRAINT [FK_TaskDependencies_Predecessor] FOREIGN KEY ([PredecessorTaskId]) REFERENCES [dbo].[Activities] ([Id]) ON DELETE CASCADE,
          CONSTRAINT [FK_TaskDependencies_Successor] FOREIGN KEY ([SuccessorTaskId]) REFERENCES [dbo].[Activities] ([Id]) ON DELETE NO ACTION
        );
      END`
    },
    {
      sql: `
      IF OBJECT_ID(N'[dbo].[StrategicPlans]', N'U') IS NULL
      BEGIN
        CREATE TABLE [dbo].[StrategicPlans] (
          [Id] INT NOT NULL PRIMARY KEY,
          [TitleAr] NVARCHAR(300) NOT NULL,
          [TitleEn] NVARCHAR(300) NOT NULL,
          [Status] NVARCHAR(50) NOT NULL CONSTRAINT [DF_StrategicPlans_Status] DEFAULT (N'Draft'),
          [PayloadJson] NVARCHAR(MAX) NOT NULL,
          [UpdatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_StrategicPlans_UpdatedAt] DEFAULT (SYSUTCDATETIME())
        );
      END`
    },
    {
      sql: `
      IF OBJECT_ID(N'[dbo].[StrategicInitiatives]', N'U') IS NULL
      BEGIN
        CREATE TABLE [dbo].[StrategicInitiatives] (
          [Id] INT NOT NULL PRIMARY KEY,
          [Title] NVARCHAR(300) NOT NULL,
          [PlanId] INT NOT NULL,
          [DepartmentId] INT NOT NULL,
          [Status] NVARCHAR(50) NOT NULL CONSTRAINT [DF_StrategicInitiatives_Status] DEFAULT (N'Draft'),
          [PayloadJson] NVARCHAR(MAX) NOT NULL,
          [UpdatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_StrategicInitiatives_UpdatedAt] DEFAULT (SYSUTCDATETIME())
        );
      END`
    },
    {
      sql: `
      IF OBJECT_ID(N'[dbo].[StrategicActivities]', N'U') IS NULL
      BEGIN
        CREATE TABLE [dbo].[StrategicActivities] (
          [Id] INT NOT NULL PRIMARY KEY,
          [Name] NVARCHAR(300) NOT NULL,
          [InitiativeId] INT NOT NULL,
          [DepartmentId] INT NOT NULL,
          [Status] NVARCHAR(50) NOT NULL CONSTRAINT [DF_StrategicActivities_Status] DEFAULT (N'Draft'),
          [PayloadJson] NVARCHAR(MAX) NOT NULL,
          [UpdatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_StrategicActivities_UpdatedAt] DEFAULT (SYSUTCDATETIME())
        );
      END`
    },
    {
      sql: `
      IF OBJECT_ID(N'[dbo].[AdminSystemSettingsStore]', N'U') IS NULL
      BEGIN
        CREATE TABLE [dbo].[AdminSystemSettingsStore] (
          [SettingKey] NVARCHAR(100) NOT NULL PRIMARY KEY,
          [PayloadJson] NVARCHAR(MAX) NOT NULL,
          [UpdatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_AdminSystemSettingsStore_UpdatedAt] DEFAULT (SYSUTCDATETIME())
        );
      END`
    },
    // Safe bilingual/extended column upgrades for pre-existing schemas
    {
      sql: `
      IF COL_LENGTH('dbo.Roles', 'DescriptionAr') IS NULL ALTER TABLE [dbo].[Roles] ADD [DescriptionAr] NVARCHAR(500) NULL;
      IF COL_LENGTH('dbo.Users', 'FullNameAr') IS NULL ALTER TABLE [dbo].[Users] ADD [FullNameAr] NVARCHAR(150) NULL;
      IF COL_LENGTH('dbo.Departments', 'NameAr') IS NULL ALTER TABLE [dbo].[Departments] ADD [NameAr] NVARCHAR(150) NULL;
      IF COL_LENGTH('dbo.Departments', 'DescriptionAr') IS NULL ALTER TABLE [dbo].[Departments] ADD [DescriptionAr] NVARCHAR(1000) NULL;
      IF COL_LENGTH('dbo.Departments', 'ManagerId') IS NULL ALTER TABLE [dbo].[Departments] ADD [ManagerId] INT NULL;
      IF COL_LENGTH('dbo.Departments', 'ResponsibleManagerId') IS NULL ALTER TABLE [dbo].[Departments] ADD [ResponsibleManagerId] INT NULL;
      IF COL_LENGTH('dbo.Portfolios', 'NameAr') IS NULL ALTER TABLE [dbo].[Portfolios] ADD [NameAr] NVARCHAR(200) NULL;
      IF COL_LENGTH('dbo.Portfolios', 'DescriptionAr') IS NULL ALTER TABLE [dbo].[Portfolios] ADD [DescriptionAr] NVARCHAR(1500) NULL;
      IF COL_LENGTH('dbo.Portfolios', 'TargetDate') IS NULL ALTER TABLE [dbo].[Portfolios] ADD [TargetDate] DATE NULL;
      IF COL_LENGTH('dbo.Initiatives', 'NameAr') IS NULL ALTER TABLE [dbo].[Initiatives] ADD [NameAr] NVARCHAR(200) NULL;
      IF COL_LENGTH('dbo.Initiatives', 'DescriptionAr') IS NULL ALTER TABLE [dbo].[Initiatives] ADD [DescriptionAr] NVARCHAR(1500) NULL;
      IF COL_LENGTH('dbo.Projects', 'NameAr') IS NULL ALTER TABLE [dbo].[Projects] ADD [NameAr] NVARCHAR(200) NULL;
      IF COL_LENGTH('dbo.Projects', 'DescriptionAr') IS NULL ALTER TABLE [dbo].[Projects] ADD [DescriptionAr] NVARCHAR(1500) NULL;
      IF COL_LENGTH('dbo.Projects', 'Budget') IS NULL ALTER TABLE [dbo].[Projects] ADD [Budget] DECIMAL(18,2) NULL DEFAULT (0);
      IF COL_LENGTH('dbo.Workstreams', 'NameAr') IS NULL ALTER TABLE [dbo].[Workstreams] ADD [NameAr] NVARCHAR(200) NULL;
      IF COL_LENGTH('dbo.Workstreams', 'DescriptionAr') IS NULL ALTER TABLE [dbo].[Workstreams] ADD [DescriptionAr] NVARCHAR(1500) NULL;
      IF COL_LENGTH('dbo.Milestones', 'NameAr') IS NULL ALTER TABLE [dbo].[Milestones] ADD [NameAr] NVARCHAR(200) NULL;
      IF COL_LENGTH('dbo.Milestones', 'DescriptionAr') IS NULL ALTER TABLE [dbo].[Milestones] ADD [DescriptionAr] NVARCHAR(1500) NULL;
      IF COL_LENGTH('dbo.Activities', 'NameAr') IS NULL ALTER TABLE [dbo].[Activities] ADD [NameAr] NVARCHAR(200) NULL;
      IF COL_LENGTH('dbo.Activities', 'DescriptionAr') IS NULL ALTER TABLE [dbo].[Activities] ADD [DescriptionAr] NVARCHAR(1500) NULL;
      `
    }
  ];

  await runBatchOnDatabase(cfg, cfg.database, ddlStatements, false);
}

export async function pushDbToSqlServer(
  cfg: SqlServerConnectionConfig,
  db: any
): Promise<{ rowCounts: Record<string, number> }> {
  if (cfg.autoCreateSchema !== false) {
    await initializeSqlServerSchema(cfg);
  }

  const stmts: QueryStatement[] = [];

  const clearOrder = [
    'TaskDependencies',
    'Activities',
    'Milestones',
    'Workstreams',
    'Projects',
    'Initiatives',
    'Portfolios',
    'Departments',
    'Users',
    'Roles',
    'StrategicActivities',
    'StrategicInitiatives',
    'StrategicPlans',
    'AdminSystemSettingsStore'
  ];

  for (const tbl of clearOrder) {
    stmts.push({ sql: `DELETE FROM [dbo].${escapeBracketId(tbl)}` });
  }

  const roles = db.roles || [];
  if (roles.length > 0) {
    stmts.push({ sql: 'SET IDENTITY_INSERT [dbo].[Roles] ON' });
    for (const r of roles) {
      stmts.push({
        sql: 'INSERT INTO [dbo].[Roles] ([Id], [Name], [Description], [DescriptionAr]) VALUES (@p0, @p1, @p2, @p3)',
        params: [Number(r.id), String(r.name), String(r.description || ''), r.descriptionAr ? String(r.descriptionAr) : null]
      });
    }
    stmts.push({ sql: 'SET IDENTITY_INSERT [dbo].[Roles] OFF' });
  }

  const users = db.users || [];
  if (users.length > 0) {
    stmts.push({ sql: 'SET IDENTITY_INSERT [dbo].[Users] ON' });
    for (const u of users) {
      stmts.push({
        sql: 'INSERT INTO [dbo].[Users] ([Id], [FullName], [FullNameAr], [Email], [Username], [PasswordHash], [RoleId], [IsActive]) VALUES (@p0, @p1, @p2, @p3, @p4, @p5, @p6, @p7)',
        params: [
          Number(u.id),
          String(u.fullName),
          u.fullNameAr ? String(u.fullNameAr) : null,
          String(u.email),
          String(u.username),
          String(u.passwordHash || ''),
          Number(u.roleId),
          u.isActive !== false ? 1 : 0
        ]
      });
    }
    stmts.push({ sql: 'SET IDENTITY_INSERT [dbo].[Users] OFF' });
  }

  const departments = db.departments || [];
  if (departments.length > 0) {
    stmts.push({ sql: 'SET IDENTITY_INSERT [dbo].[Departments] ON' });
    for (const d of departments) {
      stmts.push({
        sql: 'INSERT INTO [dbo].[Departments] ([Id], [Name], [NameAr], [Description], [DescriptionAr], [ManagerId], [ResponsibleManagerId], [IsActive]) VALUES (@p0, @p1, @p2, @p3, @p4, @p5, @p6, @p7)',
        params: [
          Number(d.id),
          String(d.name),
          d.nameAr ? String(d.nameAr) : null,
          String(d.description || ''),
          d.descriptionAr ? String(d.descriptionAr) : null,
          d.managerId != null ? Number(d.managerId) : null,
          d.responsibleManagerId != null ? Number(d.responsibleManagerId) : null,
          d.isActive !== false ? 1 : 0
        ]
      });
    }
    stmts.push({ sql: 'SET IDENTITY_INSERT [dbo].[Departments] OFF' });
  }

  const portfolios = db.portfolios || [];
  if (portfolios.length > 0) {
    stmts.push({ sql: 'SET IDENTITY_INSERT [dbo].[Portfolios] ON' });
    for (const p of portfolios) {
      stmts.push({
        sql: 'INSERT INTO [dbo].[Portfolios] ([Id], [Name], [NameAr], [Description], [DescriptionAr], [DepartmentId], [OwnerId], [StartDate], [EndDate], [TargetDate], [Status]) VALUES (@p0, @p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8, @p9, @p10)',
        params: [
          Number(p.id),
          String(p.name),
          p.nameAr ? String(p.nameAr) : null,
          String(p.description || ''),
          p.descriptionAr ? String(p.descriptionAr) : null,
          p.departmentId != null ? Number(p.departmentId) : null,
          p.ownerId != null ? Number(p.ownerId) : null,
          toSqlDate(p.startDate, '2026-01-01'),
          toSqlDate(p.endDate, '2026-12-31'),
          toSqlNullableDate(p.targetDate),
          String(p.status || 'Active')
        ]
      });
    }
    stmts.push({ sql: 'SET IDENTITY_INSERT [dbo].[Portfolios] OFF' });
  }

  const initiatives = db.initiatives || [];
  if (initiatives.length > 0) {
    stmts.push({ sql: 'SET IDENTITY_INSERT [dbo].[Initiatives] ON' });
    for (const i of initiatives) {
      stmts.push({
        sql: 'INSERT INTO [dbo].[Initiatives] ([Id], [Name], [NameAr], [Description], [DescriptionAr], [DepartmentId], [PortfolioId], [OwnerId], [StartDate], [TargetDate], [Status], [Priority], [ProgressPercentage]) VALUES (@p0, @p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8, @p9, @p10, @p11, @p12)',
        params: [
          Number(i.id),
          String(i.name),
          i.nameAr ? String(i.nameAr) : null,
          String(i.description || ''),
          i.descriptionAr ? String(i.descriptionAr) : null,
          i.departmentId != null ? Number(i.departmentId) : null,
          Number(i.portfolioId),
          i.ownerId != null ? Number(i.ownerId) : null,
          toSqlDate(i.startDate, '2026-01-01'),
          toSqlDate(i.targetDate, '2026-12-31'),
          String(i.status || 'In Progress'),
          String(i.priority || 'Medium'),
          Math.round(Number(i.progressPercentage || 0))
        ]
      });
    }
    stmts.push({ sql: 'SET IDENTITY_INSERT [dbo].[Initiatives] OFF' });
  }

  const projects = db.projects || [];
  if (projects.length > 0) {
    stmts.push({ sql: 'SET IDENTITY_INSERT [dbo].[Projects] ON' });
    for (const pr of projects) {
      stmts.push({
        sql: 'INSERT INTO [dbo].[Projects] ([Id], [Name], [NameAr], [Description], [DescriptionAr], [InitiativeId], [ProjectManagerId], [StartDate], [EndDate], [Status], [Priority], [ProgressPercentage], [Budget]) VALUES (@p0, @p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8, @p9, @p10, @p11, @p12)',
        params: [
          Number(pr.id),
          String(pr.name),
          pr.nameAr ? String(pr.nameAr) : null,
          String(pr.description || ''),
          pr.descriptionAr ? String(pr.descriptionAr) : null,
          Number(pr.initiativeId),
          pr.projectManagerId != null ? Number(pr.projectManagerId) : null,
          toSqlDate(pr.startDate, '2026-01-01'),
          toSqlDate(pr.endDate, '2026-12-31'),
          String(pr.status || 'In Progress'),
          String(pr.priority || 'Medium'),
          Math.round(Number(pr.progressPercentage || 0)),
          Number(pr.budget || 0)
        ]
      });
    }
    stmts.push({ sql: 'SET IDENTITY_INSERT [dbo].[Projects] OFF' });
  }

  const workstreams = db.workstreams || [];
  if (workstreams.length > 0) {
    stmts.push({ sql: 'SET IDENTITY_INSERT [dbo].[Workstreams] ON' });
    for (const w of workstreams) {
      stmts.push({
        sql: 'INSERT INTO [dbo].[Workstreams] ([Id], [Name], [NameAr], [Description], [DescriptionAr], [ProjectId], [OwnerId], [StartDate], [EndDate], [Status], [ProgressPercentage]) VALUES (@p0, @p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8, @p9, @p10)',
        params: [
          Number(w.id),
          String(w.name),
          w.nameAr ? String(w.nameAr) : null,
          String(w.description || ''),
          w.descriptionAr ? String(w.descriptionAr) : null,
          Number(w.projectId),
          w.ownerId != null ? Number(w.ownerId) : null,
          toSqlDate(w.startDate, '2026-01-01'),
          toSqlDate(w.endDate, '2026-12-31'),
          String(w.status || 'In Progress'),
          Math.round(Number(w.progressPercentage || 0))
        ]
      });
    }
    stmts.push({ sql: 'SET IDENTITY_INSERT [dbo].[Workstreams] OFF' });
  }

  const milestones = db.milestones || [];
  if (milestones.length > 0) {
    stmts.push({ sql: 'SET IDENTITY_INSERT [dbo].[Milestones] ON' });
    for (const m of milestones) {
      stmts.push({
        sql: 'INSERT INTO [dbo].[Milestones] ([Id], [Name], [NameAr], [Description], [DescriptionAr], [ProjectId], [WorkstreamId], [OwnerId], [PlannedDate], [ActualDate], [Status]) VALUES (@p0, @p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8, @p9, @p10)',
        params: [
          Number(m.id),
          String(m.name),
          m.nameAr ? String(m.nameAr) : null,
          String(m.description || ''),
          m.descriptionAr ? String(m.descriptionAr) : null,
          Number(m.projectId),
          m.workstreamId != null ? Number(m.workstreamId) : null,
          m.ownerId != null ? Number(m.ownerId) : null,
          toSqlDate(m.plannedDate, '2026-06-01'),
          toSqlNullableDate(m.actualDate),
          String(m.status || 'Planned')
        ]
      });
    }
    stmts.push({ sql: 'SET IDENTITY_INSERT [dbo].[Milestones] OFF' });
  }

  const activitiesList = Array.isArray(db.activities) ? db.activities : [];
  if (activitiesList.length > 0) {
    const sortedActivities = [
      ...activitiesList.filter((a: any) => !a.parentActivityId),
      ...activitiesList.filter((a: any) => Boolean(a.parentActivityId))
    ];
    stmts.push({ sql: 'SET IDENTITY_INSERT [dbo].[Activities] ON' });
    for (const a of sortedActivities) {
      stmts.push({
        sql: 'INSERT INTO [dbo].[Activities] ([Id], [Name], [NameAr], [Description], [DescriptionAr], [ProjectId], [WorkstreamId], [MilestoneId], [ParentActivityId], [AssignedUserId], [StartDate], [DueDate], [Status], [Priority], [ProgressPercentage]) VALUES (@p0, @p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8, @p9, @p10, @p11, @p12, @p13, @p14)',
        params: [
          Number(a.id),
          String(a.name),
          a.nameAr ? String(a.nameAr) : null,
          String(a.description || ''),
          a.descriptionAr ? String(a.descriptionAr) : null,
          Number(a.projectId),
          a.workstreamId != null ? Number(a.workstreamId) : null,
          a.milestoneId != null ? Number(a.milestoneId) : null,
          a.parentActivityId != null ? Number(a.parentActivityId) : null,
          a.assignedUserId != null ? Number(a.assignedUserId) : null,
          toSqlDate(a.startDate, '2026-01-01'),
          toSqlDate(a.dueDate, '2026-12-31'),
          String(a.status || 'Not Started'),
          String(a.priority || 'Medium'),
          Math.round(Number(a.progressPercentage || 0))
        ]
      });
    }
    stmts.push({ sql: 'SET IDENTITY_INSERT [dbo].[Activities] OFF' });
  }

  const dependencies = db.dependencies || [];
  if (dependencies.length > 0) {
    stmts.push({ sql: 'SET IDENTITY_INSERT [dbo].[TaskDependencies] ON' });
    for (const td of dependencies) {
      stmts.push({
        sql: 'INSERT INTO [dbo].[TaskDependencies] ([Id], [PredecessorTaskId], [SuccessorTaskId], [DependencyType]) VALUES (@p0, @p1, @p2, @p3)',
        params: [
          Number(td.id),
          Number(td.predecessorTaskId),
          Number(td.successorTaskId),
          String(td.dependencyType || 'FinishToStart')
        ]
      });
    }
    stmts.push({ sql: 'SET IDENTITY_INSERT [dbo].[TaskDependencies] OFF' });
  }

  for (const sp of db.strategicPlans || []) {
    stmts.push({
      sql: 'INSERT INTO [dbo].[StrategicPlans] ([Id], [TitleAr], [TitleEn], [Status], [PayloadJson]) VALUES (@p0, @p1, @p2, @p3, @p4)',
      params: [
        Number(sp.id),
        String(sp.titleAr || sp.titleEn || ''),
        String(sp.titleEn || sp.titleAr || ''),
        String(sp.status || 'Draft'),
        JSON.stringify(sp)
      ]
    });
  }

  for (const si of db.strategicInitiatives || []) {
    stmts.push({
      sql: 'INSERT INTO [dbo].[StrategicInitiatives] ([Id], [Title], [PlanId], [DepartmentId], [Status], [PayloadJson]) VALUES (@p0, @p1, @p2, @p3, @p4, @p5)',
      params: [
        Number(si.id),
        String(si.title || ''),
        Number(si.planId || 0),
        Number(si.departmentId || 0),
        String(si.status || 'Draft'),
        JSON.stringify(si)
      ]
    });
  }

  for (const sa of db.strategicActivities || []) {
    stmts.push({
      sql: 'INSERT INTO [dbo].[StrategicActivities] ([Id], [Name], [InitiativeId], [DepartmentId], [Status], [PayloadJson]) VALUES (@p0, @p1, @p2, @p3, @p4, @p5)',
      params: [
        Number(sa.id),
        String(sa.name || ''),
        Number(sa.initiativeId || 0),
        Number(sa.departmentId || 0),
        String(sa.status || 'Draft'),
        JSON.stringify(sa)
      ]
    });
  }

  if (db.systemSettings) {
    stmts.push({
      sql: 'INSERT INTO [dbo].[AdminSystemSettingsStore] ([SettingKey], [PayloadJson]) VALUES (@p0, @p1)',
      params: ['systemSettings', JSON.stringify(db.systemSettings)]
    });
  }

  await runBatchOnDatabase(cfg, cfg.database, stmts, true);

  const rowCounts: Record<string, number> = {
    Roles: roles.length,
    Users: users.length,
    Departments: departments.length,
    Portfolios: portfolios.length,
    Initiatives: initiatives.length,
    Projects: projects.length,
    Workstreams: workstreams.length,
    Milestones: milestones.length,
    Activities: activitiesList.length,
    TaskDependencies: dependencies.length,
    StrategicPlans: (db.strategicPlans || []).length,
    StrategicInitiatives: (db.strategicInitiatives || []).length,
    StrategicActivities: (db.strategicActivities || []).length,
    AdminSystemSettingsStore: db.systemSettings ? 1 : 0
  };

  return { rowCounts };
}

export async function pullDbFromSqlServer(
  cfg: SqlServerConnectionConfig,
  fallbackDb: any
): Promise<{ db: any; rowCounts: Record<string, number> }> {
  const [
    rolesRes,
    usersRes,
    deptRes,
    portRes,
    initRes,
    projRes,
    wsRes,
    msRes,
    actRes,
    depRes,
    tblRes
  ] = await runBatchOnDatabase(cfg, cfg.database, [
    { sql: 'SELECT * FROM [dbo].[Roles] ORDER BY [Id]' },
    { sql: 'SELECT * FROM [dbo].[Users] ORDER BY [Id]' },
    { sql: 'SELECT * FROM [dbo].[Departments] ORDER BY [Id]' },
    { sql: 'SELECT * FROM [dbo].[Portfolios] ORDER BY [Id]' },
    { sql: 'SELECT * FROM [dbo].[Initiatives] ORDER BY [Id]' },
    { sql: 'SELECT * FROM [dbo].[Projects] ORDER BY [Id]' },
    { sql: 'SELECT * FROM [dbo].[Workstreams] ORDER BY [Id]' },
    { sql: 'SELECT * FROM [dbo].[Milestones] ORDER BY [Id]' },
    { sql: 'SELECT * FROM [dbo].[Activities] ORDER BY [Id]' },
    { sql: 'SELECT * FROM [dbo].[TaskDependencies] ORDER BY [Id]' },
    { sql: "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = 'dbo'" }
  ]);

  const rolesRows = rolesRes?.recordset || [];
  const usersRows = usersRes?.recordset || [];
  const deptRows = deptRes?.recordset || [];
  const portRows = portRes?.recordset || [];
  const initRows = initRes?.recordset || [];
  const projRows = projRes?.recordset || [];
  const wsRows = wsRes?.recordset || [];
  const msRows = msRes?.recordset || [];
  const actRows = actRes?.recordset || [];
  const depRows = depRes?.recordset || [];
  const tableSet = new Set(
    (tblRes?.recordset || []).map((r) => String(r.TABLE_NAME || '').toLowerCase())
  );

  let strategicPlans = fallbackDb.strategicPlans || [];
  let strategicInitiatives = fallbackDb.strategicInitiatives || [];
  let strategicActivities = fallbackDb.strategicActivities || [];
  let systemSettings = fallbackDb.systemSettings;

  const extraStmts: QueryStatement[] = [];
  const extraKeys: string[] = [];
  if (tableSet.has('strategicplans')) {
    extraKeys.push('strategicplans');
    extraStmts.push({ sql: 'SELECT [PayloadJson] FROM [dbo].[StrategicPlans] ORDER BY [Id]' });
  }
  if (tableSet.has('strategicinitiatives')) {
    extraKeys.push('strategicinitiatives');
    extraStmts.push({ sql: 'SELECT [PayloadJson] FROM [dbo].[StrategicInitiatives] ORDER BY [Id]' });
  }
  if (tableSet.has('strategicactivities')) {
    extraKeys.push('strategicactivities');
    extraStmts.push({ sql: 'SELECT [PayloadJson] FROM [dbo].[StrategicActivities] ORDER BY [Id]' });
  }
  if (tableSet.has('adminsystemsettingsstore')) {
    extraKeys.push('adminsystemsettingsstore');
    extraStmts.push({
      sql: 'SELECT TOP 1 [PayloadJson] FROM [dbo].[AdminSystemSettingsStore] WHERE [SettingKey] = @p0',
      params: ['systemSettings']
    });
  }

  if (extraStmts.length > 0) {
    const extraRes = await runBatchOnDatabase(cfg, cfg.database, extraStmts);
    extraRes.forEach((res, idx) => {
      const key = extraKeys[idx];
      const rows = res?.recordset || [];
      if (key === 'strategicplans' && rows.length > 0) {
        strategicPlans = rows.map((r) => JSON.parse(String(r.PayloadJson)));
      } else if (key === 'strategicinitiatives' && rows.length > 0) {
        strategicInitiatives = rows.map((r) => JSON.parse(String(r.PayloadJson)));
      } else if (key === 'strategicactivities' && rows.length > 0) {
        strategicActivities = rows.map((r) => JSON.parse(String(r.PayloadJson)));
      } else if (key === 'adminsystemsettingsstore' && rows.length > 0) {
        systemSettings = JSON.parse(String(rows[0].PayloadJson));
      }
    });
  }

  const pulledDb = {
    ...fallbackDb,
    roles:
      rolesRows.length > 0
        ? rolesRows.map((r) => ({
            id: Number(r.Id),
            name: String(r.Name),
            description: r.Description ? String(r.Description) : '',
            ...(r.DescriptionAr ? { descriptionAr: String(r.DescriptionAr) } : {})
          }))
        : fallbackDb.roles,
    users:
      usersRows.length > 0
        ? usersRows.map((u) => ({
            id: Number(u.Id),
            fullName: String(u.FullName),
            ...(u.FullNameAr ? { fullNameAr: String(u.FullNameAr) } : {}),
            email: String(u.Email),
            username: String(u.Username),
            passwordHash: String(u.PasswordHash || ''),
            roleId: Number(u.RoleId),
            isActive: Boolean(u.IsActive)
          }))
        : fallbackDb.users,
    departments:
      deptRows.length > 0
        ? deptRows.map((d) => ({
            id: Number(d.Id),
            name: String(d.Name),
            ...(d.NameAr ? { nameAr: String(d.NameAr) } : {}),
            description: d.Description ? String(d.Description) : '',
            ...(d.DescriptionAr ? { descriptionAr: String(d.DescriptionAr) } : {}),
            managerId: d.ManagerId != null ? Number(d.ManagerId) : null,
            responsibleManagerId:
              d.ResponsibleManagerId != null ? Number(d.ResponsibleManagerId) : null,
            isActive: Boolean(d.IsActive)
          }))
        : fallbackDb.departments,
    portfolios:
      portRows.length > 0
        ? portRows.map((p) => ({
            id: Number(p.Id),
            name: String(p.Name),
            ...(p.NameAr ? { nameAr: String(p.NameAr) } : {}),
            description: p.Description ? String(p.Description) : '',
            ...(p.DescriptionAr ? { descriptionAr: String(p.DescriptionAr) } : {}),
            departmentId: p.DepartmentId != null ? Number(p.DepartmentId) : null,
            ownerId: p.OwnerId != null ? Number(p.OwnerId) : null,
            startDate: formatDateFromRow(p.StartDate),
            endDate: formatDateFromRow(p.EndDate, '2026-12-31'),
            ...(p.TargetDate ? { targetDate: formatDateFromRow(p.TargetDate) } : {}),
            status: String(p.Status || 'Active')
          }))
        : fallbackDb.portfolios,
    initiatives:
      initRows.length > 0
        ? initRows.map((i) => ({
            id: Number(i.Id),
            name: String(i.Name),
            ...(i.NameAr ? { nameAr: String(i.NameAr) } : {}),
            description: i.Description ? String(i.Description) : '',
            ...(i.DescriptionAr ? { descriptionAr: String(i.DescriptionAr) } : {}),
            departmentId: i.DepartmentId != null ? Number(i.DepartmentId) : null,
            portfolioId: Number(i.PortfolioId),
            ownerId: i.OwnerId != null ? Number(i.OwnerId) : null,
            startDate: formatDateFromRow(i.StartDate),
            targetDate: formatDateFromRow(i.TargetDate, '2026-12-31'),
            status: String(i.Status || 'In Progress'),
            priority: String(i.Priority || 'Medium'),
            progressPercentage: Number(i.ProgressPercentage || 0)
          }))
        : fallbackDb.initiatives,
    projects:
      projRows.length > 0
        ? projRows.map((pr) => ({
            id: Number(pr.Id),
            name: String(pr.Name),
            ...(pr.NameAr ? { nameAr: String(pr.NameAr) } : {}),
            description: pr.Description ? String(pr.Description) : '',
            ...(pr.DescriptionAr ? { descriptionAr: String(pr.DescriptionAr) } : {}),
            initiativeId: Number(pr.InitiativeId),
            projectManagerId: pr.ProjectManagerId != null ? Number(pr.ProjectManagerId) : null,
            startDate: formatDateFromRow(pr.StartDate),
            endDate: formatDateFromRow(pr.EndDate, '2026-12-31'),
            status: String(pr.Status || 'In Progress'),
            priority: String(pr.Priority || 'Medium'),
            progressPercentage: Number(pr.ProgressPercentage || 0),
            budget: pr.Budget != null ? Number(pr.Budget) : 0
          }))
        : fallbackDb.projects,
    workstreams:
      wsRows.length > 0
        ? wsRows.map((w) => ({
            id: Number(w.Id),
            name: String(w.Name),
            ...(w.NameAr ? { nameAr: String(w.NameAr) } : {}),
            description: w.Description ? String(w.Description) : '',
            ...(w.DescriptionAr ? { descriptionAr: String(w.DescriptionAr) } : {}),
            projectId: Number(w.ProjectId),
            ownerId: w.OwnerId != null ? Number(w.OwnerId) : null,
            startDate: formatDateFromRow(w.StartDate),
            endDate: formatDateFromRow(w.EndDate, '2026-12-31'),
            status: String(w.Status || 'In Progress'),
            progressPercentage: Number(w.ProgressPercentage || 0)
          }))
        : fallbackDb.workstreams,
    milestones:
      msRows.length > 0
        ? msRows.map((m) => ({
            id: Number(m.Id),
            name: String(m.Name),
            ...(m.NameAr ? { nameAr: String(m.NameAr) } : {}),
            description: m.Description ? String(m.Description) : '',
            ...(m.DescriptionAr ? { descriptionAr: String(m.DescriptionAr) } : {}),
            projectId: Number(m.ProjectId),
            workstreamId: m.WorkstreamId != null ? Number(m.WorkstreamId) : null,
            ownerId: m.OwnerId != null ? Number(m.OwnerId) : null,
            plannedDate: formatDateFromRow(m.PlannedDate),
            actualDate: m.ActualDate ? formatDateFromRow(m.ActualDate) : null,
            status: String(m.Status || 'Planned')
          }))
        : fallbackDb.milestones,
    activities:
      actRows.length > 0
        ? actRows.map((a) => ({
            id: Number(a.Id),
            name: String(a.Name),
            ...(a.NameAr ? { nameAr: String(a.NameAr) } : {}),
            description: a.Description ? String(a.Description) : '',
            ...(a.DescriptionAr ? { descriptionAr: String(a.DescriptionAr) } : {}),
            projectId: Number(a.ProjectId),
            workstreamId: a.WorkstreamId != null ? Number(a.WorkstreamId) : null,
            milestoneId: a.MilestoneId != null ? Number(a.MilestoneId) : null,
            parentActivityId: a.ParentActivityId != null ? Number(a.ParentActivityId) : null,
            assignedUserId: a.AssignedUserId != null ? Number(a.AssignedUserId) : null,
            startDate: formatDateFromRow(a.StartDate),
            dueDate: formatDateFromRow(a.DueDate, '2026-12-31'),
            status: String(a.Status || 'Not Started'),
            priority: String(a.Priority || 'Medium'),
            progressPercentage: Number(a.ProgressPercentage || 0)
          }))
        : fallbackDb.activities,
    dependencies:
      depRows.length > 0
        ? depRows.map((td) => ({
            id: Number(td.Id),
            predecessorTaskId: Number(td.PredecessorTaskId),
            successorTaskId: Number(td.SuccessorTaskId),
            dependencyType: String(td.DependencyType || 'FinishToStart')
          }))
        : fallbackDb.dependencies,
    strategicPlans,
    strategicInitiatives,
    strategicActivities,
    systemSettings
  };

  const rowCounts: Record<string, number> = {
    Roles: rolesRows.length,
    Users: usersRows.length,
    Departments: deptRows.length,
    Portfolios: portRows.length,
    Initiatives: initRows.length,
    Projects: projRows.length,
    Workstreams: wsRows.length,
    Milestones: msRows.length,
    Activities: actRows.length,
    TaskDependencies: depRows.length,
    StrategicPlans: strategicPlans.length,
    StrategicInitiatives: strategicInitiatives.length,
    StrategicActivities: strategicActivities.length,
    AdminSystemSettingsStore: systemSettings ? 1 : 0
  };

  return { db: pulledDb, rowCounts };
}

// Asynchronous non-blocking write-through queue so Express routes stay fast and SQL Server stays in sync
let pendingSyncChain: Promise<void> = Promise.resolve();

export function queueSqlServerSync(dbSnapshot: any): void {
  const cfg = loadSqlServerConfig();
  if (!cfg.enabled || !cfg.autoSync) return;

  const cloned = JSON.parse(JSON.stringify(dbSnapshot));
  pendingSyncChain = pendingSyncChain
    .then(async () => {
      try {
        await pushDbToSqlServer(cfg, cloned);
        const latestCfg = loadSqlServerConfig();
        latestCfg.lastSyncAt = new Date().toISOString();
        latestCfg.lastError = null;
        saveSqlServerConfig(latestCfg);
      } catch (err: any) {
        const latestCfg = loadSqlServerConfig();
        latestCfg.lastError = mapSqlServerError(err, latestCfg);
        saveSqlServerConfig(latestCfg);
      }
    })
    .catch(() => undefined);
}
