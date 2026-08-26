import type { ReactNode } from "react";

import type { AnalysisOptions, QueryParameters } from "../types";
import { FilterSelect } from "./FilterSelect";

export type DataFilterValues = {
  project: string;
  condition: string;
  treatment: string;
  sampleType: string;
  response: string;
  sex: string;
};

type DataFiltersProps = {
  idPrefix: string;
  options: AnalysisOptions;
  filters: DataFilterValues;
  onChange: (key: keyof DataFilterValues, value: string) => void;
  includeProjectAll?: boolean;
  showResponse?: boolean;
  children?: ReactNode;
};

export const RESPONSE_LABELS: Record<string, string> = {
  yes: "Responder",
  no: "Non-Responder",
};

export const SEX_LABELS: Record<string, string> = {
  F: "Female",
  M: "Male",
};

export function buildDataFilterQuery(
  filters: DataFilterValues,
): QueryParameters {
  return {
    project: filters.project,
    condition: filters.condition,
    treatment: filters.treatment,
    sample_type: filters.sampleType,
    response: filters.response,
    sex: filters.sex,
  };
}

export function DataFilters({
  idPrefix,
  options,
  filters,
  onChange,
  includeProjectAll = true,
  showResponse = true,
  children,
}: DataFiltersProps) {
  return (
    <>
      <FilterSelect
        id={`${idPrefix}-project`}
        label="Project"
        value={filters.project}
        options={options.projects.map((value) => ({ value }))}
        includeAll={includeProjectAll}
        onChange={(value) => onChange("project", value)}
      />
      <FilterSelect
        id={`${idPrefix}-condition`}
        label="Condition"
        value={filters.condition}
        options={options.conditions.map((value) => ({ value }))}
        onChange={(value) => onChange("condition", value)}
      />
      <FilterSelect
        id={`${idPrefix}-treatment`}
        label="Treatment"
        value={filters.treatment}
        options={options.treatments.map((value) => ({ value }))}
        onChange={(value) => onChange("treatment", value)}
      />
      <FilterSelect
        id={`${idPrefix}-sample-type`}
        label="Sample Type"
        value={filters.sampleType}
        options={options.sample_types.map((value) => ({ value }))}
        onChange={(value) => onChange("sampleType", value)}
      />
      {children}
      {showResponse && (
        <FilterSelect
          id={`${idPrefix}-response`}
          label="Response"
          value={filters.response}
          options={options.responses.map((value) => ({
            value,
            label: RESPONSE_LABELS[value],
          }))}
          onChange={(value) => onChange("response", value)}
        />
      )}
      <FilterSelect
        id={`${idPrefix}-sex`}
        label="Sex"
        value={filters.sex}
        options={options.sexes.map((value) => ({
          value,
          label: SEX_LABELS[value],
        }))}
        onChange={(value) => onChange("sex", value)}
      />
    </>
  );
}
