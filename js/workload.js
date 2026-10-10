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