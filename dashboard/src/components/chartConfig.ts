export const CHART_CONFIG = {
  displaylogo: false,
  responsive: true,
  modeBarButtonsToRemove: ["lasso2d", "select2d"],
};

export const CHART_GRID_COLOR = "#e4e4e7";

export const CHART_LAYOUT = {
  paper_bgcolor: "rgba(0,0,0,0)",
  plot_bgcolor: "rgba(0,0,0,0)",
  font: {
    family: "Inter, system-ui, sans-serif",
    color: "#2f3138",
  },
};

export const POPULATION_LABELS: Record<string, string> = {
  b_cell: "B Cell",
  cd8_t_cell: "CD8 T Cell",
  cd4_t_cell: "CD4 T Cell",
  nk_cell: "NK Cell",
  monocyte: "Monocyte",
};

export const POPULATION_COLORS: Record<string, string> = {
  b_cell: "#14b8a6",
  cd8_t_cell: "#3b82f6",
  cd4_t_cell: "#f59e0b",
  nk_cell: "#a855f7",
  monocyte: "#eab308",
};

export const CHART_SERIES_COLORS = [
  "#3b82f6",
  "#14b8a6",
  "#f59e0b",
  "#a855f7",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
];
