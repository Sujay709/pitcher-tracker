import { parseCount } from "./workload.js";

const STORAGE_KEY = "pitcherTracker.outings";
const CHECKINS_STORAGE_KEY = "pitcherTracker.checkins";
const AGE_GROUP_STORAGE_KEY = "pitcherTracker.ageGroup";
const COUNT_STORAGE_KEY = "pitcherTracker.count";

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

export function loadCheckins() {
    try {
        const raw = localStorage.getItem(CHECKINS_STORAGE_KEY);
        if (raw === null) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        console.error("Could not read saved check-ins:", err);
        return [];
    }
}

export function saveCheckins(checkins) {
    localStorage.setItem(CHECKINS_STORAGE_KEY, JSON.stringify(checkins));
}

export function loadAgeGroup(validGroups) {
    try {
        const storedGroup = localStorage.getItem(AGE_GROUP_STORAGE_KEY);
        return validGroups.includes(storedGroup) ? storedGroup : "15-16";
    } catch (err) {
        console.error("Could not read saved age group:", err);
        return "15-16";
    }
}

export function saveAgeGroup(group) {
    localStorage.setItem(AGE_GROUP_STORAGE_KEY, group);
}

export function loadCount() {
    try {
        return parseCount(localStorage.getItem(COUNT_STORAGE_KEY));
    } catch (err) {
        console.error("Could not read saved count:", err);
        return 0;
    }
}

export function saveCount(count) {
    localStorage.setItem(COUNT_STORAGE_KEY, String(count));
}

export function clearCount() {
    localStorage.removeItem(COUNT_STORAGE_KEY);
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