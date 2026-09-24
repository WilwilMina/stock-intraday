// Integration-style tests for the App state machine, with the API client
// mocked so no network/fetch is ever involved. Covers the four visible
// states plus the AbortController race the rapid-resubmit requirement calls
// for: a slow, superseded response must never overwrite a newer one.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import { ApiError } from "./api/stockClient";
import type { DailyAggregate } from "./api/types";
import * as stockClient from "./api/stockClient";

vi.mock("./api/stockClient", async () => {
  const actual = await vi.importActual<typeof import("./api/stockClient")>("./api/stockClient");
  return { ...actual, fetchDailyAggregates: vi.fn() };
});

const fetchMock = vi.mocked(stockClient.fetchDailyAggregates);

beforeEach(() => {
  fetchMock.mockReset();
});

describe("App", () => {
  it("shows the idle message before any submission", () => {
    render(<App />);

    expect(screen.getByRole("status")).toHaveTextContent("Enter a symbol to get started");
  });

  it("shows loading, then the table, on a successful fetch", async () => {
    // A controlled (not auto-resolving) promise, so "loading" can be
    // observed deterministically before resolving it - an immediately
    // resolved mock races with React's state flush and can skip past
    // "loading" before the assertion runs.
    let resolveFetch!: (data: DailyAggregate[]) => void;
    fetchMock.mockImplementation(() => new Promise((resolve) => (resolveFetch = resolve)));

    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("Stock symbol"), "TSLA");
    await user.click(screen.getByRole("button", { name: "Get daily data" }));

    expect(screen.getByRole("status")).toHaveTextContent("Loading");

    resolveFetch([{ day: "2024-06-15", lowAverage: 100, highAverage: 110, volume: 1000 }]);
    await waitFor(() => expect(screen.getByText("Daily aggregates for TSLA")).toBeInTheDocument());
  });

  it("shows a distinct empty-result message for a symbol with zero days", async () => {
    fetchMock.mockResolvedValueOnce([]);
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("Stock symbol"), "NEWCO");
    await user.click(screen.getByRole("button", { name: "Get daily data" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("No data found for NEWCO in the last month"),
    );
  });

  it("shows the invalid-symbol message, distinct from a failed request", async () => {
    fetchMock.mockRejectedValueOnce(new ApiError("invalid_symbol", 'No data found for symbol "ZZZ"'));
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("Stock symbol"), "ZZZ");
    await user.click(screen.getByRole("button", { name: "Get daily data" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent('No data found for symbol "ZZZ"'));
  });

  it("shows the failed-request message for an upstream or network failure", async () => {
    fetchMock.mockRejectedValueOnce(new ApiError("failed", "Something went wrong fetching data. Please try again."));
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("Stock symbol"), "TSLA");
    await user.click(screen.getByRole("button", { name: "Get daily data" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Something went wrong fetching data. Please try again."),
    );
  });

  it("never lets a slow, superseded response overwrite a newer one", async () => {
    // Each call gets its own controllable promise, and honors the real
    // AbortSignal App passes in - exactly like the real fetch-based client -
    // so aborting the first call's controller actually rejects its promise.
    const resolvers: Array<(data: DailyAggregate[]) => void> = [];
    fetchMock.mockImplementation(
      (_symbol, signal) =>
        new Promise<DailyAggregate[]>((resolve, reject) => {
          resolvers.push(resolve);
          signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }),
    );

    const user = userEvent.setup();
    render(<App />);
    const input = screen.getByLabelText("Stock symbol");
    const button = screen.getByRole("button", { name: "Get daily data" });

    await user.type(input, "AAA");
    await user.click(button);
    await user.clear(input);
    await user.type(input, "BBB");
    await user.click(button);

    expect(resolvers).toHaveLength(2);
    // Resolve the stale first request AFTER the second has already been
    // issued (its controller was aborted when the second submit fired).
    resolvers[0]?.([{ day: "2024-01-01", lowAverage: 1, highAverage: 2, volume: 3 }]);
    resolvers[1]?.([{ day: "2024-06-15", lowAverage: 100, highAverage: 110, volume: 1000 }]);

    await waitFor(() => expect(screen.getByText("Daily aggregates for BBB")).toBeInTheDocument());
    expect(screen.queryByText("Daily aggregates for AAA")).not.toBeInTheDocument();
  });
});
