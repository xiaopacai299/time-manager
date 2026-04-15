export function createWorklistModule({
  petState,
  persistPetState,
  BrowserWindow,
  Notification,
  dialog,
  path,
  __dirname,
  loadPetRenderer,
}) {
  const WORKLIST_ICON_MAX_LEN = 420000;
  let worklistWindow = null;
  let estimatePrompting = false;

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
    const reminderNotified = Boolean(raw.reminderNotified);
    const completionResultRaw = String(raw.completionResult || '').trim().toLowerCase();
    const completionResult =
      completionResultRaw === 'completed' || completionResultRaw === 'incomplete'
        ? completionResultRaw
        : '';
    const confirmSnoozeUntil = normalizeWorklistDatetime(raw.confirmSnoozeUntil);
    return { id, icon, name, reminderAt, estimateDoneAt, note, reminderNotified, completionResult, confirmSnoozeUntil };
  }

  function broadcastWorklistUpdate() {
    if (!worklistWindow || worklistWindow.isDestroyed()) return;
    worklistWindow.webContents.send('worklist:updated', getWorklist());
  }

  function getWorklist() {
    return (petState.worklist || [])
      .map((item) => sanitizeWorklistEntry(item))
      .filter(Boolean);
  }

  function addWorklistItem(payload) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const entry = sanitizeWorklistEntry({
      id,
      icon: payload?.icon,
      name: payload?.name,
      reminderAt: payload?.reminderAt,
      estimateDoneAt: payload?.estimateDoneAt,
      note: payload?.note,
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
    const id = String(payload?.id || '').trim();
    if (!id) {
      return { ok: false, error: '缺少清单 ID', list: getWorklist() };
    }
    const exists = getWorklist().some((item) => item.id === id);
    if (!exists) {
      return { ok: false, error: '未找到要更新的清单', list: getWorklist() };
    }
    const entry = sanitizeWorklistEntry({
      id,
      icon: payload?.icon,
      name: payload?.name,
      reminderAt: payload?.reminderAt,
      estimateDoneAt: payload?.estimateDoneAt,
      note: payload?.note,
      reminderNotified: false,
      completionResult: '',
      confirmSnoozeUntil: '',
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
      if (Notification.isSupported()) {
        try {
          const notify = new Notification({
            title: `预估完成时间已到：${candidate.name}`,
            body: '请确认这项工作是否已经完成。',
          });
          notify.show();
        } catch (error) {
          console.error('[worklist-estimate-notification-error]', error);
        }
      }
      const buttons = ['已完成', '未完成', '稍后提醒'];
      const { response } = await dialog.showMessageBox({
        type: 'question',
        buttons,
        defaultId: 0,
        cancelId: 2,
        title: '工作清单确认',
        message: `【${candidate.name}】已到预估完成时间`,
        detail: '这项工作是否完成了？',
        noLink: true,
      });

      const nowIso = new Date(now).toISOString();
      const snoozeIso = new Date(now + 10 * 60 * 1000).toISOString();
      petState.worklist = getWorklist().map((item) => {
        if (item.id !== candidate.id) return item;
        if (response === 0) {
          return { ...item, completionResult: 'completed', confirmSnoozeUntil: nowIso };
        }
        if (response === 1) {
          return { ...item, completionResult: 'incomplete', confirmSnoozeUntil: nowIso };
        }
        return { ...item, confirmSnoozeUntil: snoozeIso };
      });
      persistPetState();
      broadcastWorklistUpdate();
    } catch (error) {
      console.error('[worklist-estimate-confirm-error]', error);
    } finally {
      estimatePrompting = false;
    }
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
      title: '添加工作清单',
      resizable: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        webSecurity: false,
      },
    });

    worklistWindow.once('ready-to-show', () => {
      if (!worklistWindow || worklistWindow.isDestroyed()) return;
      worklistWindow.show();
      broadcastWorklistUpdate();
    });

    worklistWindow.on('closed', () => {
      worklistWindow = null;
    });

    loadPetRenderer(worklistWindow, 'worklist');
  }

  function registerIpc(ipcMain) {
    ipcMain.handle('worklist:get-list', () => getWorklist());
    ipcMain.handle('worklist:add', (_event, payload) => addWorklistItem(payload));
    ipcMain.handle('worklist:update', (_event, payload) => updateWorklistItem(payload));
    ipcMain.handle('worklist:remove', (_event, payload) => removeWorklistItem(payload));
  }

  function teardown() {
    if (!worklistWindow || worklistWindow.isDestroyed()) return;
    worklistWindow.close();
    worklistWindow = null;
  }

  return {
    openWindow,
    tick: checkReminders,
    checkReminders,
    registerIpc,
    teardown,
  };
}
