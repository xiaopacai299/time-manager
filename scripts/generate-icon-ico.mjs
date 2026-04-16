import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pngToIco from 'png-to-ico'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourcePng = path.join(root, 'build', 'icon.png')
const targetIco = path.join(root, 'build', 'icon.ico')

if (!fs.existsSync(sourcePng)) {
  console.error(`[icon] source png not found: ${sourcePng}`)
  process.exit(1)
}

const icoBuffer = await pngToIco(sourcePng)
fs.writeFileSync(targetIco, icoBuffer)
console.log(`[icon] generated: ${targetIco}`)
