export function createWorklistModule({
  petState,
  persistPetState,
  BrowserWindow,
  Notification,
  path,
  __dirname,
  loadPetRenderer,
}) {
  const WORKLIST_ICON_MAX_LEN = 420000;
  let worklistWindow = null;

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
    return { id, icon, name, reminderAt, estimateDoneAt, note, reminderNotified };
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
    });
    if (!entry) {
      return { ok: false, error: '请填写工作清单名称', list: getWorklist() };
    }
    petState.worklist = [...getWorklist(), entry];
    persistPetState();
    return { ok: true, list: getWorklist() };
  }

  function checkReminders() {
    if (!Notification.isSupported()) return;
    const now = Date.now();
    const raw = Array.isArray(petState.worklist) ? petState.worklist : [];
    let changed = false;
    const next = raw.map((item) => {
      const id = String(item?.id || '').trim();
      if (!id || item.reminderNotified) return item;
      const reminderAt = normalizeWorklistDatetime(item.reminderAt);
      if (!reminderAt) return item;
      const t = Date.parse(reminderAt);
      if (Number.isNaN(t) || t > now) return item;
      const name = String(item.name || '工作清单').trim().slice(0, 120);
      const body = String(item.note || '').trim().slice(0, 500) || '到提醒时间了';
      try {
        const n = new Notification({ title: `工作提醒：${name}`, body });
        n.show();
      } catch (error) {
        console.error('[worklist-reminder-notification-error]', error);
      }
      changed = true;
      return { ...item, reminderNotified: true, reminderAt };
    });
    if (changed) {
      petState.worklist = next;
      persistPetState();
    }
  }

  function openWindow() {
    if (worklistWindow && !worklistWindow.isDestroyed()) {
      worklistWindow.show();
      worklistWindow.focus();
      return;
    }

    worklistWindow = new BrowserWindow({
      width: 440,
      height: 580,
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
    });

    worklistWindow.on('closed', () => {
      worklistWindow = null;
    });

    loadPetRenderer(worklistWindow, 'worklist');
  }

  function registerIpc(ipcMain) {
    ipcMain.handle('worklist:get-list', () => getWorklist());
    ipcMain.handle('worklist:add', (_event, payload) => addWorklistItem(payload));
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
