import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <h2 className="text-lg font-semibold">页面出现错误</h2>
          <p className="text-sm text-muted-foreground">
            {this.state.error?.message ?? '未知错误'}
          </p>
          <Button variant="outline" onClick={() => this.setState({ hasError: false, error: null })}>
            重试
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
