import { addOuting, loadOutings } from "./storage.js";
import { getStatus, todayLocal } from "./workload.js";
import { renderStatus, setupForm } from "./ui.js";
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
    const ageGroup = "15-16";
    const today = todayLocal();

    function refresh() {
        renderStatus(getStatus(loadOutings(), ageGroup, guidelines, todayLocal()));
    }

    if (RUN_TESTS) {
        runTests(guidelines);
    }

    setupForm(today, (outing) => {
        addOuting(outing);
        refresh();

        const maxPitches = guidelines.ageGroups[ageGroup].maxPitches;
        return outing.pitchCount > maxPitches
            ? `Warning: this exceeds the ${maxPitches}-pitch max for the ${ageGroup} age group.`
            : null;
    });
    refresh();
}