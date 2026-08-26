import type {
  AnalysisOptions,
  FrequencyPage,
  FrequencyRow,
  LoadDataResult,
  QueryParameters,
  ResponseAnalysis,
  SampleMetadata,
  SubsetAnalysis,
} from "./types";

function buildQueryString(parameters: QueryParameters = {}) {
  const query = new URLSearchParams();
  Object.entries(parameters).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== null &&
      value !== "all" &&
      value !== ""
    ) {
      query.set(key, String(value));
    }
  });
  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
}

export function getErrorMessage(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}

async function get<T>(path: string, parameters?: QueryParameters): Promise<T> {
  const response = await fetch(`${path}${buildQueryString(parameters)}`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      body.detail ?? `Request failed with status ${response.status}`,
    );
  }
  return response.json();
}

export function getAnalysisOptions() {
  return get<AnalysisOptions>("/api/options");
}

export async function loadData(file: File): Promise<LoadDataResult> {
  const response = await fetch("/api/load-data", {
    method: "POST",
    headers: {
      "Content-Type": file.type || "text/csv",
      "X-File-Name": file.name,
    },
    body: file,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      body.detail ?? `Request failed with status ${response.status}`,
    );
  }
  return response.json();
}

export function getSamples(parameters: QueryParameters) {
  return get<{ samples: SampleMetadata[]; count: number }>(
    "/api/samples",
    parameters,
  );
}

export function getSampleFrequencies(sample: string) {
  return get<{ frequencies: FrequencyRow[] }>(
    `/api/samples/${encodeURIComponent(sample)}/frequencies`,
  );
}

export function getFrequencySummary(parameters: QueryParameters) {
  return get<FrequencyPage>("/api/frequencies", parameters);
}

export function getResponseAnalysis(parameters: QueryParameters) {
  return get<ResponseAnalysis>("/api/response-analysis", parameters);
}

export function getSubsetAnalysis(parameters: QueryParameters) {
  return get<SubsetAnalysis>("/api/subset-analysis", parameters);
}
