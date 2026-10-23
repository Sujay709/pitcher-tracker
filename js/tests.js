import {
    requiredRest,
    addDays,
    availableDate,
    checkinRestDate,
    buildSnapshot,
    decodeSnapshot,
    encodeSnapshot,
    daysBetween,
    getStatus,
    latestCheckin,
    parseImport,
    parseCount,
    sortOutings,
    upsertCheckin,
    validateCheckin,
    validateOuting,
    weekAvailability,
    weeklyPitchTotal,
} from "./workload.js";

export function runTests(guidelines) {
    const snapshotOutings = [
        { id: "one", date: "2026-10-19", pitchCount: 70, type: "game", effort: 5 },
    ];
    const snapshotCheckin = { date: "2026-10-20", feeling: 3 };
    const snapshot = buildSnapshot(
        "Alex",
        "ab-12",
        "player-test",
        snapshotOutings,
        snapshotCheckin,
        "15-16",
        guidelines,
        "2026-10-21",
    );
    const encodedSnapshot = encodeSnapshot(snapshot);
    const decodedSnapshot = decodeSnapshot(encodedSnapshot);
    console.log(
        `${!decodedSnapshot.error && decodedSnapshot.name === "Alex" && decodedSnapshot.teamCode === "AB-12" ? "PASS" : "FAIL"}: snapshot round trip`,
    );

    const unicodeSnapshot = buildSnapshot(
        "José ⚾",
        "aa-1",
        "player-unicode",
        [],
        null,
        "15-16",
        guidelines,
        "2026-10-21",
    );
    const decodedUnicode = decodeSnapshot(encodeSnapshot(unicodeSnapshot));
    console.log(
        `${decodedUnicode.name === "José ⚾" ? "PASS" : "FAIL"}: snapshot non-ASCII name`,
    );

    const tampered = `!${encodedSnapshot.slice(1)}`;
    console.log(
        `${decodeSnapshot(tampered).error ? "PASS" : "FAIL"}: snapshot tampered string`,
    );
    const encodeObject = (value) => encodeSnapshot(value);
    console.log(
        `${decodeSnapshot(encodeObject({ ...snapshot, version: 2 })).error ? "PASS" : "FAIL"}: snapshot wrong version`,
    );
    console.log(
        `${decodeSnapshot(encodeObject({ ...snapshot, name: "" })).error ? "PASS" : "FAIL"}: snapshot missing name`,
    );
    console.log(
        `${decodeSnapshot("A".repeat(2001)).error ? "PASS" : "FAIL"}: snapshot oversized input`,
    );
    console.log(
        `${decodeSnapshot(encodeObject({ ...snapshot, asOf: "2026-02-30" })).error ? "PASS" : "FAIL"}: snapshot bad date`,
    );
    console.log(
        `${decodeSnapshot(encodeObject({ ...snapshot, checkin: { date: "2026-10-20", feeling: 6 } })).error ? "PASS" : "FAIL"}: snapshot feeling out of range`,
    );
    const scriptName = "<script>alert(1)</script>";
    const decodedScript = decodeSnapshot(encodeObject({ ...snapshot, name: scriptName }));
    console.log(
        `${decodedScript.name === scriptName ? "PASS" : "FAIL"}: snapshot script name remains text`,
    );

    const checkinValidationTests = [
        {
            name: "valid",
            raw: { date: "2026-10-20", feeling: 3 },
            expected: null,
        },
        {
            name: "future date",
            raw: { date: "2026-10-21", feeling: 3 },
            expected: "Date cannot be in the future",
        },
        {
            name: "feeling 0",
            raw: { date: "2026-10-20", feeling: 0 },
            expected: "Feeling must be an integer from 1 to 5",
        },
        {
            name: "feeling 6",
            raw: { date: "2026-10-20", feeling: 6 },
            expected: "Feeling must be an integer from 1 to 5",
        },
        {
            name: "non-integer feeling",
            raw: { date: "2026-10-20", feeling: 2.5 },
            expected: "Feeling must be an integer from 1 to 5",
        },
    ];
    for (const { name, raw, expected } of checkinValidationTests) {
        const result = validateCheckin(raw, "2026-10-20");
        console.log(
            `${result === expected ? "PASS" : "FAIL"}: validateCheckin ${name} -> ${result}`,
        );
    }

    const existingCheckin = { date: "2026-10-19", feeling: 2 };
    const replacedCheckins = upsertCheckin(
        [existingCheckin, { date: "2026-10-18", feeling: 1 }],
        { date: "2026-10-19", feeling: 4 },
    );
    console.log(
        `${replacedCheckins.length === 2 && replacedCheckins.find(({ date }) => date === "2026-10-19").feeling === 4 ? "PASS" : "FAIL"}: upsertCheckin replaces same date`,
    );

    const addedCheckins = upsertCheckin(
        [existingCheckin],
        { date: "2026-10-20", feeling: 3 },
    );
    console.log(
        `${addedCheckins.length === 2 && addedCheckins.some(({ date }) => date === "2026-10-20") ? "PASS" : "FAIL"}: upsertCheckin adds new date`,
    );

    console.log(
        `${latestCheckin([]) === null ? "PASS" : "FAIL"}: latestCheckin empty list`,
    );
    const latest = latestCheckin([
        { date: "2026-10-18", feeling: 1 },
        { date: "2026-10-20", feeling: 3 },
        { date: "2026-10-19", feeling: 2 },
    ]);
    console.log(
        `${latest?.date === "2026-10-20" ? "PASS" : "FAIL"}: latestCheckin several`,
    );
    console.log(
        `${checkinRestDate({ date: "2026-10-20", feeling: 4 }) === "2026-10-23" ? "PASS" : "FAIL"}: checkinRestDate sore`,
    );
    console.log(
        `${checkinRestDate({ date: "2026-10-20", feeling: 3 }) === null ? "PASS" : "FAIL"}: checkinRestDate non-sore`,
    );

    const importTests = [
        {
            name: "bad JSON",
            raw: "{",
            expectedError: true,
        },
        {
            name: "non-array",
            raw: JSON.stringify({ outing: [] }),
            expectedError: true,
        },
        {
            name: "empty array",
            raw: "[]",
            expected: { outings: [], skipped: 0 },
        },
        {
            name: "mixed valid and invalid rows",
            raw: JSON.stringify([
                { id: "valid", date: "2026-10-09", pitchCount: 40, type: "game", effort: 5 },
                { id: "invalid", date: "2026-10-09", pitchCount: 0, type: "game", effort: 5 },
            ]),
            expected: { ids: ["valid"], skipped: 1 },
        },
        {
            name: "duplicate id",
            raw: JSON.stringify([
                { id: "existing", date: "2026-10-09", pitchCount: 40, type: "game", effort: 5 },
            ]),
            existing: [{ id: "existing" }],
            expected: { outings: [], skipped: 1 },
        },
        {
            name: "extra fields removed",
            raw: JSON.stringify([
                {
                    id: "clean",
                    date: "2026-10-09",
                    pitchCount: 40,
                    type: "game",
                    effort: 5,
                    malicious: true,
                },
            ]),
            expected: { keys: ["id", "date", "pitchCount", "type", "effort"], skipped: 0 },
        },
        {
            name: "missing id",
            raw: JSON.stringify([
                { date: "2026-10-09", pitchCount: 40, type: "game", effort: 5 },
            ]),
            expected: { generatedId: true, skipped: 0 },
        },
        {
            name: "wrapped outings array",
            raw: JSON.stringify({
                outings: [
                    { id: "wrapped", date: "2026-10-09", pitchCount: 40, type: "game", effort: 5 },
                ],
            }),
            expected: { ids: ["wrapped"], skipped: 0 },
        },
    ];
    for (const { name, raw, existing = [], expected, expectedError } of importTests) {
        const result = parseImport(raw, existing, "2026-10-09");
        const pass = expectedError
            ? Boolean(result.error)
            : !result.error &&
              result.skipped === expected.skipped &&
              (!expected.outings || JSON.stringify(result.outings) === JSON.stringify(expected.outings)) &&
              (!expected.ids || JSON.stringify(result.outings.map(({ id }) => id)) === JSON.stringify(expected.ids)) &&
              (!expected.keys || JSON.stringify(Object.keys(result.outings[0])) === JSON.stringify(expected.keys)) &&
              (!expected.generatedId || result.outings[0].id.startsWith("import-"));
        console.log(`${pass ? "PASS" : "FAIL"}: parseImport ${name}`);
    }

    const weekAvailabilityTests = [
        {
            name: "no availability date",
            availableDate: null,
            today: "2026-10-18",
            expected: [true, true, true, true, true, true, true],
        },
        {
            name: "available today",
            availableDate: "2026-10-18",
            today: "2026-10-18",
            expected: [true, true, true, true, true, true, true],
        },
        {
            name: "available three days out",
            availableDate: "2026-10-21",
            today: "2026-10-18",
            expected: [false, false, false, true, true, true, true],
        },
        {
            name: "availability date in the past",
            availableDate: "2026-10-17",
            today: "2026-10-18",
            expected: [true, true, true, true, true, true, true],
        },
        {
            name: "availability date beyond the week",
            availableDate: "2026-10-28",
            today: "2026-10-18",
            expected: [false, false, false, false, false, false, false],
        },
        {
            name: "month boundary",
            availableDate: "2026-11-02",
            today: "2026-10-29",
            expected: [false, false, false, false, true, true, true],
        },
    ];
    for (const { name, availableDate, today, expected } of weekAvailabilityTests) {
        const result = weekAvailability(availableDate, today);
        const dates = result.map(({ date }) => date);
        const availability = result.map(({ available }) => available);
        const status =
            JSON.stringify(availability) === JSON.stringify(expected) &&
            dates.length === 7 &&
            dates[0] === today
                ? "PASS"
                : "FAIL";
        console.log(
            `${status}: weekAvailability ${name} -> ${JSON.stringify(result)}`,
        );
    }

    const countTests = [
        [null, 0],
        ["", 0],
        ["abc", 0],
        ["-3", 0],
        ["12.5", 0],
        ["250", 0],
        ["200", 200],
        ["0", 0],
        ["42", 42],
    ];
    for (const [raw, expected] of countTests) {
        const result = parseCount(raw);
        const status = result === expected ? "PASS" : "FAIL";
        console.log(`${status}: parseCount ${String(raw)} -> ${result} (expected ${expected})`);
    }

    const weeklyPitchTotalTests = [
        {
            name: "empty outings",
            outings: [],
            today: "2026-11-02",
            expected: 0,
        },
        {
            name: "outing today counts",
            outings: [{ date: "2026-11-02", pitchCount: "40", type: "game" }],
            today: "2026-11-02",
            expected: 40,
        },
        {
            name: "six days ago counts and seven days ago does not",
            outings: [
                { date: "2026-10-27", pitchCount: 30, type: "game" },
                { date: "2026-10-26", pitchCount: 20, type: "game" },
            ],
            today: "2026-11-02",
            expected: 30,
        },
        {
            name: "month boundary",
            outings: [
                { date: "2026-10-27", pitchCount: 25, type: "game" },
                { date: "2026-10-26", pitchCount: 35, type: "game" },
            ],
            today: "2026-11-02",
            expected: 25,
        },
        {
            name: "future outing does not count",
            outings: [{ date: "2026-11-03", pitchCount: 50, type: "game" }],
            today: "2026-11-02",
            expected: 0,
        },
        {
            name: "catch and long toss are excluded",
            outings: [
                { date: "2026-11-02", pitchCount: 10, type: "catch" },
                { date: "2026-11-02", pitchCount: 20, type: "longToss" },
            ],
            today: "2026-11-02",
            expected: 0,
        },
        {
            name: "bullpen effort threshold",
            outings: [
                { date: "2026-11-02", pitchCount: 15, type: "bullpen", effort: 5 },
                { date: "2026-11-02", pitchCount: 25, type: "bullpen", effort: 6 },
            ],
            today: "2026-11-02",
            expected: 25,
        },
        {
            name: "several outings sum correctly",
            outings: [
                { date: "2026-10-27", pitchCount: "30", type: "game" },
                { date: "2026-10-30", pitchCount: 20, type: "liveBP" },
                { date: "2026-11-02", pitchCount: 40, type: "game" },
            ],
            today: "2026-11-02",
            expected: 90,
        },
    ];

    for (const { name, outings: fakeOutings, today, expected } of weeklyPitchTotalTests) {
        const result = weeklyPitchTotal(fakeOutings, today);
        const status = result === expected ? "PASS" : "FAIL";
        console.log(`${status}: weeklyPitchTotal ${name} -> ${result} (expected ${expected})`);
    }

    const sortingTests = [
        {
            name: "empty array",
            outings: [],
            expectedIds: "",
        },
        {
            name: "one outing",
            outings: [{ id: "one", date: "2026-10-09" }],
            expectedIds: "one",
        },
        {
            name: "oldest first",
            outings: [
                { id: "old", date: "2026-10-08" },
                { id: "new", date: "2026-10-09" },
            ],
            expectedIds: "newold",
        },
        {
            name: "same date keeps later-logged outing first",
            outings: [
                { id: "first", date: "2026-10-09" },
                { id: "second", date: "2026-10-09" },
            ],
            expectedIds: "secondfirst",
        },
    ];

    for (const { name, outings: fakeOutings, expectedIds } of sortingTests) {
        const result = sortOutings(fakeOutings);
        const resultIds = result.map(({ id }) => id).join("");
        const status = resultIds === expectedIds ? "PASS" : "FAIL";
        console.log(`${status}: sortOutings ${name} -> ${resultIds} (expected ${expectedIds})`);
    }

    const inputOrder = [
        { id: "old", date: "2026-10-08" },
        { id: "new", date: "2026-10-09" },
    ];
    sortOutings(inputOrder);
    const inputUnchanged = inputOrder.map(({ id }) => id).join("") === "oldnew";
    console.log(
        `${inputUnchanged ? "PASS" : "FAIL"}: sortOutings leaves input order unchanged`,
    );

    const validationTests = [
        {
            name: "valid outing",
            raw: { date: "2026-10-09", pitchCount: 40, type: "game", effort: 5 },
            expected: null,
        },
        {
            name: "date equal to today",
            raw: { date: "2026-10-09", pitchCount: 40, type: "game", effort: 5 },
            expected: null,
        },
        {
            name: "one pitch",
            raw: { date: "2026-10-09", pitchCount: 1, type: "game", effort: 5 },
            expected: null,
        },
        {
            name: "200 pitches",
            raw: { date: "2026-10-09", pitchCount: 200, type: "game", effort: 5 },
            expected: null,
        },
        {
            name: "201 pitches",
            raw: { date: "2026-10-09", pitchCount: 201, type: "game", effort: 5 },
            expected: "Pitch count must be between 1 and 200",
        },
        {
            name: "fractional pitch count",
            raw: { date: "2026-10-09", pitchCount: 40.5, type: "game", effort: 5 },
            expected: "Pitch count must be between 1 and 200",
        },
        {
            name: "NaN pitch count",
            raw: { date: "2026-10-09", pitchCount: NaN, type: "game", effort: 5 },
            expected: "Pitch count must be between 1 and 200",
        },
        {
            name: "zero effort",
            raw: { date: "2026-10-09", pitchCount: 40, type: "game", effort: 0 },
            expected: "Effort must be between 1 and 10",
        },
        {
            name: "fractional effort",
            raw: { date: "2026-10-09", pitchCount: 40, type: "game", effort: 5.5 },
            expected: "Effort must be between 1 and 10",
        },
        {
            name: "one effort",
            raw: { date: "2026-10-09", pitchCount: 40, type: "game", effort: 1 },
            expected: null,
        },
        {
            name: "ten effort",
            raw: { date: "2026-10-09", pitchCount: 40, type: "game", effort: 10 },
            expected: null,
        },
        {
            name: "valid long toss outing",
            raw: { date: "2026-10-09", pitchCount: 40, type: "longToss", effort: 5 },
            expected: null,
        },
        {
            name: "long toss type with space",
            raw: { date: "2026-10-09", pitchCount: 40, type: "long toss", effort: 5 },
            expected: "Type must be one of the allowed outing types",
        },
        {
            name: "future date",
            raw: { date: "2026-10-10", pitchCount: 40, type: "game", effort: 5 },
            expected: "Date cannot be in the future",
        },
        {
            name: "zero pitches",
            raw: { date: "2026-10-09", pitchCount: 0, type: "game", effort: 5 },
            expected: "Pitch count must be between 1 and 200",
        },
        {
            name: "effort above ten",
            raw: { date: "2026-10-09", pitchCount: 40, type: "game", effort: 11 },
            expected: "Effort must be between 1 and 10",
        },
        {
            name: "invalid type",
            raw: { date: "2026-10-09", pitchCount: 40, type: "scrimmage", effort: 5 },
            expected: "Type must be one of the allowed outing types",
        },
        {
            name: "empty date",
            raw: { date: "", pitchCount: 40, type: "game", effort: 5 },
            expected: "Date is required",
        },
    ];

    for (const { name, raw, expected } of validationTests) {
        const result = validateOuting(raw, "2026-10-09");
        const status = result === expected ? "PASS" : "FAIL";
        console.log(`${status}: validateOuting ${name} -> ${result} (expected ${expected})`);
    }

    const restTests = [
        [30, 5, "15-16", 0],
        [31, 5, "15-16", 1],
        [45, 8, "15-16", 1],
        [45, 9, "15-16", 2],
        [150, 5, "15-16", 4],
        [0, 5, "15-16", 0],
        [40, 5, "99", 0],
    ];

    for (const [pitches, effort, group, expected] of restTests) {
        const result = requiredRest(pitches, effort, group, guidelines);
        const status = result === expected ? "PASS" : "FAIL";
        console.log(`${status}: ${pitches} pitches, effort ${effort}, ${group} -> ${result} (expected ${expected})`);
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