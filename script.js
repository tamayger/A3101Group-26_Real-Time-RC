const RESULTS_STORAGE_KEY = "liveLapResults";
const storedResults = localStorage.getItem(RESULTS_STORAGE_KEY);
let results = storedResults ? JSON.parse(storedResults) : [];
const leaderboardBody = document.getElementById("leaderboardBody");
const resultsLeaderboardBody = document.getElementById("resultsLeaderboardBody");
const searchInput = document.getElementById("searchInput");
const resultNameFilter = document.getElementById("resultNameFilter");
const resultDateFilter = document.getElementById("resultDateFilter");
const resultEventFilter = document.getElementById("resultEventFilter");

function handleTimeEntry(event, fields, message) {
    event.preventDefault();

    const name = document.getElementById(fields.name).value.trim();
    const time = document.getElementById(fields.time).value.trim();
    const eventName = document.getElementById(fields.event).value.trim();
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
        eventName,
        date
    });

    localStorage.setItem(RESULTS_STORAGE_KEY, JSON.stringify(results));
    renderLeaderboard();
    renderResultsTable();
    renderPodium();
    event.currentTarget.reset();
    message.textContent = "Lap time added to the leaderboard.";
}

const homepageForm = document.getElementById("timeEntryForm");
if (homepageForm) {
    homepageForm.addEventListener("submit", (event) => {
        handleTimeEntry(event, {
            name: "newName",
            time: "newTime",
            event: "newEvent",
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
            event: "event",
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

    const sortedResults = getSortedResults()
        .filter((result) => result.name.toLowerCase().includes(searchTerm));

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

function renderResultsTable() {
    if (!resultsLeaderboardBody) {
        return;
    }

    resultsLeaderboardBody.replaceChildren();
    updateEventFilterOptions();

    const nameTerm = resultNameFilter ? resultNameFilter.value.trim().toLowerCase() : "";
    const selectedDate = resultDateFilter ? resultDateFilter.value : "";
    const selectedEvent = resultEventFilter ? resultEventFilter.value : "";

    const sortedResults = getSortedResults().filter((result) => {
        const matchesName = result.name.toLowerCase().includes(nameTerm);
        const matchesDate = !selectedDate || normalizeDate(result.date) === selectedDate;
        const matchesEvent = !selectedEvent || getEventName(result) === selectedEvent;
        return matchesName && matchesDate && matchesEvent;
    });

    if (sortedResults.length === 0) {
        const row = document.createElement("tr");
        const emptyMessage = results.length === 0
            ? "No results have been recorded yet."
            : "No results match these filters.";
        const cell = createCell("empty-state", emptyMessage);
        cell.colSpan = 5;
        row.appendChild(cell);
        resultsLeaderboardBody.appendChild(row);
        return;
    }

    sortedResults.forEach((result, index) => {
        const row = document.createElement("tr");
        if (index === 0) {
            row.classList.add("fastest-driver");
        }

        const actionCell = document.createElement("td");
        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "remove-result-button";
        removeButton.textContent = "Remove";
        removeButton.setAttribute("aria-label", `Remove result for ${result.name}`);
        removeButton.addEventListener("click", () => removeResult(result));
        actionCell.appendChild(removeButton);

        row.append(
            createCell("rank", index + 1),
            createCell("name", result.name),
            createCell("time", result.time),
            createDateEventCell(result),
            actionCell
        );
        resultsLeaderboardBody.appendChild(row);
    });
}

function updateEventFilterOptions() {
    if (!resultEventFilter) {
        return;
    }

    const selectedEvent = resultEventFilter.value;
    const eventNames = [...new Set(results.map(getEventName))]
        .sort((first, second) => first.localeCompare(second));
    const options = [new Option("All events", "")];

    eventNames.forEach((eventName) => {
        options.push(new Option(eventName, eventName));
    });

    resultEventFilter.replaceChildren(...options);
    if (eventNames.includes(selectedEvent)) {
        resultEventFilter.value = selectedEvent;
    }
}

function getEventName(result) {
    return result.eventName?.trim() || "Unspecified event";
}

function normalizeDate(dateValue) {
    const abbreviatedDate = dateValue.match(/^(\d{4})-([A-Za-z]{3})-(\d{2})$/);
    if (!abbreviatedDate) {
        return dateValue;
    }

    const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
        .indexOf(abbreviatedDate[2].toLowerCase()) + 1;
    if (month === 0) {
        return dateValue;
    }

    return `${abbreviatedDate[1]}-${String(month).padStart(2, "0")}-${abbreviatedDate[3]}`;
}

function createDateEventCell(result) {
    const cell = document.createElement("td");
    const date = document.createElement("span");
    const eventName = document.createElement("small");

    date.textContent = result.date;
    eventName.className = "result-event-name";
    eventName.textContent = getEventName(result);
    cell.append(date, eventName);
    return cell;
}

function renderPodium() {
    const podium = document.querySelector(".podium-section");
    if (!podium) {
        return;
    }

    const podiumPositions = [
        { nameId: "podiumFirstName", timeId: "podiumFirstTime" },
        { nameId: "podiumSecondName", timeId: "podiumSecondTime" },
        { nameId: "podiumThirdName", timeId: "podiumThirdTime" }
    ];

    const topDrivers = getSortedResults().slice(0, podiumPositions.length);
    podiumPositions.forEach((position, index) => {
        const driver = topDrivers[index];
        document.getElementById(position.nameId).textContent = driver?.name ?? "Awaiting driver";
        document.getElementById(position.timeId).textContent = driver?.time ?? "—";
    });
}

function removeResult(resultToRemove) {
    const resultIndex = results.indexOf(resultToRemove);
    if (resultIndex === -1) {
        return;
    }

    results.splice(resultIndex, 1);
    localStorage.setItem(RESULTS_STORAGE_KEY, JSON.stringify(results));
    renderLeaderboard();
    renderResultsTable();
    renderPodium();
}

if (searchInput) {
    searchInput.addEventListener("input", renderLeaderboard);
}

[resultNameFilter, resultDateFilter].filter(Boolean).forEach((filter) => {
    filter.addEventListener("input", renderResultsTable);
});

if (resultEventFilter) {
    resultEventFilter.addEventListener("change", renderResultsTable);
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

function getSortedResults() {
    return [...results].sort(
        (first, second) => convertTime(first.time) - convertTime(second.time)
    );
}

renderLeaderboard();
renderResultsTable();
renderPodium();

// Send new time to the Express backend
    document.getElementById("addTimeBtn").addEventListener("click", function() {
        var nameVal = document.getElementById("newName").value;
        var timeVal = document.getElementById("newTime").value;
        var dateVal = document.getElementById("newDate").value;

        if(nameVal === "" || timeVal === "") {
            alert("Name and Time are required!");
            return;
        }

        var payload = { name: nameVal, time: timeVal, date: dateVal };

        fetch('/api/leaderboard', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
        .then(function(response) {
            return response.json();
        })
        .then(function(result) {
            // Clear inputs and reload the table
            document.getElementById("newName").value = "";
            document.getElementById("newTime").value = "";
            document.getElementById("newDate").value = "";
            renderLeaderboard();
        });
    });
