// ============================================
// QuickNotes — Day 3: JavaScript logic
// ============================================

// 1. Starting data: an array of note objects
let notes = [
  { id: 1, text: "Buy milk and bread", category: "personal" },
  { id: 2, text: "Finish the Day 3 assignment", category: "study" },
  { id: 3, text: "Email the project report to Grace", category: "work" },
  { id: 4, text: "Revise JavaScript arrays", category: "study" },
  { id: 5, text: "Call mum", category: "personal" },
];

// Valid categories a note can belong to
const VALID_CATEGORIES = ["personal", "work", "study"];

// ============================================
// FUNCTIONS
// ============================================

// 2a. searchNotes — return notes whose text contains `word`
//     (case-insensitive: filter + toLowerCase + includes)
function searchNotes(word) {
  const query = word.toLowerCase();
  return notes.filter((note) => note.text.toLowerCase().includes(query));
}

// 2b. longestNote — the note with the most characters, or null if empty
function longestNote() {
  if (notes.length === 0) return null;

  let longest = notes[0];
  for (const note of notes) {
    if (note.text.length > longest.text.length) {
      longest = note;
    }
  }
  return longest;
}

// 2c. countByCategory — object counting notes per category
function countByCategory() {
  const counts = {};
  for (const note of notes) {
    counts[note.category] = (counts[note.category] || 0) + 1;
  }
  return counts;
}

// 2d. getSummary — sentence such as
//     "5 notes: 2 personal, 2 study, 1 work."
//     Uses "note" (singular) when there is exactly one.
function getSummary() {
  const total = notes.length;
  if (total === 0) return "No notes yet.";

  const label = total === 1 ? "note" : "notes";
  const counts = countByCategory();
  const parts = Object.entries(counts).map(
    ([category, count]) => `${count} ${category}`
  );
  return `${total} ${label}: ${parts.join(", ")}.`;
}

// 2e. isDuplicate — true if a note with the same text already exists,
//     ignoring case and extra spaces.
function isDuplicate(text) {
  const cleaned = text.trim().toLowerCase();
  return notes.some((note) => note.text.trim().toLowerCase() === cleaned);
}

// 2f. addNote — add a note only if the text is 1–200 characters,
//     not a duplicate, and the category is valid.
//     Returns true when added, false otherwise (logging the reason).
function addNote(text, category) {
  const cleaned = text.trim();

  if (cleaned.length < 1 || cleaned.length > 200) {
    console.log("❌ Note rejected: must be 1-200 characters.");
    return false;
  }

  if (isDuplicate(cleaned)) {
    console.log("❌ Note rejected: duplicate note.");
    return false;
  }

  if (!VALID_CATEGORIES.includes(category)) {
    console.log("❌ Note rejected: category must be personal, work or study.");
    return false;
  }

  const newNote = {
    id: Date.now(),
    text: cleaned,
    category: category,
  };
  notes.push(newNote);
  console.log(`✅ Added: "${cleaned}" [${category}]`);
  return true;
}

// ============================================
// TESTING — every function, normal case + edge case.
// Expected output is written in a comment next to each call.
// ============================================

console.log("===== searchNotes =====");
console.log(searchNotes("day"));
// Expected: [ { id: 2, text: "Finish the Day 3 assignment", category: "study" } ]
console.log(searchNotes("JAVASCRIPT"));
// Expected: [ { id: 4, text: "Revise JavaScript arrays", category: "study" } ]
console.log(searchNotes("banana"));
// Expected: []   (edge case: no matches)

console.log("===== longestNote =====");
console.log(longestNote());
// Expected: { id: 3, text: "Email the project report to Grace", category: "work" }

// Edge case: empty notes array should return null
const savedNotes = notes;
notes = [];
console.log(longestNote());
// Expected: null
notes = savedNotes;

console.log("===== countByCategory =====");
console.log(countByCategory());
// Expected: { personal: 2, study: 2, work: 1 }

console.log("===== getSummary =====");
console.log(getSummary());
// Expected: "5 notes: 2 personal, 2 study, 1 work."

console.log("===== isDuplicate =====");
console.log(isDuplicate("Call mum"));
// Expected: true
console.log(isDuplicate("  CALL MUM  "));
// Expected: true   (case + extra spaces ignored)
console.log(isDuplicate("Buy eggs"));
// Expected: false  (edge case: no existing match)

console.log("===== addNote =====");
console.log(addNote("Read a book", "personal"));
// Expected: ✅ Added: "Read a book" [personal]   then  true
console.log(addNote("", "work"));
// Expected: ❌ Note rejected: must be 1-200 characters.   then  false
console.log(addNote("Call mum", "personal"));
// Expected: ❌ Note rejected: duplicate note.   then  false
console.log(addNote("Study more", "hobby"));
// Expected: ❌ Note rejected: category must be personal, work or study.   then  false

console.log("===== Final state =====");
console.log(notes);
// Expected: 6 notes — the 5 starting notes plus "Read a book"
