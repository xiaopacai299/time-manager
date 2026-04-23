import badCatAnimation from '../assets/bad-cat.json'

/**
 * 休息用：去掉快速伸爪层 Lapa；保留原 cup 层并水平镜像（负 X 缩放）、静止在端起姿势，避免与叠加手绘杯重复。
 */
export function getBadCatRestAnimationData() {
  const data = JSON.parse(JSON.stringify(badCatAnimation))
  data.layers = data.layers.filter((layer) => layer.nm !== 'Lapa')

  const cup = data.layers.find((layer) => layer.nm === 'cup')
  if (cup?.ks) {
    const { s } = cup.ks
    const sx = Array.isArray(s?.k) ? s.k[0] : s?.k?.[0] ?? 18.103
    const sy = Array.isArray(s?.k) ? s.k[1] : s?.k?.[1] ?? 18.103
    const sz = Array.isArray(s?.k) ? s.k[2] : s?.k?.[2] ?? 100
    cup.ks.p = { a: 0, k: [61.25, 280.25, 0], ix: 2, l: 2 }
    cup.ks.r = { a: 0, k: 0, ix: 10 }
    cup.ks.o = { a: 0, k: 100, ix: 11 }
    cup.ks.s = { a: 0, k: [-Math.abs(sx), sy, sz], ix: 6, l: 2 }
  }

  return data
}
