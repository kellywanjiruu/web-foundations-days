// ============================================
// QuickNotes — Day 5: Users Directory
// ============================================

const API_URL = "https://jsonplaceholder.typicode.com/users";

// ---------- Select elements ----------
const loadBtn = document.querySelector("#load-users");
const statusText = document.querySelector("#status");
const list = document.querySelector("#users-list");
const filterInput = document.querySelector("#filter-input");

// ---------- Store the loaded users here ----------
let allUsers = [];

// ---------- Render any array of users ----------
function renderUsers(users) {
  list.innerHTML = "";

  if (users.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No users match your filter.";
    list.appendChild(li);
    return;
  }

  users.forEach((user) => {
    const li = document.createElement("li");

    const name = document.createElement("h3");
    name.textContent = user.name;

    const email = document.createElement("p");
    email.textContent = `Email: ${user.email}`;

    const city = document.createElement("p");
    city.textContent = `City: ${user.address.city}`;

    const company = document.createElement("p");
    company.textContent = `Company: ${user.company.name}`;

    li.appendChild(name);
    li.appendChild(email);
    li.appendChild(city);
    li.appendChild(company);

    list.appendChild(li);
  });
}

// ---------- Load users from the API ----------
async function loadUsers() {
  statusText.textContent = "Loading users...";
  loadBtn.disabled = true;
  list.innerHTML = "";

  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    allUsers = await response.json();
    renderUsers(allUsers);
    statusText.textContent = `Loaded ${allUsers.length} users.`;
  } catch (error) {
    statusText.textContent =
      "Could not load users. Please check your connection and try again.";
    console.error("Load failed:", error.message);
  } finally {
    loadBtn.disabled = false;
  }
}

// ---------- Filter the stored array (no new request) ----------
filterInput.addEventListener("input", () => {
  const query = filterInput.value.trim().toLowerCase();

  if (query === "") {
    renderUsers(allUsers);
    return;
  }

  const filtered = allUsers.filter((user) =>
    user.name.toLowerCase().includes(query)
  );

  renderUsers(filtered);
});

// ---------- Wire the button ----------
loadBtn.addEventListener("click", loadUsers);
