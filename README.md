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

Additional analysis and database functionality will be added incrementally.
