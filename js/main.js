import {
    addOuting,
    deleteOuting,
    loadAgeGroup,
    loadOutings,
    saveAgeGroup,
} from "./storage.js";
import { getStatus, sortOutings, todayLocal, weeklyPitchTotal } from "./workload.js";
import {
    renderHistory,
    renderStatus,
    renderWeeklyTotal,
    setupAgeGroup,
    setupExport,
    setupForm,
    setupHistory,
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

    function refresh() {
        const outings = loadOutings();
        const today = todayLocal();
        renderStatus(getStatus(outings, ageGroup, guidelines, today));
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
    setupExport(() => loadOutings());
    refresh();
}