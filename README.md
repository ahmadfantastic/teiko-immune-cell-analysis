# Teiko Immune Cell Analysis

Exploring and analyzing immune cell count data with Python.

## Dataset

The project currently uses `cell-count.csv`. Each row represents one biological
sample and includes project, subject, condition, treatment, response, sample
type, treatment time, and cell counts for five immune-cell populations.

### Initial inspection

- 10,500 rows and 15 columns
- 3 projects
- 3,500 subjects
- 10,500 unique samples
- 3 samples per subject
- Time points at days 0, 7, and 14
- Conditions: carcinoma, healthy, and melanoma
- Treatments: miraclib, phauximab, and none
- Sample types: PBMC and WB
- Cell populations: B cell, CD8 T cell, CD4 T cell, NK cell, and monocyte
- No duplicate rows or duplicate sample identifiers
- 1,422 missing response values; all other columns are complete

## Setup

Create a virtual environment and install the current dependency:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

## Database design

The SQLite database is organized into five related tables:

- **Projects** stores each research project once.
- **Subjects** stores participant information such as condition, age, sex,
  treatment, and response.
- **Samples** stores each collected sample, including its type and collection
  time relative to the start of treatment.
- **Cell populations** stores the names of the immune-cell types being measured.
- **Cell counts** stores the count of each cell population in each sample.

### Table relationships

- One project can contain many subjects, while each subject belongs to one
  project.
- One subject can have many samples, while each sample belongs to one subject.
- One sample can contain measurements for many cell populations, and one cell
  population can be measured in many samples.
- The `cell_counts` table connects samples and cell populations. Together, its
  sample and population identifiers uniquely identify a measurement.

In compact form:

`projects -> subjects -> samples -> cell_counts <- cell_populations`

### Design rationale

- Subject information is stored once instead of being repeated for every
  sample.
- Although the CSV contains five fixed population columns, the database stores
  populations as rows rather than separate count columns. This matches the
  required summary format and allows new populations to be added without
  changing the schema.
- Foreign keys, uniqueness rules, and validation constraints protect data
  integrity.
- Indexes support the cohort filters used by the analysis.
- Totals and percentages are calculated from the original counts rather than
  stored, preventing inconsistent derived values.
- The design can support additional projects, subjects, samples, and cell
  populations, and can later be migrated to a larger database such as
  PostgreSQL.

## Load the database

Run the loader from the repository root:

```bash
python load_data.py
```

This creates `teiko.db` in the repository root and reloads all data from
`cell-count.csv` each time it runs.

## Generate the cell frequency summary

After loading the database, run:

```bash
python analysis.py
```

The script displays a short preview and writes the complete summary to
`outputs/cell_frequencies.csv`. The output contains one row per sample and cell
population with the required columns: `sample`, `total_count`, `population`,
`count`, and `percentage`.
