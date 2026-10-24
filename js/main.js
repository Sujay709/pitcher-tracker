import {
    addOuting,
    clearCount,
    deleteOuting,
    loadAgeGroup,
    loadCheckins,
    loadCount,
    loadOutings,
    saveAgeGroup,
    saveCheckins,
    saveCount,
    saveOutings,
    loadProfile,
    loadOrCreatePlayerId,
    saveProfile,
} from "./storage.js";
import {
    getStatus,
    countsTowardRest,
    parseImport,
    sortOutings,
    todayLocal,
    buildSnapshot,
    encodeSnapshot,
    upsertCheckin,
    weeklyPitchTotal,
} from "./workload.js";
import {
    renderHistory,
    renderAvailabilityStrip,
    renderCheckin,
    renderCounter,
    renderStatus,
    renderWeeklyTotal,
    setupAgeGroup,
    setupExport,
    setupForm,
    setupHistory,
    setupCheckin,
    setupImport,
    setupCounter,
    setupShare,
    setupThemeToggle,
} from "./ui.js";
import { runTests } from "./tests.js";

const RUN_TESTS = false;

let guidelines;
try {
    const response = await fetch("data/guidelines.json");
    if (!response.ok) {
        throw new Error(`Failed to load guidelines: ${response.status}`);
    }
    guidelines = await response.json();
} catch (error) {
    console.error("Error loading guidelines:", error);
}

if (guidelines) {
    setupThemeToggle();
    const validGroups = Object.keys(guidelines.ageGroups);
    let ageGroup = loadAgeGroup(validGroups);
    let count = loadCount();
    let profile = loadProfile();
    const playerId = loadOrCreatePlayerId();

    function renderSavedCount() {
        renderCounter(count);
    }

    setupCounter(
        {
            getCount: () => count,
            onAdd: () => {
                count = Math.min(200, count + 1);
                saveCount(count);
                renderSavedCount();
            },
            onUndo: () => {
                count = Math.max(0, count - 1);
                saveCount(count);
                renderSavedCount();
            },
            onSave: () => {
                const pitchCountInput = document.getElementById("pitch-count");
                pitchCountInput.value = String(count);
                const form = document.getElementById("outing-form");
                form.scrollIntoView({ behavior: "smooth", block: "start" });
                document.getElementById("effort").focus();
            },
            onReset: () => {
                if (!confirm("Reset the pitch counter?")) return;
                count = 0;
                clearCount();
                renderSavedCount();
            },
        },
        renderSavedCount,
    );

    function refresh() {
        const outings = loadOutings();
        const today = todayLocal();
        const checkins = loadCheckins();
        const todayCheckin = checkins.find(({ date }) => date === today) ?? null;
        const status = getStatus(
            outings,
            ageGroup,
            guidelines,
            today,
            todayCheckin,
        );
        renderStatus(status);
        renderAvailabilityStrip(status.availableDate, today);
        renderCheckin(todayCheckin);
        renderWeeklyTotal(weeklyPitchTotal(outings, today));
        renderHistory(sortOutings(outings));
    }

    let refreshTimer;
    function scheduleRefresh() {
        clearTimeout(refreshTimer);
        const now = new Date();
        const nextDay = new Date(now);
        nextDay.setHours(24, 0, 0, 0);
        refreshTimer = setTimeout(() => {
            refresh();
            scheduleRefresh();
        }, nextDay - now);
    }

    if (RUN_TESTS) {
        runTests(guidelines);
    }

    setupAgeGroup(ageGroup, (nextAgeGroup) => {
        ageGroup = nextAgeGroup;
        try {
            saveAgeGroup(ageGroup);
        } catch (error) {
            console.error("Could not save age group:", error);
        }
        refresh();
    });

    setupForm(todayLocal, (outing) => {
        try {
            addOuting(outing);
        } catch (error) {
            console.error("Could not save outing:", error);
            return {
                message: "Error: This outing could not be saved. Please try again.",
                kind: "error",
                saved: false,
            };
        }

        refresh();
        count = 0;
        clearCount();
        renderSavedCount();

        const maxPitches = guidelines.ageGroups[ageGroup].maxPitches;
        const dailyTotal = loadOutings()
            .filter(({ date, ...savedOuting }) =>
                date === outing.date && countsTowardRest({ date, ...savedOuting }),
            )
            .reduce((total, savedOuting) => total + savedOuting.pitchCount, 0);
        return {
            message:
                dailyTotal > maxPitches
                    ? `Warning: this exceeds the ${maxPitches}-pitch max for the ${ageGroup} age group.`
                    : `Logged ${outing.pitchCount} pitches.`,
            kind: dailyTotal > maxPitches ? "warning" : "success",
            saved: true,
        };
    });
    setupHistory((id) => {
        try {
            deleteOuting(id);
            refresh();
        } catch (error) {
            console.error("Could not delete outing:", error);
            return { error };
        }
        return null;
    });
    setupCheckin(todayLocal, (checkin) => {
        try {
            saveCheckins(upsertCheckin(loadCheckins(), checkin));
            refresh();
            return {};
        } catch (error) {
            return { error };
        }
    });
    setupExport(() => loadOutings());
    setupShare({
        profile,
        getSnapshot: () =>
            buildSnapshot(
                profile.displayName,
                profile.teamCode,
                playerId,
                loadOutings(),
                loadCheckins().find(({ date }) => date === todayLocal()) ?? null,
                ageGroup,
                guidelines,
                todayLocal(),
            ),
        getShareUrl: (snapshot) =>
            `${new URL("coach.html", window.location.href).href}#${encodeSnapshot(snapshot)}`,
        onProfileSave: ({ displayName, teamCode }) => {
            try {
                saveProfile({ displayName, teamCode });
                profile = { ...profile, displayName, teamCode };
            } catch (error) {
                console.error("Could not save profile:", error);
                throw error;
            }
        },
    });
    setupImport((rawJson) => {
        const existingOutings = loadOutings();
        const result = parseImport(rawJson, existingOutings, todayLocal());
        if (result.error) {
            return { message: `Error: ${result.error}`, kind: "error" };
        }
        if (!window.confirm(
            `Add ${result.outings.length} imported ${
                result.outings.length === 1 ? "outing" : "outings"
            } to your existing history?`,
        )) {
            return { message: "Import cancelled.", kind: "warning" };
        }

        try {
            saveOutings([...existingOutings, ...result.outings]);
        } catch (error) {
            console.error("Could not save imported outings:", error);
            return {
                message: "Error: Imported outings could not be saved. Please try again.",
                kind: "error",
            };
        }
        refresh();
        const importedWord = result.outings.length === 1 ? "outing" : "outings";
        const skippedWord = result.skipped === 1 ? "row" : "rows";
        return {
            message: `Imported ${result.outings.length} ${importedWord}; skipped ${result.skipped} ${skippedWord}.`,
            kind: "success",
        };
    });
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("pageshow", refresh);
    refresh();
    scheduleRefresh();
}