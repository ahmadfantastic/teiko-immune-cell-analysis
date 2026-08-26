from functools import lru_cache
import json
from pathlib import Path
import tempfile

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.staticfiles import StaticFiles
import uvicorn

from analysis import (
    DATABASE_PATH,
    POPULATION_LABELS,
    PROJECT_ROOT,
    calculate_average_cell_counts,
    calculate_frequencies,
    compare_response_groups,
    filter_frequencies,
    read_cell_counts,
    read_sample_subset,
    select_response_samples,
    summarize_sample_subset,
    summarize_subjects,
)
from load_data import initialize_database


DASHBOARD_DIST_PATH = PROJECT_ROOT / "dashboard" / "dist"
MAXIMUM_UPLOAD_SIZE = 25 * 1024 * 1024

app = FastAPI(title="Teiko Immune Cell Analysis API")


@lru_cache(maxsize=1)
def get_dashboard_data():
    cell_counts = read_cell_counts(DATABASE_PATH)
    return calculate_frequencies(cell_counts)


def dataframe_records(frame):
    return json.loads(frame.to_json(orient="records"))


def parse_time_point(time_mode):
    if time_mode == "average":
        return None

    try:
        return int(time_mode)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail="Time selection must be average or a valid day",
        ) from exc


@app.get("/api/health")
def get_health():
    return {"status": "ok"}


@app.post("/api/load-data")
async def upload_data(request: Request):
    file_name = request.headers.get("x-file-name", "")
    if not file_name.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Select a CSV file")

    uploaded_size = 0

    with tempfile.TemporaryDirectory(
        prefix=".teiko-import-", dir=PROJECT_ROOT
    ) as temp_dir:
        temp_path = Path(temp_dir)
        csv_path = temp_path / "upload.csv"
        database_path = temp_path / "teiko.db"

        with csv_path.open("wb") as csv_file:
            async for chunk in request.stream():
                uploaded_size += len(chunk)
                if uploaded_size > MAXIMUM_UPLOAD_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail="CSV file must be smaller than 25 MB",
                    )
                csv_file.write(chunk)

        if uploaded_size == 0:
            raise HTTPException(status_code=400, detail="The selected CSV is empty")

        try:
            counts = initialize_database(csv_path, database_path)
        except (UnicodeDecodeError, ValueError) as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        database_path.replace(DATABASE_PATH)

    get_dashboard_data.cache_clear()
    return {
        "message": f"Loaded {file_name}",
        "counts": counts,
        "options": get_analysis_options(),
    }


@app.get("/api/options")
def get_analysis_options():
    data = get_dashboard_data()

    def get_unique_values(column):
        return sorted(data[column].dropna().unique().tolist())

    return {
        "projects": get_unique_values("project"),
        "conditions": get_unique_values("condition"),
        "treatments": get_unique_values("treatment"),
        "sample_types": get_unique_values("sample_type"),
        "time_points": get_unique_values("time_from_treatment_start"),
        "responses": get_unique_values("response"),
        "sexes": get_unique_values("sex"),
        "populations": [
            {"value": value, "label": label}
            for value, label in POPULATION_LABELS.items()
        ],
        "metrics": {
            "projects": int(data["project"].nunique()),
            "subjects": int(data[["project", "subject"]].drop_duplicates().shape[0]),
            "samples": int(data["sample"].nunique()),
            "measurements": int(len(data)),
        },
    }


@app.get("/api/frequencies")
def get_frequency_summary(
    project: str | None = None,
    condition: str | None = None,
    treatment: str | None = None,
    sample_type: str | None = None,
    time_point: int | None = None,
    response: str | None = None,
    sex: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=10, le=200),
):
    filtered = filter_frequencies(
        get_dashboard_data(),
        project=project,
        condition=condition,
        treatment=treatment,
        sample_type=sample_type,
        time_point=time_point,
        response=response,
        sex=sex,
    )
    columns = ["sample", "total_count", "population", "count", "percentage"]
    summary = filtered[columns].sort_values(["sample", "population"])
    total = int(len(summary))
    start = (page - 1) * page_size
    page_rows = summary.iloc[start : start + page_size]

    return {
        "rows": dataframe_records(page_rows),
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@app.get("/api/samples")
def get_samples(
    project: str | None = None,
    condition: str | None = None,
    treatment: str | None = None,
    sample_type: str | None = None,
    time_point: int | None = None,
    response: str | None = None,
    sex: str | None = None,
):
    filtered = filter_frequencies(
        get_dashboard_data(),
        project=project,
        condition=condition,
        treatment=treatment,
        sample_type=sample_type,
        time_point=time_point,
        response=response,
        sex=sex,
    )
    columns = [
        "project",
        "subject",
        "condition",
        "treatment",
        "response",
        "sex",
        "sample",
        "sample_type",
        "time_from_treatment_start",
    ]
    sample_rows = filtered[columns].drop_duplicates().sort_values("sample")
    return {
        "samples": dataframe_records(sample_rows),
        "count": int(len(sample_rows)),
    }


@app.get("/api/samples/{sample_id}/frequencies")
def get_sample_frequencies(sample_id: str):
    sample_rows = filter_frequencies(get_dashboard_data(), response=None)
    sample_rows = sample_rows[sample_rows["sample"].eq(sample_id)]
    if sample_rows.empty:
        raise HTTPException(status_code=404, detail="Sample not found")

    columns = ["sample", "total_count", "population", "count", "percentage"]
    return {"frequencies": dataframe_records(sample_rows[columns])}


@app.get("/api/response-analysis")
def get_response_analysis(
    project: str | None = None,
    condition: str | None = None,
    treatment: str | None = None,
    sample_type: str | None = None,
    time_mode: str = Query(default="average"),
    sex: str | None = None,
):
    time_point = parse_time_point(time_mode)

    try:
        response_samples = select_response_samples(
            get_dashboard_data(),
            project=project,
            condition=condition,
            treatment=treatment,
            sample_type=sample_type,
            time_point=time_point,
            sex=sex,
        )
        subject_summary = summarize_subjects(response_samples)
        statistics = compare_response_groups(subject_summary)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    unique_subjects = subject_summary[
        ["project", "subject", "response"]
    ].drop_duplicates()
    response_counts = unique_subjects["response"].value_counts()

    return {
        "sample_count": int(response_samples["sample"].nunique()),
        "subject_count": int(len(unique_subjects)),
        "responders": int(response_counts.get("yes", 0)),
        "nonresponders": int(response_counts.get("no", 0)),
        "statistics": dataframe_records(statistics),
        "distribution": dataframe_records(subject_summary),
    }


@app.get("/api/subset-analysis")
def get_subset_analysis(
    project: str | None = None,
    condition: str | None = None,
    treatment: str | None = None,
    sample_type: str | None = None,
    time_point: int | None = None,
    response: str | None = None,
    sex: str | None = None,
):
    try:
        subset = read_sample_subset(
            DATABASE_PATH,
            project=project,
            condition=condition,
            treatment=treatment,
            sample_type=sample_type,
            time_point=time_point,
            response=response,
            sex=sex,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    projects = get_dashboard_data()["project"].unique()
    summary = summarize_sample_subset(subset, projects)
    try:
        average_cell_counts = calculate_average_cell_counts(
            DATABASE_PATH,
            project=project,
            condition=condition,
            treatment=treatment,
            sample_type=sample_type,
            time_point=time_point,
            response=response,
            sex=sex,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "sample_count": int(len(subset)),
        "subject_count": int(
            subset[["project", "subject"]].drop_duplicates().shape[0]
        ),
        "summary": dataframe_records(summary),
        "average_cell_counts": {
            population: round(average, 2)
            for population, average in average_cell_counts.items()
        },
    }


if DASHBOARD_DIST_PATH.exists():
    app.mount(
        "/",
        StaticFiles(directory=DASHBOARD_DIST_PATH, html=True),
        name="dashboard",
    )


if __name__ == "__main__":
    if not DASHBOARD_DIST_PATH.exists():
        raise FileNotFoundError("Dashboard build not found. Run 'npm run build' first.")
    uvicorn.run(app, host="0.0.0.0", port=8000)
