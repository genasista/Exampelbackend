import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Make sure schema exists
  await knex.raw(`CREATE SCHEMA IF NOT EXISTS app;`);

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS app.municipality (
      id      INT PRIMARY KEY,
      name    TEXT NOT NULL,
      code    TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS app.school (
      id              INT PRIMARY KEY,
      name            TEXT NOT NULL,
      municipality_id INT REFERENCES app.municipality(id),
      code            TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS app.teacher (
      id         INT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name  TEXT NOT NULL,
      email      TEXT NOT NULL UNIQUE,
      school_id  INT REFERENCES app.school(id)
    );

    CREATE TABLE IF NOT EXISTS app.student (
      id         INT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name  TEXT NOT NULL,
      email      TEXT NOT NULL UNIQUE,
      school_id  INT REFERENCES app.school(id)
    );

    CREATE TABLE IF NOT EXISTS app.course (
      id          INT PRIMARY KEY,
      name        TEXT NOT NULL,
      code        TEXT NOT NULL UNIQUE,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS app.class_group (
      id            INT PRIMARY KEY,
      name          TEXT NOT NULL,
      course_id     INT REFERENCES app.course(id),
      teacher_id    INT REFERENCES app.teacher(id),
      school_id     INT REFERENCES app.school(id),
      academic_year TEXT,
      code          TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS app.enrolment (
      id             INT PRIMARY KEY,
      student_id     INT NOT NULL REFERENCES app.student(id),
      class_group_id INT NOT NULL REFERENCES app.class_group(id),
      enrolment_date DATE NOT NULL,
      CONSTRAINT enrolment_student_class_unique UNIQUE (student_id, class_group_id)
    );

    CREATE TABLE IF NOT EXISTS app.assignment (
      id             INT PRIMARY KEY,
      title          TEXT NOT NULL,
      description    TEXT,
      class_group_id INT REFERENCES app.class_group(id),
      due_date       DATE,
      created_at     DATE,
      code           TEXT NOT NULL UNIQUE
    );

    -- Lightweight demo submissions (separate from app.submissions upload store)
    CREATE TABLE IF NOT EXISTS app.submission (
      id            INT PRIMARY KEY,
      assignment_id INT NOT NULL REFERENCES app.assignment(id),
      student_id    INT NOT NULL REFERENCES app.student(id),
      submitted_at  TIMESTAMPTZ,
      artifact_path TEXT,
      grade         TEXT,
      feedback      TEXT,
      code          TEXT NOT NULL UNIQUE,
      CONSTRAINT submission_assignment_student_unique UNIQUE (assignment_id, student_id)
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP TABLE IF EXISTS app.submission;
    DROP TABLE IF EXISTS app.assignment;
    DROP TABLE IF EXISTS app.enrolment;
    DROP TABLE IF EXISTS app.class_group;
    DROP TABLE IF EXISTS app.course;
    DROP TABLE IF EXISTS app.student;
    DROP TABLE IF EXISTS app.teacher;
    DROP TABLE IF EXISTS app.school;
    DROP TABLE IF EXISTS app.municipality;
  `);
}