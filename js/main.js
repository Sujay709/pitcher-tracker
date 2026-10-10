import { loadOutings, addOuting, deleteOuting } from "./storage.js";

function todayLocal() {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${month}-${day}`;
}
//test add outing
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
console.log("pitchCount type:", typeof outings[0]?.pitchCount);
