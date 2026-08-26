import { useEffect, useState } from "react";

import { getAnalysisOptions, getErrorMessage } from "./api";
import {
  DataLoader,
  ErrorPanel,
  LoadingPanel,
  populationLabel,
} from "./components";
import type { AnalysisOptions, ViewName } from "./types";
import FrequencyView from "./views/FrequencyView";
import OverviewView from "./views/OverviewView";
import ResponseView from "./views/ResponseView";
import SubsetView from "./views/SubsetView";
import "./App.css";
import "./views/shared.css";

type NavigationItem = {
  view: ViewName;
  label: string;
  description: string;
};

type DashboardShellProps = {
  options: AnalysisOptions;
  onDataLoaded: (options: AnalysisOptions) => void;
};

const NAVIGATION: NavigationItem[] = [
  {
    view: "overview",
    label: "Data Overview",
    description: "Projects, Subjects, and Samples",
  },
  {
    view: "frequencies",
    label: "Cell Frequencies",
    description: "Sample and Subject Views",
  },
  {
    view: "response",
    label: "Response Analysis",
    description: "Responder Comparison",
  },
  {
    view: "subset",
    label: "Subset Analysis",
    description: "Filtered Data Summary",
  },
];

function getViewFromHash(): ViewName {
  const value = window.location.hash.replace("#", "") as ViewName;
  return NAVIGATION.some((item) => item.view === value) ? value : "overview";
}

function normalizeAnalysisOptions(data: AnalysisOptions) {
  return {
    ...data,
    populations: data.populations.map((population) => ({
      ...population,
      label: populationLabel(population.value),
    })),
  };
}

function DashboardShell({ options, onDataLoaded }: DashboardShellProps) {
  const [view, setView] = useState<ViewName>(getViewFromHash());
  const [isDataLoaderOpen, setIsDataLoaderOpen] = useState(false);

  useEffect(() => {
    function updateView() {
      setView(getViewFromHash());
    }
    window.addEventListener("hashchange", updateView);
    return () => window.removeEventListener("hashchange", updateView);
  }, []);

  function navigate(nextView: ViewName) {
    window.location.hash = nextView;
    setView(nextView);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#overview"
          onClick={() => navigate("overview")}
        >
          <span>
            <strong>Teiko</strong>
            <small>Immune Cell Analysis</small>
          </span>
        </a>

        <nav aria-label="Dashboard Views">
          {NAVIGATION.map((item) => (
            <a
              key={item.view}
              href={`#${item.view}`}
              className={view === item.view ? "active" : ""}
              onClick={() => navigate(item.view)}
            >
              <div>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </div>
            </a>
          ))}
        </nav>

        <div className="sidebar-status">
          <div className="sidebar-connection">
            <i />
            <span>
              <strong>Database Connected</strong>
              <small>{options.metrics.samples.toLocaleString()} Samples</small>
            </span>
          </div>
          <button type="button" onClick={() => setIsDataLoaderOpen(true)}>
            Load Data
          </button>
        </div>
      </aside>

      <header className="mobile-header">
        <a
          className="brand"
          href="#overview"
          onClick={() => navigate("overview")}
        >
          <strong>Teiko Analysis</strong>
        </a>
        <div className="mobile-header-actions">
          <button type="button" onClick={() => setIsDataLoaderOpen(true)}>
            Load Data
          </button>
          <select
            aria-label="Dashboard View"
            value={view}
            onChange={(event) => navigate(event.target.value as ViewName)}
          >
            {NAVIGATION.map((item) => (
              <option key={item.view} value={item.view}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <main className="content">
        {view === "overview" && <OverviewView options={options} />}
        {view === "frequencies" && <FrequencyView options={options} />}
        {view === "response" && <ResponseView options={options} />}
        {view === "subset" && <SubsetView options={options} />}
      </main>

      {isDataLoaderOpen && (
        <DataLoader
          onClose={() => setIsDataLoaderOpen(false)}
          onLoaded={(data) => {
            onDataLoaded(normalizeAnalysisOptions(data));
            navigate("overview");
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  const [options, setOptions] = useState<AnalysisOptions | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAnalysisOptions()
      .then((data) => setOptions(normalizeAnalysisOptions(data)))
      .catch((reason: unknown) => {
        setError(
          getErrorMessage(reason, "Could not connect to the dashboard API"),
        );
      });
  }, []);

  if (error) {
    return (
      <main className="startup-screen">
        <strong className="startup-brand">Teiko</strong>
        <ErrorPanel message={error} />
      </main>
    );
  }

  if (!options) {
    return (
      <main className="startup-screen">
        <strong className="startup-brand">Teiko</strong>
        <LoadingPanel message="Connecting to the analysis database" />
      </main>
    );
  }

  return <DashboardShell options={options} onDataLoaded={setOptions} />;
}
