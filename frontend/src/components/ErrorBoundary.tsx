import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: 24,
            textAlign: 'center',
          }}
        >
          <img src="/logo-mark.svg" alt="" style={{ width: 64, opacity: 0.6 }} />
          <h1
            style={{
              fontFamily: 'var(--lmn-font-display)',
              fontSize: 28,
              letterSpacing: '0.04em',
              color: 'var(--lmn-ash-100)',
              margin: 0,
            }}
          >
            QUALCOSA È ANDATO STORTO
          </h1>
          <p style={{ color: 'var(--lmn-ash-400)', fontSize: 14, margin: 0 }}>
            Ricarica la pagina per riprendere la partita.
          </p>
          <button
            className="lmn-btn lmn-btn--primary lmn-btn--md"
            onClick={() => window.location.reload()}
          >
            Ricarica
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
