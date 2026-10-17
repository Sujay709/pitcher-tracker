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
    setupForm,
    setupHistory,
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
    const ageGroupSelect = document.getElementById("age-group");
    const validGroups = Object.keys(guidelines.ageGroups);
    let ageGroup = loadAgeGroup(validGroups);
    ageGroupSelect.value = ageGroup;
    const today = todayLocal();

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

    ageGroupSelect.addEventListener("change", () => {
        ageGroup = ageGroupSelect.value;
        saveAgeGroup(ageGroup);
        refresh();
    });

    setupForm(today, (outing) => {
        try {
            addOuting(outing);
        } catch (error) {
            console.error("Could not save outing:", error);
            return {
                message: "This outing could not be saved. Please try again.",
                saved: false,
            };
        }

        refresh();

        const maxPitches = guidelines.ageGroups[ageGroup].maxPitches;
        return {
            message:
                outing.pitchCount > maxPitches
                    ? `Warning: this exceeds the ${maxPitches}-pitch max for the ${ageGroup} age group.`
                    : null,
            saved: true,
        };
    });
    setupHistory((id) => {
        deleteOuting(id);
        refresh();
    });
    refresh();
}