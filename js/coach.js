import {
    addDays,
    availableOn,
    decodeSnapshot,
    groupRoster,
    removePlayer,
    refreshSnapshot,
    upsertPlayer,
} from "./workload.js?coach=1";
import {
    loadCoachTeamCode,
    loadRoster,
    saveCoachTeamCode,
    saveRoster,
} from "./storage.js?coach=1";

const TEAM_CODE_PATTERN = /^[A-Za-z0-9-]{2,12}$/;
const message = document.getElementById("snapshot-message");
const details = document.getElementById("snapshot-details");
const confirmation = document.getElementById("snapshot-confirm");
const confirmationText = document.getElementById("snapshot-confirmation");
const teamWarning = document.getElementById("team-warning");
const teamInput = document.getElementById("coach-team-code");
const teamStatus = document.getElementById("coach-team-status");
const snapshotInput = document.getElementById("snapshot-input");
const rosterGroups = document.getElementById("roster-groups");
const plannerDate = document.getElementById("planner-date");
const plannerResults = document.getElementById("planner-results");
let pendingSnapshot = null;
const guidelines = await fetch("data/guidelines.json").then((response) => {
    if (!response.ok) throw new Error(`Failed to load guidelines: ${response.status}`);
    return response.json();
});

function todayLocal() {
    const date = new Date();
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
    ].join("-");
}

function armFeelingLabel(feeling) {
    return {
        1: "Fresh",
        2: "Normal",
        3: "Tired",
        4: "Sore",
        5: "Pain",
    }[feeling] ?? "Not reported";
}

function appendDetail(parent, label, value) {
    const row = document.createElement("p");
    const labelElement = document.createElement("strong");
    labelElement.textContent = `${label}: `;
    row.append(labelElement, document.createTextNode(String(value)));
    parent.append(row);
}

function createPlayerCard(player, groupKey) {
    const card = document.createElement("article");
    card.className = "roster-card";

    const heading = document.createElement("h4");
    heading.textContent = player.name;
    card.append(heading);

    const status = document.createElement("p");
    status.className = `roster-card-status roster-card-status-${player.status.level}`;
    status.textContent = groupKey === "checkArmFirst"
        ? "Check arm first"
        : player.status.level === "unknown"
          ? "Update needed"
        : player.status.level === "green"
          ? "Ready to pitch"
          : player.status.level === "yellow"
            ? `${player.status.daysShort} ${player.status.daysShort === 1 ? "day" : "days"} to go`
            : `Resting, ${player.status.daysShort} ${player.status.daysShort === 1 ? "day" : "days"} to go`;
    card.append(status);

    appendDetail(card, "Available date", player.availableDate ?? "Today");
    appendDetail(card, "7-day total", `${player.sevenDayTotal} pitches`);
    appendDetail(
        card,
        "Last outing",
        player.lastOuting
            ? `${player.lastOuting.date}, ${player.lastOuting.type}, ${player.lastOuting.count} pitches`
            : "None",
    );
    appendDetail(
        card,
        "Arm check-in",
        player.checkin
            ? `${armFeelingLabel(player.checkin.feeling)} (${player.checkin.date})`
            : "Not reported",
    );

    const updated = document.createElement("span");
    updated.className = "stale-badge";
    if (player.staleDays >= 1) updated.classList.add("stale-badge-warning");
    if (player.staleDays >= 2) updated.classList.add("stale-badge-old");
    updated.textContent = `Last updated ${player.staleDays} ${
        player.staleDays === 1 ? "day" : "days"
    } ago`;
    card.append(updated);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "roster-remove";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", () => {
        if (!window.confirm(`Remove ${player.name} from the roster?`)) return;
        try {
            saveRoster(removePlayer(loadRoster(), player.playerId));
            renderRoster();
        } catch (error) {
            console.error("Could not remove player from roster:", error);
            showMessage("Could not update the roster. Please try again.", "error");
        }
    });
    card.append(removeButton);
    return card;
}

function showMessage(text, kind = "") {
    message.textContent = text;
    if (kind) message.dataset.kind = kind;
    else message.removeAttribute("data-kind");
}

function renderDetails(snapshot) {
    details.textContent = "";
    const rows = [
        ["Name", snapshot.name],
        ["Team", snapshot.teamCode],
        ["As of", snapshot.asOf],
        ["Available date", snapshot.availableDate ?? "Today"],
        ["Pitches in the last 7 days", snapshot.sevenDayTotal],
        ["Last outing", snapshot.lastOuting
            ? `${snapshot.lastOuting.date}, ${snapshot.lastOuting.type}, ${snapshot.lastOuting.count} pitches`
            : "None"],
        ["Latest arm check-in", snapshot.checkin
            ? `${snapshot.checkin.date}, feeling ${snapshot.checkin.feeling}/5`
            : "None"],
    ];
    for (const [label, value] of rows) {
        const term = document.createElement("dt");
        term.textContent = label;
        const description = document.createElement("dd");
        description.textContent = String(value);
        details.append(term, description);
    }
    details.hidden = false;
}

function renderRoster() {
    const groups = groupRoster(loadRoster(), todayLocal());
    rosterGroups.textContent = "";
    const roster = Object.values(groups).flat();
    if (roster.length === 0) {
        const empty = document.createElement("p");
        empty.textContent =
            "No players yet. Ask players to create an update link and send it to you.";
        rosterGroups.append(empty);
        renderPlanner();
        return;
    }
    const labels = [
        ["available", "Available"],
        ["checkArmFirst", "Check arm first"],
        ["resting", "Resting"],
    ];
    for (const [key, label] of labels) {
        const group = groups[key];
        if (!group || group.length === 0) {
            if (groups[key] && groups[key].length === 0) {
                const heading = document.createElement("h3");
                heading.textContent = label;
                const list = document.createElement("div");
                list.className = "roster-list";
                const empty = document.createElement("p");
                empty.className = "roster-empty";
                empty.textContent = "None";
                list.append(empty);
                rosterGroups.append(heading, list);
            }
            continue;
        }
        const heading = document.createElement("h3");
        heading.textContent = `${label} (${group.length})`;
        const list = document.createElement("div");
        list.className = "roster-list";
        for (const player of group) {
            list.append(createPlayerCard(player, key));
        }
        rosterGroups.append(heading, list);
    }
    renderPlanner();
}

function renderPlanner() {
    const roster = loadRoster();
    plannerResults.textContent = "";
    if (roster.length === 0) {
        const empty = document.createElement("p");
        empty.textContent =
            "No players yet. Ask players to create an update link and send it to you.";
        plannerResults.append(empty);
        return;
    }
    const updatedNote = document.createElement("p");
    updatedNote.className = "field-hint";
    updatedNote.textContent = "Availability is based on each player's last update.";
    plannerResults.append(updatedNote);
    const list = document.createElement("ul");
    list.className = "planner-list";
    for (const player of roster.sort((a, b) => a.name.localeCompare(b.name))) {
        const item = document.createElement("li");
        const name = document.createElement("strong");
        name.textContent = player.name;
        const result = document.createElement("span");
        const available = availableOn(player, plannerDate.value);
        result.textContent = available ? "Available" : "Not available";
        result.className = available ? "planner-available" : "planner-unavailable";
        item.append(name, result);
        list.append(item);
    }
    plannerResults.append(list);
}

function clearHash() {
    if (window.location.hash) {
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
}

function decodeInput(value) {
    const raw = value.trim();
    if (!raw) return { error: "Paste a full link or snapshot code." };
    let encoded = raw;
    try {
        encoded = raw.includes("#") ? new URL(raw).hash.slice(1) : raw;
    } catch {
        return { error: "That does not look like a valid link or snapshot code." };
    }
    return decodeSnapshot(encoded);
}

function previewSnapshot(snapshot) {
    if (snapshot.error) {
        showMessage(snapshot.error, "error");
        confirmation.hidden = true;
        details.hidden = true;
        return;
    }
    pendingSnapshot = refreshSnapshot(snapshot, guidelines, todayLocal());
    renderDetails(snapshot);
    confirmationText.textContent = `Add ${snapshot.name} to roster?`;
    const coachTeamCode = loadCoachTeamCode();
    teamWarning.hidden = !coachTeamCode || coachTeamCode === snapshot.teamCode;
    teamWarning.textContent = `This snapshot is for team ${snapshot.teamCode}, but your saved team code is ${coachTeamCode}.`;
    confirmation.hidden = false;
    showMessage(`Review the snapshot before adding ${snapshot.name}.`);
}

document.getElementById("coach-team-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const code = teamInput.value.trim();
    if (!TEAM_CODE_PATTERN.test(code)) {
        teamStatus.textContent = "Enter a team code using 2-12 letters, numbers, or hyphens.";
        return;
    }
    try {
        saveCoachTeamCode(code);
        teamInput.value = code.toUpperCase();
        teamStatus.textContent = "Team code saved on this device.";
        if (pendingSnapshot) previewSnapshot(pendingSnapshot);
    } catch (error) {
        console.error("Could not save coach team code:", error);
        teamStatus.textContent = "Could not save the team code. Please try again.";
    }
});

document.getElementById("load-snapshot").addEventListener("click", () => {
    previewSnapshot(decodeInput(snapshotInput.value));
});

document.getElementById("add-snapshot").addEventListener("click", () => {
    if (!pendingSnapshot) return;
    const coachTeamCode = loadCoachTeamCode();
    if (
        coachTeamCode &&
        coachTeamCode !== pendingSnapshot.teamCode &&
        !window.confirm(`Team code differs (${pendingSnapshot.teamCode} vs ${coachTeamCode}). Add anyway?`)
    ) {
        return;
    }
    try {
        saveRoster(upsertPlayer(loadRoster(), pendingSnapshot));
        showMessage(`${pendingSnapshot.name} was added to the roster.`);
        confirmation.hidden = true;
        pendingSnapshot = null;
        renderRoster();
    } catch (error) {
        console.error("Could not save roster:", error);
        showMessage("Could not save the roster. Please try again.", "error");
    }
});

document.getElementById("cancel-snapshot").addEventListener("click", () => {
    pendingSnapshot = null;
    confirmation.hidden = true;
    showMessage("Snapshot was not added.");
});

teamInput.value = loadCoachTeamCode();
plannerDate.value = addDays(todayLocal(), 1);
plannerDate.addEventListener("change", renderPlanner);
const initialEncoded = window.location.hash.slice(1);
if (initialEncoded) {
    const initialSnapshot = decodeSnapshot(initialEncoded);
    clearHash();
    previewSnapshot(initialSnapshot);
} else {
    showMessage("Paste a player's update link to review it before adding them.");
}
renderRoster();
