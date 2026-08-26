import sqlite3
from pathlib import Path

import matplotlib

# Generate plots without requiring a desktop display.
matplotlib.use("Agg")

import matplotlib.pyplot as plt
import pandas as pd
from scipy.stats import t, ttest_ind
from statsmodels.stats.multitest import multipletests


PROJECT_ROOT = Path(__file__).resolve().parent
DATABASE_PATH = PROJECT_ROOT / "teiko.db"
OUTPUT_DIR = PROJECT_ROOT / "outputs"
FREQUENCY_OUTPUT_PATH = OUTPUT_DIR / "cell_frequencies.csv"
STATISTICS_OUTPUT_PATH = OUTPUT_DIR / "statistical_results.csv"
BOXPLOT_OUTPUT_PATH = OUTPUT_DIR / "responder_vs_nonresponder_boxplots.png"
SUBSET_OUTPUT_PATH = OUTPUT_DIR / "baseline_subset_summary.csv"

CELL_POPULATIONS = (
    "b_cell",
    "cd8_t_cell",
    "cd4_t_cell",
    "nk_cell",
    "monocyte",
)

POPULATION_LABELS = {
    "b_cell": "B cell",
    "cd8_t_cell": "CD8 T cell",
    "cd4_t_cell": "CD4 T cell",
    "nk_cell": "NK cell",
    "monocyte": "Monocyte",
}


def read_cell_counts(database_path):
    if not database_path.exists():
        raise FileNotFoundError(
            f"Database not found: {database_path}. Run 'python load_data.py' first."
        )

    query = """
        SELECT
            projects.project_name AS project,
            subjects.source_subject_id AS subject,
            subjects.condition,
            subjects.treatment,
            subjects.response,
            subjects.sex,
            samples.source_sample_id AS sample,
            samples.sample_type,
            samples.time_from_treatment_start,
            cell_populations.population_name AS population,
            cell_counts.cell_count AS count
        FROM cell_counts
        JOIN samples
            ON samples.sample_id = cell_counts.sample_id
        JOIN cell_populations
            ON cell_populations.population_id = cell_counts.population_id
        JOIN subjects
            ON subjects.subject_id = samples.subject_id
        JOIN projects
            ON projects.project_id = subjects.project_id
        ORDER BY samples.sample_id, cell_populations.population_id
    """

    with sqlite3.connect(database_path) as connection:
        return pd.read_sql_query(query, connection)


def calculate_frequencies(cell_counts):
    if cell_counts.empty:
        raise ValueError("No cell counts were found in the database")

    if cell_counts.duplicated(["sample", "population"]).any():
        raise ValueError("A sample contains duplicate population measurements")

    populations_by_sample = cell_counts.groupby("sample")["population"].agg(set)
    expected_populations = set(CELL_POPULATIONS)
    if not populations_by_sample.map(
        lambda values: values == expected_populations
    ).all():
        raise ValueError("Each sample must contain all five cell populations")

    frequencies = cell_counts.copy()
    total_counts = frequencies.groupby("sample")["count"].transform("sum")
    if (total_counts <= 0).any():
        raise ValueError("Each sample must have a positive total cell count")

    frequencies["total_count"] = total_counts
    frequencies["percentage"] = (
        frequencies["count"] / frequencies["total_count"] * 100
    )

    return frequencies


def filter_frequencies(
    frequencies,
    *,
    project=None,
    condition=None,
    treatment=None,
    sample_type=None,
    time_point=None,
    response=None,
    sex=None,
):
    filtered = frequencies
    filters = {
        "project": project,
        "condition": condition,
        "treatment": treatment,
        "sample_type": sample_type,
        "time_from_treatment_start": time_point,
        "response": response,
        "sex": sex,
    }

    for column, value in filters.items():
        if value is not None:
            filtered = filtered[filtered[column].eq(value)]

    return filtered.copy()


def _build_sample_filters(
    *,
    project,
    condition,
    treatment,
    sample_type,
    time_point,
    response,
    sex,
):
    return {
        "projects.project_name": project,
        "subjects.condition": condition,
        "subjects.treatment": treatment,
        "samples.sample_type": sample_type,
        "samples.time_from_treatment_start": time_point,
        "subjects.response": response,
        "subjects.sex": sex,
    }


def _build_where_clause(filters):
    clauses = []
    parameters = []
    for column, value in filters.items():
        if value is not None:
            clauses.append(f"{column} = ?")
            parameters.append(value)

    return (" AND ".join(clauses) if clauses else "1 = 1"), parameters


def select_response_samples(
    frequencies,
    *,
    project=None,
    condition="melanoma",
    treatment="miraclib",
    sample_type="PBMC",
    time_point=None,
    sex=None,
):
    response_samples = filter_frequencies(
        frequencies,
        project=project,
        condition=condition,
        treatment=treatment,
        sample_type=sample_type,
        time_point=time_point,
        sex=sex,
    )
    response_samples = response_samples[
        response_samples["response"].isin(["yes", "no"])
    ].copy()

    if response_samples.empty:
        raise ValueError("No samples matched the responder-analysis filters")

    columns = [
        "project",
        "subject",
        "response",
        "sample",
        "time_from_treatment_start",
        "population",
        "percentage",
    ]
    return response_samples[columns]


def read_sample_subset(
    database_path,
    *,
    project=None,
    condition="melanoma",
    treatment="miraclib",
    sample_type="PBMC",
    time_point=0,
    response=None,
    sex=None,
):
    filters = _build_sample_filters(
        project=project,
        condition=condition,
        treatment=treatment,
        sample_type=sample_type,
        time_point=time_point,
        response=response,
        sex=sex,
    )
    where_clause, parameters = _build_where_clause(filters)
    query = f"""
        SELECT
            projects.project_name AS project,
            subjects.source_subject_id AS subject,
            subjects.condition,
            subjects.treatment,
            subjects.response,
            subjects.sex,
            samples.source_sample_id AS sample,
            samples.sample_type,
            samples.time_from_treatment_start
        FROM samples
        JOIN subjects
            ON subjects.subject_id = samples.subject_id
        JOIN projects
            ON projects.project_id = subjects.project_id
        WHERE {where_clause}
        ORDER BY projects.project_name, subjects.source_subject_id
    """

    with sqlite3.connect(database_path) as connection:
        subset = pd.read_sql_query(query, connection, params=parameters)

    if subset.empty:
        raise ValueError("No samples matched the baseline subset filters")

    return subset


def summarize_sample_subset(subset, projects):
    samples_by_project = subset.groupby("project").size().reindex(
        sorted(projects), fill_value=0
    )
    subjects = subset[["project", "subject", "response", "sex"]].drop_duplicates()
    subjects_by_response = subjects.groupby("response").size().reindex(
        ["no", "yes"], fill_value=0
    )
    subjects_by_sex = subjects.groupby("sex").size().reindex(
        ["F", "M"], fill_value=0
    )

    rows = []
    for value, count in samples_by_project.items():
        rows.append({"summary": "samples_by_project", "group": value, "count": count})
    for value, count in subjects_by_response.items():
        rows.append({"summary": "subjects_by_response", "group": value, "count": count})
    for value, count in subjects_by_sex.items():
        rows.append({"summary": "subjects_by_sex", "group": value, "count": count})
    rows.append({"summary": "total_samples", "group": "all", "count": len(subset)})

    return pd.DataFrame(rows)


def calculate_average_cell_counts(
    database_path,
    *,
    project=None,
    condition="melanoma",
    treatment=None,
    sample_type=None,
    time_point=0,
    response="yes",
    sex="M",
):
    filters = _build_sample_filters(
        project=project,
        condition=condition,
        treatment=treatment,
        sample_type=sample_type,
        time_point=time_point,
        response=response,
        sex=sex,
    )
    where_clause, parameters = _build_where_clause(filters)
    query = f"""
        SELECT
            cell_populations.population_name,
            AVG(cell_counts.cell_count)
        FROM cell_counts
        JOIN cell_populations
            ON cell_populations.population_id = cell_counts.population_id
        JOIN samples
            ON samples.sample_id = cell_counts.sample_id
        JOIN subjects
            ON subjects.subject_id = samples.subject_id
        JOIN projects
            ON projects.project_id = subjects.project_id
        WHERE {where_clause}
        GROUP BY cell_populations.population_name
    """

    with sqlite3.connect(database_path) as connection:
        rows = connection.execute(query, parameters).fetchall()

    if not rows:
        raise ValueError("No samples matched the average cell-count filters")

    return {population: average for population, average in rows}


def summarize_subjects(response_samples):
    # Average repeated samples so each subject contributes once per population.
    return (
        response_samples.groupby(
            ["project", "subject", "response", "population"], as_index=False
        )
        .agg(mean_percentage=("percentage", "mean"))
        .sort_values(["population", "response", "project", "subject"])
    )


def calculate_hedges_g(responders, nonresponders):
    responder_variance = responders.var(ddof=1)
    nonresponder_variance = nonresponders.var(ddof=1)
    degrees_of_freedom = len(responders) + len(nonresponders) - 2
    pooled_variance = (
        (len(responders) - 1) * responder_variance
        + (len(nonresponders) - 1) * nonresponder_variance
    ) / degrees_of_freedom

    if pooled_variance == 0:
        return 0.0

    cohens_d = (responders.mean() - nonresponders.mean()) / pooled_variance**0.5
    # Correct the standardized difference for small-sample bias.
    correction = 1 - 3 / (4 * degrees_of_freedom - 1)
    return correction * cohens_d


def compare_response_groups(subject_summary):
    results = []

    for population in CELL_POPULATIONS:
        population_data = subject_summary[subject_summary["population"].eq(population)]
        responders = population_data.loc[
            population_data["response"].eq("yes"), "mean_percentage"
        ]
        nonresponders = population_data.loc[
            population_data["response"].eq("no"), "mean_percentage"
        ]

        if len(responders) < 2 or len(nonresponders) < 2:
            raise ValueError(
                "Each response group needs at least two subjects per population"
            )

        test = ttest_ind(
            responders,
            nonresponders,
            equal_var=False,
            alternative="two-sided",
        )

        responder_variance = responders.var(ddof=1)
        nonresponder_variance = nonresponders.var(ddof=1)
        # Calculate the confidence interval for the difference in means.
        responder_component = responder_variance / len(responders)
        nonresponder_component = nonresponder_variance / len(nonresponders)
        standard_error = (responder_component + nonresponder_component) ** 0.5
        degrees_of_freedom = (responder_component + nonresponder_component) ** 2 / (
            responder_component**2 / (len(responders) - 1)
            + nonresponder_component**2 / (len(nonresponders) - 1)
        )
        mean_difference = responders.mean() - nonresponders.mean()
        margin = t.ppf(0.975, degrees_of_freedom) * standard_error

        results.append(
            {
                "population": population,
                "responder_subjects": len(responders),
                "nonresponder_subjects": len(nonresponders),
                "responder_mean_percentage": responders.mean(),
                "nonresponder_mean_percentage": nonresponders.mean(),
                "mean_difference_percentage_points": mean_difference,
                "mean_difference_ci_lower": mean_difference - margin,
                "mean_difference_ci_upper": mean_difference + margin,
                "welch_t_statistic": test.statistic,
                "welch_degrees_of_freedom": degrees_of_freedom,
                "p_value": test.pvalue,
                "hedges_g": calculate_hedges_g(responders, nonresponders),
            }
        )

    statistics = pd.DataFrame(results)
    # Adjust the five population tests together.
    rejected, adjusted_p_values, _, _ = multipletests(
        statistics["p_value"],
        alpha=0.05,
        method="fdr_bh",
    )
    statistics["adjusted_p_value"] = adjusted_p_values
    statistics["significant"] = rejected

    columns = [
        "population",
        "responder_subjects",
        "nonresponder_subjects",
        "responder_mean_percentage",
        "nonresponder_mean_percentage",
        "mean_difference_percentage_points",
        "mean_difference_ci_lower",
        "mean_difference_ci_upper",
        "welch_t_statistic",
        "welch_degrees_of_freedom",
        "p_value",
        "adjusted_p_value",
        "hedges_g",
        "significant",
    ]
    return statistics[columns]


def create_boxplots(subject_summary, output_path):
    figure, axes = plt.subplots(2, 3, figsize=(14, 8), sharey=True)
    axes = axes.flatten()

    for axis, population in zip(axes, CELL_POPULATIONS):
        population_data = subject_summary[subject_summary["population"].eq(population)]
        nonresponders = population_data.loc[
            population_data["response"].eq("no"), "mean_percentage"
        ]
        responders = population_data.loc[
            population_data["response"].eq("yes"), "mean_percentage"
        ]

        boxes = axis.boxplot(
            [nonresponders, responders],
            tick_labels=["Non-responder", "Responder"],
            patch_artist=True,
            widths=0.55,
            medianprops={"color": "black", "linewidth": 1.5},
        )
        for box, color in zip(boxes["boxes"], ["#4C78A8", "#F58518"]):
            box.set_facecolor(color)
            box.set_alpha(0.75)

        axis.set_title(POPULATION_LABELS[population])
        axis.set_ylabel("Mean relative frequency (%)")
        axis.grid(axis="y", alpha=0.25)

    axes[-1].set_visible(False)
    figure.suptitle(
        "Subject-Level Cell Frequencies by Miraclib Response",
        fontsize=15,
    )
    figure.tight_layout(rect=[0, 0, 1, 0.95])
    figure.savefig(output_path, dpi=200, bbox_inches="tight")
    plt.close(figure)


def main():
    cell_counts = read_cell_counts(DATABASE_PATH)
    frequencies = calculate_frequencies(cell_counts)

    frequency_summary = frequencies[
        ["sample", "total_count", "population", "count", "percentage"]
    ]

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    frequency_summary.to_csv(
        FREQUENCY_OUTPUT_PATH,
        index=False,
        float_format="%.6f",
    )

    preview = frequency_summary.head(10).copy()
    preview["percentage"] = preview["percentage"].round(2)

    print("Cell frequency summary:\n")
    print(preview.to_string(index=False))
    print(
        f"\nSaved {len(frequency_summary):,} rows to "
        f"{FREQUENCY_OUTPUT_PATH.relative_to(PROJECT_ROOT)}"
    )

    responder_samples = select_response_samples(frequencies)
    subject_summary = summarize_subjects(responder_samples)
    statistics = compare_response_groups(subject_summary)

    statistics.to_csv(
        STATISTICS_OUTPUT_PATH,
        index=False,
        float_format="%.6f",
    )
    create_boxplots(subject_summary, BOXPLOT_OUTPUT_PATH)

    unique_subjects = subject_summary[
        ["project", "subject", "response"]
    ].drop_duplicates()
    subject_counts = unique_subjects["response"].value_counts()

    print("\nResponder analysis:\n")
    print(f"Samples: {responder_samples['sample'].nunique():,}")
    print(f"Subjects: {subject_counts.sum():,}")
    print(f"Responders: {subject_counts.get('yes', 0):,}")
    print(f"Non-responders: {subject_counts.get('no', 0):,}\n")
    print(
        statistics[
            [
                "population",
                "responder_mean_percentage",
                "nonresponder_mean_percentage",
                "mean_difference_percentage_points",
                "p_value",
                "adjusted_p_value",
                "hedges_g",
                "significant",
            ]
        ].to_string(index=False)
    )

    significant = statistics.loc[statistics["significant"], "population"].tolist()
    if significant:
        names = ", ".join(POPULATION_LABELS[value] for value in significant)
        print(f"\nSignificant populations after adjustment: {names}")
    else:
        print("\nNo populations were significant after adjustment.")

    baseline_subset = read_sample_subset(DATABASE_PATH)
    subset_summary = summarize_sample_subset(
        baseline_subset,
        cell_counts["project"].unique(),
    )
    subset_summary.to_csv(SUBSET_OUTPUT_PATH, index=False)

    print("\nBaseline subset analysis:\n")
    print(f"Samples: {len(baseline_subset):,}\n")
    print(subset_summary.to_string(index=False))
    print(f"\nSaved results to {SUBSET_OUTPUT_PATH.relative_to(PROJECT_ROOT)}")

    average_b_cells = calculate_average_cell_counts(DATABASE_PATH)["b_cell"]
    print(
        "\nAverage B-cell count for melanoma male responders at day 0 across "
        f"all sample and treatment types: {average_b_cells:.2f}"
    )


if __name__ == "__main__":
    main()
