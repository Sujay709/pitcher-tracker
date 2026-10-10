import { loadOutings, addOuting } from "./storage.js";
import { requiredRest, addDays, availableDate } from "./workload.js";

function todayLocal() {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${month}-${day}`;
}

const RUN_ADD_TEST = false;

if (RUN_ADD_TEST) {
    const saved = addOuting({
        date: todayLocal(),
        pitchCount: 40,
        type: "game",
        effort: 7,
    });
    console.log("Added:", saved);
}

const outings = loadOutings();
console.log("Loaded:", outings);

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
    console.log("15-16 max pitches:", guidelines.ageGroups["15-16"].maxPitches);


    const tests = [
        [30, 5, "15-16", 0],
        [31, 5, "15-16", 1],
        [45, 8, "15-16", 1],
        [45, 9, "15-16", 2],
        [150, 5, "15-16", 4],
        [0, 5, "15-16", 0],
        [40, 5, "99", 0],
    ];

    for (const [pitches, effort, group, expected] of tests) {
        const result = requiredRest(pitches, effort, group, guidelines);
        const status = result === expected ? "PASS" : "FAIL";
        console.log(`${status}: ${pitches} pitches, effort ${effort}, ${group} -> ${result} (expected ${expected})`);
    }
}

const dateTests = [
    ["2026-10-09", 0, "2026-10-09"],
    ["2026-10-09", 3, "2026-10-12"],
    ["2026-10-30", 3, "2026-11-02"],
    ["2026-12-30", 3, "2027-01-02"],
    ["2026-03-07", 2, "2026-03-09"],
];

for (const [dateStr, n, expected] of dateTests) {
    const result = addDays(dateStr, n);
    const status = result === expected ? "PASS" : "FAIL";
    console.log(`${status}: addDays(${dateStr}, ${n}) -> ${result} (expected ${expected})`);
}

if (guidelines) {
    const availableTests = [
        {
            name: "no counting outings",
            outings: [
                { date: "2026-10-09", pitchCount: 40, type: "bullpen", effort: 4 },
            ],
            expected: null,
        },
        {
            name: "same-day outings sum",
            outings: [
                { date: "2026-10-09", pitchCount: 20, type: "game", effort: 5 },
                { date: "2026-10-09", pitchCount: 20, type: "game", effort: 7 },
            ],
            expected: "2026-10-11",
        },
        {
            name: "latest of two days",
            outings: [
                { date: "2026-10-01", pitchCount: 80, type: "game", effort: 5 },
                { date: "2026-10-09", pitchCount: 30, type: "game", effort: 5 },
            ],
            expected: "2026-10-10",
        },
    ];

    for (const { name, outings: fakeOutings, expected } of availableTests) {
        const result = availableDate(fakeOutings, "15-16", guidelines);
        const status = result === expected ? "PASS" : "FAIL";
        console.log(`${status}: availableDate ${name} -> ${result} (expected ${expected})`);
    }
}