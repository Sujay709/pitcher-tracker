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
} from "./storage.js";
import {
    getStatus,
    parseImport,
    sortOutings,
    todayLocal,
    latestCheckin,
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
            latestCheckin(checkins),
        );
        renderStatus(status);
        renderAvailabilityStrip(status.availableDate, today);
        renderCheckin(todayCheckin);
        renderWeeklyTotal(weeklyPitchTotal(outings, today));
        renderHistory(sortOutings(outings));
    }

    if (RUN_TESTS) {
        runTests(guidelines);
    }

    setupAgeGroup(ageGroup, (nextAgeGroup) => {
        ageGroup = nextAgeGroup;
        saveAgeGroup(ageGroup);
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
        return {
            message:
                outing.pitchCount > maxPitches
                    ? `Warning: this exceeds the ${maxPitches}-pitch max for the ${ageGroup} age group.`
                    : `Logged ${outing.pitchCount} pitches.`,
            kind: outing.pitchCount > maxPitches ? "warning" : "success",
            saved: true,
        };
    });
    setupHistory((id) => {
        deleteOuting(id);
        refresh();
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
    setupImport((rawJson) => {
        const existingOutings = loadOutings();
        const result = parseImport(rawJson, existingOutings, todayLocal());
        if (result.error) {
            return { message: `Error: ${result.error}`, kind: "error" };
        }

        saveOutings([...existingOutings, ...result.outings]);
        refresh();
        const importedWord = result.outings.length === 1 ? "outing" : "outings";
        const skippedWord = result.skipped === 1 ? "row" : "rows";
        return {
            message: `Imported ${result.outings.length} ${importedWord}; skipped ${result.skipped} ${skippedWord}.`,
            kind: "success",
        };
    });
    refresh();
}