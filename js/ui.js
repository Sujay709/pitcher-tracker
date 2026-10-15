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

export function setupForm(today, onSubmit) {
    const form = document.getElementById("outing-form");
    const dateInput = document.getElementById("date");
    const errorElement = document.getElementById("form-error");

    form.noValidate = true;
    dateInput.value = today;
    dateInput.max = today;

    form.addEventListener("submit", (event) => {
        event.preventDefault();

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
        const warning = onSubmit(outing);
        form.reset();
        dateInput.value = today;
        if (warning) errorElement.textContent = warning;
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
        item.textContent =
            `${formatDate(outing.date)} - ${label}, ` +
            `${outing.pitchCount} pitches, effort ${outing.effort}`;
        historyElement.append(item);
    }
}