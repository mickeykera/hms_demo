import { Component } from 'react';
import { AlertTriangle, RotateCcw, LogOut } from 'lucide-react';

/**
 * Catches render-time crashes inside a dashboard so one broken page cannot
 * leave the user staring at a blank white screen with no way out.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Surfaced in the console so the cause is diagnosable.
    console.error('Dashboard render error:', error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.assign('/login');
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-surface-alt">
        <div className="card w-full max-w-lg p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-full bg-red-100 shrink-0">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900">
                This page could not be displayed
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Something went wrong while rendering. The rest of the system is
                still usable - you can retry, or sign out and start fresh.
              </p>
              <details className="mt-3">
                <summary className="text-xs text-gray-500 cursor-pointer">
                  Technical details
                </summary>
                <pre className="mt-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap break-words">
                  {String(error?.message || error)}
                </pre>
              </details>
              <div className="flex flex-col sm:flex-row gap-3 mt-5">
                <button
                  onClick={this.handleReset}
                  className="btn-primary flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Try again
                </button>
                <button
                  onClick={this.handleLogout}
                  className="btn-secondary flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}