# Library API — REST Design

A RESTful API design for a library's **books** resource.

Base URL: `https://api.example-library.com`

---

## Endpoints

### 1. List all books

- **Method:** `GET`
- **Path:** `/books`
- **Description:** Returns a list of all books in the library. Supports optional query parameters such as `?author=Jane%20Austen` to filter by author.
- **Request body:** None.
- **Success status:** `200 OK`
- **Example response:**

  ```json
  [
    { "id": 1, "title": "Pride and Prejudice", "author": "Jane Austen", "year": 1813 },
    { "id": 2, "title": "1984", "author": "George Orwell", "year": 1949 }
  ]
  ```

---

### 2. Get one book

- **Method:** `GET`
- **Path:** `/books/42`
- **Description:** Returns the book with the given id.
- **Request body:** None.
- **Success status:** `200 OK`
- **Example response:**

  ```json
  { "id": 42, "title": "The Hobbit", "author": "J.R.R. Tolkien", "year": 1937 }
  ```

---

### 3. Create a book

- **Method:** `POST`
- **Path:** `/books`
- **Description:** Adds a new book to the library.
- **Request body:**

  ```json
  { "title": "The Hobbit", "author": "J.R.R. Tolkien", "year": 1937 }
  ```

- **Success status:** `201 Created`
- **Example response:**

  ```json
  { "id": 42, "title": "The Hobbit", "author": "J.R.R. Tolkien", "year": 1937 }
  ```

---

### 4. Update a book (partial)

- **Method:** `PATCH`
- **Path:** `/books/42`
- **Description:** Updates one or more fields of an existing book (for example, only the title).
- **Request body:**

  ```json
  { "title": "The Hobbit, Revised Edition" }
  ```

- **Success status:** `200 OK`
- **Example response:**

  ```json
  { "id": 42, "title": "The Hobbit, Revised Edition", "author": "J.R.R. Tolkien", "year": 1937 }
  ```

---

### 5. Delete a book

- **Method:** `DELETE`
- **Path:** `/books/42`
- **Description:** Removes the book with the given id from the library.
- **Request body:** None.
- **Success status:** `204 No Content`

---

### 6. List books by an author

- **Method:** `GET`
- **Path:** `/books?author=Jane%20Austen`
- **Description:** Returns all books whose author matches the query parameter (case-insensitive).
- **Request body:** None.
- **Success status:** `200 OK`
- **Example response:**

  ```json
  [
    { "id": 1, "title": "Pride and Prejudice", "author": "Jane Austen", "year": 1813 },
    { "id": 7, "title": "Emma", "author": "Jane Austen", "year": 1815 }
  ]
  ```

---

## Error codes

### `400 Bad Request`

Returned when the request is invalid — for example, a `POST /books` with a missing title:

```json
{ "author": "Jane Austen" }
```

The server responds:

```json
{ "error": "Title is required." }
```

### `404 Not Found`

Returned when the requested book does not exist — for example, `GET /books/999` when no book has id 999. The server responds:

```json
{ "error": "Book 999 not found." }
```
