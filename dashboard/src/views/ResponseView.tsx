import { useEffect, useState } from "react";

import { getErrorMessage, getResponseAnalysis } from "../api";
import {
  buildDataFilterQuery,
  CHART_CONFIG,
  CHART_GRID_COLOR,
  CHART_LAYOUT,
  CHART_SERIES_COLORS,
  DataFilters,
  ErrorPanel,
  FilterPanel,
  FilterSelect,
  LoadingPanel,
  MetricCard,
  PageHeader,
  Plot,
  formatInteger,
  formatPValue,
  isSignificant,
  populationLabel,
  type DataFilterValues,
} from "../components";
import type {
  AnalysisOptions,
  QueryParameters,
  ResponseAnalysis,
} from "../types";

type ResponseFilters = DataFilterValues & {
  timeMode: string;
  statisticalTest: string;
  effectSize: string;
};

const DEFAULT_FILTERS: ResponseFilters = {
  project: "all",
  condition: "melanoma",
  treatment: "miraclib",
  sampleType: "PBMC",
  timeMode: "average",
  response: "all",
  sex: "all",
  statisticalTest: "welch_t_test",
  effectSize: "hedges_g",
};

const STATISTICAL_TEST_OPTIONS = [
  { value: "welch_t_test", label: "Welch's t-test" },
];

const EFFECT_SIZE_OPTIONS = [{ value: "hedges_g", label: "Hedges' g" }];

function buildResponseQuery(filters: ResponseFilters): QueryParameters {
  return {
    ...buildDataFilterQuery(filters),
    response: undefined,
    time_mode: filters.timeMode,
  };
}

export default function ResponseView({
  options,
}: {
  options: AnalysisOptions;
}) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [analysis, setAnalysis] = useState<ResponseAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    getResponseAnalysis(buildResponseQuery(filters))
      .then((result) => {
        if (active) setAnalysis(result);
      })
      .catch((reason: unknown) => {
        if (active) {
          setAnalysis(null);
          setError(getErrorMessage(reason, "Could not run analysis"));
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filters]);

  function updateFilter(key: keyof ResponseFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  const significant = analysis?.statistics.filter(isSignificant) ?? [];
  const responders =
    analysis?.distribution.filter((row) => row.response === "yes") ?? [];
  const nonresponders =
    analysis?.distribution.filter((row) => row.response === "no") ?? [];
  const statisticalTestLabel =
    STATISTICAL_TEST_OPTIONS.find(
      (option) => option.value === filters.statisticalTest,
    )?.label ?? filters.statisticalTest;
  const effectSizeLabel =
    EFFECT_SIZE_OPTIONS.find((option) => option.value === filters.effectSize)
      ?.label ?? filters.effectSize;

  return (
    <div className="page">
      <PageHeader
        title="Response Analysis"
        description="Compare relative cell frequencies between responders and non-responders. Average across collection days or select one collection day."
      />

      <FilterPanel>
        <DataFilters
          idPrefix="response"
          options={options}
          filters={filters}
          showResponse={false}
          onChange={(key, value) => updateFilter(key, value)}
        >
          <FilterSelect
            id="response-time"
            label="Collection Day"
            value={filters.timeMode}
            includeAll={false}
            options={[
              { value: "average", label: "Average Across Days" },
              ...options.time_points.map((value) => ({
                value: String(value),
                label: `Day ${value}`,
              })),
            ]}
            onChange={(value) => updateFilter("timeMode", value)}
          />
        </DataFilters>
        <FilterSelect
          id="response-statistical-test"
          label="Statistical Test"
          value={filters.statisticalTest}
          includeAll={false}
          options={STATISTICAL_TEST_OPTIONS}
          onChange={(value) => updateFilter("statisticalTest", value)}
        />
        <FilterSelect
          id="response-effect-size"
          label="Effect Size"
          value={filters.effectSize}
          includeAll={false}
          options={EFFECT_SIZE_OPTIONS}
          onChange={(value) => updateFilter("effectSize", value)}
        />
      </FilterPanel>

      {isLoading && <LoadingPanel message="Running response analysis" />}
      {error && <ErrorPanel message={error} />}

      {!isLoading && analysis && (
        <>
          <section className="analysis-metrics">
            <MetricCard
              label="Samples"
              value={formatInteger(analysis.sample_count)}
              detail={
                filters.timeMode === "average"
                  ? "Averaged Across Days"
                  : `Collected at Day ${filters.timeMode}`
              }
            />
            <MetricCard
              label="Subjects"
              value={formatInteger(analysis.subject_count)}
              detail="One Value per Cell Population"
            />
            <MetricCard
              label="Responders"
              value={formatInteger(analysis.responders)}
              detail="Response Recorded as Yes"
            />
            <MetricCard
              label="Non-Responders"
              value={formatInteger(analysis.nonresponders)}
              detail="Response Recorded as No"
            />
          </section>

          <section className="response-grid">
            <div className="panel chart-panel response-boxplot">
              <div className="panel-heading-row">
                <div>
                  <span className="eyebrow">Relative Frequencies</span>
                  <h2>Responder and Non-Responder Boxplots</h2>
                </div>
              </div>
              <Plot
                data={[
                  {
                    type: "box",
                    name: "Non-Responder",
                    x: nonresponders.map((row) =>
                      populationLabel(row.population),
                    ),
                    y: nonresponders.map((row) => row.mean_percentage),
                    marker: { color: CHART_SERIES_COLORS[0] },
                    line: { color: CHART_SERIES_COLORS[0] },
                    fillcolor: "rgba(59, 130, 246, 0.24)",
                    boxpoints: "outliers",
                    hovertemplate:
                      "%{x}<br>%{y:.2f}%<extra>Non-Responder</extra>",
                  },
                  {
                    type: "box",
                    name: "Responder",
                    x: responders.map((row) => populationLabel(row.population)),
                    y: responders.map((row) => row.mean_percentage),
                    marker: { color: CHART_SERIES_COLORS[1] },
                    line: { color: CHART_SERIES_COLORS[1] },
                    fillcolor: "rgba(20, 184, 166, 0.24)",
                    boxpoints: "outliers",
                    hovertemplate: "%{x}<br>%{y:.2f}%<extra>Responder</extra>",
                  },
                ]}
                layout={{
                  ...CHART_LAYOUT,
                  boxmode: "group",
                  autosize: true,
                  height: 440,
                  margin: { l: 58, r: 20, t: 25, b: 80 },
                  legend: { orientation: "h", x: 0, y: 1.1 },
                  yaxis: {
                    title: { text: "Relative Frequency (%)" },
                    gridcolor: CHART_GRID_COLOR,
                  },
                  xaxis: { tickangle: -18 },
                }}
                config={CHART_CONFIG}
                useResizeHandler
                className="responsive-chart"
              />
            </div>

            <aside className="finding-card">
              <span className="eyebrow">Significance Summary</span>
              {significant.length > 0 ? (
                <>
                  <div className="significant-populations">
                    {significant.map((row) => (
                      <strong key={row.population}>
                        {populationLabel(row.population)}
                      </strong>
                    ))}
                  </div>
                  <p>
                    {significant.length === 1
                      ? "One cell population has"
                      : `${significant.length} cell populations have`}{" "}
                    an adjusted p-value below 0.05.
                  </p>
                </>
              ) : (
                <>
                  <strong>None</strong>
                  <p>
                    No cell population has an adjusted p-value below 0.05 with
                    the current filters.
                  </p>
                </>
              )}
            </aside>

            <div className="panel table-panel statistics-table">
              <div className="panel-heading-row">
                <div>
                  <span className="eyebrow">{statisticalTestLabel}</span>
                  <h2>Statistical Results</h2>
                </div>
                <span className="result-pill">Adjusted p-Values</span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Cell Population</th>
                      <th>Responder Average</th>
                      <th>Non-Responder Average</th>
                      <th>Difference</th>
                      <th>95% Confidence Interval</th>
                      <th>Raw p-Value</th>
                      <th>Adjusted p-Value</th>
                      <th>{effectSizeLabel}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.statistics.map((row) => (
                      <tr
                        key={row.population}
                        className={isSignificant(row) ? "significant-row" : ""}
                      >
                        <td>
                          {populationLabel(row.population)}
                          {isSignificant(row) && (
                            <span className="significant-mark">
                              Significant
                            </span>
                          )}
                        </td>
                        <td>{row.responder_mean_percentage.toFixed(2)}%</td>
                        <td>{row.nonresponder_mean_percentage.toFixed(2)}%</td>
                        <td>
                          {row.mean_difference_percentage_points > 0 ? "+" : ""}
                          {row.mean_difference_percentage_points.toFixed(2)}
                        </td>
                        <td>
                          {row.mean_difference_ci_lower.toFixed(2)} to{" "}
                          {row.mean_difference_ci_upper.toFixed(2)}
                        </td>
                        <td>{formatPValue(row.p_value)}</td>
                        <td>
                          <strong>{formatPValue(row.adjusted_p_value)}</strong>
                        </td>
                        <td>{row.hedges_g.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
