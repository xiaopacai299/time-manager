import { Component } from 'react'

/**
 * 宠物区单独兜底：避免头像/Lottie 抛错拖垮整页（气泡、统计等一并消失）。
 */
export default class PetRenderErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="pet-visual pet-visual--fallback" role="img" aria-label="宠物加载失败">
          <span className="pet-visual__fallback-dot" />
        </div>
      )
    }
    return this.props.children
  }
}
