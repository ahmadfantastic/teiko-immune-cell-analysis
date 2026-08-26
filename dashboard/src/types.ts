export type ViewName = "overview" | "frequencies" | "response" | "subset";

export type PopulationOption = {
  value: string;
  label: string;
};

export type AnalysisOptions = {
  projects: string[];
  conditions: string[];
  treatments: string[];
  sample_types: string[];
  time_points: number[];
  responses: string[];
  sexes: string[];
  populations: PopulationOption[];
  metrics: {
    projects: number;
    subjects: number;
    samples: number;
    measurements: number;
  };
};

export type LoadDataResult = {
  message: string;
  counts: Record<string, number>;
  options: AnalysisOptions;
};

export type SampleMetadata = {
  project: string;
  subject: string;
  condition: string;
  treatment: string;
  response: string | null;
  sex: string;
  sample: string;
  sample_type: string;
  time_from_treatment_start: number;
};

export type FrequencyRow = {
  sample: string;
  total_count: number;
  population: string;
  count: number;
  percentage: number;
};

export type FrequencyPage = {
  rows: FrequencyRow[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};

export type StatisticalRow = {
  population: string;
  responder_subjects: number;
  nonresponder_subjects: number;
  responder_mean_percentage: number;
  nonresponder_mean_percentage: number;
  mean_difference_percentage_points: number;
  mean_difference_ci_lower: number;
  mean_difference_ci_upper: number;
  welch_t_statistic: number;
  welch_degrees_of_freedom: number;
  p_value: number;
  adjusted_p_value: number;
  hedges_g: number;
  significant: boolean;
};

export type DistributionRow = {
  project: string;
  subject: string;
  response: "yes" | "no";
  population: string;
  mean_percentage: number;
};

export type ResponseAnalysis = {
  sample_count: number;
  subject_count: number;
  responders: number;
  nonresponders: number;
  statistics: StatisticalRow[];
  distribution: DistributionRow[];
};

export type SubsetRow = {
  summary:
    | "samples_by_project"
    | "subjects_by_response"
    | "subjects_by_sex"
    | "total_samples";
  group: string;
  count: number;
};

export type SubsetAnalysis = {
  sample_count: number;
  subject_count: number;
  summary: SubsetRow[];
  average_cell_counts: Record<string, number>;
};

export type QueryValue = string | number | null | undefined;
export type QueryParameters = Record<string, QueryValue>;
