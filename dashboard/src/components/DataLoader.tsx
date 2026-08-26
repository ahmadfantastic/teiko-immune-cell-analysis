import { useEffect, useState } from "react";

import { getErrorMessage, loadData } from "../api";
import type { AnalysisOptions } from "../types";
import { formatInteger } from "./formatters";

type DataLoaderProps = {
  onClose: () => void;
  onLoaded: (options: AnalysisOptions) => void;
};

export function DataLoader({ onClose, onLoaded }: DataLoaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sampleCount, setSampleCount] = useState<number | null>(null);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !isLoading) onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isLoading, onClose]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Select a CSV file first");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await loadData(file);
      onLoaded(result.options);
      setSampleCount(result.options.metrics.samples);
      setFile(null);
    } catch (reason) {
      setError(getErrorMessage(reason, "Could not load the CSV"));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      className="data-loader-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isLoading) onClose();
      }}
    >
      <section
        className="data-loader"
        role="dialog"
        aria-modal="true"
        aria-labelledby="data-loader-title"
      >
        <div className="data-loader-header">
          <div>
            <h2 id="data-loader-title">Load CSV Data</h2>
            <p>Select a CSV with the same columns used by the project.</p>
          </div>
          <button type="button" onClick={onClose} disabled={isLoading}>
            Close
          </button>
        </div>

        {sampleCount === null ? (
          <form onSubmit={submit}>
            <label className="data-file-field" htmlFor="data-file">
              <span>CSV File</span>
              <input
                id="data-file"
                type="file"
                accept=".csv,text/csv"
                disabled={isLoading}
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setError(null);
                }}
              />
            </label>
            {error && <p className="data-loader-error">{error}</p>}
            <p className="data-loader-note">
              The current dashboard database is replaced only after the file
              passes validation.
            </p>
            <div className="data-loader-actions">
              <span>{file?.name ?? "No File Selected"}</span>
              <button type="submit" disabled={isLoading}>
                {isLoading ? "Loading Data…" : "Load Data"}
              </button>
            </div>
          </form>
        ) : (
          <div className="data-loader-success">
            <strong>Data Loaded</strong>
            <p>{formatInteger(sampleCount)} Samples Are Ready for Analysis</p>
            <button type="button" onClick={onClose}>
              Done
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
