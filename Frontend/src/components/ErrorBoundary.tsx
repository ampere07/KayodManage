import React from 'react';

interface ErrorBoundaryState {
  error: Error | null;
  componentStack: string | null;
}

/**
 * Top-level render-error fallback — previously nothing caught render errors
 * anywhere in this app, so a single bad field access (undefined.someMethod())
 * blanked the entire page with no indication of what broke or where.
 */
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ error, componentStack: info.componentStack });
    console.error('[ErrorBoundary] Caught render error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
          <h2 style={{ color: '#b91c1c' }}>Something went wrong rendering this page</h2>
          <p>{this.state.error.message}</p>
          <pre>{this.state.componentStack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
