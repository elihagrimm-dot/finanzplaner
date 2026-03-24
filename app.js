const SUPABASE_URL = "https://xzfdjxbmnfpcqkmjypoc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_nqgVHNUy9a7YUepEtIuzYA_GzE_vlQq";

const authPanel = document.getElementById("auth-panel");
const appShell = document.getElementById("app-shell");
const sessionUser = document.getElementById("session-user");
const authStatus = document.getElementById("auth-status");
const appStatus = document.getElementById("app-status");

const authForm = document.getElementById("auth-form");
const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const registerButton = document.getElementById("register-btn");
const resetPasswordButton = document.getElementById("reset-password-btn");
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
const exportCsvButton = document.getElementById("export-csv");
const clearAllButton = document.getElementById("clear-all");

let entries = [];
let currentUser = null;

window.addEventListener("error", (event) => {
  const message = event && event.message ? event.message : "Unbekannter JavaScript-Fehler.";
  setAuthStatus(`JavaScript-Fehler: ${message}`, true);
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event && event.reason ? String(event.reason) : "Unbekannte Promise-Ablehnung.";
  setAuthStatus(`Promise-Fehler: ${reason}`, true);
});

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
  initializeApp();
}

async function initializeApp() {
  try {
    const createClient = await resolveSupabaseCreateClient();
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    initializeDefaults();
    bindEvents(supabase);
    initializeSession(supabase);
    setAuthStatus("Bereit. Du kannst dich registrieren oder anmelden.");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Initialisierungsfehler.";
    setAuthStatus(message, true);
    alert(`Initialisierung fehlgeschlagen: ${message}`);
  }
}

async function resolveSupabaseCreateClient() {
  if (window.supabase && typeof window.supabase.createClient === "function") {
    return window.supabase.createClient;
  }

  try {
    const module = await import("https://esm.sh/@supabase/supabase-js@2");
    if (typeof module.createClient === "function") {
      return module.createClient;
    }
  } catch {
    // Continue to final error below.
  }

  throw new Error("Supabase-Bibliothek konnte weder ueber CDN noch ueber Fallback geladen werden.");
}

function bindEvents(supabase) {
  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setAuthStatus("Anmeldung wird geprueft...");
    await login(supabase);
  });

  registerButton.addEventListener("click", async () => {
    setAuthStatus("Registrierung wird gesendet...");
    await register(supabase);
  });

  resetPasswordButton.addEventListener("click", async () => {
    setAuthStatus("Passwort-Reset wird gesendet...");
    await resetPassword(supabase);
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
    const amount = parseAmount(amountInput.value);
    const note = noteInput.value.trim();

    if (!currentUser) {
      alert("Bitte zuerst anmelden.");
      return;
    }

    if (!date || !category || Number.isNaN(amount) || amount <= 0) {
      alert("Bitte Datum, Kategorie und einen gueltigen Betrag eingeben. Tipp: Beim Betrag Punkt statt Komma verwenden, z. B. 12.50.");
      return;
    }

    setAuthStatus("Buchung wird gespeichert...");

    const payload = {
      user_id: currentUser.id,
      date,
      type,
      category,
      amount,
      note,
    };

    try {
      const result = await withTimeout(
        supabase.from("entries").insert(payload),
        15000,
        "Speichern hat zu lange gedauert. Bitte Netzwerk/Supabase-Verbindung prüfen."
      );

      if (result && result.error) {
        alert(`Speichern fehlgeschlagen: ${result.error.message}`);
        setAuthStatus(`Speichern fehlgeschlagen: ${result.error.message}`, true);
        return;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unbekannter Fehler beim Speichern.";
      alert(`Speichern fehlgeschlagen: ${message}`);
      setAuthStatus(`Speichern fehlgeschlagen: ${message}`, true);
      return;
    }

    entryForm.reset();
    initializeDefaults();
    categoryInput.focus();
    setAuthStatus("Buchung gespeichert.");
    await loadEntries(supabase);
  });

  monthFilter.addEventListener("change", render);

  exportCsvButton.addEventListener("click", () => {
    exportVisibleEntriesToCsv();
  });

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
    if (session && session.user) {
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

  const session = data && data.session ? data.session : null;
  if (!session || !session.user) {
    showAuth();
    return;
  }

  currentUser = session.user;
  showApp(session.user.email || "Angemeldet");
  await loadEntries(supabase);
}

async function register(supabase) {
  try {
    const email = authEmail.value.trim();
    const password = authPassword.value;

    if (!email || password.length < 6) {
      setAuthStatus("Bitte gültige E-Mail und Passwort mit mindestens 6 Zeichen eingeben.", true);
      return;
    }

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setAuthStatus(error.message, true);
      alert(`Registrierung fehlgeschlagen: ${error.message}`);
      return;
    }

    const message = "Registrierung erfolgreich. Prüfe dein E-Mail-Postfach zur Bestätigung und melde dich danach an.";
    setAuthStatus(message);
    alert(message);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler bei der Registrierung.";
    setAuthStatus(message, true);
    alert(`Registrierung fehlgeschlagen: ${message}`);
  }
}

async function login(supabase) {
  try {
    const email = authEmail.value.trim();
    const password = authPassword.value;

    if (!email || !password) {
      setAuthStatus("Bitte E-Mail und Passwort eingeben.", true);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthStatus(error.message, true);
      alert(`Anmeldung fehlgeschlagen: ${error.message}`);
      return;
    }

    setAuthStatus("Anmeldung erfolgreich.");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler bei der Anmeldung.";
    setAuthStatus(message, true);
    alert(`Anmeldung fehlgeschlagen: ${message}`);
  }
}

async function resetPassword(supabase) {
  try {
    const email = authEmail.value.trim();
    if (!email) {
      setAuthStatus("Bitte zuerst eine E-Mail-Adresse eingeben.", true);
      return;
    }

    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    if (error) {
      setAuthStatus(error.message, true);
      alert(`Passwort-Reset fehlgeschlagen: ${error.message}`);
      return;
    }

    const message = "Reset-E-Mail versendet. Bitte pruefe dein Postfach.";
    setAuthStatus(message);
    alert(message);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler beim Passwort-Reset.";
    setAuthStatus(message, true);
    alert(`Passwort-Reset fehlgeschlagen: ${message}`);
  }
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
  if (appStatus) {
    appStatus.textContent = message;
    appStatus.style.color = isError ? "var(--expense)" : "var(--muted)";
  }
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

function withTimeout(promise, timeoutMs, timeoutMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    }),
  ]);
}

function escapeHtml(value) {
  return String(value)
    .split("&").join("&amp;")
    .split("<").join("&lt;")
    .split(">").join("&gt;")
    .split('"').join("&quot;")
    .split("'").join("&#39;");
}
