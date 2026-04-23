/**
 * 从 bad-cat.json 生成 run-cat.json：原地奔跑循环（手工关键帧，非 AE 重导出）
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const src = path.join(root, 'src', 'assets', 'bad-cat.json')
const out = path.join(root, 'src', 'assets', 'run-cat.json')

const data = JSON.parse(fs.readFileSync(src, 'utf8'))

const OP = 60
const FR = data.fr || 60

data.nm = 'Run Cat'
data.op = OP

const easeIn = { x: 0.33, y: 1 }
const easeOut = { x: 0.67, y: 0 }

/** 身体中心轨迹：8 步一循环，t=60 与 t=0 重合 */
const bodySteps = [
  [0, 190, 183],
  [8, 198, 175],
  [16, 206, 183],
  [24, 198, 175],
  [32, 190, 183],
  [40, 182, 175],
  [48, 174, 183],
  [56, 182, 175],
  [60, 190, 183],
]

function positionTrackFromBody() {
  const relEye2 = [-46, -47.25]
  const relEye = [0, -47.25]
  const relTail = [42.625, 17.5]

  function build(steps, rel) {
    const k = []
    for (let i = 0; i < steps.length - 1; i++) {
      const [t, bx, by] = steps[i]
      const s = [bx + rel[0], by + rel[1], 0]
      k.push({
        i: { x: easeIn.x, y: easeIn.y },
        o: { x: easeOut.x, y: easeOut.y },
        t,
        s,
        to: [0, 0, 0],
        ti: [0, 0, 0],
      })
    }
    const last = steps[steps.length - 1]
    k.push({ t: last[0], s: [last[1] + rel[0], last[2] + rel[1], 0] })
    return { a: 1, k, ix: 2, l: 2 }
  }

  return {
    body: (() => {
      const k = []
      for (let i = 0; i < bodySteps.length - 1; i++) {
        const [t, x, y] = bodySteps[i]
        k.push({
          i: { x: easeIn.x, y: easeIn.y },
          o: { x: easeOut.x, y: easeOut.y },
          t,
          s: [x, y, 0],
          to: [0, 0, 0],
          ti: [0, 0, 0],
        })
      }
      const L = bodySteps[bodySteps.length - 1]
      k.push({ t: L[0], s: [L[1], L[2], 0] })
      return { a: 1, k, ix: 2, l: 2 }
    })(),
    eye2: build(bodySteps, relEye2),
    eye: build(bodySteps, relEye),
    tale: build(bodySteps, relTail),
  }
}

const tracks = positionTrackFromBody()

/** 身体前倾 ± 轻微颠簸 */
const bodyRot = {
  a: 1,
  k: [
    { i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] }, t: 0, s: [-7] },
    { i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] }, t: 8, s: [-10] },
    { i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] }, t: 16, s: [-6] },
    { i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] }, t: 24, s: [-10] },
    { i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] }, t: 32, s: [-7] },
    { i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] }, t: 40, s: [-10] },
    { i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] }, t: 48, s: [-6] },
    { i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] }, t: 56, s: [-10] },
    { t: 60, s: [-7] },
  ],
  ix: 10,
}

/** 前爪（Lapa）左右快速交替，模拟迈腿 */
const lapaPos = {
  a: 1,
  k: [
    { i: { x: 0.33, y: 1 }, o: { x: 0.67, y: 0 }, t: 0, s: [188, 246, 0], to: [0, 0, 0], ti: [0, 0, 0] },
    { i: { x: 0.33, y: 1 }, o: { x: 0.67, y: 0 }, t: 8, s: [142, 252, 0], to: [0, 0, 0], ti: [0, 0, 0] },
    { i: { x: 0.33, y: 1 }, o: { x: 0.67, y: 0 }, t: 16, s: [188, 246, 0], to: [0, 0, 0], ti: [0, 0, 0] },
    { i: { x: 0.33, y: 1 }, o: { x: 0.67, y: 0 }, t: 24, s: [232, 252, 0], to: [0, 0, 0], ti: [0, 0, 0] },
    { i: { x: 0.33, y: 1 }, o: { x: 0.67, y: 0 }, t: 32, s: [188, 246, 0], to: [0, 0, 0], ti: [0, 0, 0] },
    { i: { x: 0.33, y: 1 }, o: { x: 0.67, y: 0 }, t: 40, s: [142, 252, 0], to: [0, 0, 0], ti: [0, 0, 0] },
    { i: { x: 0.33, y: 1 }, o: { x: 0.67, y: 0 }, t: 48, s: [188, 246, 0], to: [0, 0, 0], ti: [0, 0, 0] },
    { i: { x: 0.33, y: 1 }, o: { x: 0.67, y: 0 }, t: 56, s: [232, 252, 0], to: [0, 0, 0], ti: [0, 0, 0] },
    { t: 60, s: [188, 246, 0] },
  ],
  ix: 2,
  l: 2,
}

const lapaRot = {
  a: 1,
  k: [
    { i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] }, t: 0, s: [38] },
    { i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] }, t: 8, s: [-42] },
    { i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] }, t: 16, s: [38] },
    { i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] }, t: 24, s: [-42] },
    { i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] }, t: 32, s: [38] },
    { i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] }, t: 40, s: [-42] },
    { i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] }, t: 48, s: [38] },
    { i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] }, t: 56, s: [-42] },
    { t: 60, s: [38] },
  ],
  ix: 10,
}

/** 尾巴根部左右甩（在原有路径动画上叠加旋转） */
const taleRot = {
  a: 1,
  k: [
    { i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] }, t: 0, s: [0] },
    { i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] }, t: 4, s: [18] },
    { i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] }, t: 8, s: [-12] },
    { i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] }, t: 12, s: [18] },
    { i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] }, t: 16, s: [-12] },
    { i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] }, t: 20, s: [18] },
    { i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] }, t: 24, s: [-12] },
    { i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] }, t: 28, s: [18] },
    { i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] }, t: 32, s: [-12] },
    { i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] }, t: 36, s: [18] },
    { i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] }, t: 40, s: [-12] },
    { i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] }, t: 44, s: [18] },
    { i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] }, t: 48, s: [-12] },
    { i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] }, t: 52, s: [18] },
    { i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] }, t: 56, s: [-12] },
    { t: 60, s: [0] },
  ],
  ix: 10,
}

/** 压缩尾巴路径关键帧时间，让弯曲更快 */
function speedUpTailPathKeyframes(layer) {
  const gr = layer.shapes?.[0]
  const pathSh = gr?.it?.find((x) => x.ty === 'sh')
  if (!pathSh?.ks?.k || !Array.isArray(pathSh.ks.k)) return
  const orig = pathSh.ks.k
  const maxT = Math.max(...orig.map((x) => x.t ?? 0))
  const scale = (OP - 1) / maxT
  pathSh.ks.k = orig.map((kf) => ({
    ...kf,
    t: Math.round(kf.t * scale),
  }))
  const last = pathSh.ks.k[pathSh.ks.k.length - 1]
  if (last) last.t = OP
}

for (const layer of data.layers) {
  layer.op = OP
  if (layer.nm === 'body') {
    layer.ks.p = tracks.body
    layer.ks.r = bodyRot
  }
  if (layer.nm === 'eye 2') layer.ks.p = tracks.eye2
  if (layer.nm === 'eye') layer.ks.p = tracks.eye
  if (layer.nm === 'tale') {
    layer.ks.p = tracks.tale
    layer.ks.r = taleRot
    speedUpTailPathKeyframes(layer)
  }
  if (layer.nm === 'Lapa') {
    layer.ks.p = lapaPos
    layer.ks.r = lapaRot
  }
  if (layer.nm === 'cup') {
    layer.ks.o = { a: 0, k: 0, ix: 11 }
    layer.ks.r = { a: 0, k: 0, ix: 10 }
    layer.ks.p = { a: 0, k: [81.25, 303.25, 0], ix: 2, l: 2 }
  }
}

fs.writeFileSync(out, JSON.stringify(data), 'utf8')
console.log(`Wrote ${out} (${OP}f @ ${FR}fps)`)
