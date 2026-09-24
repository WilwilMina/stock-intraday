// Unit tests for table formatting/semantics: newest-first ordering, fixed
// decimal prices, locale-pinned volume formatting, and the day string passed
// through untouched.

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResultsTable } from "./ResultsTable";
import type { DailyAggregate } from "../api/types";

const sampleData: DailyAggregate[] = [
  { day: "2024-06-14", lowAverage: 100.5, highAverage: 110, volume: 1234567 },
  { day: "2024-06-15", lowAverage: 101.25, highAverage: 111.1, volume: 2000000 },
];

describe("ResultsTable", () => {
  it("renders a caption naming the symbol and scoped column headers", () => {
    render(<ResultsTable symbol="TSLA" data={sampleData} />);

    expect(screen.getByText("Daily aggregates for TSLA")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Day" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Volume" })).toBeInTheDocument();
  });

  it("renders rows newest first without mutating the input array", () => {
    render(<ResultsTable symbol="TSLA" data={sampleData} />);

    const rows = screen.getAllByRole("row").slice(1); // drop the header row
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("2024-06-15");
    expect(rows[1]).toHaveTextContent("2024-06-14");
    // The prop array itself must stay ascending (App/API order is untouched).
    expect(sampleData[0]?.day).toBe("2024-06-14");
  });

  it("formats prices to 4 decimals and volume with thousands separators", () => {
    render(<ResultsTable symbol="TSLA" data={sampleData} />);

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("101.2500");
    expect(rows[0]).toHaveTextContent("111.1000");
    expect(rows[0]).toHaveTextContent("2,000,000");
    expect(rows[1]).toHaveTextContent("1,234,567");
  });

  it("renders the day exactly as given, never reinterpreted as a Date", () => {
    // 2024-01-01 is a boundary that a UTC-vs-local Date() parse could easily
    // shift to 2023-12-31 depending on the runtime's timezone.
    render(<ResultsTable symbol="TSLA" data={[{ day: "2024-01-01", lowAverage: 1, highAverage: 2, volume: 3 }]} />);

    expect(screen.getByText("2024-01-01")).toBeInTheDocument();
  });
});
