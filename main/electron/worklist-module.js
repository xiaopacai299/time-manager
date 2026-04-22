export function createWorklistModule({
  petState,
  persistPetState,
  BrowserWindow,
  Notification,
  iconPath,
  path,
  __dirname,
  loadPetRenderer,
}) {
  const WORKLIST_ICON_MAX_LEN = 420000;
  let worklistWindow = null;
  let exportWindow = null;
  let estimateConfirmWindow = null;
  let estimatePromptPayload = null;
  let estimatePromptResolver = null;
  let estimatePrompting = false;

  function getLocalDateKey(ts = Date.now()) {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function maybeResetWorklistForNewDay(now = Date.now()) {
    const todayKey = getLocalDateKey(now);
    const lastResetKey = String(petState.worklistLastResetDate || '').trim();
    if (!lastResetKey) {
      petState.worklistLastResetDate = todayKey;
      persistPetState();
      return false;
    }
    if (lastResetKey === todayKey) return false;
    const hadItems = Array.isArray(petState.worklist) && petState.worklist.length > 0;
    petState.worklist = [];
    petState.worklistLastResetDate = todayKey;
    persistPetState();
    if (hadItems) {
      broadcastWorklistUpdate();
    }
    return hadItems;
  }

  function normalizeWorklistDatetime(value) {
    const s = String(value || '').trim();
    if (!s) return '';
    const t = Date.parse(s);
    return Number.isNaN(t) ? '' : new Date(t).toISOString();
  }

  function sanitizeWorklistIcon(icon) {
    const v = String(icon || '').trim();
    if (!v) return '📋';
    if (v.startsWith('data:image/')) {
      return v.length > WORKLIST_ICON_MAX_LEN ? '📋' : v;
    }
    return v.slice(0, 32);
  }

  function sanitizeWorklistEntry(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = String(raw.id || '').trim();
    if (!id) return null;
    const name = String(raw.name || '').trim().slice(0, 200);
    if (!name) return null;
    const icon = sanitizeWorklistIcon(raw.icon);
    const reminderAt = normalizeWorklistDatetime(raw.reminderAt);
    const estimateDoneAt = normalizeWorklistDatetime(raw.estimateDoneAt);
    const note = String(raw.note || '').trim().slice(0, 2000);
    const createdAt = normalizeWorklistDatetime(raw.createdAt);
    const reminderNotified = Boolean(raw.reminderNotified);
    const completionResultRaw = String(raw.completionResult || '').trim().toLowerCase();
    const completionResult =
      completionResultRaw === 'completed' || completionResultRaw === 'incomplete'
        ? completionResultRaw
        : '';
    const confirmSnoozeUntil = normalizeWorklistDatetime(raw.confirmSnoozeUntil);
    return { id, icon, name, reminderAt, estimateDoneAt, note, createdAt, reminderNotified, completionResult, confirmSnoozeUntil };
  }

  function broadcastWorklistUpdate() {
    if (!worklistWindow || worklistWindow.isDestroyed()) return;
    worklistWindow.webContents.send('worklist:updated', getWorklist());
  }

  function broadcastMemoUpdate() {
    if (!worklistWindow || worklistWindow.isDestroyed()) return;
    worklistWindow.webContents.send('memo-list:updated', getMemoList());
  }

  function memoNameFallbackFromContent(content) {
    const line = String(content || '')
      .trim()
      .split(/\r?\n/)[0]
      .trim();
    if (line) return line.slice(0, 200);
    return '备忘录';
  }

  function sanitizeMemoEntry(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = String(raw.id || '').trim();
    if (!id) return null;
    const content = String(raw.content ?? '').trim().slice(0, 50000);
    if (!content) return null;
    const name =
      String(raw.name || '')
        .trim()
        .slice(0, 200) || memoNameFallbackFromContent(content);
    const icon = sanitizeWorklistIcon(raw.icon);
    const reminderAt = normalizeWorklistDatetime(raw.reminderAt);
    const createdAt = normalizeWorklistDatetime(raw.createdAt) || new Date().toISOString();
    const reminderNotified = Boolean(raw.reminderNotified);
    return { id, name, icon, content, reminderAt, createdAt, reminderNotified };
  }

  function getMemoList() {
    return (petState.memoList || [])
      .map((item) => sanitizeMemoEntry(item))
      .filter(Boolean);
  }

  function addMemoItem(payload) {
    if (!String(payload?.name || '').trim()) {
      return { ok: false, error: '请填写备忘录名称', list: getMemoList() };
    }
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const entry = sanitizeMemoEntry({
      id,
      name: payload?.name,
      icon: payload?.icon,
      content: payload?.content,
      reminderAt: payload?.reminderAt,
      createdAt: new Date().toISOString(),
      reminderNotified: false,
    });
    if (!entry) {
      return { ok: false, error: '请填写备忘录内容', list: getMemoList() };
    }
    petState.memoList = [...getMemoList(), entry];
    persistPetState();
    broadcastMemoUpdate();
    return { ok: true, list: getMemoList() };
  }

  function updateMemoItem(payload) {
    const id = String(payload?.id || '').trim();
    if (!id) {
      return { ok: false, error: '缺少备忘录 ID', list: getMemoList() };
    }
    const existing = getMemoList().find((item) => item.id === id);
    if (!existing) {
      return { ok: false, error: '未找到要更新的备忘录', list: getMemoList() };
    }
    if (!String(payload?.name || '').trim()) {
      return { ok: false, error: '请填写备忘录名称', list: getMemoList() };
    }
    const nextReminder = normalizeWorklistDatetime(payload?.reminderAt);
    const reminderChanged = nextReminder !== existing.reminderAt;
    const entry = sanitizeMemoEntry({
      id,
      name: payload?.name,
      icon: payload?.icon,
      content: payload?.content,
      reminderAt: nextReminder,
      createdAt: existing.createdAt,
      reminderNotified: reminderChanged ? false : existing.reminderNotified,
    });
    if (!entry) {
      return { ok: false, error: '请填写备忘录内容', list: getMemoList() };
    }
    petState.memoList = getMemoList().map((item) => (item.id === id ? entry : item));
    persistPetState();
    broadcastMemoUpdate();
    return { ok: true, list: getMemoList() };
  }

  function removeMemoItem(payload) {
    const id = String(payload?.id || '').trim();
    if (!id) {
      return { ok: false, error: '缺少备忘录 ID', list: getMemoList() };
    }
    const before = getMemoList();
    const next = before.filter((item) => item.id !== id);
    if (next.length === before.length) {
      return { ok: false, error: '未找到要删除的备忘录', list: before };
    }
    petState.memoList = next;
    persistPetState();
    broadcastMemoUpdate();
    return { ok: true, list: getMemoList() };
  }

  function getWorklist() {
    return (petState.worklist || [])
      .map((item) => sanitizeWorklistEntry(item))
      .filter(Boolean);
  }

  function addWorklistItem(payload) {
    maybeResetWorklistForNewDay();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const entry = sanitizeWorklistEntry({
      id,
      icon: payload?.icon,
      name: payload?.name,
      reminderAt: payload?.reminderAt,
      estimateDoneAt: payload?.estimateDoneAt,
      note: payload?.note,
      createdAt: new Date().toISOString(),
      reminderNotified: false,
      completionResult: '',
      confirmSnoozeUntil: '',
    });
    if (!entry) {
      return { ok: false, error: '请填写工作清单名称', list: getWorklist() };
    }
    petState.worklist = [...getWorklist(), entry];
    persistPetState();
    broadcastWorklistUpdate();
    return { ok: true, list: getWorklist() };
  }

  function updateWorklistItem(payload) {
    maybeResetWorklistForNewDay();
    const id = String(payload?.id || '').trim();
    if (!id) {
      return { ok: false, error: '缺少清单 ID', list: getWorklist() };
    }
    const existing = getWorklist().find((item) => item.id === id);
    if (!existing) {
      return { ok: false, error: '未找到要更新的清单', list: getWorklist() };
    }
    const entry = sanitizeWorklistEntry({
      id,
      icon: payload?.icon,
      name: payload?.name,
      reminderAt: payload?.reminderAt,
      estimateDoneAt: payload?.estimateDoneAt,
      note: payload?.note,
      createdAt: existing.createdAt,
      reminderNotified: existing.reminderNotified,
      completionResult: existing.completionResult,
      confirmSnoozeUntil: existing.confirmSnoozeUntil,
    });
    if (!entry) {
      return { ok: false, error: '请填写工作清单名称', list: getWorklist() };
    }
    petState.worklist = getWorklist().map((item) => (item.id === id ? entry : item));
    persistPetState();
    broadcastWorklistUpdate();
    return { ok: true, list: getWorklist() };
  }

  function removeWorklistItem(payload) {
    maybeResetWorklistForNewDay();
    const id = String(payload?.id || '').trim();
    if (!id) {
      return { ok: false, error: '缺少清单 ID', list: getWorklist() };
    }
    const before = getWorklist();
    const next = before.filter((item) => item.id !== id);
    if (next.length === before.length) {
      return { ok: false, error: '未找到要删除的清单', list: before };
    }
    petState.worklist = next;
    persistPetState();
    broadcastWorklistUpdate();
    return { ok: true, list: getWorklist() };
  }

  async function checkReminders() {
    const now = Date.now();
    maybeResetWorklistForNewDay(now);
    const raw = Array.isArray(petState.worklist) ? petState.worklist : [];
    let changed = false;
    const canNotify = Notification.isSupported();
    const next = raw.map((item) => {
      const id = String(item?.id || '').trim();
      if (!id || item.reminderNotified) return item;
      const reminderAt = normalizeWorklistDatetime(item.reminderAt);
      if (!reminderAt) return item;
      const t = Date.parse(reminderAt);
      if (Number.isNaN(t) || t > now) return item;
      const name = String(item.name || '工作清单').trim().slice(0, 120);
      const body = String(item.note || '').trim().slice(0, 500) || '到提醒时间了';
      if (canNotify) {
        try {
          const n = new Notification({ title: `工作提醒：${name}`, body });
          n.show();
        } catch (error) {
          console.error('[worklist-reminder-notification-error]', error);
        }
      }
      changed = true;
      return { ...item, reminderNotified: true, reminderAt };
    });
    if (changed) {
      petState.worklist = next;
      persistPetState();
      broadcastWorklistUpdate();
    }

    const rawMemos = Array.isArray(petState.memoList) ? petState.memoList : [];
    let memoChanged = false;
    const nextMemos = rawMemos.map((item) => {
      const id = String(item?.id || '').trim();
      if (!id || item.reminderNotified) return item;
      const reminderAt = normalizeWorklistDatetime(item.reminderAt);
      if (!reminderAt) return item;
      const t = Date.parse(reminderAt);
      if (Number.isNaN(t) || t > now) return item;
      const memoTitle = String(item.name || '备忘录').trim().slice(0, 120);
      const body = String(item.content || '').trim().slice(0, 500) || '到提醒时间了';
      if (canNotify) {
        try {
          const n = new Notification({ title: `备忘录提醒：${memoTitle}`, body });
          n.show();
        } catch (error) {
          console.error('[memo-reminder-notification-error]', error);
        }
      }
      memoChanged = true;
      return { ...item, reminderNotified: true, reminderAt };
    });
    if (memoChanged) {
      petState.memoList = nextMemos;
      persistPetState();
      broadcastMemoUpdate();
    }

    await maybePromptEstimateCompletion(now);
  }

  async function maybePromptEstimateCompletion(now) {
    if (estimatePrompting) return;
    const list = getWorklist();
    const candidate = list.find((item) => {
      if (item.completionResult === 'completed' || item.completionResult === 'incomplete') return false;
      const estimateTs = Date.parse(String(item.estimateDoneAt || ''));
      if (Number.isNaN(estimateTs) || estimateTs > now) return false;
      const snoozeTs = Date.parse(String(item.confirmSnoozeUntil || ''));
      if (!Number.isNaN(snoozeTs) && snoozeTs > now) return false;
      return true;
    });
    if (!candidate) return;

    estimatePrompting = true;
    try {
      const action = await promptEstimateChoice(candidate);

      const nowIso = new Date(now).toISOString();
      const snoozeIso = new Date(now + 10 * 60 * 1000).toISOString();
      petState.worklist = getWorklist().map((item) => {
        if (item.id !== candidate.id) return item;
        if (action === 'completed') {
          return { ...item, completionResult: 'completed', confirmSnoozeUntil: nowIso };
        }
        if (action === 'incomplete') {
          return { ...item, completionResult: 'incomplete', confirmSnoozeUntil: nowIso };
        }
        return { ...item, confirmSnoozeUntil: snoozeIso };
      });
      persistPetState();
      broadcastWorklistUpdate();
    } catch (error) {
      console.error('[worklist-estimate-confirm-error]', error);
    } finally {
      estimatePromptPayload = null;
      estimatePromptResolver = null;
      closeEstimateConfirmWindow();
      estimatePrompting = false;
    }
  }

  function closeEstimateConfirmWindow() {
    if (!estimateConfirmWindow || estimateConfirmWindow.isDestroyed()) {
      estimateConfirmWindow = null;
      return;
    }
    estimateConfirmWindow.close();
    estimateConfirmWindow = null;
  }

  function createEstimateConfirmWindow() {
    if (estimateConfirmWindow && !estimateConfirmWindow.isDestroyed()) {
      estimateConfirmWindow.show();
      estimateConfirmWindow.focus();
      return estimateConfirmWindow;
    }

    estimateConfirmWindow = new BrowserWindow({
      width: 460,
      height: 360,
      show: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      alwaysOnTop: true,
      autoHideMenuBar: true,
      title: '工作确认',
      icon: iconPath,
      backgroundColor: '#fff7f2',
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        webSecurity: false,
      },
    });

    estimateConfirmWindow.once('ready-to-show', () => {
      if (!estimateConfirmWindow || estimateConfirmWindow.isDestroyed()) return;
      estimateConfirmWindow.setMenuBarVisibility(false);
      estimateConfirmWindow.show();
      estimateConfirmWindow.focus();
    });

    estimateConfirmWindow.on('closed', () => {
      estimateConfirmWindow = null;
      if (estimatePromptResolver) {
        const resolver = estimatePromptResolver;
        estimatePromptResolver = null;
        resolver('snooze');
      }
      estimatePromptPayload = null;
    });

    loadPetRenderer(estimateConfirmWindow, 'worklist-estimate-confirm');
    return estimateConfirmWindow;
  }

  function promptEstimateChoice(candidate) {
    estimatePromptPayload = {
      id: candidate.id,
      name: candidate.name,
      note: candidate.note || '',
      estimateDoneAt: candidate.estimateDoneAt || '',
    };
    createEstimateConfirmWindow();
    return new Promise((resolve) => {
      estimatePromptResolver = resolve;
    });
  }

  function openWindow() {
    if (worklistWindow && !worklistWindow.isDestroyed()) {
      worklistWindow.show();
      worklistWindow.focus();
      return;
    }

    worklistWindow = new BrowserWindow({
      width: 1180,
      height: 700,
      show: false,
      title: '工作清单',
      icon: iconPath,
      autoHideMenuBar: true,
      resizable: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        webSecurity: false,
      },
    });

    worklistWindow.once('ready-to-show', () => {
      if (!worklistWindow || worklistWindow.isDestroyed()) return;
      worklistWindow.setMenuBarVisibility(false);
      worklistWindow.show();
      broadcastWorklistUpdate();
      broadcastMemoUpdate();
    });

    worklistWindow.on('closed', () => {
      worklistWindow = null;
    });

    loadPetRenderer(worklistWindow, 'worklist');
  }

  function openExportWindow() {
    if (exportWindow && !exportWindow.isDestroyed()) {
      exportWindow.show();
      exportWindow.focus();
      return;
    }

    exportWindow = new BrowserWindow({
      width: 600,
      height: 500,
      show: false,
      title: '导出日志',
      icon: iconPath,
      autoHideMenuBar: true,
      resizable: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        webSecurity: false,
      },
    });

    exportWindow.once('ready-to-show', () => {
      if (!exportWindow || exportWindow.isDestroyed()) return;
      exportWindow.setMenuBarVisibility(false);
      exportWindow.show();
    });

    exportWindow.on('closed', () => {
      exportWindow = null;
    });

    loadPetRenderer(exportWindow, 'worklist-export');
  }

  function registerIpc(ipcMain) {
    ipcMain.handle('worklist:get-list', () => getWorklist());
    ipcMain.handle('worklist:open-export', () => openExportWindow());
    ipcMain.handle('memo-list:get', () => getMemoList());
    ipcMain.handle('memo-list:add', (_event, payload) => addMemoItem(payload));
    ipcMain.handle('memo-list:update', (_event, payload) => updateMemoItem(payload));
    ipcMain.handle('memo-list:remove', (_event, payload) => removeMemoItem(payload));
    ipcMain.handle('worklist:add', (_event, payload) => addWorklistItem(payload));
    ipcMain.handle('worklist:update', (_event, payload) => updateWorklistItem(payload));
    ipcMain.handle('worklist:remove', (_event, payload) => removeWorklistItem(payload));
    ipcMain.handle('worklist:estimate-confirm:get-payload', () => estimatePromptPayload);
    ipcMain.handle('worklist:estimate-confirm:submit', (_event, payload) => {
      const action = String(payload?.action || '').trim().toLowerCase();
      if (!estimatePromptResolver) return { ok: false, error: '当前没有待确认任务。' };
      if (!['completed', 'incomplete', 'snooze'].includes(action)) {
        return { ok: false, error: '无效的确认动作。' };
      }
      const resolver = estimatePromptResolver;
      estimatePromptResolver = null;
      resolver(action);
      return { ok: true };
    });
  }

  function teardown() {
    if (worklistWindow && !worklistWindow.isDestroyed()) {
      worklistWindow.close();
      worklistWindow = null;
    }
    closeEstimateConfirmWindow();
  }

  return {
    openWindow,
    openExportWindow,
    tick: checkReminders,
    checkReminders,
    registerIpc,
    teardown,
  };
}
