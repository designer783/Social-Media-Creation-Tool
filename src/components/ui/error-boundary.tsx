"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || "An unexpected section error occurred.",
    };
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: "" });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-status-danger-border bg-status-danger-bg p-6 text-status-danger-fg"
        >
          <h3 className="text-base font-semibold">
            {this.props.fallbackTitle ?? "Unable to render this section"}
          </h3>
          <p className="text-sm">{this.state.errorMessage}</p>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={this.handleReset}>
              Retry section
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
