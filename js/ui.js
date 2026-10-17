import { validateOuting } from "./workload.js";

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

export function setupForm(getToday, onSubmit) {
    const form = document.getElementById("outing-form");
    const dateInput = document.getElementById("date");
    const errorElement = document.getElementById("form-error");

    function updateDateLimit() {
        dateInput.max = getToday();
    }

    form.noValidate = true;
    dateInput.value = getToday();
    updateDateLimit();
    dateInput.addEventListener("focus", updateDateLimit);

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
            errorElement.textContent = error;
            return;
        }

        errorElement.textContent = "";
        const result = onSubmit(outing);
        const message = typeof result === "string" ? result : result?.message;
        const saved =
            result === null || typeof result !== "object" || result.saved !== false;
        if (saved) {
            form.reset();
            dateInput.value = getToday();
            updateDateLimit();
        }
        if (message) errorElement.textContent = message;
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
        const dayWord = status.daysShort === 1 ? "day" : "days";
        detail.textContent = `Available ${formatDate(status.availableDate)} (${status.daysShort} ${dayWord} to go)`;
    }

    statusElement.append(headline, detail);
}

export function renderWeeklyTotal(total) {
    const totalElement = document.getElementById("week-total");
    totalElement.textContent = `Pitches in the last 7 days: ${total}`;
}

export function renderHistory(outings) {
    const historyElement = document.getElementById("history");
    historyElement.textContent = "";

    if (outings.length === 0) {
        const emptyItem = document.createElement("li");
        emptyItem.textContent = "No outings logged yet";
        historyElement.append(emptyItem);
        return;
    }

    for (const outing of outings) {
        const item = document.createElement("li");
        const label = outingTypeLabels[outing.type] ?? outing.type;
        const text = document.createElement("span");
        text.textContent =
            `${formatDate(outing.date)} - ${label}, ` +
            `${outing.pitchCount} pitches, effort ${outing.effort}`;
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.dataset.id = outing.id;
        deleteButton.ariaLabel = `Delete ${label} outing from ${formatDate(outing.date)}`;
        deleteButton.textContent = "Delete";
        item.append(text, deleteButton);
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