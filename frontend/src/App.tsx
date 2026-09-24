// Root component: wires the symbol form to the API client and renders
// exactly one of {table, status message} at a time. Every submit aborts the
// previous in-flight request first, so a slow, superseded response can never
// overwrite a newer one.

import { useCallback, useRef, useState } from "react";
import { SymbolForm } from "./components/SymbolForm";
import { ResultsTable } from "./components/ResultsTable";
import { StatusMessage, type ViewState } from "./components/StatusMessage";
import { ApiError, fetchDailyAggregates } from "./api/stockClient";
import "./App.css";

export function App() {
  const [state, setState] = useState<ViewState>({ kind: "idle" });
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSubmit = useCallback((symbol: string) => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setState({ kind: "loading" });

    fetchDailyAggregates(symbol, controller.signal)
      .then((data) => {
        setState({ kind: "success", symbol, data });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          // Superseded by a newer submit - not a failure, nothing to show.
          return;
        }
        if (error instanceof ApiError && error.kind === "invalid_symbol") {
          setState({ kind: "invalid", message: error.message });
          return;
        }
        const message =
          error instanceof ApiError ? error.message : "Something went wrong fetching data. Please try again.";
        setState({ kind: "failed", message });
      });
  }, []);

  return (
    <main>
      <h1>Stock Intraday</h1>
      <SymbolForm onSubmit={handleSubmit} />
      <StatusMessage state={state} />
      {state.kind === "success" && state.data.length > 0 && (
        <ResultsTable symbol={state.symbol} data={state.data} />
      )}
    </main>
  );
}
