import React from "react";

import { FrostPanel } from "./FrostPanel";

interface ErrorBoundaryState {
  error?: Error;
}

export class ErrorBoundary extends React.Component<
  React.PropsWithChildren,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("FrostChat render error", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="grid min-h-screen place-items-center px-6">
          <FrostPanel className="w-full max-w-2xl p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-rose-200/70">
              FrostChat Error
            </p>
            <h1 className="mt-3 font-display text-3xl font-semibold text-white">
              The chat UI crashed
            </h1>
            <p className="mt-3 text-sm text-white/60">
              This is now surfacing the actual runtime error instead of a blank screen.
            </p>
            <pre className="mt-5 overflow-auto rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-rose-100/85">
              {this.state.error.message}
            </pre>
          </FrostPanel>
        </div>
      );
    }

    return this.props.children;
  }
}
