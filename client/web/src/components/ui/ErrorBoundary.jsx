import { Component } from 'react';
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react';

import i18n from '../../lib/i18n.js';

// FET-17 — a class component (error boundaries must be classes, per React's
// own constraint) has no hook access, so this reads the shared `i18n`
// singleton directly rather than `useTranslation()` — same pattern already
// established by `lib/dateFormat.js`/`lib/numberFormat.js` for non-hook code.
const t = (key, fallback) => i18n.t(key, fallback);

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // In production, log error to structured telemetry / monitoring service if available
    console.error('Unhandled Application Error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background text-foreground animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-destructive/20 bg-card p-6 sm:p-8 shadow-one-ui-lg text-center space-y-6">
            <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
              <AlertTriangle size={32} />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold tracking-tight">{t('errors.boundary.title', 'Something went wrong')}</h1>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {t('errors.boundary.description', 'An unexpected error occurred while rendering this component. You can try refreshing or returning to the dashboard.')}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-one-ui hover:opacity-90 active:scale-[0.98] transition-all"
              >
                <RefreshCw size={16} />
                {t('errors.boundary.tryAgain', 'Try Again')}
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl border border-border bg-transparent hover:bg-accent text-sm font-semibold active:scale-[0.98] transition-all"
              >
                {t('errors.boundary.reloadPage', 'Reload Page')}
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl border border-border bg-transparent hover:bg-accent text-sm font-semibold active:scale-[0.98] transition-all"
              >
                <Home size={16} />
                {t('errors.boundary.dashboard', 'Dashboard')}
              </button>
            </div>

            {this.state.error ? (
              <div className="pt-4 border-t border-border text-left">
                <button
                  type="button"
                  onClick={this.toggleDetails}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium"
                >
                  {this.state.showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {this.state.showDetails ? t('errors.boundary.hideDetails', 'Hide error details') : t('errors.boundary.showDetails', 'Show error details')}
                </button>

                {this.state.showDetails ? (
                  <div className="mt-3 p-3 rounded-lg bg-muted/60 text-muted-foreground text-xs font-mono overflow-x-auto max-h-48 whitespace-pre-wrap leading-relaxed select-all">
                    <p className="font-semibold text-destructive mb-1">{this.state.error.toString()}</p>
                    {this.state.errorInfo?.componentStack}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
