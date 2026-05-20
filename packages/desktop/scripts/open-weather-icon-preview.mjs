import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, 'weather-icon-preview.html');

const cmd = process.platform === 'win32' ? 'cmd' : 'xdg-open';
const args =
  process.platform === 'win32'
    ? ['/c', 'start', '', htmlPath]
    : process.platform === 'darwin'
      ? [htmlPath]
      : [htmlPath];

execFile(cmd, args, (err) => {
  if (err) {
    console.error('无法自动打开浏览器，请手动打开：');
    console.error(htmlPath);
    process.exit(1);
  }
  console.log('已在默认浏览器打开天气图标预览：');
  console.log(htmlPath);
});
