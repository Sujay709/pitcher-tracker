import { loadOutings, addOuting } from "./storage.js";
import { requiredRest, addDays, availableDate, daysBetween, getStatus } from "./workload.js";

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

const daysBetweenTests = [
    ["2026-10-09", "2026-10-09", 0],
    ["2026-10-09", "2026-10-12", 3],
    ["2026-10-30", "2026-11-02", 3],
    ["2026-12-30", "2027-01-02", 3],
    ["2026-10-12", "2026-10-09", 0],
];

for (const [fromStr, toStr, expected] of daysBetweenTests) {
    const result = daysBetween(fromStr, toStr);
    const status = result === expected ? "PASS" : "FAIL";
    console.log(`${status}: daysBetween(${fromStr}, ${toStr}) -> ${result} (expected ${expected})`);
}

if (guidelines) {
    const game40 = [{ date: "2026-10-09", pitchCount: 40, type: "game", effort: 5 }];
    const game70 = [{ date: "2026-10-09", pitchCount: 70, type: "game", effort: 5 }];
    const gameOver = [{ date: "2026-10-09", pitchCount: 110, type: "game", effort: 5 }];

    const statusTests = [
        {
            name: "no outings",
            outings: [],
            today: "2026-10-09",
            expected: { level: "green", availableDate: null, daysShort: 0 },
        },
        {
            name: "40-pitch game today",
            outings: game40,
            today: "2026-10-09",
            expected: { level: "yellow", availableDate: "2026-10-11", daysShort: 2 },
        },
        {
            name: "70-pitch game today",
            outings: game70,
            today: "2026-10-09",
            expected: { level: "red", availableDate: "2026-10-13", daysShort: 4 },
        },
        {
            name: "70-pitch checked 2 days later",
            outings: game70,
            today: "2026-10-11",
            expected: { level: "yellow", availableDate: "2026-10-13", daysShort: 2 },
        },
        {
            name: "checked on available date",
            outings: game70,
            today: "2026-10-13",
            expected: { level: "green", availableDate: "2026-10-13", daysShort: 0 },
        },
        {
            name: "over max still uses rest for level",
            outings: gameOver,
            today: "2026-10-09",
            expected: { level: "red", availableDate: "2026-10-14", daysShort: 5 },
            reasonIncludes: "over the 95 pitch max for 15-16",
        },
    ];

    for (const { name, outings: fakeOutings, today, expected, reasonIncludes } of statusTests) {
        const result = getStatus(fakeOutings, "15-16", guidelines, today);
        const pass =
            result.level === expected.level &&
            result.availableDate === expected.availableDate &&
            result.daysShort === expected.daysShort &&
            (!reasonIncludes || result.reason.toLowerCase().includes(reasonIncludes));
        const status = pass ? "PASS" : "FAIL";
        console.log(
            `${status}: getStatus ${name} -> ${result.level}, ${result.availableDate}, ${result.daysShort} (${result.reason})`,
        );
    }
}