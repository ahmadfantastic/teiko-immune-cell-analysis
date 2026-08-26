import { useEffect, useState } from "react";

import { getErrorMessage, getSamples } from "../api";
import {
  buildDataFilterQuery,
  DataFilters,
  EmptyPanel,
  ErrorPanel,
  FilterPanel,
  FilterSelect,
  LoadingPanel,
  PageHeader,
  type DataFilterValues,
} from "../components";
import type {
  AnalysisOptions,
  QueryParameters,
  SampleMetadata,
} from "../types";
import FrequencySummaryTable from "./FrequencySummaryTable";
import SampleFrequencyView from "./SampleFrequencyView";
import SubjectTimeline from "./SubjectTimeline";

type FrequencyMode = "sample" | "subject" | "table";

type FrequencyFilters = DataFilterValues & {
  timePoint: string;
};

const DEFAULT_FILTERS: FrequencyFilters = {
  project: "all",
  condition: "all",
  treatment: "all",
  sampleType: "all",
  timePoint: "all",
  response: "all",
  sex: "all",
};

function buildFrequencyQuery(filters: FrequencyFilters): QueryParameters {
  return {
    ...buildDataFilterQuery(filters),
    time_point: filters.timePoint,
  };
}

export default function FrequencyView({
  options,
}: {
  options: AnalysisOptions;
}) {
  const [mode, setMode] = useState<FrequencyMode>("table");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [subjectSamples, setSubjectSamples] = useState<SampleMetadata[]>([]);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);
  const [subjectError, setSubjectError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "subject") {
      setSubjectSamples([]);
      setIsLoadingSubjects(false);
      setSubjectError(null);
      return;
    }

    let active = true;
    setIsLoadingSubjects(true);
    setSubjectError(null);
    getSamples({ ...buildFrequencyQuery(filters), time_point: undefined })
      .then((result) => {
        if (active) setSubjectSamples(result.samples);
      })
      .catch((reason: unknown) => {
        if (active)
          setSubjectError(getErrorMessage(reason, "Could not load samples"));
      })
      .finally(() => {
        if (active) setIsLoadingSubjects(false);
      });
    return () => {
      active = false;
    };
  }, [filters, mode]);

  function updateFilter(key: keyof FrequencyFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function changeMode(nextMode: FrequencyMode) {
    setMode(nextMode);
    if (nextMode === "subject" && filters.project === "all") {
      setFilters((current) => ({
        ...current,
        project: options.projects[0] ?? "all",
      }));
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Cell Frequencies"
        description="View the complete summary table, inspect one sample, or follow one subject across collection days."
      />

      <div className="view-tabs" role="tablist" aria-label="Frequency View">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "table"}
          className={mode === "table" ? "active" : ""}
          onClick={() => changeMode("table")}
        >
          Summary Table
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "sample"}
          className={mode === "sample" ? "active" : ""}
          onClick={() => changeMode("sample")}
        >
          Sample View
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "subject"}
          className={mode === "subject" ? "active" : ""}
          onClick={() => changeMode("subject")}
        >
          Subject Timeline
        </button>
      </div>

      <FilterPanel>
        <DataFilters
          idPrefix="frequency"
          options={options}
          filters={filters}
          includeProjectAll={mode !== "subject"}
          onChange={(key, value) => updateFilter(key, value)}
        >
          {mode !== "subject" && (
            <FilterSelect
              id="frequency-time"
              label="Collection Day"
              value={filters.timePoint}
              options={options.time_points.map((value) => ({
                value,
                label: `Day ${value}`,
              }))}
              allLabel="All Days"
              onChange={(value) => updateFilter("timePoint", value)}
            />
          )}
        </DataFilters>
      </FilterPanel>

      {mode === "table" && (
        <FrequencySummaryTable queryParameters={buildFrequencyQuery(filters)} />
      )}

      {mode === "sample" && (
        <SampleFrequencyView
          options={options}
          queryParameters={buildFrequencyQuery(filters)}
        />
      )}

      {mode === "subject" && subjectError && (
        <ErrorPanel message={subjectError} />
      )}
      {mode === "subject" && isLoadingSubjects && (
        <LoadingPanel message="Finding matching samples" />
      )}
      {mode === "subject" &&
        !isLoadingSubjects &&
        !subjectError &&
        subjectSamples.length === 0 && (
          <EmptyPanel message="No samples match the selected filters." />
        )}
      {mode === "subject" &&
        !isLoadingSubjects &&
        subjectSamples.length > 0 && (
          <SubjectTimeline options={options} samples={subjectSamples} />
        )}
    </div>
  );
}
