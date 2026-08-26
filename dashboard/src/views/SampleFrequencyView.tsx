import { useEffect, useMemo, useState } from "react";

import { getErrorMessage, getSampleFrequencies, getSamples } from "../api";
import {
  CHART_CONFIG,
  CHART_LAYOUT,
  EmptyPanel,
  ErrorPanel,
  FilterSelect,
  LoadingPanel,
  POPULATION_COLORS,
  Plot,
  formatInteger,
  populationLabel,
  titleCaseLabel,
} from "../components";
import type {
  AnalysisOptions,
  FrequencyRow,
  QueryParameters,
  SampleMetadata,
} from "../types";

export default function SampleFrequencyView({
  options,
  queryParameters,
}: {
  options: AnalysisOptions;
  queryParameters: QueryParameters;
}) {
  const [samples, setSamples] = useState<SampleMetadata[]>([]);
  const [sampleCount, setSampleCount] = useState(0);
  const [selectedSample, setSelectedSample] = useState("");
  const [query, setQuery] = useState("");
  const [population, setPopulation] = useState("all");
  const [frequencies, setFrequencies] = useState<FrequencyRow[]>([]);
  const [isLoadingSamples, setIsLoadingSamples] = useState(true);
  const [isLoadingFrequencies, setIsLoadingFrequencies] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filterKey = JSON.stringify(queryParameters);

  useEffect(() => {
    let active = true;
    setIsLoadingSamples(true);
    setError(null);
    getSamples(queryParameters)
      .then((result) => {
        if (!active) return;
        setSamples(result.samples);
        setSampleCount(result.count);
        setSelectedSample((current) => {
          if (result.samples.some((sample) => sample.sample === current))
            return current;
          return result.samples[0]?.sample ?? "";
        });
      })
      .catch((reason: unknown) => {
        if (active) setError(getErrorMessage(reason, "Could not load samples"));
      })
      .finally(() => {
        if (active) setIsLoadingSamples(false);
      });
    return () => {
      active = false;
    };
  }, [filterKey]);

  useEffect(() => {
    if (!selectedSample) {
      setFrequencies([]);
      setQuery("");
      return;
    }

    let active = true;
    setQuery(selectedSample);
    setIsLoadingFrequencies(true);
    getSampleFrequencies(selectedSample)
      .then((result) => {
        if (active) setFrequencies(result.frequencies);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(getErrorMessage(reason, "Could not load frequencies"));
      })
      .finally(() => {
        if (active) setIsLoadingFrequencies(false);
      });
    return () => {
      active = false;
    };
  }, [selectedSample]);

  const selectedMetadata = samples.find(
    (sample) => sample.sample === selectedSample,
  );
  const currentIndex = samples.findIndex(
    (sample) => sample.sample === selectedSample,
  );
  const visibleRows =
    population === "all"
      ? frequencies
      : frequencies.filter((row) => row.population === population);
  const totalCount = frequencies[0]?.total_count ?? 0;

  const suggestions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized || normalized === selectedSample.toLowerCase()) return [];
    return samples
      .filter((sample) => sample.sample.toLowerCase().includes(normalized))
      .slice(0, 7);
  }, [query, samples, selectedSample]);

  function chooseSample(sample: string) {
    setSelectedSample(sample);
    setQuery(sample);
  }

  function submitSample() {
    const match = samples.find(
      (sample) => sample.sample.toLowerCase() === query.trim().toLowerCase(),
    );
    if (match) chooseSample(match.sample);
  }

  if (error) return <ErrorPanel message={error} />;
  if (isLoadingSamples)
    return <LoadingPanel message="Finding matching samples" />;
  if (samples.length === 0)
    return <EmptyPanel message="No samples match the selected filters." />;

  return (
    <section className="sample-frequency-layout">
      <aside className="sample-selector panel">
        <div className="sample-selector-header">
          <span className="eyebrow">Matching Samples</span>
          <strong>{formatInteger(sampleCount)}</strong>
        </div>

        <label className="search-field" htmlFor="sample-search">
          <span>Sample ID</span>
          <div>
            <input
              id="sample-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitSample();
              }}
            />
            <button type="button" onClick={submitSample}>
              View
            </button>
          </div>
        </label>
        {suggestions.length > 0 && (
          <div className="suggestions">
            {suggestions.map((sample) => (
              <button
                key={sample.sample}
                type="button"
                onClick={() => chooseSample(sample.sample)}
              >
                {sample.sample}
              </button>
            ))}
          </div>
        )}

        <div className="sample-navigation">
          <button
            type="button"
            disabled={currentIndex <= 0}
            onClick={() => chooseSample(samples[currentIndex - 1].sample)}
          >
            Previous
          </button>
          <span>
            {formatInteger(currentIndex + 1)} of {formatInteger(samples.length)}
          </span>
          <button
            type="button"
            disabled={currentIndex >= samples.length - 1}
            onClick={() => chooseSample(samples[currentIndex + 1].sample)}
          >
            Next
          </button>
        </div>

        {selectedMetadata && (
          <dl className="sample-metadata">
            <div>
              <dt>Project</dt>
              <dd>{selectedMetadata.project}</dd>
            </div>
            <div>
              <dt>Subject</dt>
              <dd>{selectedMetadata.subject}</dd>
            </div>
            <div>
              <dt>Condition</dt>
              <dd>{titleCaseLabel(selectedMetadata.condition)}</dd>
            </div>
            <div>
              <dt>Treatment</dt>
              <dd>{titleCaseLabel(selectedMetadata.treatment)}</dd>
            </div>
            <div>
              <dt>Sample Type</dt>
              <dd>{selectedMetadata.sample_type}</dd>
            </div>
            <div>
              <dt>Collection Day</dt>
              <dd>Day {selectedMetadata.time_from_treatment_start}</dd>
            </div>
          </dl>
        )}
      </aside>

      <div className="frequency-results">
        <div className="panel chart-panel">
          <div className="panel-heading-row">
            <div>
              <span className="eyebrow">{selectedSample}</span>
              <h2>Relative Frequency</h2>
            </div>
            <FilterSelect
              id="population-display"
              label="Highlight"
              value={population}
              options={options.populations}
              allLabel="No Highlight"
              onChange={setPopulation}
            />
          </div>
          {isLoadingFrequencies ? (
            <LoadingPanel />
          ) : (
            <Plot
              data={[
                {
                  type: "pie",
                  labels: frequencies.map((row) =>
                    populationLabel(row.population),
                  ),
                  values: frequencies.map((row) => row.percentage),
                  customdata: frequencies.map((row) => row.count),
                  hole: 0.62,
                  sort: false,
                  direction: "clockwise",
                  domain: { x: [0.05, 0.95], y: [0.16, 0.98] },
                  marker: {
                    colors: frequencies.map(
                      (row) => POPULATION_COLORS[row.population],
                    ),
                    line: { color: "#ffffff", width: 3 },
                  },
                  pull: frequencies.map((row) =>
                    population !== "all" && row.population === population
                      ? 0.08
                      : 0,
                  ),
                  textinfo: "label+percent",
                  textposition: "outside",
                  hovertemplate:
                    "%{label}<br>%{value:.2f}%<br>%{customdata:,} cells<extra></extra>",
                },
              ]}
              layout={{
                ...CHART_LAYOUT,
                autosize: true,
                height: 420,
                margin: { l: 35, r: 35, t: 20, b: 20 },
                showlegend: false,
                annotations: [
                  {
                    x: 0.5,
                    y: 0.57,
                    text: `<b>${formatInteger(totalCount)}</b><br><span style="font-size:0.6875rem;color:#676b76">Total Cell Count</span>`,
                    showarrow: false,
                    align: "center",
                    font: { color: "#12141d", size: 18 },
                  },
                ],
              }}
              config={CHART_CONFIG}
              useResizeHandler
              className="responsive-chart"
            />
          )}
        </div>

        <div className="panel table-panel">
          <div className="panel-heading-row">
            <div>
              <span className="eyebrow">Sample Details</span>
              <h2>Cell Counts</h2>
            </div>
            <strong className="total-count">
              {formatInteger(totalCount)} Total
            </strong>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Cell Population</th>
                  <th>Cell Count</th>
                  <th>Relative Frequency</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.population}>
                    <td>
                      <i
                        className="population-dot"
                        style={{
                          backgroundColor: POPULATION_COLORS[row.population],
                        }}
                      />
                      {populationLabel(row.population)}
                    </td>
                    <td>{formatInteger(row.count)}</td>
                    <td>{row.percentage.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
