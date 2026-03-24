const STORAGE_KEY = "finanzplaner.entries.v1";

const appStatus = document.getElementById("app-status");

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
const categoryPie = document.getElementById("category-pie");
const categoryPieLabel = document.getElementById("category-pie-label");
const financePieLegend = document.getElementById("finance-pie-legend");
const entryList = document.getElementById("entry-list");
const emptyState = document.getElementById("empty-state");
const monthFilter = document.getElementById("month-filter");
const exportCsvButton = document.getElementById("export-csv");
const clearAllButton = document.getElementById("clear-all");

const PIE_COLORS = [
  "#155fa0",
  "#1b8b4a",
  "#f28749",
  "#b03a2e",
  "#7a5af8",
  "#1e9e9f",
  "#c85ea2",
  "#e2a93b",
];

let entries = loadEntries();

initializeDefaults();
render();
setStatus("Bereit.");

entryForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const date = dateInput.value;
  const type = typeInput.value;
  const category = categoryInput.value.trim();
  const amount = parseAmount(amountInput.value);
  const note = noteInput.value.trim();

  if (!date || !category || Number.isNaN(amount) || amount <= 0) {
    alert("Bitte Datum, Kategorie und einen gueltigen Betrag eingeben.");
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
  setStatus("Buchung gespeichert.");
});

monthFilter.addEventListener("change", render);

exportCsvButton.addEventListener("click", () => {
  exportVisibleEntriesToCsv();
});

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
  setStatus("Alle Buchungen wurden geloescht.");
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
  setStatus("Buchung geloescht.");
});

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

function initializeDefaults() {
  if (!dateInput.value) {
    dateInput.value = new Date().toISOString().slice(0, 10);
  }
  if (!monthFilter.value) {
    monthFilter.value = new Date().toISOString().slice(0, 7);
  }
}

function setStatus(message, isError = false) {
  if (appStatus) {
    appStatus.textContent = message;
    appStatus.style.color = isError ? "var(--expense)" : "var(--muted)";
  }
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

  renderFinancialPie(income, expense, balance);
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

  const totalExpense = expenseItems.reduce((sum, item) => sum + item.amount, 0);

  for (const [category, total] of sorted) {
    const percentage = totalExpense > 0 ? Math.round((total / totalExpense) * 100) : 0;
    const li = document.createElement("li");
    li.innerHTML = `<span>${escapeHtml(category)}</span><strong>${formatCurrency(total)} <em class="category-percent">(${percentage}%)</em></strong>`;
    categoryBreakdown.appendChild(li);
  }
}

function renderFinancialPie(income, expense, balance) {
  if (!categoryPie || !categoryPieLabel || !financePieLegend) {
    return;
  }

  const remaining = Math.max(balance, 0);
  const segmentsData = [
    { label: "Einnahmen", value: income, color: "#1b8b4a" },
    { label: "Ausgaben", value: expense, color: "#b03a2e" },
    { label: "Übrig", value: remaining, color: "#155fa0" },
  ];

  const total = segmentsData.reduce((sum, item) => sum + item.value, 0);

  if (total <= 0) {
    categoryPie.style.background = "conic-gradient(#d7dce8 0deg 360deg)";
    categoryPieLabel.textContent = "Noch keine Werte im gewählten Zeitraum.";
    financePieLegend.innerHTML = "";
    return;
  }

  let currentAngle = 0;
  const gradientSegments = [];

  for (const segment of segmentsData) {
    const angle = (segment.value / total) * 360;
    const nextAngle = currentAngle + angle;
    gradientSegments.push(`${segment.color} ${currentAngle.toFixed(2)}deg ${nextAngle.toFixed(2)}deg`);
    currentAngle = nextAngle;
  }

  categoryPie.style.background = `conic-gradient(${gradientSegments.join(", ")})`;
  categoryPieLabel.textContent = `Monatsüberblick: ${formatCurrency(income)} Einnahmen`;

  financePieLegend.innerHTML = "";
  for (const segment of segmentsData) {
    const percent = total > 0 ? Math.round((segment.value / total) * 100) : 0;
    const li = document.createElement("li");
    li.innerHTML = `<span class="legend-name"><span class="legend-dot" style="background:${segment.color}"></span>${segment.label}</span><strong>${formatCurrency(segment.value)} (${percent}%)</strong>`;
    financePieLegend.appendChild(li);
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

function exportVisibleEntriesToCsv() {
  const visibleEntries = getVisibleEntries();
  if (visibleEntries.length === 0) {
    alert("Keine Buchungen zum Export im aktuell gewaehlten Zeitraum.");
    return;
  }

  const headers = ["Datum", "Art", "Kategorie", "Betrag", "Notiz"];
  const rows = visibleEntries.map((item) => [
    item.date,
    item.type === "income" ? "Einnahme" : "Ausgabe",
    item.category,
    item.amount.toFixed(2),
    item.note || "",
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => toCsvCell(cell)).join(";"))
    .join("\n");

  const monthPart = monthFilter.value || "alle-monate";
  const fileName = `finanzplaner-export-${monthPart}.csv`;
  downloadTextFile(`\uFEFF${csvContent}`, fileName, "text/csv;charset=utf-8;");
}

function toCsvCell(value) {
  const text = String(value == null ? "" : value).split('"').join('""');
  return `"${text}"`;
}

function downloadTextFile(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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

function parseAmount(value) {
  return Number.parseFloat(String(value).replace(",", "."));
}

function escapeHtml(value) {
  return String(value)
    .split("&").join("&amp;")
    .split("<").join("&lt;")
    .split(">").join("&gt;")
    .split('"').join("&quot;")
    .split("'").join("&#39;");
}
