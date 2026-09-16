import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  stack: string;
}

/**
 * Diagnostic as much as defensive.
 *
 * Without a boundary a render error unmounts the whole tree and leaves a blank
 * page that looks exactly like a crash. With one, a JavaScript fault is caught
 * and displayed — so if the page dies and this never appears, the cause was not
 * JavaScript, which rules out a whole class of suspect at a glance.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, stack: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ stack: info.componentStack ?? '' });
    // Keep it in the console too, in case the page is reloaded before it is read.
    console.error('Invoker Lab caught a render error:', error, info.componentStack);
  }

  render(): ReactNode {
    const { error, stack } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="boundary">
        <h2>Something threw</h2>
        <p className="boundary-msg">{error.message}</p>
        {stack && <pre className="boundary-stack">{stack.trim()}</pre>}
        <button type="button" className="btn primary" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
