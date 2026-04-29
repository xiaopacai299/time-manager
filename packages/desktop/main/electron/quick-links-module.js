import { fileURLToPath } from 'url';

const DEFAULT_CATEGORY_ID = 'cat-default';

function newId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function defaultStickyLinks() {
  return {
    categories: [{ id: DEFAULT_CATEGORY_ID, name: '未分类', sort: 0 }],
    items: [],
  };
}

export function normalizeStickyLinks(raw) {
  const base = defaultStickyLinks();
  if (!raw || typeof raw !== 'object') return base;
  const cats = Array.isArray(raw.categories) ? raw.categories : [];
  const normalizedCats = cats
    .map((c, i) => ({
      id: String(c?.id || '').trim() || newId('cat'),
      name: String(c?.name || '分类').trim().slice(0, 40) || '分类',
      sort: Number.isFinite(Number(c?.sort)) ? Number(c.sort) : i,
    }))
    .filter((c) => c.id);
  const byId = new Map(normalizedCats.map((c) => [c.id, c]));
  if (!byId.has(DEFAULT_CATEGORY_ID)) {
    normalizedCats.unshift({ id: DEFAULT_CATEGORY_ID, name: '未分类', sort: -1 });
  }
  normalizedCats.sort((a, b) => a.sort - b.sort);

  const items = Array.isArray(raw.items) ? raw.items : [];
  const catIds = new Set(normalizedCats.map((c) => c.id));
  const normalizedItems = items
    .map((it) => {
      const url = String(it?.url || '').trim().slice(0, 2048);
      if (!url) return null;
      let categoryId = String(it?.categoryId || '').trim();
      if (!catIds.has(categoryId)) categoryId = DEFAULT_CATEGORY_ID;
      return {
        id: String(it?.id || '').trim() || newId('link'),
        categoryId,
        url,
        title: String(it?.title || '').trim().slice(0, 120) || url.slice(0, 80),
        createdAt: String(it?.createdAt || new Date().toISOString()),
      };
    })
    .filter(Boolean);

  return { categories: normalizedCats, items: normalizedItems };
}

function sanitizeUrlInput(text) {
  let s = String(text || '').trim().replace(/\uFEFF/g, '');
  if (!s) return '';
  if ((s.startsWith('<') && s.endsWith('>')) || (s.startsWith('(') && s.endsWith(')'))) {
    s = s.slice(1, -1).trim();
  }
  s = s.replace(/^[\s"'「]+|[\s"'」]+$/g, '').trim();
  return s.slice(0, 2048);
}

/** 便签手动输入：允许网页/下载链接、磁力、本地路径 */
function looksLikeStickyTarget(u) {
  const s = String(u || '').trim();
  if (!s) return false;
  if (/^(https?|ftp|ftps):\/\//i.test(s) || /^magnet:/i.test(s)) return true;
  if (/^[a-zA-Z]:[\\/]/.test(s) || /^\\\\/u.test(s)) return true;
  if (s.toLowerCase().startsWith('file:')) return true;
  return false;
}

export function createQuickLinksModule({
  petState,
  persistPetState,
  BrowserWindow,
  shell,
  path,
  iconPath,
  __dirname,
  loadPetRenderer,
}) {
  let stickyWindow = null;

  /**
   * 仅保证 petState.stickyLinks 存在且含 categories/items。
   * 切勿在每次调用时 normalize 并整体替换引用：addEntries 会先 const state = ensureStickyLinks()，
   * 再调 resolveFinalCategory（若内部再次 normalize，petState 会指向新对象，state 仍指向旧对象，
   * unshift 会加在「孤儿对象」上，磁盘里永远没有新条目）。
   */
  function ensureStickyLinks() {
    if (!petState.stickyLinks || typeof petState.stickyLinks !== 'object') {
      petState.stickyLinks = defaultStickyLinks();
      return petState.stickyLinks;
    }
    if (!Array.isArray(petState.stickyLinks.categories) || !Array.isArray(petState.stickyLinks.items)) {
      petState.stickyLinks = normalizeStickyLinks(petState.stickyLinks);
    }
    return petState.stickyLinks;
  }

  function broadcastStickyLinksUpdate() {
    if (!stickyWindow || stickyWindow.isDestroyed()) return;
    stickyWindow.webContents.send('sticky-links:updated', getState());
  }

  function getState() {
    return JSON.parse(JSON.stringify(ensureStickyLinks()));
  }

  async function openLink(raw) {
    const s = sanitizeUrlInput(raw);
    if (!s) return { ok: false, error: '链接为空' };
    if (/^(https?|ftp|ftps):\/\//i.test(s) || /^magnet:/i.test(s)) {
      try {
        await shell.openExternal(s);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: String(e?.message || e) };
      }
    }
    let filePath = s;
    if (s.toLowerCase().startsWith('file:')) {
      try {
        filePath = fileURLToPath(s);
      } catch {
        return { ok: false, error: '无效的 file:// 链接' };
      }
    }
    const err = await shell.openPath(filePath);
    if (err) return { ok: false, error: err };
    return { ok: true };
  }

  function resolveFinalCategory(categoryId, state) {
    const st = state || ensureStickyLinks();
    const cid = String(categoryId || '').trim();
    return st.categories.some((c) => c.id === cid) ? cid : DEFAULT_CATEGORY_ID;
  }

  /** 批量添加；同一批里数组顺序靠前的条目在列表中更靠上 */
  function addEntries({ categoryId, entries }) {
    const state = ensureStickyLinks();
    const finalCat = resolveFinalCategory(categoryId, state);
    const list = (Array.isArray(entries) ? entries : [])
      .map((e) => {
        const url = sanitizeUrlInput(e?.url);
        if (!url) return null;
        const t = String(e?.title || '').trim().slice(0, 120);
        const displayTitle = t || url.slice(0, 96);
        return { url, title: displayTitle };
      })
      .filter(Boolean);
    if (!list.length) return { ok: false, error: '没有有效链接或路径' };
    const now = new Date().toISOString();
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const { url, title } = list[i];
      state.items.unshift({
        id: newId('link'),
        categoryId: finalCat,
        url,
        title,
        createdAt: now,
      });
    }
    persistPetState();
    broadcastStickyLinksUpdate();
    return { ok: true, stickyLinks: getState(), added: list.length };
  }

  function addItem({ categoryId, url, title }) {
    const u = sanitizeUrlInput(url);
    if (!u) return { ok: false, error: '请输入有效链接或路径' };
    if (!looksLikeStickyTarget(u)) {
      return { ok: false, error: '请输入 http(s)、ftp、magnet 链接或本地 / file:// 路径' };
    }
    const displayTitle = String(title || '').trim().slice(0, 120) || u.slice(0, 96);
    return addEntries({ categoryId, entries: [{ url: u, title: displayTitle }] });
  }

  function removeItem({ id }) {
    const state = ensureStickyLinks();
    const rid = String(id || '').trim();
    if (!rid) return { ok: false, error: '缺少 id' };
    state.items = state.items.filter((it) => it.id !== rid);
    persistPetState();
    broadcastStickyLinksUpdate();
    return { ok: true, stickyLinks: getState() };
  }

  function addCategory({ name }) {
    const state = ensureStickyLinks();
    const n = String(name || '').trim().slice(0, 40);
    if (!n) return { ok: false, error: '分类名称不能为空' };
    const maxSort = state.categories.reduce((m, c) => Math.max(m, c.sort || 0), 0);
    const newIdCat = newId('cat');
    state.categories.push({
      id: newIdCat,
      name: n,
      sort: maxSort + 1,
    });
    persistPetState();
    broadcastStickyLinksUpdate();
    return { ok: true, stickyLinks: getState(), newCategoryId: newIdCat };
  }

  function renameCategory({ id, name }) {
    const state = ensureStickyLinks();
    const cid = String(id || '').trim();
    if (!cid) return { ok: false, error: '缺少分类 id' };
    const n = String(name || '').trim().slice(0, 40);
    if (!n) return { ok: false, error: '名称不能为空' };
    const cat = state.categories.find((c) => c.id === cid);
    if (!cat) return { ok: false, error: '分类不存在' };
    cat.name = n;
    persistPetState();
    broadcastStickyLinksUpdate();
    return { ok: true, stickyLinks: getState() };
  }

  function removeCategory({ id }) {
    const state = ensureStickyLinks();
    const cid = String(id || '').trim();
    if (!cid || cid === DEFAULT_CATEGORY_ID) return { ok: false, error: '不能删除默认分类' };
    const idx = state.categories.findIndex((c) => c.id === cid);
    if (idx < 0) return { ok: false, error: '分类不存在' };
    state.categories.splice(idx, 1);
    for (const it of state.items) {
      if (it.categoryId === cid) it.categoryId = DEFAULT_CATEGORY_ID;
    }
    persistPetState();
    broadcastStickyLinksUpdate();
    return { ok: true, stickyLinks: getState() };
  }

  function openWindow() {
    if (stickyWindow && !stickyWindow.isDestroyed()) {
      stickyWindow.show();
      stickyWindow.focus();
      broadcastStickyLinksUpdate();
      return;
    }

    stickyWindow = new BrowserWindow({
      width: 640,
      height: 640,
      minWidth: 480,
      minHeight: 480,
      show: false,
      title: '便签',
      icon: iconPath,
      autoHideMenuBar: true,
      resizable: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        webSecurity: false,
      },
    });

    stickyWindow.once('ready-to-show', () => {
      if (!stickyWindow || stickyWindow.isDestroyed()) return;
      stickyWindow.setMenuBarVisibility(false);
      stickyWindow.show();
      broadcastStickyLinksUpdate();
    });

    stickyWindow.on('closed', () => {
      stickyWindow = null;
    });

    loadPetRenderer(stickyWindow, 'sticky-links');
  }

  function registerIpc(ipcMain) {
    ipcMain.handle('sticky-links:get-state', () => getState());
    ipcMain.handle('sticky-links:add-item', (_e, payload) => addItem(payload || {}));
    ipcMain.handle('sticky-links:remove-item', (_e, payload) => removeItem(payload || {}));
    ipcMain.handle('sticky-links:add-category', (_e, payload) => addCategory(payload || {}));
    ipcMain.handle('sticky-links:rename-category', (_e, payload) => renameCategory(payload || {}));
    ipcMain.handle('sticky-links:remove-category', (_e, payload) => removeCategory(payload || {}));
    ipcMain.handle('sticky-links:open', async (_e, payload) => openLink(payload?.url));
  }

  function teardown() {
    if (!stickyWindow || stickyWindow.isDestroyed()) return;
    stickyWindow.close();
    stickyWindow = null;
  }

  return {
    openWindow,
    registerIpc,
    ensureStickyLinks,
    teardown,
  };
}
