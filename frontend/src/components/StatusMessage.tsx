// The single aria-live region for every non-table state (idle, loading, an
// empty result, an invalid symbol, or a failed request), so screen readers
// announce each transition without needing focus to move anywhere.

import type { DailyAggregate } from "../api/types";

export type ViewState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; symbol: string; data: DailyAggregate[] }
  | { kind: "invalid"; message: string }
  | { kind: "failed"; message: string };

function messageFor(state: ViewState): string | null {
  switch (state.kind) {
    case "idle":
      return "Enter a symbol to get started";
    case "loading":
      return "Loading...";
    case "success":
      // A non-empty success renders the table instead of a message.
      return state.data.length === 0 ? `No data found for ${state.symbol} in the last month` : null;
    case "invalid":
    case "failed":
      return state.message;
  }
}

export function StatusMessage({ state }: { state: ViewState }) {
  const message = messageFor(state);
  if (message === null) {
    return null;
  }

  return (
    <p role="status" aria-live="polite" className="status-message">
      {message}
    </p>
  );
}
