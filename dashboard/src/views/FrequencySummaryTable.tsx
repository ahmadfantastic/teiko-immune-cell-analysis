import { useEffect, useState } from "react";

import { getErrorMessage, getFrequencySummary } from "../api";
import {
  EmptyPanel,
  ErrorPanel,
  LoadingPanel,
  formatInteger,
  populationLabel,
} from "../components";
import type { FrequencyPage, QueryParameters } from "../types";

export default function FrequencySummaryTable({
  queryParameters,
}: {
  queryParameters: QueryParameters;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [result, setResult] = useState<FrequencyPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const filterKey = JSON.stringify(queryParameters);

  useEffect(() => {
    setPage(1);
  }, [filterKey]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    getFrequencySummary({
      ...queryParameters,
      page,
      page_size: pageSize,
    })
      .then((data) => {
        if (active) setResult(data);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(getErrorMessage(reason, "Could not load the summary table"));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filterKey, page, pageSize]);

  if (isLoading && !result)
    return <LoadingPanel message="Loading summary table" />;
  if (error && !result) return <ErrorPanel message={error} />;
  if (!result || result.total === 0)
    return <EmptyPanel message="No rows match the selected filters." />;

  const firstRow = (result.page - 1) * result.page_size + 1;
  const lastRow = Math.min(result.page * result.page_size, result.total);

  return (
    <section className="panel table-panel frequency-summary-table">
      <div className="panel-heading-row">
        <div>
          <h2>Sample Cell Frequencies</h2>
        </div>
        <strong className="result-pill">
          {formatInteger(result.total)} Rows
        </strong>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Sample</th>
              <th>Total Count</th>
              <th>Cell Population</th>
              <th>Cell Count</th>
              <th>Relative Frequency</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, index) => (
              <tr key={`${row.sample}-${row.population}-${index}`}>
                <td>{row.sample}</td>
                <td>{formatInteger(row.total_count)}</td>
                <td>{populationLabel(row.population)}</td>
                <td>{formatInteger(row.count)}</td>
                <td>{row.percentage.toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="table-pagination">
        <label htmlFor="summary-page-size">
          <span>Rows per Page</span>
          <select
            id="summary-page-size"
            value={pageSize}
            disabled={isLoading}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
        </label>
        <span aria-live="polite">
          {isLoading ? (
            "Loading Page…"
          ) : (
            <>
              {formatInteger(firstRow)}–{formatInteger(lastRow)} of{" "}
              {formatInteger(result.total)} · Page {result.page} of{" "}
              {result.total_pages}
            </>
          )}
        </span>
        <div>
          <button
            type="button"
            disabled={isLoading || result.page <= 1}
            onClick={() => setPage((current) => current - 1)}
          >
            Previous
          </button>
          <button
            type="button"
            disabled={isLoading || result.page >= result.total_pages}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
