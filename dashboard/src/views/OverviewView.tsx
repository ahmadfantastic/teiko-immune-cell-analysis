import {
  MetricCard,
  POPULATION_COLORS,
  PageHeader,
  formatInteger,
} from "../components";
import type { AnalysisOptions } from "../types";

export default function OverviewView({
  options,
}: {
  options: AnalysisOptions;
}) {
  return (
    <div className="page">
      <PageHeader
        title="Data Overview"
        description="A summary of the projects, subjects, samples, collection days, sample types, and cell populations available for analysis."
      />

      <section className="metrics" aria-label="Data Overview">
        <MetricCard
          label="Projects"
          value={formatInteger(options.metrics.projects)}
          detail="Clinical Trial Projects"
        />
        <MetricCard
          label="Subjects"
          value={formatInteger(options.metrics.subjects)}
          detail="Across All Projects"
        />
        <MetricCard
          label="Samples"
          value={formatInteger(options.metrics.samples)}
          detail="Collected at Days 0, 7, and 14"
        />
        <MetricCard
          label="Cell Count Records"
          value={formatInteger(options.metrics.measurements)}
          detail="Five Cell Populations per Sample"
        />
      </section>

      <section className="dataset-contents" aria-label="Data Contents">
        <article className="panel coverage-card">
          <span className="eyebrow">Projects</span>
          <h2>{formatInteger(options.projects.length)} Available Projects</h2>
          <ul className="coverage-list">
            {options.projects.map((project) => (
              <li key={project}>{project}</li>
            ))}
          </ul>
        </article>

        <article className="panel coverage-card">
          <span className="eyebrow">Collection Days</span>
          <h2>{formatInteger(options.time_points.length)} Collection Days</h2>
          <ul className="coverage-list">
            {options.time_points.map((day) => (
              <li key={day}>Day {day}</li>
            ))}
          </ul>
        </article>

        <article className="panel coverage-card">
          <span className="eyebrow">Sample Types</span>
          <h2>{formatInteger(options.sample_types.length)} Sample Types</h2>
          <ul className="coverage-list">
            {options.sample_types.map((sampleType) => (
              <li key={sampleType}>{sampleType}</li>
            ))}
          </ul>
        </article>

        <article className="panel coverage-card">
          <span className="eyebrow">Cell Populations</span>
          <h2>{formatInteger(options.populations.length)} Cell Populations</h2>
          <ul className="coverage-list population-coverage-list">
            {options.populations.map((population) => (
              <li key={population.value}>
                <i
                  className="population-dot"
                  style={{
                    backgroundColor: POPULATION_COLORS[population.value],
                  }}
                />
                {population.label}
              </li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  );
}
