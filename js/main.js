import { loadOutings } from "./storage.js";
import { getStatus, todayLocal } from "./workload.js";
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
    if (RUN_TESTS) {
        runTests(guidelines);
    }
    console.log("Status:", getStatus(loadOutings(), "15-16", guidelines, todayLocal()));
}