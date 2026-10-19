import { todayLocal, validateOuting, weekAvailability } from "./workload.js";

const outingTypeLabels = {
    game: "Game",
    liveBP: "Live BP",
    bullpen: "Bullpen",
    longToss: "Long toss",
    catch: "Catch",
};

export function formatDate(dateStr) {
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
    });
}

export function setupAgeGroup(current, onChange) {
    const ageGroupSelect = document.getElementById("age-group");
    ageGroupSelect.value = current;
    ageGroupSelect.addEventListener("change", () => {
        onChange(ageGroupSelect.value);
    });
}

export function setupThemeToggle() {
    const button = document.getElementById("theme-toggle");
    const root = document.documentElement;
    let storedTheme;
    try {
        storedTheme = localStorage.getItem("pitcherTracker.theme");
    } catch (error) {
        console.error("Could not read saved theme:", error);
    }
    const systemTheme = matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    const theme = storedTheme === "dark" || storedTheme === "light"
        ? storedTheme
        : systemTheme;

    function updateButton() {
        const isDark = root.dataset.theme === "dark";
        button.textContent = isDark ? "Use light mode" : "Use dark mode";
        button.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
        button.setAttribute("aria-pressed", String(isDark));
    }

    root.dataset.theme = theme;
    updateButton();
    button.addEventListener("click", () => {
        const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";
        root.dataset.theme = nextTheme;
        try {
            localStorage.setItem("pitcherTracker.theme", nextTheme);
        } catch (error) {
            console.error("Could not save theme:", error);
        }
        updateButton();
    });
}

export function renderCounter(count) {
    document.getElementById("pitch-counter").textContent = String(count);
}

export function setupCounter({ getCount, onAdd, onUndo, onSave, onReset }, render) {
    let wakeLock;

    async function updateWakeLock() {
        if (!("wakeLock" in navigator)) return;
        if (getCount() === 0 || document.visibilityState !== "visible") {
            if (wakeLock) {
                try {
                    await wakeLock.release();
                } catch {
                    // Wake lock is optional and may already be released by the browser.
                }
                wakeLock = null;
            }
            return;
        }
        if (!wakeLock || wakeLock.released) {
            try {
                wakeLock = await navigator.wakeLock.request("screen");
            } catch {
                wakeLock = null;
            }
        }
    }

    document.getElementById("count-add").addEventListener("click", () => {
        onAdd();
        updateWakeLock();
    });
    document.getElementById("count-undo").addEventListener("click", () => {
        onUndo();
        updateWakeLock();
    });
    document.getElementById("count-save").addEventListener("click", onSave);
    document.getElementById("count-reset").addEventListener("click", () => {
        onReset();
        updateWakeLock();
    });
    document.addEventListener("visibilitychange", updateWakeLock);
    render();
    updateWakeLock();
}

export function setupForm(getToday, onSubmit) {
    const form = document.getElementById("outing-form");
    const dateInput = document.getElementById("date");
    const errorElement = document.getElementById("form-error");

    function updateDateLimit() {
        dateInput.max = getToday();
    }

    function clearMessage() {
        errorElement.textContent = "";
        errorElement.removeAttribute("data-kind");
    }

    function showMessage(message, kind) {
        errorElement.textContent = message;
        errorElement.dataset.kind = kind;
    }

    form.noValidate = true;
    dateInput.value = getToday();
    updateDateLimit();
    dateInput.addEventListener("focus", updateDateLimit);
    form.addEventListener("input", () => {
        if (errorElement.dataset.kind === "success") clearMessage();
    });

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const today = getToday();

        const outing = {
            date: dateInput.value,
            pitchCount: Number(document.getElementById("pitch-count").value),
            type: document.getElementById("type").value,
            effort: Number(document.getElementById("effort").value),
        };
        const error = validateOuting(outing, today);
        if (error) {
            showMessage(`Error: ${error}`, "error");
            return;
        }

        clearMessage();
        const result = onSubmit(outing);
        const message = typeof result === "string" ? result : result?.message;
        const kind =
            result !== null && typeof result === "object"
                ? result.kind ?? "warning"
                : "warning";
        const saved =
            result === null || typeof result !== "object" || result.saved !== false;
        if (saved) {
            form.reset();
            dateInput.value = getToday();
            updateDateLimit();
        }
        if (message) showMessage(message, kind);
    });
}

const headlineByLevel = {
    green: "Good to pitch",
    yellow: "Take it easy",
    red: "Rest up",
};

export function renderStatus(status) {
    const statusElement = document.getElementById("status");
    statusElement.textContent = "";
    statusElement.dataset.level = status.level;

    const headline = document.createElement("h2");
    headline.textContent = headlineByLevel[status.level];

    const detail = document.createElement("p");
    if (status.level === "green") {
        detail.textContent = status.reason;
    } else {
        const days = document.createElement("strong");
        days.className = "status-days";
        days.textContent = status.daysShort;
        const dayLabel = document.createElement("span");
        dayLabel.className = "status-days-label";
        const dayWord = status.daysShort === 1 ? "day" : "days";
        dayLabel.textContent = `${dayWord} to go`;
        const available = document.createElement("span");
        available.className = "status-available";
        available.textContent = `Available ${formatDate(status.availableDate)}`;
        detail.append(days, dayLabel, available);
    }

    statusElement.append(headline, detail);
}

export function renderAvailabilityStrip(availableDate, today) {
    const strip = document.getElementById("availability-strip");
    strip.textContent = "";

    for (const { date, available } of weekAvailability(availableDate, today)) {
        const item = document.createElement("li");
        item.className = "availability-cell";
        if (date === today) item.classList.add("availability-today");
        item.dataset.available = String(available);
        item.ariaLabel = `${formatDate(date).replace(",", "")}, ${available ? "OK" : "rest"} day`;
        if (date === today) item.ariaCurrent = "date";

        const [year, month, day] = date.split("-").map(Number);
        const dateValue = new Date(year, month - 1, day);
        const weekday = document.createElement("span");
        weekday.className = "availability-weekday";
        weekday.textContent = dateValue.toLocaleDateString(undefined, {
            weekday: "short",
        });

        const dateElement = document.createElement("span");
        dateElement.className = "availability-date";
        dateElement.textContent = String(day);

        const statusElement = document.createElement("span");
        statusElement.className = "availability-status";
        statusElement.textContent = available ? "OK" : "Rest";

        item.append(weekday, dateElement, statusElement);
        strip.append(item);
    }
}

export function renderWeeklyTotal(total) {
    const totalElement = document.getElementById("week-total");
    totalElement.textContent = "";

    const number = document.createElement("strong");
    number.className = "weekly-total-number";
    number.textContent = total;

    const label = document.createElement("span");
    label.className = "weekly-total-label";
    label.textContent = "pitches in the last 7 days";

    const note = document.createElement("span");
    note.className = "weekly-total-note";
    note.textContent = "Games, live BP, and effort 6+ bullpens count.";

    totalElement.append(number, label, note);
}

export function renderHistory(outings) {
    const historyElement = document.getElementById("history");
    historyElement.textContent = "";

    if (outings.length === 0) {
        const emptyItem = document.createElement("li");
        emptyItem.className = "history-empty";
        emptyItem.textContent = "No outings logged yet";
        historyElement.append(emptyItem);
        return;
    }

    for (const outing of outings) {
        const item = document.createElement("li");
        const label = outingTypeLabels[outing.type] ?? outing.type;
        item.className = "history-row";

        const details = document.createElement("div");
        details.className = "history-details";
        const date = document.createElement("strong");
        date.className = "history-date";
        date.textContent = formatDate(outing.date);
        const type = document.createElement("span");
        type.className = "history-type";
        type.textContent = label;
        details.append(date, type);

        const pitchCount = document.createElement("span");
        pitchCount.className = "history-pitch-count";
        pitchCount.textContent = `${outing.pitchCount} pitches`;

        const effort = document.createElement("span");
        effort.className = "history-effort";
        effort.textContent = `Effort ${outing.effort}`;

        const deleteButton = document.createElement("button");
        deleteButton.className = "history-delete";
        deleteButton.type = "button";
        deleteButton.dataset.id = outing.id;
        deleteButton.ariaLabel = `Delete ${label} outing from ${formatDate(outing.date)}`;
        deleteButton.textContent = "Delete";
        item.append(details, pitchCount, effort, deleteButton);
        historyElement.append(item);
    }
}

export function setupHistory(onDelete) {
    const historyElement = document.getElementById("history");
    historyElement.addEventListener("click", (event) => {
        const button = event.target.closest("button");
        if (!button) return;

        const { id } = button.dataset;
        if (confirm("Delete this outing?")) {
            onDelete(id);
        }
    });
}

export function setupExport(getOutings) {
    const exportButton = document.getElementById("export-data");
    exportButton.addEventListener("click", () => {
        const data = JSON.stringify({ version: 1, outings: getOutings() }, null, 2);
        const blob = new Blob([data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `pitcher-outings-${todayLocal()}.json`;
        link.click();
        URL.revokeObjectURL(url);
    });
}

export function setupImport(onImport) {
    const input = document.getElementById("import-data");
    const status = document.getElementById("import-status");
    const maxFileSize = 1024 * 1024;

    function showMessage(message, kind) {
        status.textContent = message;
        status.dataset.kind = kind;
    }

    input.addEventListener("change", async () => {
        const [file] = input.files;
        if (!file) return;

        try {
            const hasJsonType = file.type === "application/json";
            const hasJsonExtension = file.name.toLowerCase().endsWith(".json");
            if (!hasJsonType && !hasJsonExtension) {
                showMessage("Error: Choose a JSON file.", "error");
                return;
            }
            if (file.size > maxFileSize) {
                showMessage("Error: The JSON file must be no larger than 1 MB.", "error");
                return;
            }
            if (file.size === 0) {
                showMessage("Error: The JSON file is empty.", "error");
                return;
            }

            const result = await onImport(await file.text());
            showMessage(result.message, result.kind);
        } catch (error) {
            console.error("Could not import outings:", error);
            showMessage("Error: This file could not be imported. Please try again.", "error");
        } finally {
            input.value = "";
        }
    });
}