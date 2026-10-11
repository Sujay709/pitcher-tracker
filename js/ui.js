export function formatDate(dateStr) {
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
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