PRAGMA foreign_keys = ON;

-- Start with an empty schema each time the loader runs.
DROP TABLE IF EXISTS cell_counts;
DROP TABLE IF EXISTS samples;
DROP TABLE IF EXISTS cell_populations;
DROP TABLE IF EXISTS subjects;
DROP TABLE IF EXISTS projects;

CREATE TABLE projects (
    project_id INTEGER PRIMARY KEY,
    project_name TEXT NOT NULL UNIQUE
);

CREATE TABLE subjects (
    subject_id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL,
    source_subject_id TEXT NOT NULL,
    condition TEXT NOT NULL,
    age INTEGER NOT NULL CHECK (age >= 0),
    sex TEXT NOT NULL CHECK (sex IN ('F', 'M')),
    treatment TEXT NOT NULL,
    response TEXT CHECK (response IN ('yes', 'no') OR response IS NULL),
    FOREIGN KEY (project_id) REFERENCES projects(project_id),
    UNIQUE (project_id, source_subject_id)
);

CREATE TABLE samples (
    sample_id INTEGER PRIMARY KEY,
    subject_id INTEGER NOT NULL,
    source_sample_id TEXT NOT NULL,
    sample_type TEXT NOT NULL,
    time_from_treatment_start INTEGER NOT NULL
        CHECK (time_from_treatment_start >= 0),
    FOREIGN KEY (subject_id) REFERENCES subjects(subject_id),
    UNIQUE (subject_id, source_sample_id)
);

CREATE TABLE cell_populations (
    population_id INTEGER PRIMARY KEY,
    population_name TEXT NOT NULL UNIQUE
);

CREATE TABLE cell_counts (
    sample_id INTEGER NOT NULL,
    population_id INTEGER NOT NULL,
    cell_count INTEGER NOT NULL CHECK (cell_count >= 0),
    PRIMARY KEY (sample_id, population_id),
    FOREIGN KEY (sample_id) REFERENCES samples(sample_id),
    FOREIGN KEY (population_id) REFERENCES cell_populations(population_id)
);

-- These columns will be used often in cohort filters and table joins.
CREATE INDEX idx_subjects_cohort
    ON subjects(condition, treatment, response, sex);

CREATE INDEX idx_subjects_project
    ON subjects(project_id);

CREATE INDEX idx_samples_cohort
    ON samples(sample_type, time_from_treatment_start);

CREATE INDEX idx_samples_subject
    ON samples(subject_id);

CREATE INDEX idx_cell_counts_population
    ON cell_counts(population_id);
