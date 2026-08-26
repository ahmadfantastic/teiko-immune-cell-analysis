import csv
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parent
CSV_PATH = ROOT / "cell-count.csv"
DATABASE_PATH = ROOT / "teiko.db"
SCHEMA_PATH = ROOT / "schema.sql"

CELL_POPULATIONS = (
    "b_cell",
    "cd8_t_cell",
    "cd4_t_cell",
    "nk_cell",
    "monocyte",
)

METADATA_COLUMNS = (
    "project",
    "subject",
    "condition",
    "age",
    "sex",
    "treatment",
    "response",
    "sample",
    "sample_type",
    "time_from_treatment_start",
)


def parse_integer(value, column, row_number):
    try:
        return int(value)
    except ValueError as exc:
        raise ValueError(
            f"Row {row_number}: {column} must be an integer, got {value!r}"
        ) from exc


def load_rows(connection):
    project_ids = {}
    # Subject details repeat for each sample, so keep the first copy for checks.
    subject_records = {}
    sample_ids = set()

    with CSV_PATH.open(newline="", encoding="utf-8-sig") as csv_file:
        reader = csv.DictReader(csv_file)
        required_columns = set(METADATA_COLUMNS + CELL_POPULATIONS)
        missing_columns = required_columns.difference(reader.fieldnames or [])
        if missing_columns:
            missing = ", ".join(sorted(missing_columns))
            raise ValueError(f"CSV is missing required columns: {missing}")

        population_ids = {}
        for population in CELL_POPULATIONS:
            cursor = connection.execute(
                "INSERT INTO cell_populations (population_name) VALUES (?)",
                (population,),
            )
            population_ids[population] = cursor.lastrowid

        for row_number, row in enumerate(reader, start=2):
            project_name = row["project"].strip()
            if project_name not in project_ids:
                cursor = connection.execute(
                    "INSERT INTO projects (project_name) VALUES (?)",
                    (project_name,),
                )
                project_ids[project_name] = cursor.lastrowid

            project_id = project_ids[project_name]
            source_subject_id = row["subject"].strip()
            subject_key = (project_id, source_subject_id)
            subject_metadata = (
                row["condition"].strip(),
                parse_integer(row["age"], "age", row_number),
                row["sex"].strip(),
                row["treatment"].strip(),
                # Empty responses are missing values, not empty strings.
                row["response"].strip() or None,
            )

            if subject_key not in subject_records:
                cursor = connection.execute(
                    """
                    INSERT INTO subjects (
                        project_id,
                        source_subject_id,
                        condition,
                        age,
                        sex,
                        treatment,
                        response
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (project_id, source_subject_id, *subject_metadata),
                )
                subject_records[subject_key] = (cursor.lastrowid, subject_metadata)
            else:
                subject_id, saved_metadata = subject_records[subject_key]
                if subject_metadata != saved_metadata:
                    raise ValueError(
                        f"Row {row_number}: inconsistent metadata for subject "
                        f"{source_subject_id!r}"
                    )

            subject_id = subject_records[subject_key][0]
            source_sample_id = row["sample"].strip()
            sample_key = (subject_id, source_sample_id)
            if sample_key in sample_ids:
                raise ValueError(
                    f"Row {row_number}: duplicate sample {source_sample_id!r}"
                )
            sample_ids.add(sample_key)

            cursor = connection.execute(
                """
                INSERT INTO samples (
                    subject_id,
                    source_sample_id,
                    sample_type,
                    time_from_treatment_start
                ) VALUES (?, ?, ?, ?)
                """,
                (
                    subject_id,
                    source_sample_id,
                    row["sample_type"].strip(),
                    parse_integer(
                        row["time_from_treatment_start"],
                        "time_from_treatment_start",
                        row_number,
                    ),
                ),
            )
            sample_id = cursor.lastrowid

            counts = []
            # Convert the five CSV columns into one row per population.
            for population in CELL_POPULATIONS:
                count = parse_integer(row[population], population, row_number)
                counts.append((sample_id, population_ids[population], count))

            connection.executemany(
                """
                INSERT INTO cell_counts (sample_id, population_id, cell_count)
                VALUES (?, ?, ?)
                """,
                counts,
            )


def table_counts(connection):
    tables = (
        "projects",
        "subjects",
        "samples",
        "cell_populations",
        "cell_counts",
    )
    return {
        table: connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        for table in tables
    }


def main():
    if not CSV_PATH.exists():
        raise FileNotFoundError(f"Input file not found: {CSV_PATH}")

    schema = SCHEMA_PATH.read_text(encoding="utf-8")
    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.execute("PRAGMA foreign_keys = ON")
        connection.executescript(schema)
        load_rows(connection)

        # Catch broken relationships before reporting a successful load.
        foreign_key_errors = connection.execute("PRAGMA foreign_key_check").fetchall()
        if foreign_key_errors:
            raise RuntimeError(f"Foreign key check failed: {foreign_key_errors}")

        counts = table_counts(connection)

    print(f"Created {DATABASE_PATH.name}")
    for table, count in counts.items():
        print(f"  {table}: {count:,}")


if __name__ == "__main__":
    main()
