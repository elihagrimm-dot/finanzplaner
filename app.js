const SUPABASE_URL = "https://xzfdjxbmnfpcqkmjypoc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_nqgVHNUy9a7YUepEtIuzYA_GzE_vlQq";

const authPanel = document.getElementById("auth-panel");
const appShell = document.getElementById("app-shell");
const sessionUser = document.getElementById("session-user");
const authStatus = document.getElementById("auth-status");

const authForm = document.getElementById("auth-form");
const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const registerButton = document.getElementById("register-btn");
const logoutButton = document.getElementById("logout-btn");

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

let entries = [];
let currentUser = null;

const hasConfig =
  SUPABASE_URL !== "DEINE_SUPABASE_URL" &&
  SUPABASE_ANON_KEY !== "DEIN_SUPABASE_ANON_KEY";

if (!hasConfig) {
  authStatus.textContent = "Bitte trage in app.js deine Supabase URL und den Anon Key ein. Danach neu laden.";
  authStatus.className = "auth-status error";
  authForm.querySelectorAll("input, button").forEach((el) => {
    el.disabled = true;
  });
} else {
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  initializeDefaults();
  bindEvents(supabase);
  initializeSession(supabase);

const SUPABASE_URL = "https://xzfdjxbmnfpcqkmjypoc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_nqgVHNUy9a7YUepEtIuzYA_GzE_vlQq";
  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await login(supabase);
  });

  registerButton.addEventListener("click", async () => {
    await register(supabase);
  });

  logoutButton.addEventListener("click", async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthStatus(error.message, true);
      return;
    }
    setAuthStatus("Erfolgreich abgemeldet.");
  });

  entryForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const date = dateInput.value;
    const type = typeInput.value;
    const category = categoryInput.value.trim();
    const amount = Number.parseFloat(amountInput.value);
    const note = noteInput.value.trim();

    if (!date || !category || Number.isNaN(amount) || amount <= 0 || !currentUser) {
      return;
    }

    const payload = {
      user_id: currentUser.id,
      date,
      type,
      category,
      amount,
      note,
    };

    const { error } = await supabase.from("entries").insert(payload);
    if (error) {
      alert(`Speichern fehlgeschlagen: ${error.message}`);
      return;
    }

    entryForm.reset();
    initializeDefaults();
    categoryInput.focus();
    await loadEntries(supabase);
  });

  monthFilter.addEventListener("change", render);

  clearAllButton.addEventListener("click", async () => {
    if (!currentUser || entries.length === 0) {
      return;
    }

    const confirmed = window.confirm("Möchtest du wirklich alle Buchungen löschen?");
    if (!confirmed) {
      return;
    }

    const { error } = await supabase
      .from("entries")
      .delete()
      .eq("user_id", currentUser.id);

    if (error) {
      alert(`Löschen fehlgeschlagen: ${error.message}`);
      return;
    }

    await loadEntries(supabase);
  });

  entryList.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-id]");
    if (!button || !currentUser) {
      return;
    }

    const id = button.dataset.id;
    const { error } = await supabase
      .from("entries")
      .delete()
      .eq("id", id)
      .eq("user_id", currentUser.id);

    if (error) {
      alert(`Löschen fehlgeschlagen: ${error.message}`);
      return;
    }

    await loadEntries(supabase);
  });

  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      currentUser = session.user;
      showApp(session.user.email || "Angemeldet");
      await loadEntries(supabase);
      setAuthStatus("");
      return;
    }

    currentUser = null;
    entries = [];
    render();
    showAuth();
  });
}

async function initializeSession(supabase) {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    setAuthStatus(error.message, true);
    return;
  }

  const session = data?.session;
  if (!session?.user) {
    showAuth();
    return;
  }

  currentUser = session.user;
  showApp(session.user.email || "Angemeldet");
  await loadEntries(supabase);
}

async function register(supabase) {
  const email = authEmail.value.trim();
  const password = authPassword.value;

  if (!email || password.length < 6) {
    setAuthStatus("Bitte gültige E-Mail und Passwort mit mindestens 6 Zeichen eingeben.", true);
    return;
  }

  const { error } = await supabase.auth.signUp({ email, password });
  if (error) {
    setAuthStatus(error.message, true);
    return;
  }

  setAuthStatus("Registrierung erfolgreich. Je nach Supabase-Einstellung bitte E-Mail bestätigen.");
}

async function login(supabase) {
  const email = authEmail.value.trim();
  const password = authPassword.value;

  if (!email || !password) {
    setAuthStatus("Bitte E-Mail und Passwort eingeben.", true);
    return;
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    setAuthStatus(error.message, true);
    return;
  }

  setAuthStatus("Anmeldung erfolgreich.");
}

async function loadEntries(supabase) {
  if (!currentUser) {
    entries = [];
    render();
    return;
  }

  const { data, error } = await supabase
    .from("entries")
    .select("id, date, type, category, amount, note")
    .eq("user_id", currentUser.id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    alert(`Laden fehlgeschlagen: ${error.message}`);
    return;
  }

  entries = (data || []).map((entry) => ({
    ...entry,
    amount: Number(entry.amount),
  }));

  render();
}

function initializeDefaults() {
  if (!dateInput.value) {
    dateInput.value = new Date().toISOString().slice(0, 10);
  }
  if (!monthFilter.value) {
    monthFilter.value = new Date().toISOString().slice(0, 7);
  }
}

function setAuthStatus(message, isError = false) {
  authStatus.textContent = message;
  authStatus.className = isError ? "auth-status error" : "auth-status success";
}

function showApp(email) {
  sessionUser.textContent = `Angemeldet als ${email}`;
  authPanel.hidden = true;
  appShell.hidden = false;
}

function showAuth() {
  authPanel.hidden = false;
  appShell.hidden = true;
  sessionUser.textContent = "";
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
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
