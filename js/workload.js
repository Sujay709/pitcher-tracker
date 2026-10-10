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