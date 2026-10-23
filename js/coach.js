import {
    decodeSnapshot,
    groupRoster,
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
let pendingSnapshot = null;

function todayLocal() {
    const date = new Date();
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
    ].join("-");
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
    const labels = [
        ["available", "Available"],
        ["checkArmFirst", "Check arm first"],
        ["resting", "Resting"],
    ];
    for (const [key, label] of labels) {
        const heading = document.createElement("h3");
        heading.textContent = label;
        const list = document.createElement("ul");
        list.className = "roster-list";
        for (const player of groups[key]) {
            const item = document.createElement("li");
            const name = document.createElement("strong");
            name.textContent = player.name;
            const status = document.createElement("span");
            status.textContent = key === "resting"
                ? `${player.status.daysShort} days to go`
                : key === "checkArmFirst"
                  ? "Check arm first"
                  : "Ready";
            item.append(name, status);
            list.append(item);
        }
        if (groups[key].length === 0) {
            const empty = document.createElement("li");
            empty.textContent = "None";
            list.append(empty);
        }
        rosterGroups.append(heading, list);
    }
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
    pendingSnapshot = snapshot;
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
    saveCoachTeamCode(code);
    teamInput.value = code.toUpperCase();
    teamStatus.textContent = "Team code saved on this device.";
    if (pendingSnapshot) previewSnapshot(pendingSnapshot);
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
    saveRoster(upsertPlayer(loadRoster(), pendingSnapshot));
    showMessage(`${pendingSnapshot.name} was added to the roster.`);
    confirmation.hidden = true;
    pendingSnapshot = null;
    renderRoster();
});

document.getElementById("cancel-snapshot").addEventListener("click", () => {
    pendingSnapshot = null;
    confirmation.hidden = true;
    showMessage("Snapshot was not added.");
});

teamInput.value = loadCoachTeamCode();
const initialEncoded = window.location.hash.slice(1);
if (initialEncoded) {
    const initialSnapshot = decodeSnapshot(initialEncoded);
    clearHash();
    previewSnapshot(initialSnapshot);
} else {
    showMessage("Paste a shared link or snapshot code to preview it.");
}
renderRoster();
