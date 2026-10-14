const YELLOW_THRESHOLD = 2;

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