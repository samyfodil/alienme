import { Component, type ReactNode } from 'react'

export class Safe3D extends Component<{ children?: ReactNode; fallback?: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (!this.state.failed) return this.props.children
    if (this.props.fallback !== undefined) return this.props.fallback
    return (
      <div className="no-3d">
        <p>Your browser has 3D graphics turned off, so the assessment can&rsquo;t be shown.</p>
        <p>
          Restart the browser, or check that hardware acceleration is on in its settings, then reload this
          page.
        </p>
      </div>
    )
  }
}
