# School Database — Design Notes

## Tables

### `students`
Holds one row per student. Columns:

- `id` — primary key, unique identifier for each student.
- `name` — text, required (`NOT NULL`).
- `email` — text, required and `UNIQUE`, so no two students can share an email address.

### `courses`
Holds one row per course. Columns:

- `id` — primary key.
- `title` — text, required (e.g. "Web Foundations").
- `code` — text, required and `UNIQUE` (e.g. `WEB101`), so two courses cannot share the same code.

### `enrolments`
The join table that links students to courses, and stores the grade for that pairing. Columns:

- `id` — primary key.
- `student_id` — foreign key pointing to `students.id`.
- `course_id` — foreign key pointing to `courses.id`.
- `grade` — text, **nullable**, because a student can be enrolled before being graded.
- `UNIQUE (student_id, course_id)` — prevents the same student enrolling on the same course twice.

---

## Relationships

- **Students → enrolments** is **one-to-many**: one student can have many enrolment rows, but each enrolment belongs to exactly one student.
- **Courses → enrolments** is **one-to-many**: one course can have many enrolments, but each enrolment is for exactly one course.
- **Students ↔ courses** is therefore **many-to-many**: one student can be on many courses, and one course can have many students.

A **join table** (`enrolments`) is needed because a many-to-many relationship cannot be stored in either of the two main tables. `students` cannot hold a list of course ids in a single column, and neither can `courses` — a column holds one value. The join table gives each student–course pairing its own row, and it also has a natural place to store information that belongs to the pairing itself: the `grade`.

---

## Index

**Index to add:**

```sql
CREATE INDEX idx_enrolments_student_id ON enrolments(student_id);
```

**Reason:** The most common query against `enrolments` is "find all enrolments for this student" — for example, to show a student their courses. Without an index, SQLite scans every row in `enrolments`. With an index on `student_id`, it jumps straight to the matching rows. A second useful index would be on `course_id`, for the reverse query ("all students on this course"). We do not index `grade`, because it is rarely used as a filter.

---

## SQL or NoSQL?

I would choose **SQL** (a relational database) for this system. The data is highly structured — students, courses and enrolments each have a fixed, well-known shape — and the relationships between them are central to how the system works. Foreign keys and the `UNIQUE (student_id, course_id)` rule let the database itself guarantee correctness: no duplicate enrolments, no orphan rows. A JOIN is the natural way to answer questions like "which students are on this course?" or "how many students per course?". SQL also gives us transactions, so a multi-step change can be made all-or-nothing.

A document (NoSQL) database would be a poor fit here. The relationships are many-to-many and would have to be duplicated across documents, and the strict rules (unique email, one enrolment per student per course) would have to be re-implemented in application code rather than enforced by the database. SQL is the right tool for structured, relationship-heavy data like a school's records.
