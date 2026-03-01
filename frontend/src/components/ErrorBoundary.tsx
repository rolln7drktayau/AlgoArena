import React from "react";

interface Props {
  title: string;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error): void {
    console.error("Panel error:", error);
  }

  componentDidUpdate(prevProps: Props): void {
    if (prevProps.title !== this.props.title && this.state.hasError) {
      this.setState({ hasError: false, message: null });
    }
  }

  private readonly resetBoundary = () => {
    this.setState({ hasError: false, message: null });
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-rose-400/40 bg-rose-950/50 p-4 text-sm text-rose-100">
          <p className="font-semibold">{this.props.title} failed</p>
          <p className="mt-1 text-xs opacity-80">{this.state.message ?? "Unexpected rendering error."}</p>
          <button
            type="button"
            onClick={this.resetBoundary}
            className="mt-3 rounded-md border border-rose-300/40 px-3 py-1 text-xs"
          >
            Retry Render
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
