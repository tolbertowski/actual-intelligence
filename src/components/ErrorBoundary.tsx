import { Component, type ErrorInfo, type ReactNode } from 'react';

// A top-level safety net. A render error in one view shouldn't blank the whole
// app — especially since the app holds the only copy of the user's cards and
// export must stay reachable. We catch, show a calm message, and offer a reload.

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Leave a breadcrumb in the console; we don't send anything anywhere.
    console.error('Caught by ErrorBoundary:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="page">
          <h1>Something went wrong on this screen</h1>
          <p className="muted">
            Your cards are safe — they live in this browser’s storage and weren’t
            touched. Reloading usually clears this.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload
            </button>
            <button
              className="btn"
              onClick={() => {
                window.location.hash = '#/';
                this.setState({ error: null });
              }}
            >
              Back to decks
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
