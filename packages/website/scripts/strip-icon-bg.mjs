/**
 * 将 icon-source.png 的黑底抠为透明，输出 public/icon.png
 * 用法：node scripts/strip-icon-bg.mjs
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const websiteRoot = path.join(__dirname, '..');
const src = path.join(websiteRoot, 'public', 'icon-source.png');
const out = path.join(websiteRoot, 'public', 'icon.png');

const py = `
from PIL import Image
img = Image.open(r"${src.replace(/\\/g, '\\\\')}").convert("RGBA")
pixels = img.load()
w, h = img.size
for y in range(h):
    for x in range(w):
        r, g, b, a = pixels[x, y]
        # 近黑底变透明（保留橘子边缘抗锯齿）
        if r < 28 and g < 28 and b < 28:
            pixels[x, y] = (r, g, b, 0)
        elif r < 48 and g < 48 and b < 48 and max(r, g, b) - min(r, g, b) < 12:
            # 深色灰边柔化
            fade = max(r, g, b) / 48.0
            pixels[x, y] = (r, g, b, int(a * fade))
img.save(r"${out.replace(/\\/g, '\\\\')}", "PNG")
print("saved", r"${out.replace(/\\/g, '\\\\')}")
`;

const result = spawnSync('python', ['-c', py], { encoding: 'utf8' });
if (result.status !== 0) {
  console.error(result.stderr || result.stdout);
  process.exit(1);
}
console.log(result.stdout.trim());
