// ============================================
// QuickNotes — Day 4: live editor logic
// ============================================

// ---------- 1. Select the elements we need ----------
const textarea = document.querySelector("#note-text");
const charCount = document.querySelector("#char-count");
const wordCount = document.querySelector("#word-count");
const clearBtn = document.querySelector("#clear-btn");
const themeBtn = document.querySelector("#theme-toggle");

// ---------- 2. Constants ----------
const DRAFT_KEY = "quicknotes-draft";
const THEME_KEY = "quicknotes-theme";
const MAX_CHARS = 200;
const WARN_AT = 180;

// ---------- 3. Counters and warning classes ----------
function updateCounts() {
  const text = textarea.value;
  const chars = text.length;

  const trimmed = text.trim();
  const words = trimmed === "" ? 0 : trimmed.split(/\s+/).length;

  // "N / 200 characters"
  charCount.textContent = `${chars} / ${MAX_CHARS} characters`;

  // "N words" (with correct singular for one word)
  wordCount.textContent = words === 1 ? "1 word" : `${words} words`;

  // warning (orange) above 180 characters
  if (chars > WARN_AT) {
    charCount.classList.add("warning");
  } else {
    charCount.classList.remove("warning");
  }

  // over (red, bold) above 200 characters
  if (chars > MAX_CHARS) {
    charCount.classList.add("over");
  } else {
    charCount.classList.remove("over");
  }
}

// ---------- 4. Draft save / restore ----------
function saveDraft() {
  localStorage.setItem(DRAFT_KEY, textarea.value);
}

// ---------- 5. Clear everything ----------
function clearEverything() {
  textarea.value = "";
  localStorage.removeItem(DRAFT_KEY);
  updateCounts();
  textarea.focus();
}

// ---------- 6. Theme ----------
function applyTheme(isDark) {
  document.body.classList.toggle("dark", isDark);
  themeBtn.textContent = isDark ? "Light mode" : "Dark mode";
}

// ---------- 7. Events ----------

// Every keystroke: update counters and save the draft
textarea.addEventListener("input", () => {
  updateCounts();
  saveDraft();
});

// Escape inside the textarea clears it
textarea.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    clearEverything();
  }
});

// Clear button
clearBtn.addEventListener("click", clearEverything);

// Theme button toggles dark mode and remembers the choice
themeBtn.addEventListener("click", () => {
  const isDark = !document.body.classList.contains("dark");
  applyTheme(isDark);
  localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
});

// ---------- 8. On page load: restore draft and theme ----------
const savedDraft = localStorage.getItem(DRAFT_KEY);
if (savedDraft) {
  textarea.value = savedDraft;
}

const savedTheme = localStorage.getItem(THEME_KEY);
applyTheme(savedTheme === "dark");

// Draw the counters once for whatever was restored
updateCounts();
