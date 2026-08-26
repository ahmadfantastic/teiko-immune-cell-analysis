import type { ReactNode } from "react";

type FilterPanelProps = {
  children: ReactNode;
};

export function FilterPanel({ children }: FilterPanelProps) {
  return (
    <section className="filter-panel">
      <div className="filter-panel-title">
        <span className="eyebrow">Data Filters</span>
        <p>Change any field to update the results.</p>
      </div>
      <div className="filter-grid">{children}</div>
    </section>
  );
}
