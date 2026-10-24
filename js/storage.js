import {
    parseCount,
    todayLocal,
    validCalendarDate,
    validateCheckin,
    validateOuting,
} from "./workload.js";

const STORAGE_KEY = "pitcherTracker.outings";
const CHECKINS_STORAGE_KEY = "pitcherTracker.checkins";
const AGE_GROUP_STORAGE_KEY = "pitcherTracker.ageGroup";
const COUNT_STORAGE_KEY = "pitcherTracker.count";
const DISPLAY_NAME_STORAGE_KEY = "pitcherTracker.displayName";
const TEAM_CODE_STORAGE_KEY = "pitcherTracker.teamCode";
const PLAYER_ID_STORAGE_KEY = "pitcherTracker.playerId";
const ROSTER_STORAGE_KEY = "pitcherTracker.roster";
const COACH_TEAM_CODE_STORAGE_KEY = "pitcherTracker.coachTeamCode";

export function loadOutings() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw === null) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed)
            ? parsed.filter((outing) => !validateOuting(outing, todayLocal()))
            : [];
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
        return Array.isArray(parsed)
            ? parsed.filter((checkin) => !validateCheckin(checkin, todayLocal()))
            : [];
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

export function loadProfile() {
    try {
        return {
            displayName: localStorage.getItem(DISPLAY_NAME_STORAGE_KEY) ?? "",
            teamCode: localStorage.getItem(TEAM_CODE_STORAGE_KEY) ?? "",
            playerId: localStorage.getItem(PLAYER_ID_STORAGE_KEY) ?? "",
        };
    } catch (err) {
        console.error("Could not read saved profile:", err);
        return { displayName: "", teamCode: "", playerId: "" };
    }
}

export function saveProfile({ displayName, teamCode }) {
    localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, displayName.trim());
    localStorage.setItem(TEAM_CODE_STORAGE_KEY, teamCode.trim().toUpperCase());
}

export function loadOrCreatePlayerId() {
    try {
        const saved = localStorage.getItem(PLAYER_ID_STORAGE_KEY);
        if (saved) return saved;
        const playerId = globalThis.crypto?.randomUUID
            ? globalThis.crypto.randomUUID()
            : `player-${Math.random().toString(36).slice(2)}-${Date.now()}`;
        localStorage.setItem(PLAYER_ID_STORAGE_KEY, playerId);
        return playerId;
    } catch (err) {
        console.error("Could not read or save player ID:", err);
        return `player-${Math.random().toString(36).slice(2)}-${Date.now()}`;
    }
}

export function loadRoster() {
    try {
        const raw = localStorage.getItem(ROSTER_STORAGE_KEY);
        if (raw === null) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed)
            ? parsed.filter((player) =>
                  player &&
                  typeof player === "object" &&
                  typeof player.playerId === "string" &&
                  player.playerId.length > 0 &&
                  typeof player.name === "string" &&
                  player.name.length > 0 &&
                  typeof player.teamCode === "string" &&
                  validCalendarDate(player.asOf) &&
                  (player.availableDate === null ||
                      validCalendarDate(player.availableDate)) &&
                  Number.isInteger(player.sevenDayTotal) &&
                  player.sevenDayTotal >= 0 &&
                  player.sevenDayTotal <= 1400 &&
                  (player.checkin === null ||
                      !validateCheckin(player.checkin, todayLocal())),
              )
            : [];
    } catch (err) {
        console.error("Could not read saved roster:", err);
        return [];
    }
}

export function saveRoster(roster) {
    localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(roster));
}

export function loadCoachTeamCode() {
    try {
        return localStorage.getItem(COACH_TEAM_CODE_STORAGE_KEY) ?? "";
    } catch (err) {
        console.error("Could not read saved coach team code:", err);
        return "";
    }
}

export function saveCoachTeamCode(teamCode) {
    localStorage.setItem(COACH_TEAM_CODE_STORAGE_KEY, teamCode.trim().toUpperCase());
}

export function addOuting(outing) {
    const outings = loadOutings();
    const id = globalThis.crypto?.randomUUID
        ? globalThis.crypto.randomUUID()
        : `outing-${Math.random().toString(36).slice(2)}-${Date.now()}`;
    const newOuting = { ...outing, id };
    outings.push(newOuting);
    saveOutings(outings);
    return newOuting;
}

export function deleteOuting(id) {
    const remaining = loadOutings().filter((o) => o.id !== id);
    saveOutings(remaining);
}