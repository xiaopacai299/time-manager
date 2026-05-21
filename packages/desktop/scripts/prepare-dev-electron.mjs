/**
 * Windows 开发态：复制 electron.exe 并用 rcedit 写入橘子图标与应用名，
 * 其余 dist 文件用目录联接指向 node_modules，避免整包复制。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const DEV_DIST = path.join(root, '.dev-electron');
const STAMP_PATH = path.join(DEV_DIST, '.stamp.json');
const APP_USER_MODEL_ID = 'com.timemanager.pet';
const APP_DISPLAY_NAME = '橘子ING';

function sha256File(filePath) {
  const buf = fs.readFileSync(filePath);
  return createHash('sha256').update(buf).digest('hex');
}

function resolveElectronDist() {
  const electronExe = require('electron');
  return path.dirname(electronExe);
}

function readPkgElectronVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  return pkg.devDependencies?.electron || pkg.dependencies?.electron || '';
}

function linkDistEntries(srcDist, destDist) {
  fs.mkdirSync(destDist, { recursive: true });
  for (const name of fs.readdirSync(srcDist)) {
    if (name === 'electron.exe' || name === '.stamp.json') continue;
    const src = path.resolve(srcDist, name);
    const dest = path.join(destDist, name);
    if (fs.existsSync(dest)) continue;

    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      const r = spawnSync('cmd', ['/c', 'mklink', '/J', dest, src], {
        windowsHide: true,
        encoding: 'utf8',
      });
      if (r.status !== 0) {
        throw new Error(
          `[dev-electron] 目录联接失败 ${name}: ${r.stderr || r.stdout || r.status}. ` +
            '请以管理员运行，或开启 Windows「开发人员模式」后重试。',
        );
      }
      continue;
    }

    try {
      fs.linkSync(src, dest);
    } catch {
      fs.copyFileSync(src, dest);
    }
  }
}

async function patchElectronExe(exePath) {
  const rcedit = require('rcedit');
  const absExe = path.resolve(exePath);

  // 勿替换 application-manifest（会破坏 SxS）。
  // 勿 --set-icon：当前 icon.ico 写入 electron.exe 会 Unable to commit changes 并损坏 exe。
  // 任务栏橘子图标由 BrowserWindow setIcon(build/icon.ico) 负责。
  // electron 41 的 exe 仅能稳定写入少量 version-string；多加字段会 Unable to commit changes。
  await rcedit(absExe, {
    'version-string': {
      FileDescription: APP_DISPLAY_NAME,
      ProductName: APP_DISPLAY_NAME,
    },
  });
}

/** @returns {boolean} */
function verifyElectronExe(exePath) {
  const r = spawnSync(path.resolve(exePath), ['--version'], {
    cwd: path.dirname(path.resolve(exePath)),
    windowsHide: true,
    encoding: 'utf8',
    timeout: 15000,
  });
  return r.status === 0 && /v?\d+\.\d+\.\d+/.test(String(r.stdout || r.stderr || ''));
}

/**
 * @returns {Promise<string>} 开发用 electron.exe 绝对路径
 */
export async function prepareDevElectron() {
  if (process.platform !== 'win32') {
    return require('electron');
  }

  const srcDist = resolveElectronDist();
  const srcExe = path.join(srcDist, 'electron.exe');
  const destExe = path.join(DEV_DIST, 'electron.exe');
  const iconIco = path.join(root, 'build', 'icon.ico');

  const desiredStamp = {
    electronVersion: readPkgElectronVersion(),
    srcExeHash: sha256File(srcExe),
    iconHash: fs.existsSync(iconIco) ? sha256File(iconIco) : null,
    patchRevision: 4,
    appUserModelId: APP_USER_MODEL_ID,
  };

  let currentStamp = null;
  if (fs.existsSync(STAMP_PATH)) {
    try {
      currentStamp = JSON.parse(fs.readFileSync(STAMP_PATH, 'utf8'));
    } catch {
      currentStamp = null;
    }
  }

  const stampMatch =
    currentStamp &&
    currentStamp.electronVersion === desiredStamp.electronVersion &&
    currentStamp.srcExeHash === desiredStamp.srcExeHash &&
    currentStamp.iconHash === desiredStamp.iconHash &&
    currentStamp.patchRevision === desiredStamp.patchRevision &&
    currentStamp.appUserModelId === desiredStamp.appUserModelId &&
    fs.existsSync(destExe) &&
    verifyElectronExe(destExe);

  linkDistEntries(srcDist, DEV_DIST);

  if (!stampMatch) {
    console.log('[dev-electron] 正在生成带橘子品牌信息的开发版 electron.exe …');
    fs.mkdirSync(DEV_DIST, { recursive: true });
    fs.copyFileSync(srcExe, destExe);
    try {
      await patchElectronExe(destExe);
      if (!verifyElectronExe(destExe)) {
        throw new Error('补丁后 exe 无法执行 --version');
      }
      fs.writeFileSync(STAMP_PATH, `${JSON.stringify(desiredStamp, null, 2)}\n`, 'utf8');
      console.log('[dev-electron] 完成:', destExe);
      return destExe;
    } catch (err) {
      fs.rmSync(destExe, { force: true });
      console.warn(
        '[dev-electron] 品牌化失败，将使用官方 electron.exe:',
        err?.message || err,
      );
    }
  } else if (fs.existsSync(destExe) && !verifyElectronExe(destExe)) {
    fs.rmSync(destExe, { force: true });
    fs.rmSync(STAMP_PATH, { force: true });
    return prepareDevElectron();
  }

  if (fs.existsSync(destExe) && verifyElectronExe(destExe)) {
    return destExe;
  }

  return require('electron');
}

const isCli =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCli) {
  const exe = await prepareDevElectron();
  console.log(exe);
}
