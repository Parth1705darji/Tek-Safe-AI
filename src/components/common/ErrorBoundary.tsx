import { Component, type ReactNode, type ErrorInfo } from 'react';
import { Shield, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

function ErrorFallback({ error, onReset }: { error: Error | null; onReset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-light-bg px-4 dark:bg-dark-bg">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-900/20">
            <Shield className="h-8 w-8 text-red-500" />
          </div>
        </div>

        <h1 className="mb-3 text-xl font-semibold text-gray-900 dark:text-white">
          Something went wrong
        </h1>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          An unexpected error occurred. Please refresh the page — your chat history is safe.
        </p>

        {error && (
          <p className="mb-6 rounded-xl bg-gray-100 px-4 py-3 text-left font-mono text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            {error.message}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={onReset}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary/90 active:scale-[0.98]"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
          <button
            onClick={() => window.location.replace('/')}
            className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Go to Home
          </button>
        </div>

        <p className="mt-6 text-xs text-gray-400 dark:text-gray-500">
          If this keeps happening,{' '}
          <a
            href="mailto:support@teksafe.ai"
            className="text-accent underline underline-offset-2"
          >
            report the issue
          </a>
          .
        </p>
      </div>
    </div>
  );
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onReset={this.handleReset} />;
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
