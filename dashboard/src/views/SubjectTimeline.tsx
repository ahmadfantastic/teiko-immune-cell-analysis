import { useEffect, useMemo, useState } from "react";

import { getErrorMessage, getSampleFrequencies } from "../api";
import {
  CHART_CONFIG,
  CHART_GRID_COLOR,
  CHART_LAYOUT,
  EmptyPanel,
  ErrorPanel,
  LoadingPanel,
  MetricCard,
  POPULATION_COLORS,
  Plot,
  formatInteger,
} from "../components";
import type { AnalysisOptions, FrequencyRow, SampleMetadata } from "../types";

type TimelineRow = FrequencyRow & {
  project: string;
  subject: string;
  sample_type: string;
  time_from_treatment_start: number;
};

function FrequencyChange({
  current,
  previous,
  isFirst,
}: {
  current: number;
  previous?: number;
  isFirst: boolean;
}) {
  if (isFirst) {
    return <span className="frequency-change baseline">Starting Value</span>;
  }
  if (previous === undefined || previous === 0) {
    return <span className="frequency-change neutral">Change Unavailable</span>;
  }

  const change = ((current - previous) / previous) * 100;
  if (Math.abs(change) < 0.005) {
    return <span className="frequency-change neutral">No Change</span>;
  }

  const direction = change > 0 ? "increase" : "decrease";
  return (
    <span className={`frequency-change ${direction}`}>
      {change > 0 ? "↑" : "↓"} {Math.abs(change).toFixed(2)}% {direction}
    </span>
  );
}

export default function SubjectTimeline({
  options,
  samples,
}: {
  options: AnalysisOptions;
  samples: SampleMetadata[];
}) {
  const subjectOptions = useMemo(() => {
    const subjects = new Set<string>();
    samples.forEach((sample) => {
      subjects.add(sample.subject);
    });
    return [...subjects].sort((left, right) => left.localeCompare(right));
  }, [samples]);

  const [selectedSubject, setSelectedSubject] = useState("");
  const [subjectQuery, setSubjectQuery] = useState("");
  const [rows, setRows] = useState<TimelineRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const nextSubject = subjectOptions.includes(selectedSubject)
      ? selectedSubject
      : (subjectOptions[0] ?? "");
    setSelectedSubject(nextSubject);
    setSubjectQuery(nextSubject);
  }, [subjectOptions]);

  const selectedSamples = useMemo(
    () => samples.filter((sample) => sample.subject === selectedSubject),
    [samples, selectedSubject],
  );
  const currentSubjectIndex = subjectOptions.indexOf(selectedSubject);

  function chooseSubject(subject: string) {
    setSelectedSubject(subject);
    setSubjectQuery(subject);
  }

  function submitSubject() {
    const normalized = subjectQuery.trim().toLowerCase();
    const match =
      subjectOptions.find((subject) => subject.toLowerCase() === normalized) ??
      subjectOptions.find((subject) =>
        subject.toLowerCase().includes(normalized),
      );
    if (match) chooseSubject(match);
  }

  function moveSubject(offset: number) {
    const nextSubject = subjectOptions[currentSubjectIndex + offset];
    if (nextSubject) chooseSubject(nextSubject);
  }

  useEffect(() => {
    if (selectedSamples.length === 0) {
      setRows([]);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);
    Promise.all(
      selectedSamples.map(async (sample) => {
        const result = await getSampleFrequencies(sample.sample);
        return result.frequencies.map((row) => ({
          ...row,
          project: sample.project,
          subject: sample.subject,
          sample_type: sample.sample_type,
          time_from_treatment_start: sample.time_from_treatment_start,
        }));
      }),
    )
      .then((result) => {
        if (active) setRows(result.flat());
      })
      .catch((reason: unknown) => {
        if (active)
          setError(getErrorMessage(reason, "Could not load subject timeline"));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedSamples]);

  if (subjectOptions.length === 0) {
    return <EmptyPanel message="No subjects match the selected filters." />;
  }

  const days = [
    ...new Set(rows.map((row) => row.time_from_treatment_start)),
  ].sort((left, right) => left - right);
  const sampleTypes = [...new Set(rows.map((row) => row.sample_type))].sort();
  const traces = options.populations.flatMap((population) =>
    sampleTypes.flatMap((sampleType, sampleTypeIndex) => {
      const populationRows = rows
        .filter(
          (row) =>
            row.population === population.value &&
            row.sample_type === sampleType,
        )
        .sort(
          (left, right) =>
            left.time_from_treatment_start - right.time_from_treatment_start,
        );
      if (populationRows.length === 0) return [];

      return [
        {
          type: "scatter" as const,
          mode: "lines+markers" as const,
          name:
            sampleTypes.length > 1
              ? `${population.label} · ${sampleType}`
              : population.label,
          x: populationRows.map((row) => row.time_from_treatment_start),
          y: populationRows.map((row) => row.percentage),
          customdata: populationRows.map((row) => [
            row.count,
            row.sample,
            row.sample_type,
          ]),
          line: {
            color: POPULATION_COLORS[population.value],
            width: 2.5,
            dash: sampleTypeIndex === 0 ? "solid" : "dot",
          },
          marker: {
            color: POPULATION_COLORS[population.value],
            size: 8,
          },
          hovertemplate:
            "%{fullData.name}<br>Day %{x}<br>%{y:.2f}%<br>%{customdata[0]:,} cells<br>%{customdata[1]} (%{customdata[2]})<extra></extra>",
        },
      ];
    }),
  );

  return (
    <section className="timeline-results">
      <div className="analysis-metrics timeline-metrics">
        <MetricCard
          label="Subjects"
          value={formatInteger(subjectOptions.length)}
          detail="Matching Current Filters"
        />
        <MetricCard
          label="Samples"
          value={formatInteger(selectedSamples.length)}
          detail="For the Selected Subject"
        />
        <MetricCard
          label="Collection Days"
          value={formatInteger(days.length)}
          detail={days.map((day) => `Day ${day}`).join(", ") || "No Data"}
        />
      </div>

      <div className="panel chart-panel timeline-chart">
        <div className="panel-heading-row">
          <div>
            <span className="eyebrow">Frequency Changes</span>
            <h2>Relative Frequency Over Time</h2>
          </div>
          <div className="subject-selector">
            <label
              className="search-field subject-search"
              htmlFor="timeline-subject"
            >
              <span>Subject</span>
              <div>
                <input
                  id="timeline-subject"
                  value={subjectQuery}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSubjectQuery(value);
                    const exactMatch = subjectOptions.find(
                      (subject) =>
                        subject.toLowerCase() === value.trim().toLowerCase(),
                    );
                    if (exactMatch) setSelectedSubject(exactMatch);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      submitSubject();
                    }
                  }}
                />
                <button type="button" onClick={submitSubject}>
                  View
                </button>
              </div>
            </label>
            <div className="subject-navigation">
              <button
                type="button"
                disabled={currentSubjectIndex <= 0}
                onClick={() => moveSubject(-1)}
              >
                Previous
              </button>
              <span>
                {formatInteger(currentSubjectIndex + 1)} of{" "}
                {formatInteger(subjectOptions.length)}
              </span>
              <button
                type="button"
                disabled={currentSubjectIndex >= subjectOptions.length - 1}
                onClick={() => moveSubject(1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <LoadingPanel message="Loading subject timeline" />
        ) : error ? (
          <ErrorPanel message={error} />
        ) : (
          <Plot
            data={traces}
            layout={{
              ...CHART_LAYOUT,
              autosize: true,
              height: 470,
              margin: { l: 65, r: 25, t: 25, b: 60 },
              legend: {
                orientation: "h",
                x: 0,
                y: 1.14,
              },
              xaxis: {
                title: { text: "Collection Day" },
                tickmode: "array",
                tickvals: days,
                ticktext: days.map((day) => `Day ${day}`),
                gridcolor: CHART_GRID_COLOR,
              },
              yaxis: {
                title: { text: "Relative Frequency (%)" },
                rangemode: "tozero",
                gridcolor: CHART_GRID_COLOR,
              },
              hovermode: "closest",
            }}
            config={CHART_CONFIG}
            useResizeHandler
            className="responsive-chart"
          />
        )}
      </div>

      {!isLoading && !error && (
        <div className="panel table-panel">
          <div className="panel-heading-row">
            <div>
              <span className="eyebrow">{selectedSubject}</span>
              <h2>Relative Frequency by Collection Day</h2>
            </div>
            {days.length > 1 && (
              <strong className="result-pill">
                Compared With Previous Day
              </strong>
            )}
          </div>
          <div className="table-scroll">
            <table className="timeline-table">
              <thead>
                <tr>
                  <th>Cell Population</th>
                  {days.map((day) => (
                    <th key={day}>Day {day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {options.populations.map((population) => (
                  <tr key={population.value}>
                    <td>
                      <i
                        className="population-dot"
                        style={{
                          backgroundColor: POPULATION_COLORS[population.value],
                        }}
                      />
                      {population.label}
                    </td>
                    {days.map((day, dayIndex) => {
                      const previousDay = days[dayIndex - 1];
                      const dayRows = rows.filter(
                        (row) =>
                          row.population === population.value &&
                          row.time_from_treatment_start === day,
                      );
                      return (
                        <td key={day}>
                          {dayRows.length === 0
                            ? "—"
                            : dayRows.map((row) => (
                                <span
                                  className="timeline-value"
                                  key={`${row.sample}-${row.sample_type}`}
                                  title={row.sample}
                                >
                                  <strong>{row.percentage.toFixed(2)}%</strong>
                                  <small>
                                    {formatInteger(row.count)} cells ·{" "}
                                    {row.sample_type}
                                  </small>
                                  <FrequencyChange
                                    current={row.percentage}
                                    previous={
                                      rows.find(
                                        (candidate) =>
                                          candidate.population ===
                                            population.value &&
                                          candidate.sample_type ===
                                            row.sample_type &&
                                          candidate.time_from_treatment_start ===
                                            previousDay,
                                      )?.percentage
                                    }
                                    isFirst={dayIndex === 0}
                                  />
                                </span>
                              ))}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
