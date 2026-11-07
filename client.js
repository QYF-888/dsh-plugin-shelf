/**
 * Plugin Shelf — browser half.
 *
 * One sidebar entry + one main panel. Everything factual comes from the host
 * route this bundle's `index.js` registers (`/plugin-shelf/api`); the panel
 * only renders, sorts, and sends intents back.
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-shelf',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useCallback, useEffect, useMemo, useRef, useState } = React;

    const NS = 'pluginShelf';
    const PANEL_ID = 'plugin-shelf';
    const UNGROUPED = '__ungrouped__';
    const RPC = '/plugin-shelf/api';

    const dict = {
      zh: {
        panel: '插件书架',
        title: '插件书架',
        subtitle: '管理已安装的插件：排序、分组、一键启停与自动更新',
        refresh: '刷新',
        enableAll: '全部启用',
        disableAll: '全部停用',
        sortBy: '排序',
        sortName: '名称',
        sortInstalled: '安装时间',
        sortSize: '大小',
        asc: '升序',
        desc: '降序',
        search: '搜索',
        searchPlaceholder: '搜索插件名…',
        newGroup: '新建分组',
        ungrouped: '未分组',
        rename: '重命名',
        deleteGroup: '删除分组',
        moveUp: '上移',
        moveDown: '下移',
        groupEnable: '启用本组',
        groupDisable: '停用本组',
        groupEmpty: '这个分组还没有插件',
        groupHidden: '这些插件被当前筛选隐藏，共',
        collapse: '折叠',
        expand: '展开',
        version: '版本',
        size: '大小',
        installedAt: '安装于',
        unknown: '未知',
        entries: '入口',
        moveTo: '移到',
        autoTitle: '自动更新',
        autoHint: '检查每个已安装插件在 registry 上的最新版本，并可自动安装。',
        autoEnable: '启用自动检查',
        autoApply: '发现新版本时自动安装',
        autoInterval: '检查间隔（分钟）',
        autoRegistry: '源地址',
        autoRegistryHint: '用于查最新版本的 npm registry，国内可换镜像',
        autoScopeAll: '全部插件',
        autoScopeGroups: '仅这些分组',
        autoRunNow: '立即检查并处理',
        updateAllNow: '一键更新',
        updateAllHint: '检查并安装所有可更新插件（逐个移除→安装，失败会自动回滚）',
        updateAllConfirm: '检查并安装全部可更新插件？期间会多次执行 pnpm 安装，可能需要一两分钟。',
        updateAllConfirmShort: '确认一键更新？',
        updateAllDone: '一键更新完成',
        pendingClear: '清理记录',
        pendingClearConfirm: '清空这份“未完成更新”记录？（只删记录，不动已安装插件）',
        pendingClearDone: '记录已清空',
        pendingClearConfirmShort: '确认清理？',
        pendingDismiss: '关闭（不删除记录）',
        pendingTotal: '共',
        pendingIncompatible: '版本与本机 DSH 不兼容，重试无法恢复；可「清理记录」后手动安装匹配版本',
        dismiss: '关闭',
        autoLast: '上次运行',
        autoNever: '还没有运行过',
        autoUpdatable: '可更新',
        autoChecked: '已检查',
        update: '更新',
        updateAll: '全部更新',
        checking: '检查中…',
        updating: '更新中…',
        nothingToUpdate: '没有发现可更新的插件',
        diagProbe: '探测失败',
        diagNonNpm: '非 npm 源',
        diagHint: '这些插件无法读取 registry 版本，已跳过自动更新',
        pendingTitle: '上次更新未完成',
        pendingHint: '这些插件在“移除→安装”之间被打断，重新安装即可恢复',
        pendingRetry: '重试安装',
        pendingOk: '已修复',
        foundUpdates: '发现可更新插件',
        total: '共',
        unit: '个插件',
        busyWorking: '处理中…',
        restartNeeded: '部分改动需要重启 DSH 才能完全生效',
        opFailed: '操作失败',
        saveFailed: '保存失败',
        confirmDeleteGroup: '删除这个分组？组内插件会回到“未分组”。',
        confirmDisableAll: '停用全部插件？这会收起所有插件的功能。',
        confirmEnableAll: '启用全部插件？',
        noHost: '暂时连不上 host 端，点“刷新”重试。',
        logs: '运行日志',
        appliedAt: '安装于',
        status: '状态',
        enabled: '已启用',
        disabled: '已停用',
        empty: '暂时没有已安装的插件',
        source: '来源',
        groupOrder: '分组顺序',
        autoScopeEmpty: '（未选择分组＝全部插件）',
        includeBuiltin: '显示内置',
        filter: '筛选',
        filterStatus: '状态',
        filterGroup: '分组',
        filterAll: '全部',
        filterEnabled: '已启用',
        filterDisabled: '已停用',
        filterUpdatable: '只看可更新',
        filterReset: '清空筛选',
        filterOnlyUngrouped: '仅未分组',
        filterActive: '已筛选',
        pickerTitle: '把插件加进分组',
        pickerHint: '勾选要加入这个分组的插件，已属于其他分组的会被移过来',
        pickerSearch: '搜索插件…',
        pickerSelectAll: '全选可见',
        pickerClear: '清空',
        pickerAdd: '加入分组',
        pickerCancel: '取消',
        pickerSelected: '已选',
        addPlugins: '加插件',
        setUngroupedName: '未分组名称',
        sortMenu: '排序方式',
        done: '完成',
        lastUpdate: '最近一次更新',
        updateFailed: '更新失败',
        buildBlocked: 'pnpm 拦下了依赖的构建脚本，需要先批准再重试',
        approveAndRetry: '批准并重试',
        approvedNow: '已记录批准，正在重试…',
        rollbackOk: '已回滚到原版本',
        rollbackFailed: '回滚没成功，插件可能已被移除',
        restartNeededHint: '宿主侧的改动（启用状态、版本）重启 DSH 后才完全生效',
        updateQueued: '已排队（插件被宿主占用，无法在线移除）',
        updateQueuedHint: '该插件已暂时停用并写入待办记录，重启 DSH 后会自动完成安装并恢复启用',
      },
      en: {
        panel: 'Plugin Shelf',
        title: 'Plugin Shelf',
        subtitle: 'Sort, group, switch and auto-update the plugins you already installed',
        refresh: 'Refresh',
        enableAll: 'Enable all',
        disableAll: 'Disable all',
        sortBy: 'Sort',
        sortName: 'Name',
        sortInstalled: 'Install time',
        sortSize: 'Size',
        asc: 'Ascending',
        desc: 'Descending',
        search: 'Search',
        searchPlaceholder: 'Filter by plugin name…',
        newGroup: 'New group',
        ungrouped: 'Ungrouped',
        rename: 'Rename',
        deleteGroup: 'Delete group',
        moveUp: 'Move up',
        moveDown: 'Move down',
        groupEnable: 'Enable group',
        groupDisable: 'Disable group',
        groupEmpty: 'This group has no plugins yet',
        groupHidden: 'Hidden by the current filter, total',
        collapse: 'Collapse',
        expand: 'Expand',
        version: 'Version',
        size: 'Size',
        installedAt: 'Installed',
        unknown: 'unknown',
        entries: 'entries',
        moveTo: 'Move to',
        autoTitle: 'Auto update',
        autoHint: 'Checks the registry for a newer version of every installed plugin, and can install it for you.',
        autoEnable: 'Enable automatic checks',
        autoApply: 'Install new versions automatically',
        autoInterval: 'Interval (minutes)',
        autoRegistry: 'Registry',
        autoRegistryHint: 'npm registry used to look up the latest version',
        autoScopeAll: 'All plugins',
        autoScopeGroups: 'Only these groups',
        autoRunNow: 'Check and apply now',
        updateAllNow: 'Update all',
        updateAllHint: 'Check and install every updatable plugin (remove → install per plugin, rollback on failure)',
        updateAllConfirm: 'Check and install every updatable plugin? pnpm runs several times; this can take a minute or two.',
        updateAllConfirmShort: 'Confirm update all?',
        updateAllDone: 'Bulk update finished',
        pendingClear: 'Clear records',
        pendingClearConfirm: 'Clear the unfinished-update records? Only the records are removed; installed plugins stay as they are.',
        pendingClearDone: 'Records cleared',
        pendingClearConfirmShort: 'Confirm clear?',
        pendingDismiss: 'Close (keep records)',
        pendingTotal: 'total',
        pendingIncompatible: 'this version is incompatible with the running DSH, re-installing will not help; clear the record and install a matching version',
        dismiss: 'Dismiss',
        autoLast: 'Last run',
        autoNever: 'never',
        autoUpdatable: 'updatable',
        autoChecked: 'checked',
        update: 'Update',
        updateAll: 'Update all',
        checking: 'Checking…',
        updating: 'Updating…',
        nothingToUpdate: 'No update available',
        diagProbe: 'probe failed',
        diagNonNpm: 'not npm-sourced',
        diagHint: 'Their registry version could not be read; they are skipped by auto update',
        pendingTitle: 'An update did not finish',
        pendingHint: 'These plugins were interrupted between remove and install; re-installing restores them',
        pendingRetry: 'Finish installing',
        pendingOk: 'repaired',
        foundUpdates: 'Updates available',
        total: 'Total',
        unit: 'plugins',
        busyWorking: 'Working…',
        restartNeeded: 'Some changes need a DSH restart to take full effect',
        opFailed: 'Operation failed',
        saveFailed: 'Save failed',
        confirmDeleteGroup: 'Delete this group? Its plugins go back to “Ungrouped”.',
        confirmDisableAll: 'Disable every plugin? That removes every plugin feature from this profile.',
        confirmEnableAll: 'Enable every plugin?',
        noHost: 'Cannot reach the host right now — press Refresh to retry.',
        logs: 'Run log',
        appliedAt: 'installed',
        status: 'Status',
        enabled: 'enabled',
        disabled: 'disabled',
        empty: 'No installed plugins',
        source: 'Source',
        groupOrder: 'Group order',
        autoScopeEmpty: '(nothing selected = all plugins)',
        includeBuiltin: 'Show built-in',
        filter: 'Filter',
        filterStatus: 'Status',
        filterGroup: 'Group',
        filterAll: 'All',
        filterEnabled: 'Enabled',
        filterDisabled: 'Disabled',
        filterUpdatable: 'Updatable only',
        filterReset: 'Clear filters',
        filterOnlyUngrouped: 'Ungrouped only',
        filterActive: 'filtered',
        pickerTitle: 'Add plugins to a group',
        pickerHint: 'Tick the plugins to put in this group; ones already in another group move here',
        pickerSearch: 'Search plugins…',
        pickerSelectAll: 'Select visible',
        pickerClear: 'Clear',
        pickerAdd: 'Add to group',
        pickerCancel: 'Cancel',
        pickerSelected: 'selected',
        addPlugins: 'Add plugins',
        setUngroupedName: 'Ungrouped name',
        sortMenu: 'Sort by',
        done: 'done',
        lastUpdate: 'Last update',
        updateFailed: 'Update failed',
        buildBlocked: 'pnpm blocked a dependency build script — approve it and retry',
        approveAndRetry: 'Approve and retry',
        approvedNow: 'Approval saved, retrying…',
        rollbackOk: 'Rolled back to the previous version',
        rollbackFailed: 'Rollback did not succeed — the plugin may be gone',
        restartNeededHint: 'Host-side changes (enablement, versions) apply after a DSH restart',
        updateQueued: 'Queued (the host still has this plugin loaded, so it cannot be removed live)',
        updateQueuedHint: 'The plugin was disabled and recorded as pending; the install completes and enablement is restored after a DSH restart',
      },
    };

    const browserLang = (() => {      try {
        const languages = (typeof navigator !== 'undefined' && (navigator.languages || [navigator.language])) || [];
        return languages.some(language => /^zh/i.test(String(language))) ? 'zh' : 'en';
      } catch {
        return 'zh';
      }
    })();

    /* ----------------------------------------------------------- boundary -- */

    class ShelfBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { error: null };
      }

      static getDerivedStateFromError(error) {
        return { error };
      }

      render() {
        const error = this.state.error;
        if (error === null) return this.props.children;
        const text = error && (error.stack || error.message) ? (error.stack || error.message) : String(error);
        return h('pre', {
          style: {
            padding: 16, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            fontSize: 12, color: '#c0392b', fontFamily: 'ui-monospace, monospace',
          },
        }, `Plugin Shelf 渲染失败 / render failed:\n${text}`);
      }
    }

    /* ------------------------------------------------------------- helpers -- */

    const PREFS_KEY = 'dsh-plugin-shelf:ui-prefs';
    function readPrefs() {
      try {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(PREFS_KEY) : null;
        const parsed = raw ? JSON.parse(raw) : null;
        return typeof parsed === 'object' && parsed !== null ? parsed : {};
      } catch {
        return {};
      }
    }
    function writePrefs(next) {
      try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
    }

    async function rpc(op, payload) {
      const response = await fetch(RPC, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op, ...(payload || {}) }),
      });
      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error(`HTTP ${response.status}`);
      }
      if (!response.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${response.status}`);
      return data;
    }

    function formatSize(bytes) {
      const value = Number(bytes) || 0;
      if (value <= 0) return '—';
      const units = ['B', 'KB', 'MB', 'GB'];
      let index = 0;
      let scaled = value;
      while (scaled >= 1024 && index < units.length - 1) {
        scaled /= 1024;
        index += 1;
      }
      return `${scaled >= 100 || index === 0 ? Math.round(scaled) : scaled.toFixed(1)} ${units[index]}`;
    }

    function formatTime(ms, fallback) {
      const value = Number(ms) || 0;
      if (value <= 0) return fallback;
      const date = new Date(value);
      const pad = number => String(number).padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    function cloneState(state) {
      return JSON.parse(JSON.stringify(state ?? {}));
    }

    // A journal entry is identified by what it was trying to do, not just by the
    // plugin name: a dismissed failure must come back when the same plugin fails
    // again for a different target version or in a different step.
    function pendingKey(entry) {
      const name = entry?.name ?? '?';
      const version = entry?.targetVersion ?? '?';
      const step = entry?.step ?? '?';
      return `${name}@${version}:${step}`;
    }

    function nextGroupId(groups) {
      let index = groups.length + 1;
      const taken = new Set(groups.map(group => group.id));
      while (taken.has(`group-${index}`)) index += 1;
      return `group-${index}`;
    }

    /* ------------------------------------------------------------ components -- */

    const styles = `
.psx-root { height: 100%; overflow: auto; padding: 20px 22px 60px; color: var(--dsw-alias-label-primary); }
.psx-head { display: flex; align-items: flex-start; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
.psx-head-main { flex: 1 1 260px; min-width: 220px; }
.psx-title { font-size: 18px; font-weight: 650; margin: 0 0 4px; }
.psx-sub { font-size: 12px; color: var(--dsw-alias-label-secondary); }
.psx-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.psx-card { background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; padding: 12px 14px; margin-bottom: 12px; }
.psx-toolbar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.psx-label { font-size: 12px; color: var(--dsw-alias-label-secondary); }
.psx-btn { appearance: none; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); border-radius: 7px; padding: 5px 10px; font-size: 12px; cursor: pointer; line-height: 1.4; }
.psx-btn:hover:not(:disabled) { border-color: var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-overlay); }
.psx-btn:disabled { opacity: .5; cursor: not-allowed; }
.psx-btn.psx-primary { background: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); color: #fff; }
.psx-btn.psx-danger:hover:not(:disabled) { color: var(--dsw-alias-state-error-primary); border-color: var(--dsw-alias-state-error-primary); }
.psx-btn.psx-icon { padding: 3px 7px; font-size: 12px; }
.psx-select, .psx-input { appearance: none; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); border-radius: 7px; padding: 5px 8px; font-size: 12px; }
.psx-input.psx-grow { flex: 1 1 160px; }
.psx-group { border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; margin-bottom: 12px; background: var(--dsw-alias-bg-layer-1); overflow: hidden; }
.psx-group-head { display: flex; align-items: center; gap: 8px; padding: 9px 12px; background: var(--dsw-alias-bg-layer-2); flex-wrap: wrap; }
.psx-group-name { font-size: 13px; font-weight: 600; cursor: pointer; }
.psx-group-body { padding: 4px 0; }
.psx-row { display: flex; align-items: center; gap: 10px; padding: 7px 12px; border-top: 1px solid var(--dsw-alias-border-l1); flex-wrap: wrap; }
.psx-row:first-child { border-top: none; }
.psx-row-main { flex: 1 1 240px; min-width: 180px; }
.psx-row-name { font-size: 13px; font-weight: 550; word-break: break-all; }
.psx-row-meta { font-size: 11px; color: var(--dsw-alias-label-secondary); display: flex; gap: 8px; flex-wrap: wrap; margin-top: 2px; }
.psx-off .psx-row-name { color: var(--dsw-alias-label-secondary); text-decoration: line-through; text-decoration-thickness: 1px; }
.psx-switch { position: relative; width: 38px; height: 21px; border-radius: 999px; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-base); cursor: pointer; padding: 0; flex: none; }
.psx-switch span { position: absolute; top: 2px; left: 2px; width: 15px; height: 15px; border-radius: 50%; background: var(--dsw-alias-label-secondary); transition: transform .15s ease, background .15s ease; }
.psx-switch.psx-on { background: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); }
.psx-switch.psx-on span { transform: translateX(17px); background: #fff; }
.psx-switch:disabled { opacity: .5; cursor: not-allowed; }
.psx-badge { font-size: 11px; padding: 1px 6px; border-radius: 999px; border: 1px solid var(--dsw-alias-border-l1); color: var(--dsw-alias-label-secondary); }
.psx-badge.psx-warn { color: var(--dsw-alias-state-warn-primary); border-color: var(--dsw-alias-state-warn-primary); }
.psx-badge.psx-ok { color: var(--dsw-alias-state-success-primary); border-color: var(--dsw-alias-state-success-primary); }
.psx-badge.psx-err { color: var(--dsw-alias-state-error-primary); border-color: var(--dsw-alias-state-error-primary); }
.psx-empty { font-size: 12px; color: var(--dsw-alias-label-secondary); padding: 10px 12px; }
.psx-note { font-size: 11px; color: var(--dsw-alias-label-secondary); margin-top: 6px; line-height: 1.6; }
.psx-toast { position: sticky; bottom: 0; margin-top: 12px; padding: 8px 12px; border-radius: 8px; font-size: 12px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-overlay); }
.psx-toast.psx-err { color: var(--dsw-alias-state-error-primary); border-color: var(--dsw-alias-state-error-primary); }
.psx-log { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: var(--dsw-alias-label-secondary); max-height: 160px; overflow: auto; background: var(--dsw-alias-bg-base); border-radius: 8px; padding: 8px 10px; border: 1px solid var(--dsw-alias-border-l1); }
.psx-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.psx-check { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer; }
.psx-rename { font-size: 13px; padding: 2px 6px; }
.psx-anchor { position: relative; display: inline-flex; }
.psx-pop { position: absolute; top: calc(100% + 6px); left: 0; z-index: 40; min-width: 160px; padding: 5px; border-radius: 9px; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-overlay); box-shadow: 0 10px 28px rgba(0,0,0,.28); }
.psx-pop-right { left: auto; right: 0; }
.psx-pop-item { display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 9px; border-radius: 6px; border: none; background: transparent; color: var(--dsw-alias-label-primary); font-size: 12px; text-align: left; cursor: pointer; }
.psx-pop-item:hover { background: var(--dsw-alias-bg-layer-2); }
.psx-pop-item.psx-active { color: var(--dsw-alias-brand-primary); font-weight: 600; }
.psx-pop-tick { width: 12px; flex: none; color: var(--dsw-alias-brand-primary); }
.psx-pop-sep { height: 1px; margin: 4px 2px; background: var(--dsw-alias-border-l1); }
.psx-pop-title { padding: 5px 9px 3px; font-size: 11px; color: var(--dsw-alias-label-secondary); }
.psx-trigger { display: inline-flex; align-items: center; gap: 6px; }
.psx-trigger .psx-caret { font-size: 9px; color: var(--dsw-alias-label-secondary); }
.psx-trigger.psx-on { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-brand-primary); }
.psx-overlay { position: fixed; inset: 0; z-index: 90; background: rgba(0,0,0,.42); display: flex; align-items: flex-start; justify-content: center; padding: 6vh 16px 16px; }
.psx-modal { width: min(640px, 100%); max-height: 82vh; display: flex; flex-direction: column; border-radius: 12px; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-overlay); box-shadow: 0 24px 60px rgba(0,0,0,.4); overflow: hidden; }
.psx-modal-head { padding: 13px 16px 9px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.psx-modal-tools { display: flex; gap: 8px; align-items: center; padding: 10px 16px; border-bottom: 1px solid var(--dsw-alias-border-l1); flex-wrap: wrap; }
.psx-modal-list { flex: 1 1 auto; overflow: auto; padding: 6px 8px; }
.psx-modal-foot { display: flex; gap: 8px; align-items: center; padding: 11px 16px; border-top: 1px solid var(--dsw-alias-border-l1); }
.psx-pick { display: flex; align-items: center; gap: 9px; padding: 6px 8px; border-radius: 7px; cursor: pointer; }
.psx-pick:hover { background: var(--dsw-alias-bg-layer-2); }
.psx-pick input { margin: 0; }
.psx-pick-main { flex: 1 1 auto; min-width: 0; }
.psx-pick-name { font-size: 12px; font-weight: 550; word-break: break-all; }
.psx-pick-meta { font-size: 11px; color: var(--dsw-alias-label-secondary); margin-top: 1px; }
.psx-filterbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: -4px 0 12px; }
`;

    function Switch({ checked, disabled, onToggle, title }) {
      return h('button', {
        type: 'button',
        className: `psx-switch${checked ? ' psx-on' : ''}`,
        role: 'switch',
        'aria-checked': checked ? 'true' : 'false',
        title,
        disabled,
        onClick: () => onToggle(!checked),
      }, h('span'));
    }

    /* ------------------------------------------------------------ dropdown -- */

    function Dropdown(props) {
      const { label, active, align, items, title, disabled } = props;
      const [open, setOpen] = React.useState(false);
      const ref = React.useRef(null);
      React.useEffect(() => {
        if (!open) return undefined;
        const onPointer = event => {
          const node = ref.current;
          if (node && event.target instanceof Node && node.contains(event.target)) return;
          setOpen(false);
        };
        const onKey = event => {
          if (event.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onPointer, true);
        document.addEventListener('keydown', onKey, true);
        return () => {
          document.removeEventListener('mousedown', onPointer, true);
          document.removeEventListener('keydown', onKey, true);
        };
      }, [open]);
      return h('div', { className: 'psx-anchor', ref },
        h('button', {
          type: 'button',
          className: `psx-btn psx-trigger${active ? ' psx-on' : ''}`,
          title: title ?? label,
          disabled: disabled === true,
          onClick: () => setOpen(value => !value),
        },
          h('span', null, label),
          h('span', { className: 'psx-caret' }, '▼'),
        ),
        open
          ? h('div', { className: `psx-pop${align === 'right' ? ' psx-pop-right' : ''}` },
            items.map(item => (item.separator === true
              ? h('div', { key: item.key, className: 'psx-pop-sep' })
              : (item.heading === true
                ? h('div', { key: item.key, className: 'psx-pop-title' }, item.label)
                : h('button', {
                  key: item.key,
                  type: 'button',
                  className: `psx-pop-item${item.checked ? ' psx-active' : ''}`,
                  title: item.title ?? item.label,
                  onClick: () => {
                    setOpen(false);
                    if (typeof item.onSelect === 'function') item.onSelect();
                  },
                },
                  h('span', { className: 'psx-pop-tick' }, item.checked ? '✓' : ''),
                  h('span', null, item.label),
                )))),
          )
          : null,
      );
    }

    /* -------------------------------------------------------------- picker -- */

    function PluginPicker(props) {
      const { title, hint, plugins, groups, preselected, onConfirm, onCancel, t } = props;
      const [picked, setPicked] = React.useState(() => new Set(Array.isArray(preselected) ? preselected : []));
      const [needle, setNeedle] = React.useState('');
      const memberOf = React.useMemo(() => {
        const map = new Map();
        for (const group of groups) {
          for (const name of group.members ?? []) map.set(name, group.name);
        }
        return map;
      }, [groups]);
      const shown = React.useMemo(() => {
        const text = needle.trim().toLowerCase();
        return text === '' ? plugins : plugins.filter(plugin => plugin.name.toLowerCase().includes(text));
      }, [plugins, needle]);
      React.useEffect(() => {
        const onKey = event => {
          if (event.key === 'Escape') onCancel();
        };
        document.addEventListener('keydown', onKey, true);
        return () => document.removeEventListener('keydown', onKey, true);
      }, [onCancel]);
      const toggle = name => setPicked(previous => {
        const next = new Set(previous);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        return next;
      });
      return h('div', {
        className: 'psx-overlay',
        onMouseDown: event => {
          if (event.target === event.currentTarget) onCancel();
        },
      },
        h('div', { className: 'psx-modal' },
          h('div', { className: 'psx-modal-head' },
            h('div', { className: 'psx-title', style: { fontSize: 14 } }, title),
            h('div', { className: 'psx-note' }, hint),
          ),
          h('div', { className: 'psx-modal-tools' },
            h('input', {
              className: 'psx-input psx-grow',
              placeholder: t('pickerSearch'),
              value: needle,
              autoFocus: true,
              onChange: event => setNeedle(event.target.value),
            }),
            h('button', {
              type: 'button',
              className: 'psx-btn',
              onClick: () => setPicked(previous => {
                const next = new Set(previous);
                for (const plugin of shown) next.add(plugin.name);
                return next;
              }),
            }, t('pickerSelectAll')),
            h('button', { type: 'button', className: 'psx-btn', onClick: () => setPicked(new Set()) }, t('pickerClear')),
          ),
          h('div', { className: 'psx-modal-list' },
            shown.length === 0
              ? h('div', { className: 'psx-empty' }, t('empty'))
              : shown.map(plugin => h('label', { key: plugin.name, className: 'psx-pick' },
                h('input', {
                  type: 'checkbox',
                  checked: picked.has(plugin.name),
                  onChange: () => toggle(plugin.name),
                }),
                h('div', { className: 'psx-pick-main' },
                  h('div', { className: 'psx-pick-name' }, plugin.name),
                  h('div', { className: 'psx-pick-meta' },
                    `v${plugin.version ?? '?'} · ${formatSize(plugin.sizeBytes)}`
                    + (memberOf.has(plugin.name) ? ` · ${t('moveTo')} ${memberOf.get(plugin.name)}` : ` · ${t('ungrouped')}`)
                    + (plugin.enabled ? '' : ` · ${t('disabled')}`)),
                ),
              )),
          ),
          h('div', { className: 'psx-modal-foot' },
            h('span', { className: 'psx-label' }, `${picked.size} ${t('pickerSelected')}`),
            h('div', { style: { flex: 1 } }),
            h('button', { type: 'button', className: 'psx-btn', onClick: onCancel }, t('pickerCancel')),
            h('button', {
              type: 'button',
              className: 'psx-btn psx-primary',
              onClick: () => onConfirm([...picked]),
            }, t('pickerAdd')),
          ),
        ),
      );
    }

    function PluginRow(props) {
      const { plugin, groups, busy, onToggle, onMove, t } = props;
      const groupId = groups.find(group => group.members.includes(plugin.name))?.id ?? '';
      return h('div', { className: `psx-row${plugin.enabled ? '' : ' psx-off'}` },
        h('div', { className: 'psx-row-main' },
          h('div', { className: 'psx-row-name' }, plugin.name),
          h('div', { className: 'psx-row-meta' },
            h('span', null, `v${plugin.version ?? '?'}`),
            h('span', null, `${t('size')} ${formatSize(plugin.sizeBytes)}`),
            h('span', null, `${t('installedAt')} ${formatTime(plugin.installedAt, t('unknown'))}`),
            Array.isArray(plugin.entryIds) && plugin.entryIds.length > 0
              ? h('span', null, `${plugin.entryIds.length} ${t('entries')}`)
              : null,
            plugin.official ? h('span', { className: 'psx-badge' }, 'official') : null,
          ),
        ),
        h(Dropdown, {
          label: groupId === '' ? t('ungrouped') : (groups.find(group => group.id === groupId)?.name ?? t('ungrouped')),
          title: t('moveTo'),
          align: 'right',
          disabled: busy,
          items: [
            { key: '', label: t('ungrouped'), checked: groupId === '', onSelect: () => onMove(plugin.name, null) },
            ...(groups.length === 0
              ? [{ key: '__none__', heading: true, label: '—' }]
              : groups.map(group => ({
                key: group.id,
                label: group.name,
                checked: groupId === group.id,
                onSelect: () => onMove(plugin.name, group.id),
              }))),
          ],
        }),
        h(Switch, {
          checked: plugin.enabled,
          disabled: busy,
          title: plugin.enabled ? t('enabled') : t('disabled'),
          onToggle: next => onToggle([plugin.name], next),
        }),
      );
    }

    function AutoUpdateCard(props) {
      const { state, groups, busy, result, onPatch, onRun, onUpdate, onUpdateAll, onApproveRetry, t } = props;
      const [confirmAll, setConfirmAll] = React.useState(false);
      const [bulkHidden, setBulkHidden] = React.useState(false);
      const bulkRef = React.useRef(null);
      React.useEffect(() => {
        if (result?.bulk !== bulkRef.current) {
          bulkRef.current = result?.bulk ?? null;
          setBulkHidden(false);
        }
      }, [result?.bulk]);
      const auto = state.autoUpdate;
      const updating = busy.get('__update__') === true;
      const updatingAll = busy.get('__updateall__') === true;
      const running = busy.get('__auto__') === true;
      const rows = Array.isArray(result?.rows) ? result.rows : [];
      const updatable = rows.filter(row => row.updatable);
      const log = Array.isArray(auto.log) ? auto.log.slice(-6).reverse() : [];
      const last = result?.lastUpdate ?? null;
      const pendingBuilds = Array.isArray(last?.pendingBuilds) ? last.pendingBuilds : [];
      const lastFailed = last !== null && last !== undefined && last.ok !== true;
      return h('div', { className: 'psx-card' },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' } },
          h('div', { style: { flex: '1 1 220px' } },
            h('div', { style: { fontSize: 13, fontWeight: 600 } }, t('autoTitle')),
            h('div', { className: 'psx-note', style: { marginTop: 2 } }, t('autoHint')),
          ),
          h('label', { className: 'psx-check' },
            h('input', {
              type: 'checkbox',
              checked: auto.enabled === true,
              onChange: event => onPatch({ enabled: event.target.checked }),
            }),
            t('autoEnable'),
          ),
          h('label', { className: 'psx-check' },
            h('input', {
              type: 'checkbox',
              checked: auto.apply === true,
              onChange: event => onPatch({ apply: event.target.checked }),
            }),
            t('autoApply'),
          ),
          h('label', { className: 'psx-check' },
            t('autoInterval'),
            h('input', {
              className: 'psx-input',
              type: 'number',
              min: 5,
              max: 10080,
              style: { width: 74 },
              value: auto.intervalMinutes,
              onChange: event => onPatch({ intervalMinutes: Number(event.target.value) || 5 }),
            }),
          ),
          h('label', { className: 'psx-check', title: t('autoRegistryHint') },
            t('autoRegistry'),
            h('input', {
              className: 'psx-input',
              style: { width: 220 },
              value: auto.registry ?? '',
              placeholder: 'https://registry.npmjs.org',
              onChange: event => onPatch({ registry: event.target.value }),
            }),
          ),
          h('button', {
            type: 'button',
            className: 'psx-btn psx-primary',
            disabled: running || updating || updatingAll,
            onClick: onRun,
          }, running ? t('checking') : t('autoRunNow')),
          h('button', {
            type: 'button',
            className: `psx-btn${updatable.length > 0 ? ' psx-primary' : ''}`,
            title: t('updateAllHint'),
            disabled: running || updating || updatingAll,
            onClick: () => {
              if (confirmAll !== true) {
                setConfirmAll(true);
                window.setTimeout(() => setConfirmAll(false), 4000);
                return;
              }
              setConfirmAll(false);
              onUpdateAll();
            },
          }, updatingAll
            ? t('updating')
            : (confirmAll === true
              ? t('updateAllConfirmShort')
              : `${t('updateAllNow')}${updatable.length > 0 ? ` (${updatable.length})` : ''}`)),
        ),
        h('div', { className: 'psx-note' },
          `${t('autoLast')}: ${auto.lastRun ? formatTime(auto.lastRun, t('autoNever')) : t('autoNever')}`,
          auto.lastResult
            ? ` · ${t('autoChecked')} ${auto.lastResult.checked} · ${t('autoUpdatable')} ${auto.lastResult.updatable}`
            : '',
        ),
        h('div', { style: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 } },
          h('span', { className: 'psx-label' }, t('autoScopeGroups')),
          groups.length === 0
            ? h('span', { className: 'psx-note' }, t('autoScopeEmpty'))
            : h('div', { className: 'psx-chips' },
              groups.map(group => {
                const selected = Array.isArray(auto.groups) && auto.groups.includes(group.id);
                return h('label', { key: group.id, className: 'psx-check' },
                  h('input', {
                    type: 'checkbox',
                    checked: selected,
                    onChange: event => {
                      const current = Array.isArray(auto.groups) ? auto.groups : [];
                      const next = event.target.checked
                        ? [...current, group.id]
                        : current.filter(id => id !== group.id);
                      onPatch({ groups: next, scope: next.length > 0 ? 'groups' : 'all' });
                    },
                  }),
                  group.name,
                );
              }),
            ),
        ),
        updatable.length > 0
          ? h('div', { style: { marginTop: 10 } },
            h('div', { className: 'psx-label' }, `${t('foundUpdates')}: ${updatable.length}`),
            h('div', { className: 'psx-group', style: { marginTop: 6 } },
              updatable.map(row => h('div', { key: row.name, className: 'psx-row' },
                h('div', { className: 'psx-row-main' },
                  h('div', { className: 'psx-row-name' }, row.name),
                  h('div', { className: 'psx-row-meta' },
                    h('span', null, `${row.installedVersion ?? '?'} → ${row.latestVersion ?? '?'}`),
                  ),
                ),
                h('button', {
                  type: 'button',
                  className: 'psx-btn',
                  disabled: updating,
                  onClick: () => onUpdate(row.name, row.latestVersion),
                }, t('update')),
              )),
            ),
          )
          : (result !== null && result !== undefined
            ? h('div', { className: 'psx-note' }, t('nothingToUpdate'))
            : null),
        (() => {
          const probeFailed = rows.filter(row => typeof row.reason === 'string' && row.reason.startsWith('probe-failed'));
          const nonNpm = rows.filter(row => row.reason === 'non-npm-source');
          if (probeFailed.length === 0 && nonNpm.length === 0) return null;
          return h('details', { style: { marginTop: 8 } },
            h('summary', { className: 'psx-note', style: { cursor: 'pointer' } },
              `${t('diagProbe')} ${probeFailed.length} · ${t('diagNonNpm')} ${nonNpm.length} —— ${t('diagHint')}`),
            h('div', { className: 'psx-log', style: { marginTop: 6 } },
              [...probeFailed, ...nonNpm].map(row => h('div', { key: row.name }, `${row.name} — ${row.reason}`)),
            ),
          );
        })(),
        (() => {
          const bulk = result?.bulk;
          if (bulk === null || bulk === undefined || bulkHidden) return null;
          const queued = Array.isArray(bulk.queued) ? bulk.queued : [];
          const failed = Array.isArray(bulk.failed) ? bulk.failed : [];
          const okAll = bulk.ok === true && failed.length === 0;
          return h('div', {
            className: 'psx-card',
            style: {
              marginTop: 10,
              borderColor: okAll
                ? 'var(--dsw-alias-state-success-primary, #16a34a)'
                : 'var(--dsw-alias-state-warn-primary, #d97706)',
            },
          },
            h('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 8 } },
              h('div', { className: 'psx-label', style: { flex: 1 } },
                `${t('updateAllDone')} · ${bulk.done ?? 0}/${bulk.total ?? 0}`
                + (queued.length > 0 ? ` · ${t('updateQueued')} ${queued.length}` : '')
                + (failed.length > 0 ? ` · ${t('updateFailed')} ${failed.length}` : '')),
              h('button', {
                type: 'button',
                className: 'psx-btn psx-icon',
                title: t('dismiss'),
                onClick: () => setBulkHidden(true),
              }, '✕'),
            ),
            queued.length > 0
              ? h('div', { className: 'psx-note' }, `${queued.join('、')} —— ${t('updateQueuedHint')}`)
              : null,
            failed.length > 0
              ? h('div', { className: 'psx-log', style: { marginTop: 6 } },
                failed.map(entry => h('div', { key: entry.name },
                  `${entry.name} — ${String(entry.error ?? '').slice(0, 160)}`)))
              : null,
          );
        })(),
        last === null || last === undefined
          ? null
          : h('div', {
            className: 'psx-card',
            style: {
              marginTop: 10,
              borderColor: lastFailed
                ? 'var(--dsw-alias-state-error-primary, #dc2626)'
                : 'var(--dsw-alias-state-success-primary, #16a34a)',
            },
          },
          h('div', { className: 'psx-label' },
            `${t('lastUpdate')} · ${last.name} ${last.beforeVersion ?? '?'} → ${last.targetVersion ?? last.version ?? '?'}`),
          last.queued === true
            ? h('div', { className: 'psx-note', style: { color: 'var(--dsw-alias-state-warn-primary, #d97706)' } },
              `${t('updateQueued')} · ${t('updateQueuedHint')}`)
            : (lastFailed
              ? h('div', { className: 'psx-note meta', style: { color: 'var(--dsw-alias-state-error-primary, #dc2626)' } },
                `${t('updateFailed')}: ${String(last.error ?? last.application ?? '?').slice(0, 400)}`)
              : h('div', { className: 'psx-note' }, `${t('done')} · ${last.afterVersion ?? last.version ?? ''}`)),
          last.rollback === 'restored'
            ? h('div', { className: 'psx-note' }, `↩ ${t('rollbackOk')}`)
            : (last.rollback !== undefined && last.rollback !== null
              ? h('div', { className: 'psx-note', style: { color: 'var(--dsw-alias-state-error-primary, #dc2626)' } }, `⚠ ${t('rollbackFailed')} (${String(last.rollback).slice(0, 120)})`)
              : null),
          last.application === 'restart-required' || last.restartReason !== undefined
            ? h('div', { className: 'psx-note', style: { color: 'var(--dsw-alias-state-warn-primary, #d97706)' } },
              `${t('restartNeeded')}${last.restartReason ? ` · ${last.restartReason}` : ''}`)
            : null,
          pendingBuilds.length > 0
            ? h('div', { style: { marginTop: 8 } },
              h('div', { className: 'psx-note' }, `${t('buildBlocked')}:`),
              h('div', { className: 'psx-log', style: { marginTop: 4 } },
                pendingBuilds.map(build => h('div', { key: build }, build))),
              h('button', {
                type: 'button',
                className: 'psx-btn psx-primary',
                style: { marginTop: 6 },
                disabled: updating,
                onClick: async () => {
                  await onApproveRetry(last.name, last.targetVersion, pendingBuilds);
                },
              }, t('approveAndRetry')),
            )
            : null,
        ),
        log.length > 0
          ? h('details', { style: { marginTop: 10 } },            h('summary', { className: 'psx-label', style: { cursor: 'pointer' } }, t('logs')),
            h('div', { className: 'psx-log', style: { marginTop: 6 } },
              log.map((entry, index) => h('div', { key: `${entry.at}-${index}` },
                `${formatTime(entry.at, '')} [${entry.trigger}] ${t('autoChecked')} ${entry.checked} · ${t('autoUpdatable')} ${(entry.updatable || []).length}`
                + (entry.applied && entry.applied.length > 0 ? ` · applied ${entry.applied.filter(row => row.ok).length}/${entry.applied.length}` : ''),
              )),
            ),
          )
          : null,
      );
    }

    function GroupCard(props) {
      const { group, groups, plugins, allPlugins, busy, sort, onRename, onDelete, onMove, onToggleGroup, onToggleAll, onReorder, onCollapse, onTogglePlugin, onAddPlugins, t } = props;
      const busyAny = busy instanceof Map ? busy.size > 0 : busy === true;
      const members = plugins.filter(plugin => group.members.includes(plugin.name));
      const memberPool = Array.isArray(allPlugins) ? allPlugins : plugins;
      const totalMembers = memberPool.filter(plugin => group.members.includes(plugin.name));
      const enabledCount = members.filter(plugin => plugin.enabled).length;
      const collapsed = group.collapsed === true;
      const [editing, setEditing] = React.useState(false);
      const [draft, setDraft] = React.useState(group.name);
      const beginEdit = () => {
        setDraft(group.name);
        setEditing(true);
      };
      const commitEdit = () => {
        setEditing(false);
        const trimmed = String(draft ?? '').trim();
        if (trimmed === '' || trimmed === group.name) return;
        onRename(trimmed);
      };
      const nameNode = editing
        ? h('input', {
          className: 'psx-input psx-group-input',
          style: { width: 190, fontSize: 13, fontWeight: 600 },
          autoFocus: true,
          value: draft,
          onChange: event => {
            const value = event.currentTarget.value;
            setDraft(value);
            const trimmed = value.trim();
            if (trimmed !== '' && trimmed !== group.name) onRename(trimmed);
          },
          onKeyDown: event => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitEdit();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              setEditing(false);
            }
          },
          onBlur: commitEdit,
        })
        : h('span', { className: 'psx-group-name', onClick: onCollapse, title: collapsed ? t('expand') : t('collapse') },
          `${collapsed ? '▸' : '▾'} ${group.name}`);
      return h('div', { className: 'psx-group' },
        h('div', { className: 'psx-group-head' },
          nameNode,
          h('span', { className: 'psx-badge' }, `${enabledCount}/${totalMembers.length}`),
          h('div', { style: { flex: 1 } }),
          h('button', { type: 'button', className: 'psx-btn psx-icon', title: t('moveUp'), disabled: busyAny, onClick: () => onReorder(group.id, -1) }, '↑'),
          h('button', { type: 'button', className: 'psx-btn psx-icon', title: t('moveDown'), disabled: busyAny, onClick: () => onReorder(group.id, 1) }, '↓'),
          h('button', { type: 'button', className: 'psx-btn psx-icon', title: t('rename'), disabled: busyAny || editing, onClick: beginEdit }, '✎'),
          group.id === UNGROUPED
            ? null
            : h('button', { type: 'button', className: 'psx-btn', title: t('pickerTitle'), disabled: busyAny, onClick: () => onAddPlugins(group) }, `+ ${t('addPlugins')}`),
          h('button', {
            type: 'button',
            className: 'psx-btn',
            disabled: busyAny || members.length === 0,
            onClick: () => onToggleGroup(members, true),
          }, t('groupEnable')),
          h('button', {
            type: 'button',
            className: 'psx-btn',
            disabled: busyAny || members.length === 0,
            onClick: () => onToggleGroup(members, false),
          }, t('groupDisable')),
          group.id !== UNGROUPED
            ? h('button', { type: 'button', className: 'psx-btn psx-danger psx-icon', title: t('deleteGroup'), disabled: busyAny, onClick: onDelete }, '✕')
            : null,
        ),
        collapsed ? null : h('div', { className: 'psx-group-body' },
          members.length === 0
            ? h('div', { className: 'psx-empty' }, totalMembers.length === 0 ? t('groupEmpty') : `${t('groupHidden')} ${totalMembers.length}`)
            : members.map(plugin => h(PluginRow, {
              key: plugin.name,
              plugin,
              groups,
              busy: busy.get(plugin.name) === true,
              onToggle: names => onTogglePlugin(names, !plugin.enabled),
              onMove: onMove,
              t,
            })),
        ),
      );
    }

    /* ----------------------------------------------------------------- page -- */

    function ShelfPage() {
      const shelf = React.useContext(ShelfContext);
      const {
        snap, error, busy, result, st, query, setQuery, loading,
        reload, mutateState, togglePlugins, runAuto, updateOne, updateAll, repair, clearPending, approveAndRetry, t,
      } = shelf;

      const includeBuiltin = st?.ui?.includeBuiltin === true;
      const allPlugins = Array.isArray(snap?.plugins) ? snap.plugins : [];
      const plugins = includeBuiltin
        ? allPlugins
        : allPlugins.filter(plugin => plugin.installed === true && plugin.availability === 'profile');
      const groups = Array.isArray(st?.groups) ? st.groups : [];

      const [picker, setPicker] = React.useState(null);
      const [confirmClear, setConfirmClear] = React.useState(false);
      const [prefs, setPrefs] = React.useState(readPrefs);
      const patchPrefs = patch => setPrefs(previous => {
        const next = { ...previous, ...patch };
        writePrefs(next);
        return next;
      });
      const ui = st?.ui ?? {};
      React.useEffect(() => {
        if (typeof st?.ui !== 'object' || st.ui === null) return;
        const mirror = {};
        if (typeof st.ui.ungroupedName === 'string') mirror.ungroupedName = st.ui.ungroupedName;
        if (typeof st.ui.ungroupedCollapsed === 'boolean') mirror.ungroupedCollapsed = st.ui.ungroupedCollapsed;
        if (st.ui.filter && typeof st.ui.filter === 'object') mirror.filter = st.ui.filter;
        if (Object.keys(mirror).length === 0) return;
        setPrefs(previous => {
          const merged = { ...previous, ...mirror };
          writePrefs(merged);
          return merged;
        });
      }, [st]);
      const filter = (typeof ui.filter === 'object' && ui.filter !== null) ? ui.filter : (prefs.filter ?? {});
      const ungroupedName = (typeof ui.ungroupedName === 'string' && ui.ungroupedName.trim() !== '')
        ? ui.ungroupedName
        : (typeof prefs.ungroupedName === 'string' ? prefs.ungroupedName : '');
      const ungroupedCollapsed = typeof ui.ungroupedCollapsed === 'boolean'
        ? ui.ungroupedCollapsed
        : prefs.ungroupedCollapsed === true;
      const statusFilter = filter.status === 'on' || filter.status === 'off' ? filter.status : 'all';
      const groupFilter = typeof filter.group === 'string' && filter.group !== '' ? filter.group : 'all';
      const onlyUpdatable = filter.updatable === true;
      const updatableNames = useMemo(() => {
        const rows = Array.isArray(result?.rows) ? result.rows : [];
        return new Set(rows.filter(row => row.updatable === true).map(row => row.name));
      }, [result]);
      const patchFilter = patch => {
        const next = {
          status: patch.status ?? statusFilter,
          group: patch.group ?? groupFilter,
          updatable: 'updatable' in patch ? patch.updatable : onlyUpdatable,
        };
        patchPrefs({ filter: next });
        mutateState(state => {
          state.ui = state.ui ?? {};
          state.ui.filter = next;
        });
      };
      const filterActive = statusFilter !== 'all' || groupFilter !== 'all' || onlyUpdatable;
      const pendingList = Array.isArray(snap?.pending) ? snap.pending : [];
      const pendingSeen = Array.isArray(ui.pendingSeen) ? ui.pendingSeen : [];
      const unseenPending = pendingList.filter(entry => !pendingSeen.includes(pendingKey(entry)));
      const pendingVisible = unseenPending.length > 0;

      const visible = useMemo(() => {
        const needle = query.trim().toLowerCase();
        let list = needle === '' ? plugins : plugins.filter(plugin => plugin.name.toLowerCase().includes(needle));
        if (statusFilter === 'on') list = list.filter(plugin => plugin.enabled === true);
        else if (statusFilter === 'off') list = list.filter(plugin => plugin.enabled !== true);
        if (onlyUpdatable) list = list.filter(plugin => updatableNames.has(plugin.name));
        const key = st?.sort?.key ?? 'installedAt';
        const dir = st?.sort?.dir === 'asc' ? 1 : -1;
        const compare = (left, right) => {
          if (key === 'name') return left.name.localeCompare(right.name) * dir;
          if (key === 'size') return ((left.sizeBytes || 0) - (right.sizeBytes || 0)) * dir;
          return ((left.installedAt || 0) - (right.installedAt || 0)) * dir;
        };
        return [...list].sort(compare);
      }, [plugins, query, st?.sort?.key, st?.sort?.dir, statusFilter, onlyUpdatable, updatableNames]);

      const allNames = allPlugins
        .filter(plugin => plugin.installed === true && plugin.availability === 'profile')
        .map(plugin => plugin.name);

      const groupsForRender = useMemo(() => {
        const ordered = [...groups].sort((left, right) => left.order - right.order);
        const assigned = new Set(ordered.flatMap(group => group.members));
        const ungroupedMembers = visible.filter(plugin => !assigned.has(plugin.name)).map(plugin => plugin.name);
        const ungrouped = {
          id: UNGROUPED,
          name: ungroupedName.trim() !== '' ? ungroupedName : t('ungrouped'),
          order: Number.MAX_SAFE_INTEGER,
          members: ungroupedMembers,
          collapsed: ungroupedCollapsed,
        };
        const cards = [...ordered, ungrouped];
        if (groupFilter === 'all') return cards;
        return cards.filter(card => card.id === groupFilter);
      }, [groups, visible, t, ungroupedName, ungroupedCollapsed, groupFilter]);

      const pickerPlugins = useMemo(() => [...plugins].sort((left, right) => left.name.localeCompare(right.name)), [plugins]);

      const busyAny = busy.size > 0;

      if (error !== null) {
        return h('div', { className: 'psx-root' },
          h('style', null, styles),
          h('div', { className: 'psx-card' },
            h('div', { className: 'psx-title' }, t('title')),
            h('div', { className: 'psx-note' }, t('noHost')),
            h('div', { className: 'psx-toast psx-err', style: { marginTop: 8 } }, String(error)),
            h('button', { type: 'button', className: 'psx-btn psx-primary', style: { marginTop: 8 }, onClick: reload }, t('refresh')),
          ),
        );
      }

      return h('div', { className: 'psx-root' },
        h('style', null, styles),
        h('div', { className: 'psx-head' },
          h('div', { className: 'psx-head-main' },
            h('h2', { className: 'psx-title' }, t('title')),
            h('div', { className: 'psx-sub' }, t('subtitle')),
            snap
              ? h('div', { className: 'psx-note' },
                `${t('total')} ${filterActive ? `${visible.length}/${plugins.length}` : plugins.length} ${t('unit')}`
                + (filterActive ? ` · ${t('filterActive')}` : '')
                + (snap.profile ? ` · profile ${snap.profile}` : '')
                + (loading ? ' · …' : ''))
              : null,
          ),
          h('div', { className: 'psx-actions' },
            h('button', { type: 'button', className: 'psx-btn', onClick: reload, disabled: loading }, t('refresh')),
            h('button', {
              type: 'button',
              className: 'psx-btn',
              disabled: busyAny || plugins.length === 0,
              onClick: () => {
                if (typeof window !== 'undefined' && !window.confirm(t('confirmEnableAll'))) return;
                togglePlugins(allNames, true);
              },
            }, t('enableAll')),
            h('button', {
              type: 'button',
              className: 'psx-btn',
              disabled: busyAny || plugins.length === 0,
              onClick: () => {
                if (typeof window !== 'undefined' && !window.confirm(t('confirmDisableAll'))) return;
                togglePlugins(allNames, false);
              },
            }, t('disableAll')),
          ),
        ),

        h('div', { className: 'psx-card psx-toolbar' },
          h(Dropdown, {
            label: `${t('sortBy')}: ${st?.sort?.key === 'name' ? t('sortName') : (st?.sort?.key === 'size' ? t('sortSize') : t('sortInstalled'))}`,
            title: t('sortMenu'),
            items: [
              { key: 'name', label: t('sortName'), checked: (st?.sort?.key ?? 'installedAt') === 'name', onSelect: () => mutateState(state => { state.sort = { ...state.sort, key: 'name' }; }) },
              { key: 'installedAt', label: t('sortInstalled'), checked: (st?.sort?.key ?? 'installedAt') === 'installedAt', onSelect: () => mutateState(state => { state.sort = { ...state.sort, key: 'installedAt' }; }) },
              { key: 'size', label: t('sortSize'), checked: (st?.sort?.key ?? 'installedAt') === 'size', onSelect: () => mutateState(state => { state.sort = { ...state.sort, key: 'size' }; }) },
            ],
          }),
          h('button', {
            type: 'button',
            className: 'psx-btn',
            title: st?.sort?.dir === 'asc' ? t('asc') : t('desc'),
            onClick: () => mutateState(state => {
              state.sort = { ...state.sort, dir: state.sort?.dir === 'asc' ? 'desc' : 'asc' };
            }),
          }, st?.sort?.dir === 'asc' ? `${t('asc')} ↑` : `${t('desc')} ↓`),
          h('input', {
            className: 'psx-input psx-grow',
            placeholder: t('searchPlaceholder'),
            value: query,
            onChange: event => setQuery(event.target.value),
          }),
          h(Dropdown, {
            label: `${t('filterStatus')}: ${statusFilter === 'on' ? t('filterEnabled') : (statusFilter === 'off' ? t('filterDisabled') : t('filterAll'))}`,
            title: t('filterStatus'),
            align: 'right',
            active: statusFilter !== 'all',
            items: [
              { key: 'all', label: t('filterAll'), checked: statusFilter === 'all', onSelect: () => patchFilter({ status: 'all' }) },
              { key: 'on', label: t('filterEnabled'), checked: statusFilter === 'on', onSelect: () => patchFilter({ status: 'on' }) },
              { key: 'off', label: t('filterDisabled'), checked: statusFilter === 'off', onSelect: () => patchFilter({ status: 'off' }) },
            ],
          }),
          h(Dropdown, {
            label: `${t('filterGroup')}: ${groupFilter === 'all'
              ? t('filterAll')
              : (groupFilter === UNGROUPED
                ? (ungroupedName || t('ungrouped'))
                : (groups.find(group => group.id === groupFilter)?.name ?? t('filterAll'))) }`,
            title: t('filterGroup'),
            align: 'right',
            active: groupFilter !== 'all',
            items: [
              { key: 'all', label: t('filterAll'), checked: groupFilter === 'all', onSelect: () => patchFilter({ group: 'all' }) },
              { key: UNGROUPED, label: ungroupedName || t('ungrouped'), checked: groupFilter === UNGROUPED, onSelect: () => patchFilter({ group: UNGROUPED }) },
              ...(groups.length === 0 ? [] : [{ key: '__sep__', separator: true }]),
              ...groups
                .slice()
                .sort((left, right) => left.order - right.order)
                .map(group => ({ key: group.id, label: group.name, checked: groupFilter === group.id, onSelect: () => patchFilter({ group: group.id }) })),
            ],
          }),
          h('button', {
            type: 'button',
            className: `psx-btn${onlyUpdatable ? ' psx-primary' : ''}`,
            title: t('filterUpdatable'),
            onClick: () => patchFilter({ updatable: !onlyUpdatable }),
          }, t('filterUpdatable')),
          filterActive
            ? h('button', {
              type: 'button',
              className: 'psx-btn',
              onClick: () => patchFilter({ status: 'all', group: 'all', updatable: false }),
            }, t('filterReset'))
            : null,
          h('button', {
            type: 'button',
            className: 'psx-btn psx-primary',
            onClick: () => {
              const id = nextGroupId(groups);
              mutateState(state => {
                state.groups = [...(state.groups || []), { id, name: `${t('newGroup')} ${(state.groups || []).length + 1}`, order: (state.groups || []).length, members: [], collapsed: false }];
              });
              setPicker({ groupId: id, name: `${t('newGroup')} ${groups.length + 1}` });
            },
          }, `+ ${t('newGroup')}`),
          h('label', { className: 'psx-check', title: t('includeBuiltin') },
            h('input', {
              type: 'checkbox',
              checked: includeBuiltin,
              onChange: event => mutateState(state => {
                state.ui = state.ui ?? {};
                state.ui.includeBuiltin = event.target.checked;
              }),
            }),
            t('includeBuiltin'),
          ),
        ),

        pendingVisible
          ? h('div', { className: 'psx-card', style: { borderColor: 'var(--dsw-alias-state-warn-primary, #d97706)' } },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' } },
              h('div', { style: { flex: '1 1 240px' } },
                h('div', { className: 'psx-title', style: { fontSize: 13 } },
                  `${t('pendingTitle')} (${unseenPending.length})`
                  + (pendingList.length > unseenPending.length ? ` · ${t('pendingTotal')} ${pendingList.length}` : '')),
                h('div', { className: 'psx-note' }, t('pendingHint')),
              ),
              h('button', {
                type: 'button',
                className: 'psx-btn psx-primary',
                disabled: busyAny,
                onClick: repair,
              }, t('pendingRetry')),
              h('button', {
                type: 'button',
                className: 'psx-btn',
                disabled: busyAny,
                onClick: () => {
                  if (confirmClear !== true) {
                    setConfirmClear(true);
                    setTimeout(() => setConfirmClear(false), 4000);
                    return;
                  }
                  setConfirmClear(false);
                  clearPending();
                },
              }, confirmClear === true ? t('pendingClearConfirmShort') : t('pendingClear')),
              h('button', {
                type: 'button',
                className: 'psx-btn psx-icon',
                title: t('pendingDismiss'),
                onClick: () => mutateState(state => {
                  state.ui = state.ui ?? {};
                  state.ui.pendingSeen = (snap.pending ?? []).map(entry => pendingKey(entry));
                }),
              }, '✕'),
            ),
            h('div', { className: 'psx-log', style: { marginTop: 6 } },
              snap.pending.map(entry => {
                const failure = entry.error ? String(entry.error) : '';
                const incompatible = /incompatible-version/.test(failure);
                return h('div', { key: pendingKey(entry) },
                  `${entry.name} ${entry.beforeVersion ?? '?'} → ${entry.targetVersion ?? '?'} · ${entry.step}`
                  + (failure ? ' · ' + failure.split(String.fromCharCode(10)).join(' ').replace(String.fromCharCode(13), ' ').slice(0, 160) : '')
                  + (incompatible ? ` —— ${t('pendingIncompatible')}` : '')
                );
              }),
            ),
          )
          : null,

        st?.autoUpdate ? h(AutoUpdateCard, {
          state: st,
          groups: groups.filter(group => group.id !== UNGROUPED),
          busy,
          result,
          onPatch: patch => mutateState(state => { state.autoUpdate = { ...state.autoUpdate, ...patch }; }),
          onRun: runAuto,
          onUpdate: updateOne,
          onUpdateAll: updateAll,
          onApproveRetry: approveAndRetry,
          t,
        }) : null,

        groupsForRender.map(group => h(GroupCard, {
          key: group.id,
          group,
          allPlugins: plugins,
          groups: groups.slice().sort((left, right) => left.order - right.order),
          plugins: visible,
          busy,
          sort: st?.sort,
          t,
          onTogglePlugin: (names, enabled) => togglePlugins(names, enabled),
          onToggleGroup: (members, enabled) => togglePlugins(members.map(plugin => plugin.name), enabled),
          onRename: name => {
            const trimmed = typeof name === 'string' ? name.trim() : '';
            if (trimmed === '') return;
            if (group.id === UNGROUPED) {
              patchPrefs({ ungroupedName: trimmed });
              mutateState(state => {
                state.ui = state.ui ?? {};
                state.ui.ungroupedName = trimmed;
              });
              return;
            }
            mutateState(state => {
              const target = state.groups.find(entry => entry.id === group.id);
              if (target) target.name = trimmed;
            });
          },
          onDelete: () => {
            if (group.id === UNGROUPED) return;
            if (typeof window !== 'undefined' && !window.confirm(t('confirmDeleteGroup'))) return;
            mutateState(state => { state.groups = state.groups.filter(entry => entry.id !== group.id); });
          },
          onMove: (name, targetId) => mutateState(state => {
            for (const entry of state.groups) entry.members = entry.members.filter(member => member !== name);
            if (targetId !== null) {
              const target = state.groups.find(entry => entry.id === targetId);
              if (target && !target.members.includes(name)) target.members.push(name);
            }
          }),
          onReorder: (id, delta) => mutateState(state => {
            const ordered = [...state.groups].sort((left, right) => left.order - right.order);
            const index = ordered.findIndex(entry => entry.id === id);
            const swapWith = index + delta;
            if (index < 0 || swapWith < 0 || swapWith >= ordered.length) return;
            const moved = ordered[index];
            ordered[index] = ordered[swapWith];
            ordered[swapWith] = moved;
            ordered.forEach((entry, position) => { entry.order = position; });
            state.groups = ordered;
          }),
          onCollapse: () => {
            if (group.id === UNGROUPED) {
              const next = !ungroupedCollapsed;
              patchPrefs({ ungroupedCollapsed: next });
              mutateState(state => {
                state.ui = state.ui ?? {};
                state.ui.ungroupedCollapsed = next;
              });
              return;
            }
            mutateState(state => {
              const target = state.groups.find(entry => entry.id === group.id);
              if (target) target.collapsed = !(target.collapsed === true);
            });
          },
          onAddPlugins: target => setPicker({ groupId: target.id, name: target.name }),
        })),

        picker !== null
          ? h(PluginPicker, {
            title: `${t('pickerTitle')} · ${picker.name}`,
            hint: t('pickerHint'),
            plugins: pickerPlugins,
            groups,
            preselected: (groups.find(group => group.id === picker.groupId)?.members ?? []),
            t,
            onCancel: () => setPicker(null),
            onConfirm: names => {
              const groupId = picker.groupId;
              setPicker(null);
              mutateState(state => {
                const target = (state.groups || []).find(entry => entry.id === groupId);
                if (!target) return;
                for (const entry of state.groups) entry.members = (entry.members ?? []).filter(member => !names.includes(member));
                target.members = [...new Set([...(target.members ?? []), ...names])];
              });
            },
          })
          : null,

        plugins.length === 0 ? h('div', { className: 'psx-empty' }, t('empty')) : null,
        busyAny ? h('div', { className: 'psx-toast' }, t('busyWorking')) : null,
      );
    }

    const ShelfContext = React.createContext(null);

    function ShelfProvider(props) {
      const { t } = props;
      const [snap, setSnap] = useState(null);
      const [error, setError] = useState(null);
      const [busy, setBusy] = useState(() => new Map());
      const [result, setResult] = useState(null);
      const [st, setSt] = useState(null);
      const [query, setQuery] = useState('');
      const [loading, setLoading] = useState(false);
      const saveTimer = useRef(null);
      const pendingState = useRef(null);

      const mark = useCallback((key, value) => {
        setBusy(previous => {
          const next = new Map(previous);
          if (value) next.set(key, true);
          else next.delete(key);
          return next;
        });
      }, []);

      const load = useCallback(async () => {
        setLoading(true);
        try {
          const data = await rpc('snapshot');
          setSnap(data);
          setSt(previous => (pendingState.current === null ? data.state : previous));
          setError(null);
        } catch (issue) {
          setError(issue instanceof Error ? issue.message : String(issue));
        } finally {
          setLoading(false);
        }
      }, []);

      useEffect(() => { load(); }, [load]);

      const flush = useCallback(async () => {
        const state = pendingState.current;
        if (state === null) return;
        pendingState.current = null;
        try {
          await rpc('saveState', { state });
        } catch (issue) {
          setError(`${t('saveFailed')}: ${issue instanceof Error ? issue.message : String(issue)}`);
        }
      }, [t]);

      const mutateState = useCallback(updater => {
        setSt(previous => {
          const next = cloneState(previous ?? {});
          next.sort = next.sort ?? { key: 'installedAt', dir: 'desc' };
          next.groups = Array.isArray(next.groups) ? next.groups : [];
          next.autoUpdate = next.autoUpdate ?? {};
          next.ui = next.ui ?? { collapsed: {} };
          updater(next);
          pendingState.current = next;
          if (saveTimer.current !== null) clearTimeout(saveTimer.current);
          saveTimer.current = setTimeout(() => { flush(); }, 350);
          return next;
        });
      }, [flush]);

      useEffect(() => () => {
        if (saveTimer.current !== null) clearTimeout(saveTimer.current);
      }, []);

      const togglePlugins = useCallback(async (names, enabled) => {
        const list = (Array.isArray(names) ? names : []).filter(name => typeof name === 'string');
        if (list.length === 0) return;
        for (const name of list) mark(name, true);
        mark('__all__', true);
        try {
          const data = await rpc('setEnabled', { names: list, enabled });
          if (data.restartRequired) setResult({ note: t('restartNeeded') });
          await load();
        } catch (issue) {
          setError(`${t('opFailed')}: ${issue instanceof Error ? issue.message : String(issue)}`);
          await load();
        } finally {
          for (const name of list) mark(name, false);
          mark('__all__', false);
        }
      }, [load, mark, t]);

      const updateAll = useCallback(async () => {
        mark('__updateall__', true);
        try {
          await flush();
          const data = await rpc('update', {});
          const applied = Array.isArray(data?.applied) ? data.applied : [];
          const failed = applied.filter(entry => entry.ok !== true);
          setResult(previous => ({
            ...(previous ?? {}),
            bulk: {
              ok: data?.ok === true,
              total: applied.length,
              done: applied.filter(entry => entry.ok === true).length,
              queued: applied.filter(entry => entry.queued === true).map(entry => entry.name),
              failed: failed.filter(entry => entry.queued !== true).map(entry => ({ name: entry.name, error: entry.error, pendingBuilds: entry.pendingBuilds })),
            },
          }));
          await load();
          try {
            const check = await rpc('checkUpdates', { names: [] });
            setResult(previous => ({ ...(previous ?? {}), ...check }));
          } catch {
            /* the bulk result above already tells the story */
          }
        } catch (issue) {
          setError(`${t('opFailed')}: ${issue instanceof Error ? issue.message : String(issue)}`);
        } finally {
          mark('__updateall__', false);
        }
      }, [flush, load, mark, t]);

      const clearPending = useCallback(async () => {
        mark('__pending__', true);
        try {
          const data = await rpc('clearPending', {});
          setResult(previous => ({ ...(previous ?? {}), note: t('pendingClearDone'), cleared: data?.cleared ?? 0 }));
          await load();
        } catch (issue) {
          setError(`${t('opFailed')}: ${issue instanceof Error ? issue.message : String(issue)}`);
        } finally {
          mark('__pending__', false);
        }
      }, [load, mark, t]);

      const runAuto = useCallback(async () => {
        mark('__auto__', true);
        try {
          await flush();
          const data = await rpc('runAutoUpdate');
          setResult(data);
          await load();
        } catch (issue) {
          setError(`${t('opFailed')}: ${issue instanceof Error ? issue.message : String(issue)}`);
        } finally {
          mark('__auto__', false);
        }
      }, [flush, load, mark, t]);

      const updateOne = useCallback(async (name, version, approvedBuilds) => {
        mark('__update__', true);
        mark(name, true);
        try {
          const data = await rpc('update', {
            names: [name],
            versions: version ? { [name]: version } : {},
            ...(Array.isArray(approvedBuilds) && approvedBuilds.length > 0 ? { approvedBuilds } : {}),
          });
          const entry = Array.isArray(data?.applied) ? data.applied.find(row => row.name === name) : undefined;
          const check = await rpc('checkUpdates', { names: [] });
          setResult({ ...check, lastUpdate: entry ?? null });
          await load();
          return entry;
        } catch (issue) {
          setError(`${t('opFailed')}: ${issue instanceof Error ? issue.message : String(issue)}`);
          return undefined;
        } finally {
          mark('__update__', false);
          mark(name, false);
        }
      }, [load, mark, t]);

      const approveAndRetry = useCallback(async (name, version, builds) => {
        mark('__update__', true);
        mark(name, true);
        try {
          const approved = await rpc('approveBuilds', { builds });
          if (approved?.ok !== true) throw new Error(approved?.error ?? 'approveBuilds refused');
          const merged = Array.isArray(approved.approvedBuilds) ? approved.approvedBuilds : builds;
          mark('__update__', false);
          mark(name, false);
          return await updateOne(name, version, merged);
        } catch (issue) {
          setError(`${t('opFailed')}: ${issue instanceof Error ? issue.message : String(issue)}`);
          return undefined;
        } finally {
          mark('__update__', false);
          mark(name, false);
        }
      }, [mark, t, updateOne]);

      const repair = useCallback(async () => {
        mark('__repair__', true);
        try {
          const data = await rpc('repairUpdates');
          setResult({ note: data.ok ? t('pendingOk') : `${t('opFailed')}`, rows: result?.rows });
          await load();
        } catch (issue) {
          setError(`${t('opFailed')}: ${issue instanceof Error ? issue.message : String(issue)}`);
        } finally {
          mark('__repair__', false);
        }
      }, [load, mark, result?.rows, t]);

      const value = useMemo(() => ({
        snap, error, busy, result, st, query, setQuery, loading,
        reload: load, mutateState, togglePlugins, runAuto, updateOne, updateAll, repair, clearPending, approveAndRetry, t,
      }), [snap, error, busy, result, st, query, loading, load, mutateState, togglePlugins, runAuto, updateOne, updateAll, repair, clearPending, approveAndRetry, t]);

      return h(ShelfContext.Provider, { value }, h(ShelfPage));
    }

    function ShelfIcon() {
      return h('svg', {
        viewBox: '0 0 64 64', width: 22, height: 22, 'aria-hidden': true,
        style: { display: 'block' },
      },
        h('rect', { x: 4, y: 8, width: 56, height: 48, rx: 10, fill: 'currentColor', opacity: 0.18 }),
        h('rect', { x: 12, y: 16, width: 10, height: 14, rx: 2, fill: 'currentColor' }),
        h('rect', { x: 25, y: 16, width: 10, height: 14, rx: 2, fill: 'currentColor', opacity: 0.75 }),
        h('rect', { x: 38, y: 16, width: 10, height: 14, rx: 2, fill: 'currentColor', opacity: 0.5 }),
        h('rect', { x: 12, y: 34, width: 14, height: 14, rx: 2, fill: 'currentColor', opacity: 0.5 }),
        h('rect', { x: 29, y: 34, width: 19, height: 14, rx: 2, fill: 'currentColor', opacity: 0.75 }),
      );
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, dict), 'plugin-shelf: dictionaries');
        const t = ctx.locale.bind(NS);
        const tr = key => {
          try {
            const text = t(key);
            if (typeof text === 'string' && text !== key && text !== '') return text;
          } catch {
            /* fall through to the static table */
          }
          return dict[browserLang][key] ?? dict.zh[key] ?? key;
        };
        function Page() {
          return h(ShelfBoundary, null, h(ShelfProvider, { t: tr }));
        }
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          locale: NS,
        }, Page));
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 3,
          label: () => tr('panel'),
          locale: NS,
        }, ShelfIcon));
      },
    };
  },
});
