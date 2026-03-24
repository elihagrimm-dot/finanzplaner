const STORAGE_KEY = "finanzplaner.entries.v1";

const entryForm = document.getElementById("entry-form");
const dateInput = document.getElementById("date");
const typeInput = document.getElementById("type");
const categoryInput = document.getElementById("category");
const amountInput = document.getElementById("amount");
const noteInput = document.getElementById("note");

const incomeTotal = document.getElementById("income-total");
const expenseTotal = document.getElementById("expense-total");
const balanceTotal = document.getElementById("balance-total");
const categoryBreakdown = document.getElementById("category-breakdown");
const entryList = document.getElementById("entry-list");
const emptyState = document.getElementById("empty-state");
const monthFilter = document.getElementById("month-filter");
const clearAllButton = document.getElementById("clear-all");

let entries = loadEntries();

initializeDefaults();
render();

entryForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const date = dateInput.value;
  const type = typeInput.value;
  const category = categoryInput.value.trim();
  const amount = Number.parseFloat(amountInput.value);
  const note = noteInput.value.trim();

  if (!date || !category || Number.isNaN(amount) || amount <= 0) {
    return;
  }

  const entry = {
    id: crypto.randomUUID(),
    date,
    type,
    category,
    amount,
    note,
  };

  entries.unshift(entry);
  saveEntries();
  render();
  entryForm.reset();
  initializeDefaults();
  categoryInput.focus();
});

monthFilter.addEventListener("change", render);

clearAllButton.addEventListener("click", () => {
  if (entries.length === 0) {
    return;
  }

  const confirmed = window.confirm("Möchtest du wirklich alle Buchungen löschen?");
  if (!confirmed) {
    return;
  }

  entries = [];
  saveEntries();
  render();
});

entryList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-id]");
  if (!button) {
    return;
  }

  const id = button.dataset.id;
  entries = entries.filter((entry) => entry.id !== id);
  saveEntries();
  render();
});

function initializeDefaults() {
  if (!dateInput.value) {
    dateInput.value = new Date().toISOString().slice(0, 10);
  }
  if (!monthFilter.value) {
    monthFilter.value = new Date().toISOString().slice(0, 7);
  }
}

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isEntryLike).map((entry) => ({
      ...entry,
      amount: Number(entry.amount),
    }));
  } catch {
    return [];
  }
}

function isEntryLike(value) {
  return value &&
    typeof value.id === "string" &&
    typeof value.date === "string" &&
    typeof value.type === "string" &&
    typeof value.category === "string" &&
    value.type !== "";
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function render() {
  const visibleEntries = getVisibleEntries();

  renderTotals(visibleEntries);
  renderCategories(visibleEntries);
  renderEntryList(visibleEntries);
}

function getVisibleEntries() {
  const selectedMonth = monthFilter.value;
  if (!selectedMonth) {
    return entries;
  }

  return entries.filter((entry) => entry.date.startsWith(selectedMonth));
}

function renderTotals(items) {
  const income = items
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);

  const expense = items
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);

  const balance = income - expense;

  incomeTotal.textContent = formatCurrency(income);
  expenseTotal.textContent = formatCurrency(expense);
  balanceTotal.textContent = formatCurrency(balance);
}

function renderCategories(items) {
  const expenseItems = items.filter((item) => item.type === "expense");
  categoryBreakdown.innerHTML = "";

  if (expenseItems.length === 0) {
    categoryBreakdown.innerHTML = "<li><span>Keine Ausgaben im gewählten Zeitraum.</span><strong>0,00 €</strong></li>";
    return;
  }

  const totalsByCategory = expenseItems.reduce((acc, item) => {
    const key = item.category;
    acc[key] = (acc[key] || 0) + item.amount;
    return acc;
  }, {});

  const sorted = Object.entries(totalsByCategory).sort((a, b) => b[1] - a[1]);

  for (const [category, total] of sorted) {
    const li = document.createElement("li");
    li.innerHTML = `<span>${escapeHtml(category)}</span><strong>${formatCurrency(total)}</strong>`;
    categoryBreakdown.appendChild(li);
  }
}

function renderEntryList(items) {
  entryList.innerHTML = "";

  if (items.length === 0) {
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;

  for (const item of items) {
    const li = document.createElement("li");
    li.className = "entry-item";

    const typeLabel = item.type === "income" ? "Einnahme" : "Ausgabe";
    const amountPrefix = item.type === "income" ? "+" : "-";

    li.innerHTML = `
      <div class="entry-type ${item.type}"></div>
      <div class="entry-main">
        <strong>${escapeHtml(item.category)} · ${typeLabel}</strong>
        <span>${formatDate(item.date)}${item.note ? ` · ${escapeHtml(item.note)}` : ""}</span>
      </div>
      <div class="entry-amount ${item.type}">${amountPrefix}${formatCurrency(item.amount)}</div>
      <button class="delete-btn" type="button" data-id="${item.id}">Löschen</button>
    `;

    entryList.appendChild(li);
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
