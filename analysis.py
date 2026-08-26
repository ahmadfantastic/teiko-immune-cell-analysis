import sqlite3
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parent
DATABASE_PATH = ROOT / "teiko.db"
OUTPUT_PATH = ROOT / "outputs" / "cell_frequencies.csv"

EXPECTED_POPULATIONS = {
    "b_cell",
    "cd8_t_cell",
    "cd4_t_cell",
    "nk_cell",
    "monocyte",
}


def read_cell_counts(database_path):
    if not database_path.exists():
        raise FileNotFoundError(
            f"Database not found: {database_path}. Run 'python load_data.py' first."
        )

    query = """
        SELECT
            samples.source_sample_id AS sample,
            cell_populations.population_name AS population,
            cell_counts.cell_count AS count
        FROM cell_counts
        JOIN samples
            ON samples.sample_id = cell_counts.sample_id
        JOIN cell_populations
            ON cell_populations.population_id = cell_counts.population_id
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
    if not populations_by_sample.map(lambda values: values == EXPECTED_POPULATIONS).all():
        raise ValueError("Each sample must contain all five cell populations")

    frequencies = cell_counts.copy()
    total_counts = frequencies.groupby("sample")["count"].transform("sum")
    if (total_counts <= 0).any():
        raise ValueError("Each sample must have a positive total cell count")

    frequencies.insert(1, "total_count", total_counts)
    frequencies["percentage"] = (
        frequencies["count"] / frequencies["total_count"] * 100
    )

    percentage_totals = frequencies.groupby("sample")["percentage"].sum()
    if not percentage_totals.between(99.999999, 100.000001).all():
        raise ValueError("Population percentages do not add up to 100")

    return frequencies[["sample", "total_count", "population", "count", "percentage"]]


def main():
    cell_counts = read_cell_counts(DATABASE_PATH)
    frequencies = calculate_frequencies(cell_counts)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    frequencies.to_csv(OUTPUT_PATH, index=False, float_format="%.6f")

    preview = frequencies.head(10).copy()
    preview["percentage"] = preview["percentage"].round(2)

    print("Cell frequency summary:\n")
    print(preview.to_string(index=False))
    print(f"\nSaved {len(frequencies):,} rows to {OUTPUT_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
