const YELLOW_THRESHOLD = 2;
const MAX_IMPORT_ROWS = 5000;

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
    if (!raw.date) return "Date is required";
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
    if (!raw || !raw.date) return "Date is required";
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
    let current = fromStr;
    let count = 0;
    while (current !== toStr && count < 60) {
        current = addDays(current, 1);
        count += 1;
    }
    return count;
}

function overMaxNote(outings, ageGroup, guidelines, today) {
    const group = guidelines.ageGroups[ageGroup];
    if (!group) return "";
    const days = dailyTotals(outings);
    for (const date of Object.keys(days)) {
        if (!(days[date].pitches > group.maxPitches)) continue;
        const rest = requiredRest(days[date].pitches, days[date].maxEffort, ageGroup, guidelines);
        const ready = addDays(date, rest + 1);
        if (today < ready) {
            return ` Over the ${group.maxPitches} pitch max for ${ageGroup}.`;
        }
    }
    return "";
}

export function getStatus(outings, ageGroup, guidelines, today) {
    const ready = availableDate(outings, ageGroup, guidelines);
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
    };
}