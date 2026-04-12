import './RunCatTailSparks.css'

/**
 * 奔跑 run-cat 时叠在 Lottie 下层；发射锚点在身右侧，向 +X 溅出（与旧版左后尾巴对调左右）；随父级 scaleX 镜像。
 */
export default function RunCatTailSparks() {
  return (
    <div className="run-cat-tail-sparks" aria-hidden="true">
      <div className="run-cat-tail-sparks__origin">
        <span className="run-cat-tail-sparks__spark run-cat-tail-sparks__spark--streak run-cat-tail-sparks__spark--0" />
        <span className="run-cat-tail-sparks__spark run-cat-tail-sparks__spark--dot run-cat-tail-sparks__spark--1" />
        <span className="run-cat-tail-sparks__spark run-cat-tail-sparks__spark--tiny run-cat-tail-sparks__spark--2" />
        <span className="run-cat-tail-sparks__spark run-cat-tail-sparks__spark--dot run-cat-tail-sparks__spark--3" />
        <span className="run-cat-tail-sparks__spark run-cat-tail-sparks__spark--tiny run-cat-tail-sparks__spark--4" />
        <span className="run-cat-tail-sparks__spark run-cat-tail-sparks__spark--streak run-cat-tail-sparks__spark--5" />
      </div>
    </div>
  )
}
