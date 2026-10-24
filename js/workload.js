const YELLOW_THRESHOLD = 2;
const MAX_IMPORT_ROWS = 5000;
const SNAPSHOT_VERSION = 1;
const MAX_SNAPSHOT_LENGTH = 2000;

export const FEELINGS = [
    { value: 1, label: "Fresh" },
    { value: 2, label: "Normal" },
    { value: 3, label: "Tired" },
    { value: 4, label: "Sore" },
    { value: 5, label: "Pain" },
];

export function parseCount(raw) {
    if (raw === null || raw === "") return 0;
    const count = Number(raw);
    return Number.isInteger(count) && count >= 0 && count <= 200 ? count : 0;
}

export function requiredRest(pitchCount, effort, ageGroup, guidelines) {
    const group = guidelines.ageGroups[ageGroup];
    if (!group || !(pitchCount > 0)) return 0;

    const band =
        group.bands.find((b) => pitchCount >= b.min && pitchCount <= b.max) ??
        group.bands[group.bands.length - 1];

    return band.restDays + (effort >= 9 ? 1 : 0);
}

export function countsTowardRest(outing) {
    return (
        outing.type === "game" ||
        outing.type === "liveBP" ||
        (outing.type === "bullpen" && outing.effort >= 6)
    );
}

export function addDays(dateStr, n) {
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + n);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

export function weekAvailability(availableDate, today) {
    return Array.from({ length: 7 }, (_, index) => {
        const date = addDays(today, index);
        return {
            date,
            available: availableDate === null || date >= availableDate,
        };
    });
}

export function todayLocal() {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${month}-${day}`;
}

export function sortOutings(outings) {
    return [...outings].reverse().sort((a, b) => b.date.localeCompare(a.date));
}

const OUTING_TYPES = ["game", "liveBP", "bullpen", "longToss", "catch"];

export function validateOuting(raw, today) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return "Date is required";
    }
    if (!validCalendarDate(raw.date)) return "Date is required";
    if (raw.date > today) return "Date cannot be in the future";

    if (!Number.isInteger(raw.pitchCount) || raw.pitchCount < 1 || raw.pitchCount > 200) {
        return "Pitch count must be between 1 and 200";
    }

    if (!OUTING_TYPES.includes(raw.type)) {
        return "Type must be one of the allowed outing types";
    }

    if (!Number.isInteger(raw.effort) || raw.effort < 1 || raw.effort > 10) {
        return "Effort must be between 1 and 10";
    }

    return null;
}

export function validateCheckin(raw, today) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return "Date is required";
    }
    if (!validCalendarDate(raw.date)) return "Date is required";
    if (raw.date > today) return "Date cannot be in the future";
    if (!Number.isInteger(raw.feeling) || raw.feeling < 1 || raw.feeling > 5) {
        return "Feeling must be an integer from 1 to 5";
    }
    return null;
}

export function upsertCheckin(checkins, checkin) {
    const withoutDate = checkins.filter(({ date }) => date !== checkin.date);
    return [...withoutDate, { ...checkin }];
}

export function latestCheckin(checkins) {
    return checkins.reduce(
        (latest, checkin) =>
            latest === null || checkin.date > latest.date ? checkin : latest,
        null,
    );
}

export function upsertPlayer(roster, incomingPlayer) {
    const existingIndex = roster.findIndex(
        ({ playerId }) => playerId === incomingPlayer.playerId,
    );
    if (existingIndex === -1) return [...roster, { ...incomingPlayer }];

    const existingPlayer = roster[existingIndex];
    if (incomingPlayer.asOf <= existingPlayer.asOf) return [...roster];

    return roster.map((player, index) =>
        index === existingIndex ? { ...incomingPlayer } : player,
    );
}

export function removePlayer(roster, playerId) {
    return roster.filter((player) => player.playerId !== playerId);
}

export function availableOn(snapshot, date) {
    return snapshot.availableDate === null || snapshot.availableDate <= date;
}

export function rosterStatus(snapshot, today) {
    const daysShort =
        snapshot.availableDate === null
            ? 0
            : daysBetween(today, snapshot.availableDate);
    const available = availableOn(snapshot, today);
    return {
        level: available
            ? "green"
            : daysShort <= YELLOW_THRESHOLD
              ? "yellow"
              : "red",
        daysShort,
    };
}

export function staleDays(snapshot, today) {
    return daysBetween(snapshot.asOf, today);
}

export function groupRoster(roster, today) {
    const available = [];
    const checkArmFirst = [];
    const resting = [];

    for (const snapshot of roster) {
        const status = rosterStatus(snapshot, today);
        const hasArmConcern =
            snapshot.checkin?.date === snapshot.asOf &&
            (snapshot.checkin.feeling === 4 || snapshot.checkin.feeling === 5);
        const player = { ...snapshot, status, staleDays: staleDays(snapshot, today) };

        if (hasArmConcern) {
            checkArmFirst.push(player);
        } else if (status.level === "green") {
            available.push(player);
        } else {
            resting.push(player);
        }
    }

    resting.sort(
        (a, b) =>
            a.status.daysShort - b.status.daysShort ||
            a.name.localeCompare(b.name),
    );

    return { available, checkArmFirst, resting };
}

export function checkinRestDate(checkin) {
    return checkin?.feeling === 4 ? addDays(checkin.date, 3) : null;
}

function randomPlayerId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `player-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

export function validCalendarDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    );
}

function snapshotError(message) {
    return { error: message };
}

export function buildSnapshot(
    name,
    teamCode,
    playerId,
    outings,
    checkin,
    ageGroup,
    guidelines,
    today,
) {
    const status = getStatus(outings, ageGroup, guidelines, today, checkin);
    const lastOuting = sortOutings(outings)[0];
    return {
        version: SNAPSHOT_VERSION,
        playerId: playerId || randomPlayerId(),
        name: String(name).trim(),
        teamCode: String(teamCode).trim().toUpperCase(),
        asOf: today,
        availableDate: status.availableDate,
        sevenDayTotal: weeklyPitchTotal(outings, today),
        lastOuting: lastOuting
            ? {
                  date: lastOuting.date,
                  type: lastOuting.type,
                  count: Number(lastOuting.pitchCount),
              }
            : null,
        checkin: checkin
            ? { feeling: checkin.feeling, date: checkin.date }
            : null,
    };
}

function encodeUtf8Base64(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
}

function decodeUtf8Base64(value) {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}

export function encodeSnapshot(snapshot) {
    return encodeUtf8Base64(JSON.stringify(snapshot))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

export function decodeSnapshot(encoded) {
    if (typeof encoded !== "string" || encoded.length === 0) {
        return snapshotError("Snapshot is empty");
    }
    if (encoded.length > MAX_SNAPSHOT_LENGTH) {
        return snapshotError("Snapshot is too large");
    }
    if (!/^[A-Za-z0-9_-]+$/.test(encoded)) {
        return snapshotError("Snapshot is not valid");
    }

    let parsed;
    try {
        const padded = encoded.replace(/-/g, "+").replace(/_/g, "/") +
            "=".repeat((4 - (encoded.length % 4)) % 4);
        parsed = JSON.parse(decodeUtf8Base64(padded));
    } catch {
        return snapshotError("Snapshot is not valid");
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return snapshotError("Snapshot is not valid");
    }
    if (parsed.version !== SNAPSHOT_VERSION) {
        return snapshotError("Unsupported snapshot version");
    }
    if (
        typeof parsed.playerId !== "string" ||
        parsed.playerId.length < 1 ||
        parsed.playerId.length > 100
    ) {
        return snapshotError("Snapshot player ID is invalid");
    }

    const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
    if (name.length < 1 || name.length > 30) {
        return snapshotError("Snapshot name must be 1 to 30 characters");
    }
    const teamCode = typeof parsed.teamCode === "string"
        ? parsed.teamCode.trim().toUpperCase()
        : "";
    if (!/^[A-Z0-9-]{2,12}$/.test(teamCode)) {
        return snapshotError("Snapshot team code is invalid");
    }
    if (!validCalendarDate(parsed.asOf)) {
        return snapshotError("Snapshot as-of date is invalid");
    }
    if (parsed.availableDate !== null && !validCalendarDate(parsed.availableDate)) {
        return snapshotError("Snapshot available date is invalid");
    }
    if (
        !Number.isInteger(parsed.sevenDayTotal) ||
        parsed.sevenDayTotal < 0 ||
        parsed.sevenDayTotal > 1400
    ) {
        return snapshotError("Snapshot total is invalid");
    }

    let lastOuting = null;
    if (parsed.lastOuting !== null) {
        const outing = parsed.lastOuting;
        if (
            !outing ||
            typeof outing !== "object" ||
            !validCalendarDate(outing.date) ||
            typeof outing.type !== "string" ||
            !Number.isInteger(outing.count) ||
            outing.count < 1 ||
            outing.count > 200
        ) {
            return snapshotError("Snapshot last outing is invalid");
        }
        lastOuting = {
            date: outing.date,
            type: outing.type,
            count: outing.count,
        };
    }

    let cleanCheckin = null;
    if (parsed.checkin !== null) {
        const checkinValue = parsed.checkin;
        if (
            !checkinValue ||
            !validCalendarDate(checkinValue.date) ||
            !Number.isInteger(checkinValue.feeling) ||
            checkinValue.feeling < 1 ||
            checkinValue.feeling > 5
        ) {
            return snapshotError("Snapshot check-in is invalid");
        }
        cleanCheckin = {
            feeling: checkinValue.feeling,
            date: checkinValue.date,
        };
    }

    return {
        version: SNAPSHOT_VERSION,
        playerId: parsed.playerId,
        name,
        teamCode,
        asOf: parsed.asOf,
        availableDate: parsed.availableDate,
        sevenDayTotal: parsed.sevenDayTotal,
        lastOuting,
        checkin: cleanCheckin,
    };
}

export function parseImport(rawJson, existingOutings, today = todayLocal()) {
    let parsed;
    try {
        parsed = JSON.parse(rawJson);
    } catch {
        return { error: "Import must be valid JSON" };
    }

    const rows = Array.isArray(parsed) ? parsed : parsed?.outings;
    if (!Array.isArray(rows)) {
        return { error: "Import must be an array or an object with an outings array" };
    }

    const existingIds = new Set(
        existingOutings
            .map((outing) => outing.id)
            .filter((id) => typeof id === "string" && id.length > 0),
    );
    const incomingIds = new Set(
        rows
            .map((row) => row?.id)
            .filter((id) => typeof id === "string" && id.length > 0),
    );
    const imported = [];
    let skipped = Math.max(0, rows.length - MAX_IMPORT_ROWS);

    for (const [index, row] of rows.slice(0, MAX_IMPORT_ROWS).entries()) {
        if (row === null || typeof row !== "object" || Array.isArray(row)) {
            skipped += 1;
            continue;
        }

        const validationError = validateOuting(row, today);
        if (validationError) {
            skipped += 1;
            continue;
        }

        let id = row.id;
        if (id !== undefined && id !== null && id !== "" && typeof id !== "string") {
            skipped += 1;
            continue;
        }
        if (typeof id === "string" && (existingIds.has(id) || imported.some((outing) => outing.id === id))) {
            skipped += 1;
            continue;
        }
        if (id === undefined || id === null || id === "") {
            id = `import-${index + 1}`;
            while (existingIds.has(id) || incomingIds.has(id) || imported.some((outing) => outing.id === id)) {
                id = `${id}-1`;
            }
        }

        imported.push({
            id,
            date: row.date,
            pitchCount: row.pitchCount,
            type: row.type,
            effort: row.effort,
        });
    }

    return { outings: imported, skipped };
}

export function dailyTotals(outings) {
    const days = {};
    for (const outing of outings) {
        if (!countsTowardRest(outing)) continue;
        const day = days[outing.date] ?? { pitches: 0, maxEffort: 0 };
        day.pitches += Number(outing.pitchCount);
        day.maxEffort = Math.max(day.maxEffort, Number(outing.effort));
        days[outing.date] = day;
    }
    return days;
}

export function weeklyPitchTotal(outings, today) {
    const start = addDays(today, -6);
    let total = 0;
    for (const outing of outings) {
        if (
            outing.date >= start &&
            outing.date <= today &&
            countsTowardRest(outing)
        ) {
            total += Number(outing.pitchCount);
        }
    }
    return total;
}

export function availableDate(outings, ageGroup, guidelines) {
    const days = dailyTotals(outings);
    let latest = null;
    for (const date of Object.keys(days)) {
        const { pitches, maxEffort } = days[date];
        const rest = requiredRest(pitches, maxEffort, ageGroup, guidelines);
        const ready = addDays(date, rest + 1);
        if (latest === null || ready > latest) {
            latest = ready;
        }
    }
    return latest;
}

export function daysBetween(fromStr, toStr) {
    if (toStr <= fromStr) return 0;
    const from = new Date(`${fromStr}T00:00:00Z`);
    const to = new Date(`${toStr}T00:00:00Z`);
    return Math.floor((to - from) / 86400000);
}

function overMaxNote(outings, ageGroup, guidelines, today) {
    const group = guidelines.ageGroups[ageGroup];
    if (!group) return "";
    const days = dailyTotals(outings);
    for (const date of Object.keys(days)) {
        if (!(days[date].pitches > group.maxPitches)) continue;
        const rest = requiredRest(days[date].pitches, days[date].maxEffort, ageGroup, guidelines);
        const ready = addDays(date, rest + 1);
        return ` Over the ${group.maxPitches} pitch max for ${ageGroup}.`;
    }
    return "";
}

export function getStatus(outings, ageGroup, guidelines, today, checkin = null) {
    const outingReady = availableDate(outings, ageGroup, guidelines);
    const checkinReady = checkinRestDate(checkin);
    const ready =
        outingReady === null
            ? checkinReady
            : checkinReady === null
              ? outingReady
              : outingReady > checkinReady
                ? outingReady
                : checkinReady;
    if (ready === null) {
        return {
            level: "green",
            availableDate: null,
            daysShort: 0,
            reason: "no recent outings",
        };
    }
    if (today >= ready) {
        return {
            level: "green",
            availableDate: ready,
            daysShort: 0,
            reason: "available to pitch",
            overMax: Boolean(overMaxNote(outings, ageGroup, guidelines, today)),
        };
    }
    const daysShort = daysBetween(today, ready);
    const dayWord = daysShort === 1 ? "day" : "days";
    const reason =
        `available ${ready.slice(5)}, ${daysShort} ${dayWord} to go.` +
        overMaxNote(outings, ageGroup, guidelines, today);
    return {
        level: daysShort <= YELLOW_THRESHOLD ? "yellow" : "red",
        availableDate: ready,
        daysShort,
        reason,
        overMax: Boolean(overMaxNote(outings, ageGroup, guidelines, today)),
    };
}