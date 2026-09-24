// Renders the daily aggregates, newest first for the reader (the API itself
// stays ascending - only a copy is reversed here). Prices are fixed to 4
// decimals and volume uses a pinned locale so output is deterministic; `day`
// is rendered exactly as the API returns it, never re-parsed with Date().

import type { DailyAggregate } from "../api/types";

interface ResultsTableProps {
  symbol: string;
  data: DailyAggregate[];
}

export function ResultsTable({ symbol, data }: ResultsTableProps) {
  const newestFirst = [...data].reverse();

  return (
    // Scrolls horizontally instead of wrapping cell content mid-word on
    // narrow viewports (see App.css's .table-scroll / white-space rules).
    <div className="table-scroll">
      <table>
        <caption>Daily aggregates for {symbol}</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Low average</th>
            <th scope="col">High average</th>
            <th scope="col">Volume</th>
          </tr>
        </thead>
        <tbody>
          {newestFirst.map((row) => (
            <tr key={row.day}>
              <td>{row.day}</td>
              <td>{row.lowAverage.toFixed(4)}</td>
              <td>{row.highAverage.toFixed(4)}</td>
              <td>{row.volume.toLocaleString("en-US")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
