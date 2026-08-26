import { useEffect, useState } from "react";

import { getErrorMessage, getSubsetAnalysis } from "../api";
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
  POPULATION_COLORS,
  PageHeader,
  Plot,
  RESPONSE_LABELS,
  SEX_LABELS,
  formatInteger,
  type DataFilterValues,
} from "../components";
import type {
  AnalysisOptions,
  QueryParameters,
  SubsetAnalysis,
  SubsetRow,
} from "../types";

type SubsetFilters = DataFilterValues & {
  timePoint: string;
};

const DEFAULT_FILTERS: SubsetFilters = {
  project: "all",
  condition: "melanoma",
  treatment: "miraclib",
  sampleType: "PBMC",
  timePoint: "0",
  response: "all",
  sex: "all",
};

function buildSubsetQuery(filters: SubsetFilters): QueryParameters {
  return {
    ...buildDataFilterQuery(filters),
    time_point: filters.timePoint,
  };
}

function selectSummaryRows(rows: SubsetRow[], summary: SubsetRow["summary"]) {
  return rows.filter((row) => row.summary === summary);
}

export default function SubsetView({ options }: { options: AnalysisOptions }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [analysis, setAnalysis] = useState<SubsetAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    getSubsetAnalysis(buildSubsetQuery(filters))
      .then((result) => {
        if (active) setAnalysis(result);
      })
      .catch((reason: unknown) => {
        if (active) {
          setAnalysis(null);
          setError(getErrorMessage(reason, "Could not build subset"));
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filters]);

  function updateFilter(key: keyof SubsetFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  const projects = analysis
    ? selectSummaryRows(analysis.summary, "samples_by_project")
    : [];
  const responses = analysis
    ? selectSummaryRows(analysis.summary, "subjects_by_response")
    : [];
  const sexes = analysis
    ? selectSummaryRows(analysis.summary, "subjects_by_sex")
    : [];
  return (
    <div className="page">
      <PageHeader
        title="Subset Analysis"
        description="Filter the data and summarize the matching samples and subjects. The default filters reproduce Part 4."
      />

      <FilterPanel>
        <DataFilters
          idPrefix="subset"
          options={options}
          filters={filters}
          onChange={(key, value) => updateFilter(key, value)}
        >
          <FilterSelect
            id="subset-time"
            label="Collection Day"
            value={filters.timePoint}
            options={options.time_points.map((value) => ({
              value,
              label: `Day ${value}`,
            }))}
            allLabel="All Days"
            onChange={(value) => updateFilter("timePoint", value)}
          />
        </DataFilters>
      </FilterPanel>

      {isLoading && <LoadingPanel message="Building data subset" />}
      {error && <ErrorPanel message={error} />}

      {!isLoading && analysis && (
        <>
          <section className="analysis-metrics two-metrics">
            <MetricCard
              label="Matching Samples"
              value={formatInteger(analysis.sample_count)}
              detail="Matching Current Filters"
            />
            <MetricCard
              label="Subjects"
              value={formatInteger(analysis.subject_count)}
              detail="Unique Within Each Project"
            />
          </section>

          <section className="subset-charts">
            <div className="panel chart-panel">
              <div className="panel-heading-row">
                <div>
                  <span className="eyebrow">Samples</span>
                  <h2>By Project</h2>
                </div>
              </div>
              <Plot
                data={[
                  {
                    type: "bar",
                    x: projects.map((row) => row.group),
                    y: projects.map((row) => row.count),
                    marker: {
                      color: projects.map(
                        (_, index) =>
                          CHART_SERIES_COLORS[
                            index % CHART_SERIES_COLORS.length
                          ],
                      ),
                    },
                    text: projects.map((row) => row.count),
                    textposition: "outside",
                    hovertemplate: "%{x}<br>%{y:,} samples<extra></extra>",
                  },
                ]}
                layout={{
                  ...CHART_LAYOUT,
                  autosize: true,
                  height: 300,
                  margin: { l: 50, r: 18, t: 20, b: 45 },
                  yaxis: {
                    rangemode: "tozero",
                    gridcolor: CHART_GRID_COLOR,
                  },
                }}
                config={CHART_CONFIG}
                useResizeHandler
                className="responsive-chart"
              />
            </div>
            <div className="panel chart-panel">
              <div className="panel-heading-row">
                <div>
                  <span className="eyebrow">Subjects</span>
                  <h2>By Response</h2>
                </div>
              </div>
              <Plot
                data={[
                  {
                    type: "pie",
                    labels: responses.map(
                      (row) => RESPONSE_LABELS[row.group] ?? row.group,
                    ),
                    values: responses.map((row) => row.count),
                    hole: 0.62,
                    marker: {
                      colors: [CHART_SERIES_COLORS[0], CHART_SERIES_COLORS[1]],
                    },
                    textinfo: "label+value",
                    hovertemplate:
                      "%{label}<br>%{value:,} subjects<extra></extra>",
                  },
                ]}
                layout={{
                  ...CHART_LAYOUT,
                  autosize: true,
                  height: 300,
                  margin: { l: 10, r: 10, t: 10, b: 10 },
                  showlegend: false,
                }}
                config={CHART_CONFIG}
                useResizeHandler
                className="responsive-chart"
              />
            </div>
            <div className="panel chart-panel">
              <div className="panel-heading-row">
                <div>
                  <span className="eyebrow">Subjects</span>
                  <h2>By Sex</h2>
                </div>
              </div>
              <Plot
                data={[
                  {
                    type: "pie",
                    labels: sexes.map(
                      (row) => SEX_LABELS[row.group] ?? row.group,
                    ),
                    values: sexes.map((row) => row.count),
                    hole: 0.62,
                    marker: {
                      colors: [CHART_SERIES_COLORS[3], CHART_SERIES_COLORS[2]],
                    },
                    textinfo: "label+value",
                    hovertemplate:
                      "%{label}<br>%{value:,} subjects<extra></extra>",
                  },
                ]}
                layout={{
                  ...CHART_LAYOUT,
                  autosize: true,
                  height: 300,
                  margin: { l: 10, r: 10, t: 10, b: 10 },
                  showlegend: false,
                }}
                config={CHART_CONFIG}
                useResizeHandler
                className="responsive-chart"
              />
            </div>
          </section>

          <section className="panel population-average-summary">
            <div className="panel-heading-row">
              <div>
                <span className="eyebrow">Matching Samples</span>
                <h2>Average Cell Counts</h2>
              </div>
            </div>
            <div className="average-count-grid">
              {options.populations.map((population) => (
                <div className="average-count-item" key={population.value}>
                  <span>
                    <i
                      className="population-dot"
                      style={{
                        backgroundColor: POPULATION_COLORS[population.value],
                      }}
                    />
                    {population.label}
                  </span>
                  <strong>
                    {analysis.average_cell_counts[population.value]?.toFixed(
                      2,
                    ) ?? "—"}
                  </strong>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
