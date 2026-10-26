const RESULTS_STORAGE_KEY = "liveLapResults";
const storedResults = localStorage.getItem(RESULTS_STORAGE_KEY);
let results = storedResults ? JSON.parse(storedResults) : [];
const leaderboardBody = document.getElementById("leaderboardBody");
const searchInput = document.getElementById("searchInput");

function handleTimeEntry(event, fields, message) {
    event.preventDefault();

    const name = document.getElementById(fields.name).value.trim();
    const time = document.getElementById(fields.time).value.trim();
    const date = document.getElementById(fields.date).value;
    const validTime = /^\d{2}:\d{2}\.\d{2}$/.test(time)
        && Number(time.slice(3, 5)) < 60;

    if (!validTime) {
        message.textContent = "Enter all six time digits to complete the MM:SS.hh format.";
        document.getElementById(fields.time).focus();
        return;
    }

    results.push({
        name: name.toUpperCase(),
        time,
        date
    });

    localStorage.setItem(RESULTS_STORAGE_KEY, JSON.stringify(results));
    renderLeaderboard();
    event.currentTarget.reset();
    message.textContent = "Lap time added to the leaderboard.";
}

const homepageForm = document.getElementById("timeEntryForm");
if (homepageForm) {
    homepageForm.addEventListener("submit", (event) => {
        handleTimeEntry(event, {
            name: "newName",
            time: "newTime",
            date: "newDate"
        }, document.getElementById("timeEntryMessage"));
    });
}

const dataEntryForm = document.getElementById("raceForm");
if (dataEntryForm) {
    dataEntryForm.addEventListener("submit", (event) => {
        handleTimeEntry(event, {
            name: "name",
            time: "time",
            date: "date"
        }, document.getElementById("message"));
    });
}

function renderLeaderboard() {
    if (!leaderboardBody) {
        return;
    }

    leaderboardBody.replaceChildren();
    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : "";

    const sortedResults = results
        .filter((result) => result.name.toLowerCase().includes(searchTerm))
        .sort((first, second) => convertTime(first.time) - convertTime(second.time));

    if (searchTerm && sortedResults.length === 0) {
        const row = document.createElement("tr");
        row.className = "empty-state";
        const cell = createCell("", "No drivers match your search.");
        cell.colSpan = 4;
        row.appendChild(cell);
        leaderboardBody.appendChild(row);
        return;
    }

    sortedResults.forEach((result, index) => {
        const row = document.createElement("tr");
        row.append(
            createCell("rank", index + 1),
            createCell("time", result.time),
            createCell("name", result.name),
            createCell("", result.date)
        );
        leaderboardBody.appendChild(row);
    });
}

if (searchInput) {
    searchInput.addEventListener("input", renderLeaderboard);
}

function createCell(className, value) {
    const cell = document.createElement("td");
    if (className) {
        cell.className = className;
    }
    cell.textContent = value;
    return cell;
}

function convertTime(time) {
    const [minutes, seconds] = time.split(":");
    return Number(minutes) * 60 + Number(seconds);
}

renderLeaderboard();
// Load backend results without losing browser-saved entries or active search filters.
async function loadLeaderboard() {
    if (!leaderboardBody) {
        return;
    }

    try {
        const response = await fetch("/api/leaderboard");
        if (!response.ok) {
            throw new Error(`Leaderboard request failed (${response.status}).`);
        }

        const serverResults = await response.json();
        if (!Array.isArray(serverResults)) {
            throw new Error("The leaderboard response must be an array.");
        }

        results = mergeResults(serverResults, results);
        renderLeaderboard();
    } catch (error) {
        console.error("Unable to load leaderboard data from the server:", error);
    }
}

function mergeResults(serverResults, browserResults) {
    const mergedResults = new Map();

    [...serverResults, ...browserResults].forEach((result) => {
        if (!result || !result.name || !result.time || !result.date) {
            return;
        }

        const key = [result.name, result.time, result.date]
            .map((value) => String(value).trim().toLowerCase())
            .join("|");

        if (!mergedResults.has(key)) {
            mergedResults.set(key, result);
        }
    });

    return [...mergedResults.values()];
}

loadLeaderboard();
