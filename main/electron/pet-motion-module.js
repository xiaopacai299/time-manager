export function createPetMotionModule({
  petState,
  screen,
  getUIOhook,
  getMainWindow,
  getTargetSize,
}) {
  let dragTimer = null;
  let followTimer = null;
  let chaosCatTimer = null;
  let globalMouseHookReady = false;
  const followTarget = { active: false, x: 0, y: 0 };
  const rambleTarget = { x: 0, y: 0 };
  const dragState = { active: false, offsetX: 0, offsetY: 0, started: false };
  let petContextMenuOpen = false;
  let suppressFollowMouseUntil = 0;

  function sendPetMotion(payload) {
    const mainWindow = getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const wc = mainWindow.webContents;
    if (!wc || wc.isDestroyed()) return;
    wc.send('pet:motion', payload);
  }

  function stopFollowMouse() {
    if (followTimer) {
      clearInterval(followTimer);
      followTimer = null;
    }
    followTarget.active = false;
    if (!petState.chaosCat) {
      sendPetMotion({ running: false, mirrorX: false });
    }
  }

  function pickRandomRamblePoint(tw, th) {
    const displays = screen.getAllDisplays();
    if (!displays.length) return { x: 0, y: 0 };
    const d = displays[Math.floor(Math.random() * displays.length)];
    const wa = d.workArea;
    const halfW = Math.round(tw / 2);
    const halfH = Math.round(th / 2);
    const minX = wa.x + halfW;
    const maxX = wa.x + wa.width - halfW;
    const minY = wa.y + halfH;
    const maxY = wa.y + wa.height - halfH;
    if (minX >= maxX || minY >= maxY) {
      return {
        x: wa.x + Math.round(wa.width / 2),
        y: wa.y + Math.round(wa.height / 2),
      };
    }
    return {
      x: minX + Math.random() * (maxX - minX),
      y: minY + Math.random() * (maxY - minY),
    };
  }

  function stopChaosCat() {
    if (chaosCatTimer) {
      clearInterval(chaosCatTimer);
      chaosCatTimer = null;
    }
    petState.chaosCat = false;
    const chasingFollow = petState.followMouse && followTarget.active;
    if (!chasingFollow) {
      sendPetMotion({ running: false, mirrorX: false });
    }
  }

  function startChaosCat() {
    const mainWindow = getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (chaosCatTimer) {
      clearInterval(chaosCatTimer);
      chaosCatTimer = null;
    }
    petState.chaosCat = true;
    const speedFactor = 0.2;
    const maxStep = 22;
    const armNextTarget = () => {
      const [tw, th] = getTargetSize();
      const bounds = mainWindow.getBounds();
      const cx = bounds.x + Math.round(bounds.width / 2);
      const cy = bounds.y + Math.round(bounds.height / 2);
      let p = pickRandomRamblePoint(tw, th);
      for (let i = 0; i < 14; i++) {
        if (Math.hypot(p.x - cx, p.y - cy) > 48) break;
        p = pickRandomRamblePoint(tw, th);
      }
      rambleTarget.x = p.x;
      rambleTarget.y = p.y;
    };
    armNextTarget();
    chaosCatTimer = setInterval(() => {
      const win = getMainWindow();
      if (!win || win.isDestroyed() || !petState.chaosCat) return;
      if (dragState.active) return;
      const [tw, th] = getTargetSize();
      const bounds = win.getBounds();
      const centerX = bounds.x + Math.round(bounds.width / 2);
      const centerY = bounds.y + Math.round(bounds.height / 2);
      const dx = rambleTarget.x - centerX;
      const dy = rambleTarget.y - centerY;
      const dist = Math.hypot(dx, dy);
      if (dist < 6) {
        armNextTarget();
        return;
      }
      const mirrorX = dx > 0;
      sendPetMotion({ running: true, mirrorX });
      const stepX = Math.max(-maxStep, Math.min(maxStep, dx * speedFactor));
      const stepY = Math.max(-maxStep, Math.min(maxStep, dy * speedFactor));
      win.setBounds({
        x: Math.round(bounds.x + stepX),
        y: Math.round(bounds.y + stepY),
        width: tw,
        height: th,
      });
    }, 16);
  }

  function startFollowMouse() {
    const mainWindow = getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) return;
    stopFollowMouse();
    const speedFactor = 0.2;
    const maxStep = 22;
    followTimer = setInterval(() => {
      const win = getMainWindow();
      if (!win || win.isDestroyed() || !petState.followMouse) return;
      if (!followTarget.active || dragState.active) return;
      const [tw, th] = getTargetSize();
      const bounds = win.getBounds();
      const centerX = bounds.x + Math.round(bounds.width / 2);
      const centerY = bounds.y + Math.round(bounds.height / 2);
      const dx = followTarget.x - centerX;
      const dy = followTarget.y - centerY;
      const dist = Math.hypot(dx, dy);
      if (dist < 6) {
        followTarget.active = false;
        sendPetMotion({ running: false, mirrorX: false });
        return;
      }
      const mirrorX = dx > 0;
      sendPetMotion({ running: true, mirrorX });
      const stepX = Math.max(-maxStep, Math.min(maxStep, dx * speedFactor));
      const stepY = Math.max(-maxStep, Math.min(maxStep, dy * speedFactor));
      win.setBounds({
        x: Math.round(bounds.x + stepX),
        y: Math.round(bounds.y + stepY),
        width: tw,
        height: th,
      });
    }, 16);
  }

  function triggerFollowBurst() {
    if (!petState.followMouse) return false;
    if (petContextMenuOpen) return false;
    if (Date.now() < suppressFollowMouseUntil) return false;
    if (followTarget.active) return false;
    const cursor = screen.getCursorScreenPoint();
    followTarget.x = cursor.x;
    followTarget.y = cursor.y;
    followTarget.active = true;
    if (!followTimer) startFollowMouse();
    return true;
  }

  function setupGlobalMouseHook() {
    if (globalMouseHookReady) return;
    const hook = getUIOhook();
    if (!hook) return;
    try {
      hook.on('mousedown', (event) => {
        if (event?.button !== 1) return;
        triggerFollowBurst();
      });
      hook.start();
      globalMouseHookReady = true;
    } catch (error) {
      console.error('[global-mouse-hook-error]', error);
    }
  }

  function teardownGlobalMouseHook() {
    if (!globalMouseHookReady) return;
    const hook = getUIOhook();
    try {
      if (hook) {
        hook.removeAllListeners('mousedown');
        hook.stop();
      }
    } catch (error) {
      console.error('[global-mouse-hook-stop-error]', error);
    } finally {
      globalMouseHookReady = false;
    }
  }

  function resetDragState() {
    dragState.active = false;
    dragState.started = false;
    if (dragTimer) {
      clearInterval(dragTimer);
      dragTimer = null;
    }
    const chasingFollow = petState.followMouse && followTarget.active;
    if (!chasingFollow && !petState.chaosCat) {
      sendPetMotion({ running: false, mirrorX: false });
    }
  }

  function registerIpc(ipcMain) {
    ipcMain.on('pet:start-drag', () => {
      const mainWindow = getMainWindow();
      if (!mainWindow || mainWindow.isDestroyed()) return;
      if (dragTimer) {
        clearInterval(dragTimer);
        dragTimer = null;
      }
      const startCursor = screen.getCursorScreenPoint();
      const winBounds = mainWindow.getBounds();
      dragState.active = true;
      dragState.offsetX = startCursor.x - winBounds.x;
      dragState.offsetY = startCursor.y - winBounds.y;
      dragState.started = false;

      const [tw, th] = getTargetSize();
      dragTimer = setInterval(() => {
        const win = getMainWindow();
        if (!dragState.active || !win || win.isDestroyed()) return;
        const cursor = screen.getCursorScreenPoint();
        if (!dragState.started) {
          const dx = Math.abs(cursor.x - startCursor.x);
          const dy = Math.abs(cursor.y - startCursor.y);
          if (dx < 3 && dy < 3) return;
          dragState.started = true;
        }
        win.setBounds({
          x: Math.round(cursor.x - dragState.offsetX),
          y: Math.round(cursor.y - dragState.offsetY),
          width: tw,
          height: th,
        });
      }, 16);
    });

    ipcMain.on('pet:end-drag', () => {
      dragState.active = false;
      if (dragTimer) {
        clearInterval(dragTimer);
        dragTimer = null;
      }
      const chasing = petState.followMouse && followTarget.active;
      if (!chasing && !petState.chaosCat) {
        sendPetMotion({ running: false, mirrorX: false });
      }
    });

    ipcMain.on('pet:drag-by', (_event, delta) => {
      const mainWindow = getMainWindow();
      if (!mainWindow || mainWindow.isDestroyed()) return;
      const bounds = mainWindow.getBounds();
      const [tw, th] = getTargetSize();
      mainWindow.setBounds({
        x: bounds.x + Number(delta?.dx || 0),
        y: bounds.y + Number(delta?.dy || 0),
        width: tw,
        height: th,
      });
    });
  }

  function onContextMenuOpened() {
    petContextMenuOpen = true;
  }

  function onContextMenuClosed() {
    petContextMenuOpen = false;
    suppressFollowMouseUntil = Date.now() + 280;
  }

  function setContextMenuActive(active) {
    if (active) onContextMenuOpened();
    else onContextMenuClosed();
  }

  function teardown() {
    if (dragTimer) {
      clearInterval(dragTimer);
      dragTimer = null;
    }
    stopChaosCat();
    stopFollowMouse();
    teardownGlobalMouseHook();
  }

  return {
    setup: setupGlobalMouseHook,
    startChaosCat,
    stopChaosCat,
    startFollowMouse,
    stopFollowMouse,
    setupGlobalMouseHook,
    resetDragState,
    registerIpc,
    setContextMenuActive,
    onContextMenuOpened,
    onContextMenuClosed,
    teardown,
  };
}
