import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

/**
 * Last line of defense: if anything throws during rendering, show a
 * plain-language recovery screen instead of a blank page. The reset button
 * also drops any URL hash so a bad share link can't re-break the app.
 */
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('Trainer crashed:', error)
  }

  private reset = () => {
    try {
      history.replaceState(null, '', location.pathname + location.search)
    } catch {
      // Ignore; reload alone usually recovers too.
    }
    location.reload()
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 12,
          color: '#e8e8ea',
          background: '#1b1d21',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          padding: 24,
        }}
      >
        <div style={{ fontSize: 18 }}>Something went wrong displaying the trainer.</div>
        <div style={{ fontSize: 13, opacity: 0.7, maxWidth: 420 }}>
          This can happen if a shared link was damaged in transit. Resetting takes you back to a
          fresh, working setup — your saved scenarios are kept.
        </div>
        <button
          onClick={this.reset}
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            border: '1px solid #4a4d55',
            background: '#2a2d33',
            color: '#e8e8ea',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Reset and reload
        </button>
      </div>
    )
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
)
