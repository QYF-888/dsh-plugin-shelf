/**
 * Plugin Shelf — host half.
 *
 * Owns three things the browser half cannot do on its own:
 *
 * 1. A truthful inventory of the installed plugins with the two facts the
 *    Loader does not expose (`on-disk size`, `install time`), measured from the
 *    profile's own `node_modules` tree.
 * 2. Persistence for the shelf's own state (groups, group order, sort choice,
 *    auto-update settings, run log) in `$DSH_HOME/plugin-shelf/state.json`.
 * 3. The actual mutations: enable/disable through `pluginManager`, and
 *    automatic updates through `pluginManager.inspect` + `installBundle`.
 *
 * The browser half talks to this file over one exact HTTP route on the host's
 * `webServer` (`POST/GET /plugin-shelf/api`), which keeps it free of the
 * `typert` host-manifest machinery and of any `@deepseek-ai/*` import.
 */
import {
  existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, statSync, writeFileSync,
} from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROUTE_PATH = '/plugin-shelf/api';
const STATE_SCHEMA = 1;
const MAX_BODY = 1 << 20;
const SIZE_TTL_MS = 60_000;
const UPDATE_PROBE_TIMEOUT_MS = 15_000;
const UPDATE_CONCURRENCY = 4;
const DEFAULT_REGISTRY = 'https://registry.npmjs.org';
/** Removal refusals that mean "the module is loaded right now, try after a restart". */
const LIVE_MOUNT = /bundle-in-use|stop-profile/;
const LOG_LIMIT = 40;
const JOURNAL_SCHEMA = 1;
const TICK_MS = 60_000;

/* ------------------------------------------------------------------ paths -- */

/** `$DSH_HOME`, falling back to `~/.dsh` exactly like the host does. */
function dshHome() {
  const configured = process.env.DSH_HOME;
  return typeof configured === 'string' && configured.trim() !== ''
    ? configured.trim()
    : join(homedir(), '.dsh');
}

function statePath() {
  return join(dshHome(), 'plugin-shelf', 'state.json');
}

/** Locate the profile directory this plugin was installed into. */
function profileDir() {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < 10; depth += 1) {
    const manifest = join(dir, 'package.json');
    if (existsSync(manifest)) {
      try {
        const parsed = JSON.parse(readFileSync(manifest, 'utf8'));
        if (typeof parsed?.name === 'string' && parsed.name.startsWith('dsh-profile')) return dir;
      } catch {
        /* a malformed manifest is not the profile marker; keep walking */
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const profilesRoot = join(dshHome(), 'profiles');
  try {
    for (const entry of readdirSync(profilesRoot)) {
      const candidate = join(profilesRoot, entry);
      if (existsSync(join(candidate, 'node_modules', 'dsh-plugin-shelf'))) return candidate;
    }
  } catch {
    /* no profiles root: the caller reports an unmeasured inventory */
  }
  return undefined;
}

/* ------------------------------------------------------------------ state -- */

function defaultState() {
  return {
    schema: STATE_SCHEMA,
    sort: { key: 'installedAt', dir: 'desc' },
    groups: [],
    autoUpdate: {
      enabled: false,
      intervalMinutes: 360,
      apply: false,
      scope: 'all',
      groups: [],
      registry: DEFAULT_REGISTRY,
      approvedBuilds: [],
      lastRun: 0,
      lastResult: undefined,
      log: [],
    },
    ui: {
      collapsed: {},
      includeBuiltin: false,
      ungroupedName: '',
      ungroupedCollapsed: false,
      pendingSeen: [],
      filter: { status: 'all', group: 'all', updatable: false },
    },
  };
}

function normalizeState(raw) {
  const base = defaultState();
  if (raw === null || typeof raw !== 'object') return base;
  const state = { ...base, ...raw };
  if (typeof raw.sort === 'object' && raw.sort !== null) {
    state.sort = {
      key: ['name', 'installedAt', 'size'].includes(raw.sort.key) ? raw.sort.key : base.sort.key,
      dir: raw.sort.dir === 'asc' ? 'asc' : 'desc',
    };
  }
  state.groups = Array.isArray(raw.groups)
    ? raw.groups
      .filter(group => group !== null && typeof group === 'object')
      .map((group, index) => ({
        id: typeof group.id === 'string' && group.id !== '' ? group.id : `group-${index + 1}`,
        name: typeof group.name === 'string' && group.name !== '' ? group.name : `分组 ${index + 1}`,
        order: Number.isFinite(group.order) ? group.order : index,
        members: Array.isArray(group.members) ? group.members.filter(name => typeof name === 'string') : [],
      }))
      .sort((a, b) => a.order - b.order)
      .map((group, index) => ({ ...group, order: index }))
    : [];
  if (typeof raw.autoUpdate === 'object' && raw.autoUpdate !== null) {
    const auto = raw.autoUpdate;
    state.autoUpdate = {
      ...base.autoUpdate,
      enabled: auto.enabled === true,
      apply: auto.apply === true,
      intervalMinutes: clampInterval(auto.intervalMinutes),
      scope: auto.scope === 'groups' ? 'groups' : 'all',
      groups: Array.isArray(auto.groups) ? auto.groups.filter(id => typeof id === 'string') : [],
      registry: typeof auto.registry === 'string' && auto.registry.trim() !== '' ? auto.registry.trim() : DEFAULT_REGISTRY,
      approvedBuilds: Array.isArray(auto.approvedBuilds) ? auto.approvedBuilds.filter(s => typeof s === 'string' && s !== '') : [],
      lastRun: Number.isFinite(auto.lastRun) ? auto.lastRun : 0,
      lastResult: typeof auto.lastResult === 'object' && auto.lastResult !== null ? auto.lastResult : undefined,
      log: Array.isArray(auto.log) ? auto.log.filter(row => row !== null && typeof row === 'object').slice(-LOG_LIMIT) : [],
    };
  }
  if (typeof raw.ui === 'object' && raw.ui !== null) {
    const rawFilter = typeof raw.ui.filter === 'object' && raw.ui.filter !== null ? raw.ui.filter : {};
    state.ui = {
      collapsed: typeof raw.ui.collapsed === 'object' && raw.ui.collapsed !== null ? raw.ui.collapsed : {},
      includeBuiltin: raw.ui.includeBuiltin === true,
      ungroupedName: typeof raw.ui.ungroupedName === 'string' ? raw.ui.ungroupedName.slice(0, 120) : '',
      ungroupedCollapsed: raw.ui.ungroupedCollapsed === true,
      pendingSeen: Array.isArray(raw.ui.pendingSeen)
        ? raw.ui.pendingSeen.filter(name => typeof name === 'string').slice(0, 200)
        : [],
      filter: {
        status: rawFilter.status === 'on' || rawFilter.status === 'off' ? rawFilter.status : 'all',
        group: typeof rawFilter.group === 'string' ? rawFilter.group.slice(0, 200) : 'all',
        updatable: rawFilter.updatable === true,
      },
    };
  }
  return state;
}

function clampInterval(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return 360;
  return Math.min(Math.max(Math.round(minutes), 5), 10_080);
}

function loadState() {
  try {
    return normalizeState(JSON.parse(readFileSync(statePath(), 'utf8')));
  } catch {
    return defaultState();
  }
}

/**
 * Merge a (possibly partial) state patch onto the stored document. Plain
 * objects are merged key by key; arrays and scalars replace the stored value.
 */
function mergeState(base, patch) {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return base;
  const out = { ...(base !== null && typeof base === 'object' && !Array.isArray(base) ? base : {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    out[key] = value !== null && typeof value === 'object' && !Array.isArray(value)
      ? mergeState(out[key], value)
      : value;
  }
  return out;
}

function saveState(state) {
  const normalized = normalizeState(state);
  const target = statePath();
  mkdirSync(dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  renameSync(temporary, target);
  return normalized;
}

/* ---------------------------------------------------------------- journal -- */

/**
 * The update journal.
 *
 * This DSH ships a plugin manager without an in-place update: `installBundle`
 * refuses a package the profile already declares, so an update is
 * `removeBundle` + `installBundle`. If the process dies between the two the
 * plugin is simply gone, so the intent is written down first and replayed on
 * the next start.
 */
function journalPath() {
  return join(dshHome(), 'plugin-shelf', 'pending-updates.json');
}

function loadJournal() {
  try {
    const raw = JSON.parse(readFileSync(journalPath(), 'utf8'));
    const operations = Array.isArray(raw && raw.operations) ? raw.operations : [];
    return operations
      .filter(entry => entry !== null && typeof entry === 'object' && typeof entry.name === 'string')
      .map(entry => ({
        name: entry.name,
        profile: typeof entry.profile === 'string' ? entry.profile : undefined,
        targetVersion: typeof entry.targetVersion === 'string' ? entry.targetVersion : undefined,
        beforeVersion: typeof entry.beforeVersion === 'string' ? entry.beforeVersion : undefined,
        enabled: entry.enabled !== false,
        attempts: Number.isFinite(entry.attempts) ? entry.attempts : 0,
        step: typeof entry.step === 'string' ? entry.step : 'removing',
        startedAt: Number.isFinite(entry.startedAt) ? entry.startedAt : Date.now(),
        error: typeof entry.error === 'string' ? entry.error : undefined,
      }));
  } catch {
    return [];
  }
}

function saveJournal(operations) {
  const target = journalPath();
  mkdirSync(dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify({ schema: JOURNAL_SCHEMA, operations }, null, 2)}\n`, 'utf8');
  renameSync(temporary, target);
}

/** Insert or update one operation, keeping a single record per plugin name. */
function noteOperation(operation) {
  const operations = loadJournal().filter(entry => entry.name !== operation.name);
  operations.push({ ...operation, startedAt: operation.startedAt === undefined ? Date.now() : operation.startedAt });
  saveJournal(operations);
}

function clearOperation(name) {
  const operations = loadJournal();
  const remaining = operations.filter(entry => entry.name !== name);
  if (remaining.length !== operations.length) saveJournal(remaining);
}

function pendingOperations() {
  return loadJournal().map(entry => ({
    name: entry.name,
    targetVersion: entry.targetVersion,
    beforeVersion: entry.beforeVersion,
    step: entry.step,
    attempts: entry.attempts,
    error: entry.error,
    startedAt: entry.startedAt,
  }));
}

/* ---------------------------------------------------------------- measure -- */

const sizeCache = new Map();

/** Bytes on disk for one package directory, without following symlinks. */
function directorySize(root) {
  let total = 0;
  let visited = 0;
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      visited += 1;
      if (visited > 60_000) return total;
      const absolute = join(current, entry.name);
      if (entry.isSymbolicLink()) {
        try {
          const link = lstatSync(absolute);
          total += link.size;
        } catch {
          /* unreadable link: costs nothing measurable */
        }
        continue;
      }
      if (entry.isDirectory()) {
        stack.push(absolute);
        continue;
      }
      try {
        total += statSync(absolute).size;
      } catch {
        /* a file that vanished mid-walk simply is not counted */
      }
    }
  }
  return total;
}

/** `node_modules/<name>` with scoped names kept intact. */
function packagePath(profile, name) {
  if (typeof profile !== 'string' || typeof name !== 'string' || name === '') return undefined;
  const candidate = join(profile, 'node_modules', ...name.split('/'));
  return existsSync(candidate) ? candidate : undefined;
}

function measure(profile, name) {
  const cached = sizeCache.get(name);
  if (cached !== undefined && Date.now() - cached.at < SIZE_TTL_MS) return cached;
  const path = packagePath(profile, name);
  const result = { name, sizeBytes: 0, installedAt: 0, at: Date.now() };
  if (path !== undefined) {
    try {
      const link = lstatSync(path);
      result.installedAt = Math.round(link.mtimeMs);
    } catch {
      /* no link metadata: fall through to the directory itself */
    }
    let real = path;
    try {
      real = realpathSync(path);
    } catch {
      /* not resolvable through the link: measure the link target path as-is */
    }
    result.sizeBytes = directorySize(real);
    if (result.installedAt === 0) {
      try {
        result.installedAt = Math.round(statSync(real).mtimeMs);
      } catch {
        /* stays 0 and the UI shows "unknown" */
      }
    }
  }
  sizeCache.set(name, result);
  return result;
}

/* ------------------------------------------------------------- inventory -- */

async function collect(ctx) {
  const manager = ctx.get('pluginManager');
  if (manager === undefined) throw new Error('host has no pluginManager service');
  const profile = profileDir();
  const bundles = await manager.listBundles();
  const plugins = [];
  for (const bundle of bundles) {
    const measured = measure(profile, bundle.name);
    const rows = Array.isArray(bundle.rows) ? bundle.rows : [];
    plugins.push({
      name: bundle.name,
      version: typeof bundle.version === 'string' ? bundle.version : undefined,
      enabled: bundle.enabled === true,
      installed: bundle.installed === true,
      official: bundle.official === true,
      removable: bundle.removable === true,
      availability: bundle.availability,
      source: typeof bundle.source === 'string' ? bundle.source : undefined,
      description: typeof bundle.description === 'string' ? bundle.description : undefined,
      title: typeof bundle.meta?.title === 'string' ? bundle.meta.title : undefined,
      sizeBytes: measured.sizeBytes,
      installedAt: measured.installedAt,
      entryIds: rows.map(row => row.entryId).filter(id => typeof id === 'string'),
      unknownRows: rows.filter(row => typeof row.entryId !== 'string').length,
    });
  }
  plugins.sort((a, b) => a.name.localeCompare(b.name));
  return {
    ok: true,
    profile: profile === undefined ? undefined : profile.split(sep).pop(),
    profileDir: profile,
    generatedAt: Date.now(),
    state: loadState(),
    pending: pendingOperations(),
    plugins,
  };
}

/* ----------------------------------------------------------------- semver -- */

/**
 * The version spec the profile manifest declares for a package.
 * `undefined` means the manifest does not declare it at all.
 */
function declaredSpec(name) {
  const specFields = ['dependencies', 'devDependencies', 'optionalDependencies'];
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(profileDir(), 'package.json'), 'utf8'));
  } catch {
    return undefined;
  }
  for (const field of specFields) {
    const table = manifest[field];
    if (table !== null && typeof table === 'object' && Object.hasOwn(table, name)) {
      return String(table[name]);
    }
  }
  return undefined;
}

const NON_REGISTRY_SPEC = /^(file:|link:|workspace:|portal:|git\+|git:|github:|bitbucket:|gitlab:|https?:|npm:)/i;

/**
 * Whether the declared spec actually points at `target`.
 * Non-registry specs cannot be compared, so they are treated as acceptable.
 */
function specPointsAt(spec, target) {
  if (typeof spec !== 'string' || spec === '') return false;
  if (NON_REGISTRY_SPEC.test(spec)) return true;
  if (typeof target !== 'string' || target === '') return false;
  const bare = spec.trim().replace(/^[\^~=<>v ]+/, '');
  if (bare === '' || bare === '*' || bare === 'latest') return true;
  return bare === target || bare.startsWith(`${target} `) || bare.split(' || ').includes(target);
}

function compareVersions(left, right) {
  const split = value => {
    const text = String(value ?? '').trim().replace(/^v/, '');
    const dash = text.indexOf('-');
    const core = dash === -1 ? text : text.slice(0, dash);
    const pre = dash === -1 ? '' : text.slice(dash + 1);
    return { core: core.split('.').map(part => Number.parseInt(part, 10) || 0), pre };
  };
  const a = split(left);
  const b = split(right);
  for (let index = 0; index < Math.max(a.core.length, b.core.length); index += 1) {
    const delta = (a.core[index] ?? 0) - (b.core[index] ?? 0);
    if (delta !== 0) return delta > 0 ? 1 : -1;
  }
  if (a.pre === b.pre) return 0;
  if (a.pre === '') return 1;
  if (b.pre === '') return -1;
  return a.pre > b.pre ? 1 : -1;
}

/** Run `worker` over `items` with at most `limit` in flight, preserving order. */
async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

/**
 * Latest published version of `name` on an npm-compatible registry.
 *
 * `pluginManager.inspect()` cannot answer this for an installed package —— it
 * refuses with `already-installed` for anything already named in the profile
 * manifest —— so the shelf asks the registry directly.
 */
async function fetchLatestVersion(name, registry) {
  const base = (typeof registry === 'string' && registry.trim() !== '' ? registry.trim() : DEFAULT_REGISTRY).replace(/\/+$/, '');
  const url = `${base}/${name.startsWith('@') ? name.replace('/', '%2f') : name}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPDATE_PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { accept: 'application/vnd.npm.install-v1+json, application/json' },
      signal: controller.signal,
    });
    if (response.status === 404) throw new Error('not-found');
    if (response.status === 401 || response.status === 403) throw new Error(`registry HTTP ${response.status}`);
    if (!response.ok) throw new Error(`registry HTTP ${response.status}`);
    const data = await response.json();
    const latest = data?.['dist-tags']?.latest ?? data?.version;
    if (typeof latest !== 'string' || latest === '') throw new Error('registry answered no latest version');
    return latest;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error(`registry timed out after ${UPDATE_PROBE_TIMEOUT_MS}ms`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/** Where a package would come from; anything not npm-like cannot be version-probed. */
function isRegistrySource(source) {
  if (typeof source !== 'string' || source === '') return true;
  return !/^(file:|link:|workspace:|portal:|git\+|github:|bitbucket:|gitlab:|https?:)/i.test(source);
}

/* -------------------------------------------------------------- mutations -- */

async function resolveTargets(ctx, names) {
  const manager = ctx.get('pluginManager');
  if (manager === undefined) throw new Error('host has no pluginManager service');
  const bundles = await manager.listBundles();
  const wanted = Array.isArray(names) && names.length > 0 ? new Set(names) : undefined;
  return bundles.filter(bundle => bundle.installed === true
    && bundle.availability === 'profile'
    && (wanted === undefined || wanted.has(bundle.name)));
}

async function setEnabled(ctx, payload) {
  const manager = ctx.get('pluginManager');
  if (manager === undefined) throw new Error('host has no pluginManager service');
  const enabled = payload?.enabled === true;
  const names = Array.isArray(payload?.names) ? payload.names.filter(name => typeof name === 'string') : [];
  if (names.length === 0) return { ok: true, changed: 0, rows: [] };
  const rows = [];
  for (const name of names) {
    try {
      const result = await manager.setBundleEnabled(name, enabled);
      rows.push({
        name,
        ok: result?.application !== 'failed',
        application: result?.application,
        changed: result?.changed === true,
        error: typeof result?.error === 'string' ? result.error : undefined,
      });
    } catch (error) {
      rows.push({ name, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return {
    ok: rows.every(row => row.ok),
    changed: rows.filter(row => row.changed).length,
    restartRequired: rows.some(row => row.application === 'restart-required'),
    rows,
  };
}

/**
 * Uninstall one or more plugins.
 *
 * Removal is the same primitive updates use (`removeBundle`) —— and it hits the
 * same wall: a plugin the running host still has mounted comes back as
 * `bundle-in-use`, so the answer says so plainly instead of pretending.
 * Group membership and journal rows for a removed plugin are dropped with it,
 * otherwise the panel would keep rendering a ghost row.
 */
async function uninstall(ctx, payload) {
  const manager = ctx.get('pluginManager');
  if (manager === undefined) throw new Error('host has no pluginManager service');
  const names = Array.isArray(payload?.names) ? payload.names.filter(name => typeof name === 'string' && name !== '') : [];
  if (names.length === 0) return { ok: true, removed: [], rows: [] };
  const profile = await collect(ctx);
  const removable = new Map(profile.plugins.map(plugin => [plugin.name, plugin]));
  const rows = [];
  for (const name of names) {
    const info = removable.get(name);
    if (info === undefined) {
      rows.push({ name, ok: false, error: 'not-installed' });
      continue;
    }
    if (info.removable !== true) {
      rows.push({ name, ok: false, error: 'builtin-not-removable' });
      continue;
    }
    try {
      const result = await manager.removeBundle(name);
      const failed = result?.application === 'failed';
      const failure = failed ? describeFailure(result?.error) : undefined;
      const live = failed && LIVE_MOUNT.test(failure);
      rows.push({
        name,
        ok: !failed,
        application: result?.application,
        version: info.version,
        needsRestart: live,
        error: failure,
      });
      if (!failed) {
        const state = loadState();
        for (const group of state.groups) group.members = group.members.filter(member => member !== name);
        saveState(state);
        const journal = loadJournal().filter(entry => entry.name !== name);
        saveJournal(journal);
        sizeCache.delete(name);
      } else if (live) {
        // The manager already disabled the bundle before failing; record the
        // removal so the next start finishes it instead of leaving a ghost.
        noteOperation({
          name,
          targetVersion: undefined,
          beforeVersion: info.version,
          enabled: false,
          step: 'uninstall',
          attempts: 1,
          error: failure,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      rows.push({ name, ok: false, needsRestart: LIVE_MOUNT.test(message), error: message });
    }
  }
  return {
    ok: rows.every(row => row.ok),
    removed: rows.filter(row => row.ok).map(row => row.name),
    restartRequired: rows.some(row => row.needsRestart === true || row.application === 'restart-required'),
    rows,
  };
}

/**
 * Compare every installed plugin against its registry's latest version.
 *
 * The probe goes to the registry itself: `pluginManager.inspect()` refuses an
 * already-installed package by design, so it can never answer "is there a newer
 * version" for the packages this panel manages.
 */
async function checkUpdates(ctx, payload) {
  const manager = ctx.get('pluginManager');
  if (manager === undefined) throw new Error('host has no pluginManager service');
  const targets = await resolveTargets(ctx, payload?.names);
  const registry = typeof payload?.registry === 'string' && payload.registry.trim() !== ''
    ? payload.registry.trim()
    : loadState().autoUpdate.registry;
  const rows = await mapLimit(targets, UPDATE_CONCURRENCY, async (bundle) => {
    const installedVersion = typeof bundle.version === 'string' ? bundle.version : undefined;
    const row = { name: bundle.name, installedVersion, latestVersion: undefined, updatable: false, source: bundle.source };
    if (!isRegistrySource(bundle.source)) {
      row.reason = 'non-npm-source';
      return row;
    }
    try {
      const latest = await fetchLatestVersion(bundle.name, registry);
      row.latestVersion = latest;
      if (installedVersion === undefined) {
        row.updatable = true;
        row.reason = 'unknown-installed-version';
      } else if (compareVersions(latest, installedVersion) > 0) {
        row.updatable = true;
        row.reason = 'newer-version';
      } else {
        row.reason = 'up-to-date';
      }
    } catch (error) {
      row.reason = `probe-failed: ${error instanceof Error ? error.message : String(error)}`;
    }
    return row;
  });
  return {
    ok: true,
    registry,
    checked: rows.length,
    updatable: rows.filter(row => row.updatable),
    rows,
  };
}

/** Flatten a `ChangeResult.error` (string or `{code, diagnostic, incompatible?}`) into one line. */
function describeFailure(error) {
  if (typeof error === 'string') return error;
  if (error !== null && typeof error === 'object') {
    const parts = [error.code, error.diagnostic].filter(part => typeof part === 'string' && part !== '');
    if (parts.length > 0) return parts.join(': ');
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

/** True when the manager rejected an approval list that no longer matches its pending set. */function isStaleApproval(result) {
  const error = result && result.error;
  const code = error !== null && typeof error === 'object' ? error.code : undefined;
  if (code === 'stale-approval') return true;
  return describeFailure(error === undefined ? '' : error).includes('stale-approval');
}

/**
 * Install with the approve list the user has granted, self-healing the two ways
 * pnpm's `allowBuilds` bucket can disagree with us: the manager rewrites that
 * bucket on every run, so an approval we already own can become "stale", and a
 * run that reports a build block only tells us the names afterwards.
 */
async function installBundleWithApprovals(manager, spec, options) {
  const approved = installApprovals().approvedBuilds ?? [];
  const attempts = [];
  if (approved.length > 0) {
    attempts.push(await manager.installBundle(spec, { ...options, approvedBuilds: approved }));
    if (isStaleApproval(attempts[attempts.length - 1])) {
      attempts.push(await manager.installBundle(spec, { ...options }));
    }
  } else {
    attempts.push(await manager.installBundle(spec, { ...options }));
  }
  const blocked = attempts[attempts.length - 1];
  const reported = Array.isArray(blocked && blocked.pendingBuilds) ? blocked.pendingBuilds : [];
  if (reported.length > 0 && reported.every(name => approved.includes(name))) {
    attempts.push(await manager.installBundle(spec, { ...options, approvedBuilds: reported }));
  }
  const result = attempts[attempts.length - 1];
  if (attempts.length > 1 && result !== null && typeof result === 'object') {
    result.attempts = attempts.map(entry => (entry === undefined ? 'undefined' : String(entry.application ?? 'error')));
  }
  return result;
}

/** Put a plugin back at `version` after a failed update, so a failure never leaves it uninstalled. */
async function rollbackTo(manager, name, version, enabled) {
  if (typeof version !== 'string' || version === '') return 'no-version';
  try {
    const result = await installBundleWithApprovals(manager, `${name}@${version}`, { enabled });
    if (result && (result.application === 'failed' || result.application === 'cancelled')) {
      return `failed: ${describeFailure(result.error === undefined ? result.application : result.error)}`;
    }
    return 'restored';
  } catch (error) {
    return `failed: ${describeFailure(error instanceof Error ? error.message : String(error))}`;
  }
}

/**
 * Update plugins: remove, then install the target version.
 *
 * `installBundle` refuses a package the profile already declares, so every
 * update is two manager operations, journalled so an interrupted run is
 * repaired on the next start instead of leaving the plugin uninstalled.
 */
/**
 * pnpm refuses an install whose dependency has a build script nobody approved,
 * and the profile's `allowBuilds` list is rewritten by the plugin manager on
 * every install, so a hand edit does not survive. The approve list therefore
 * lives in our own state: the panel asks the user once, then every later
 * install (including automatic ones) carries the approval through.
 */
function installApprovals(extra) {
  const fromState = loadState().autoUpdate.approvedBuilds ?? [];
  const fromPayload = Array.isArray(extra) ? extra.filter(item => typeof item === 'string' && item !== '') : [];
  const merged = [...new Set([...fromState, ...fromPayload])];
  return merged.length > 0 ? { approvedBuilds: merged } : {};
}

async function applyUpdates(ctx, payload) {
  const manager = ctx.get('pluginManager');
  if (manager === undefined) throw new Error('host has no pluginManager service');
  const names = Array.isArray(payload && payload.names) ? payload.names.filter(name => typeof name === 'string') : [];
  const all = await resolveTargets(ctx, names.length > 0 ? names : undefined);
  let targets = all;
  if (names.length === 0) {
    const report = await checkUpdates(ctx, {});
    const updatable = new Set(report.updatable.map(row => row.name));
    targets = targets.filter(bundle => updatable.has(bundle.name));
  }
  const bundleByName = new Map(all.map(bundle => [bundle.name, bundle]));
  const wanted = names.length > 0 ? names : targets.map(bundle => bundle.name);
  const applied = [];
  for (const name of wanted) {
    const bundle = bundleByName.get(name);
    const entry = { name, ok: false };
    try {
      if (bundle === undefined) throw new Error('not-installed');
      if (bundle.removable === false) throw new Error('not-removable');
      let version = payload && payload.versions && typeof payload.versions[name] === 'string' ? payload.versions[name] : undefined;
      if (version === undefined) {
        const registry = payload && typeof payload.registry === 'string' && payload.registry.trim() !== ''
          ? payload.registry.trim()
          : loadState().autoUpdate.registry;
        version = await fetchLatestVersion(name, registry);
      }
      entry.beforeVersion = bundle.version;
      entry.targetVersion = version;
      const record = {
        name,
        profile: bundle.availability,
        targetVersion: version,
        beforeVersion: bundle.version,
        enabled: bundle.enabled !== false,
      };
      noteOperation({ ...record, step: 'removing', attempts: 0 });
      const removed = await manager.removeBundle(name);
      entry.removed = removed && removed.application ? removed.application : 'removed';
      if (removed && removed.application === 'failed') {
        const failure = describeFailure(removed.error === undefined ? 'remove failed' : removed.error);
        if (LIVE_MOUNT.test(failure)) {
          // The bundle is mounted in this process, so it cannot be unloaded from
          // under itself. Disable it, remember the target version and finish on
          // the next start, when nothing of it is loaded any more.
          entry.needsRestart = true;
          entry.queued = true;
          entry.error = failure;
          try {
            const disabled = await manager.setBundleEnabled(name, false);
            entry.disabledForUpdate = disabled !== undefined && disabled.application !== undefined ? disabled.application : 'disabled';
          } catch (error) {
            entry.disabledForUpdate = describeFailure(error instanceof Error ? error.message : String(error));
          }
          noteOperation({ ...record, step: 'queued', attempts: 0, error: failure });
          applied.push(entry);
          continue;
        }
        throw new Error(failure);
      }
      noteOperation({ ...record, step: 'installing', attempts: 0 });
      const result = await installBundleWithApprovals(manager, `${name}@${version}`, {
        enabled: bundle.enabled !== false,
      });
      entry.stage = result && result.stage;
      entry.application = result && result.application;
      if (result && typeof result.version === 'string') {
        entry.version = result.version;
        entry.afterVersion = result.version;
      }
      entry.ok = !(result && (result.application === 'failed' || result.application === 'cancelled'));
      if (result && result.error !== undefined) entry.error = describeFailure(result.error);
      if (result && Array.isArray(result.pendingBuilds) && result.pendingBuilds.length > 0) entry.pendingBuilds = result.pendingBuilds;
      if (result && Array.isArray(result.warnings) && result.warnings.length > 0) entry.warnings = result.warnings.map(warning => String(warning));
      if (result && typeof result.restartReason === 'string') entry.restartReason = result.restartReason;
      if (entry.ok) {
        const declared = declaredSpec(name);
        entry.declared = declared ?? null;
        if (!specPointsAt(declared, version)) {
          entry.ok = false;
          entry.error = `declared-version-unchanged: ${declared === undefined ? 'not-declared' : declared}`;
        }
      }
      if (entry.ok) {
        clearOperation(name);
      } else {
        const rollback = await rollbackTo(manager, name, bundle.version, bundle.enabled !== false);
        entry.rollback = rollback;
        if (rollback === 'restored') clearOperation(name);
        else noteOperation({ ...record, step: 'installing', attempts: 1, error: entry.error });
      }
    } catch (error) {
      if (entry.error === undefined) {
        const message = error instanceof Error ? error.message : String(error);
        entry.error = describeFailure(message);
      }
      const before = bundle !== undefined && typeof bundle.version === 'string' ? bundle.version : entry.beforeVersion;
      if (entry.removed !== undefined || entry.removed === undefined) {
        const rollback = await rollbackTo(manager, name, before, bundle === undefined || bundle.enabled !== false);
        entry.rollback = rollback;
        if (rollback === 'restored') {
          clearOperation(name);
        } else {
          noteOperation({
            name,
            targetVersion: entry.targetVersion,
            beforeVersion: entry.beforeVersion,
            enabled: bundle === undefined || bundle.enabled !== false,
            step: 'installing',
            attempts: 1,
            error: entry.error,
          });
        }
      }
    }
    applied.push(entry);
  }
  sizeCache.clear();
  return { ok: applied.every(entry => entry.ok), applied };
}

/** Replay journal entries left behind by an interrupted update. */
async function repairUpdates(ctx) {
  const manager = ctx.get('pluginManager');
  if (manager === undefined) return { ok: false, repaired: [], pending: pendingOperations(), error: 'no-manager' };
  const operations = loadJournal();
  if (operations.length === 0) return { ok: true, repaired: [], pending: [] };
  const bundles = await manager.listBundles();
  const byName = new Map(bundles.map(bundle => [bundle.name, bundle]));
  const repaired = [];
  for (const operation of operations) {
    const current = byName.get(operation.name);
    // An uninstall that could not run while the plugin was mounted: after a
    // restart it is no longer loaded, so the removal completes here.
    if (operation.step === 'uninstall') {
      if (current === undefined || current.installed !== true) {
        clearOperation(operation.name);
        repaired.push({ name: operation.name, ok: true, uninstalled: true, skipped: 'already-gone' });
        continue;
      }
      try {
        const removed = await manager.removeBundle(operation.name);
        const failure = removed && removed.application === 'failed'
          ? describeFailure(removed.error === undefined ? 'remove failed' : removed.error)
          : undefined;
        if (failure !== undefined) {
          noteOperation({ ...operation, attempts: operation.attempts + 1, error: failure });
          repaired.push({ name: operation.name, ok: false, error: failure });
          continue;
        }
        const state = loadState();
        for (const group of state.groups) group.members = group.members.filter(member => member !== operation.name);
        saveState(state);
        sizeCache.delete(operation.name);
        clearOperation(operation.name);
        repaired.push({ name: operation.name, ok: true, uninstalled: true });
      } catch (error) {
        const message = describeFailure(error instanceof Error ? error.message : String(error));
        noteOperation({ ...operation, attempts: operation.attempts + 1, error: message });
        repaired.push({ name: operation.name, ok: false, error: message });
      }
      continue;
    }
    const declaredNow = declaredSpec(operation.name);
    const declaredOk = operation.targetVersion === undefined || specPointsAt(declaredNow, operation.targetVersion);
    const alreadyThere = current !== undefined
      && current.installed === true
      && (operation.targetVersion === undefined || current.version === operation.targetVersion)
      && declaredOk;
    if (!alreadyThere && current !== undefined && current.installed === true && !declaredOk) {
      noteOperation({ ...operation, attempts: operation.attempts + 1, error: `declared-version-mismatch: ${declaredNow === undefined ? 'not-declared' : declaredNow}` });
    }
    if (alreadyThere) {
      clearOperation(operation.name);
      repaired.push({ name: operation.name, ok: true, skipped: 'already-updated' });
      continue;
    }
    if (operation.targetVersion === undefined) {
      noteOperation({ ...operation, attempts: operation.attempts + 1, error: 'no target version recorded' });
      repaired.push({ name: operation.name, ok: false, error: 'no target version recorded' });
      continue;
    }
    try {
      // A queued entry still has the old version installed, so drop it first —
      // that is exactly the step that was impossible while it was mounted.
      if (operation.step === 'queued' || (current !== undefined && current.installed === true)) {
        try {
          const removed = await manager.removeBundle(operation.name);
          if (removed && removed.application === 'failed') {
            const failure = describeFailure(removed.error === undefined ? 'remove failed' : removed.error);
            if (LIVE_MOUNT.test(failure)) throw new Error(failure);
          }
        } catch (error) {
          const message = describeFailure(error instanceof Error ? error.message : String(error));
          if (LIVE_MOUNT.test(message)) throw error;
          // already gone or not removable: the install below decides the outcome
        }
      }
      const result = await installBundleWithApprovals(manager, `${operation.name}@${operation.targetVersion}`, {
        enabled: operation.enabled !== false,
      });
      if (result && (result.application === 'failed' || result.application === 'cancelled')) {
        throw new Error(describeFailure(result.error === undefined ? result.application : result.error));
      }
      const declaredAfter = declaredSpec(operation.name);
      if (!specPointsAt(declaredAfter, operation.targetVersion)) {
        const message = `declared-version-unchanged: ${declaredAfter === undefined ? 'not-declared' : declaredAfter}`;
        noteOperation({ ...operation, attempts: operation.attempts + 1, error: message });
        repaired.push({ name: operation.name, ok: false, error: message });
        continue;
      }
      if (operation.enabled !== false) {
        try {
          await manager.setBundleEnabled(operation.name, true);
        } catch (error) {
          repaired.push({ name: operation.name, ok: true, version: operation.targetVersion, reEnable: describeFailure(error instanceof Error ? error.message : String(error)) });
          clearOperation(operation.name);
          continue;
        }
      }
      clearOperation(operation.name);
      repaired.push({ name: operation.name, ok: true, version: operation.targetVersion, reEnable: operation.enabled !== false ? 'applied' : 'skipped' });
    } catch (error) {
      const message = describeFailure(error instanceof Error ? error.message : String(error));
      noteOperation({ ...operation, attempts: operation.attempts + 1, error: message });
      repaired.push({ name: operation.name, ok: false, error: message });
    }
  }
  sizeCache.clear();
  return { ok: repaired.every(row => row.ok), repaired, pending: pendingOperations() };
}

/* ------------------------------------------------------------- auto update -- */

let autoRunning = false;

async function runAutoCycle(ctx, { manual = false } = {}) {
  if (autoRunning) return { skipped: 'busy' };
  autoRunning = true;
  try {
    const state = loadState();
    const auto = state.autoUpdate;
    if (!manual && auto.enabled !== true) return { skipped: 'disabled' };
    let names = [];
    if (auto.scope === 'groups') {
      const selected = new Set(auto.groups);
      names = state.groups
        .filter(group => selected.has(group.id))
        .flatMap(group => group.members);
    }
    const report = await checkUpdates(ctx, { names });
    const updatable = report.updatable.map(row => row.name);
    let applied = [];
    if (auto.apply === true && updatable.length > 0) {
      const result = await applyUpdates(ctx, {
        names: updatable,
        registry: report.registry,
        versions: Object.fromEntries(report.updatable.map(row => [row.name, row.latestVersion])),
      });
      applied = result.applied;
    }
    const entry = {
      at: Date.now(),
      trigger: manual ? 'manual' : 'auto',
      checked: report.checked,
      updatable,
      rows: report.rows
        .filter(row => row.updatable)
        .map(row => ({ name: row.name, installedVersion: row.installedVersion, latestVersion: row.latestVersion, updatable: true })),
      applied: applied.map(row => ({ name: row.name, ok: row.ok, version: row.version, error: row.error })),
      errors: report.rows
        .filter(row => typeof row.reason === 'string' && (row.reason.startsWith('probe-failed') || row.reason === 'non-npm-source'))
        .map(row => ({ name: row.name, reason: row.reason })),
    };
    const latest = loadState();
    latest.autoUpdate.lastRun = entry.at;
    latest.autoUpdate.lastResult = { checked: entry.checked, updatable: entry.updatable.length, applied: entry.applied.length, trigger: entry.trigger, at: entry.at };
    latest.autoUpdate.log = [...latest.autoUpdate.log, entry].slice(-LOG_LIMIT);
    saveState(latest);
    return { ok: true, ...entry };
  } finally {
    autoRunning = false;
  }
}

/* ------------------------------------------------------------------ route -- */

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
}

/** Same-origin fence: the `Origin` header, when present, must match `Host`. */
function refuseOrigin(request) {
  const origin = request.headers.origin;
  if (typeof origin !== 'string' || origin === '') return undefined;
  const host = request.headers.host;
  try {
    return new URL(origin).host === host ? undefined : 403;
  } catch {
    return 403;
  }
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('request body too large'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (chunks.length === 0) { resolve({}); return; }
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        resolve(parsed !== null && typeof parsed === 'object' ? parsed : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

async function dispatch(ctx, op, payload) {
  switch (op) {
    case 'snapshot':
      return collect(ctx);
    case 'saveState': {
      // A partial patch must never wipe the whole document: merge onto what is
      // already stored, then normalise. Arrays (groups, log, approvedBuilds) are
      // replaced wholesale, which is what the UI sends anyway.
      const current = loadState();
      const saved = saveState(mergeState(current, payload?.state));
      return { ok: true, state: saved };
    }
    case 'setEnabled':
      return setEnabled(ctx, payload);
    case 'uninstall':
      return uninstall(ctx, payload);
    case 'checkUpdates':
      return checkUpdates(ctx, payload);
    case 'update':
      return applyUpdates(ctx, payload);
    case 'runAutoUpdate':
      return runAutoCycle(ctx, { manual: true });
    case 'repairUpdates':
      return repairUpdates(ctx);
    case 'clearPending': {
      const names = Array.isArray(payload?.names) ? payload.names.filter(name => typeof name === 'string') : [];
      const operations = loadJournal();
      const remaining = names.length === 0 ? [] : operations.filter(entry => !names.includes(entry.name));
      saveJournal(remaining);
      return { ok: true, cleared: operations.length - remaining.length, pending: pendingOperations() };
    }
    case 'approveBuilds': {
      const builds = Array.isArray(payload?.builds) ? payload.builds.filter(item => typeof item === 'string' && item !== '') : [];
      const current = loadState();
      const merged = [...new Set([...(current.autoUpdate.approvedBuilds ?? []), ...builds])];
      current.autoUpdate.approvedBuilds = merged;
      const saved = saveState(current);
      return { ok: true, approvedBuilds: saved.autoUpdate.approvedBuilds };
    }
    default:
      throw new Error(`unknown op: ${String(op)}`);
  }
}

/**
 * The whole plugin: one route, plus the auto-update ticker.
 *
 * Both halves wait for their services through `ctx.inject` —— on a cold start
 * the loader mounts plugins before `webServer`/`pluginManager` exist, and a
 * plain `ctx.get` there would silently drop the route for the whole session.
 */
export function apply(ctx) {
  ctx.inject(['webServer'], hostCtx => {
    hostCtx.effect(() => {
      const server = hostCtx.get('webServer');
      const dispose = server.register({
        kind: 'exact',
        path: ROUTE_PATH,
        async handler(request, response) {
          const refused = refuseOrigin(request);
          if (refused !== undefined) {
            sendJson(response, refused, { ok: false, error: 'cross-origin request refused' });
            return;
          }
          try {
            let op;
            let payload = {};
            if (request.method === 'GET') {
              const url = new URL(request.url ?? ROUTE_PATH, 'http://localhost');
              op = url.searchParams.get('op') ?? 'snapshot';
            } else if (request.method === 'POST') {
              payload = await readBody(request);
              op = typeof payload.op === 'string' ? payload.op : 'snapshot';
            } else {
              sendJson(response, 405, { ok: false, error: 'method not allowed' });
              return;
            }
            const result = await dispatch(ctx, op, payload);
            sendJson(response, 200, result);
          } catch (error) {
            sendJson(response, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
          }
        },
      });
      return () => { dispose(); };
    }, 'plugin-shelf: rpc route');
  });

  ctx.inject(['pluginManager'], hostCtx => {
    hostCtx.effect(() => {
      const timer = setTimeout(() => {
        repairUpdates(hostCtx).catch(() => {
          /* an unrepaired entry stays journalled and is offered again on the panel */
        });
      }, 4_000);
      if (typeof timer.unref === 'function') timer.unref();
      return () => { clearTimeout(timer); };
    }, 'plugin-shelf: interrupted update repair');

    hostCtx.effect(() => {
      const timer = setInterval(() => {
        const state = loadState();
        const auto = state.autoUpdate;
        if (auto.enabled !== true) return;
        if (Date.now() - auto.lastRun < clampInterval(auto.intervalMinutes) * 60_000) return;
        runAutoCycle(hostCtx, { manual: false }).catch(() => {
          /* a failed cycle leaves lastRun untouched, so the next tick retries */
        });
      }, TICK_MS);
      if (typeof timer.unref === 'function') timer.unref();
      return () => { clearInterval(timer); };
    }, 'plugin-shelf: auto update ticker');
  });
}
