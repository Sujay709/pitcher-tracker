const STORAGE_KEY = "pitcherTracker.outings";

export function loadOutings() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw === null) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        console.error("Could not read saved outings:", err);
        return [];
    }
}

export function saveOutings(outings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(outings));
}

export function addOuting(outing) {
    const outings = loadOutings();
    const newOuting = { ...outing, id: crypto.randomUUID() };
    outings.push(newOuting);
    saveOutings(outings);
    return newOuting;
}

export function deleteOuting(id) {
    const remaining = loadOutings().filter((o) => o.id !== id);
    saveOutings(remaining);
}