import { Component, type ReactNode } from 'react'

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#1C1C1E] text-white flex items-center justify-center p-8">
          <div className="max-w-md">
            <h1 className="text-xl font-bold text-red-400 mb-4">页面崩溃</h1>
            <div className="bg-[#2C2C2E] rounded-xl p-4 mb-4">
              <p className="text-sm font-mono text-red-300 break-all">
                {this.state.error?.message || '未知错误'}
              </p>
            </div>
            <pre className="text-xs text-gray-400 overflow-auto max-h-48 bg-black/30 rounded-lg p-3">
              {this.state.error?.stack}
            </pre>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold text-obsidian-900"
              style={{ background: 'linear-gradient(135deg, #F5C542, #D4A020)' }}
            >
              重试
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
