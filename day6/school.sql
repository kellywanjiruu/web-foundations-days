-- ============================================
-- Day 6 assignment — School database (SQLite)
-- ============================================

-- SQLite does not enforce foreign keys by default
PRAGMA foreign_keys = ON;

-- ---------- 1. Tables ----------

CREATE TABLE students (
  id     INTEGER PRIMARY KEY,
  name   TEXT    NOT NULL,
  email  TEXT    NOT NULL UNIQUE
);

CREATE TABLE courses (
  id     INTEGER PRIMARY KEY,
  title  TEXT    NOT NULL,
  code   TEXT    NOT NULL UNIQUE
);

CREATE TABLE enrolments (
  id          INTEGER PRIMARY KEY,
  student_id  INTEGER NOT NULL,
  course_id   INTEGER NOT NULL,
  grade       TEXT,
  UNIQUE (student_id, course_id),                              -- no duplicate enrolments
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id)  REFERENCES courses(id)  ON DELETE CASCADE
);

-- ---------- 2. Sample data ----------

INSERT INTO students (name, email) VALUES
  ('Amina Otieno',    'amina@example.com'),
  ('Brian Kamau',     'brian@example.com'),
  ('Cynthia Wanjiru', 'cynthia@example.com'),
  ('David Mwangi',    'david@example.com');

INSERT INTO courses (title, code) VALUES
  ('Web Foundations', 'WEB101'),
  ('Databases',       'DB201'),
  ('System Design',   'SD301');

INSERT INTO enrolments (student_id, course_id, grade) VALUES
  (1, 1, 'A'),
  (1, 2, 'B+'),
  (2, 1, 'B'),
  (2, 3, 'A-'),
  (3, 2, 'A');

-- ---------- 3. The five queries ----------

-- Query 1: All courses for one student (by name)
SELECT courses.title, courses.code, enrolments.grade
FROM students
JOIN enrolments ON enrolments.student_id = students.id
JOIN courses    ON courses.id = enrolments.course_id
WHERE students.name = 'Amina Otieno'
ORDER BY courses.title;

-- Query 2: All students on one course
SELECT students.name, students.email, enrolments.grade
FROM courses
JOIN enrolments ON enrolments.course_id = courses.id
JOIN students   ON students.id = enrolments.student_id
WHERE courses.title = 'Web Foundations'
ORDER BY students.name;

-- Query 3: Number of students per course
SELECT courses.title, COUNT(enrolments.student_id) AS student_count
FROM courses
LEFT JOIN enrolments ON enrolments.course_id = courses.id
GROUP BY courses.id
ORDER BY student_count DESC;

-- Query 4: Students who have no enrolments
SELECT students.name, students.email
FROM students
LEFT JOIN enrolments ON enrolments.student_id = students.id
WHERE enrolments.id IS NULL;

-- Query 5: Update one enrolment's grade
UPDATE enrolments
SET grade = 'A+'
WHERE student_id = 1 AND course_id = 2;
