const crypto = require("crypto");
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;
const templateCache = new Map();

let leaderboard = [
    { time: "00:24.53", name: "TYRESE MARIANO", date: "2026-SEP-06", eventName: "Unspecified event" },
    { time: "01:23.16", name: "RICARDO MARMOL", date: "2026-SEP-06", eventName: "Unspecified event" },
    { time: "01:32.62", name: "ANTHONY BERNALES", date: "2026-SEP-06", eventName: "Unspecified event" },
    { time: "02:04.08", name: "JONATHAN BACANI", date: "2026-SEP-01", eventName: "Unspecified event" }
].map((result) => ({ ...result, id: crypto.randomUUID() }));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function renderTemplate(fileName, values, response) {
    const filePath = path.join(__dirname, fileName);
    let html = templateCache.get(fileName);

    if (!html) {
        html = fs.readFileSync(filePath, "utf8");
        templateCache.set(fileName, html);
    }

    Object.entries(values).forEach(([key, value]) => {
        html = html.replaceAll(`{{${key}}}`, value);
    });

    response.type("html").send(html);
}

function timeToHundredths(time) {
    const match = /^(\d{2}):(\d{2})\.(\d{2})$/.exec(time || "");
    if (!match) {
        return Number.MAX_SAFE_INTEGER;
    }

    return (Number(match[1]) * 60 + Number(match[2])) * 100 + Number(match[3]);
}

function getSortedResults(records = leaderboard) {
    return [...records].sort((first, second) => timeToHundredths(first.time) - timeToHundredths(second.time));
}

function getEventName(result) {
    return result.eventName || "Unspecified event";
}

function normalizeDate(date) {
    const match = /^(\d{4})-([A-Za-z]{3})-(\d{2})$/.exec(date || "");
    if (!match) {
        return date || "";
    }

    const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
        .indexOf(match[2].toLowerCase()) + 1;
    if (month === 0) {
        return date;
    }

    return `${match[1]}-${String(month).padStart(2, "0")}-${match[3]}`;
}

function filterResults(query = {}) {
    const driver = String(query.driver || "").trim().toLowerCase();
    const date = String(query.date || "");
    const event = String(query.event || "");

    return getSortedResults().filter((result) => {
        const matchesDriver = result.name.toLowerCase().includes(driver);
        const matchesDate = !date || normalizeDate(result.date) === date;
        const matchesEvent = !event || getEventName(result) === event;
        return matchesDriver && matchesDate && matchesEvent;
    });
}

function renderLeaderboardRows(records, emptyMessage = "No drivers have been recorded yet.") {
    if (records.length === 0) {
        return `<tr class="empty-state"><td colspan="4">${escapeHtml(emptyMessage)}</td></tr>`;
    }

    return records.map((result, index) => `
        <tr>
            <td class="rank">${index + 1}</td>
            <td class="time">${escapeHtml(result.time)}</td>
            <td class="name">${escapeHtml(result.name)}</td>
            <td>${escapeHtml(result.date)}</td>
        </tr>`).join("");
}

function renderResultsRows(records, returnTo) {
    if (records.length === 0) {
        const message = leaderboard.length === 0
            ? "No results have been recorded yet."
            : "No results match these filters.";
        return `<tr><td class="empty-state" colspan="5">${escapeHtml(message)}</td></tr>`;
    }

    return records.map((result, index) => `
        <tr${index === 0 ? ' class="fastest-driver"' : ""}>
            <td class="rank">${index + 1}</td>
            <td class="name">${escapeHtml(result.name)}</td>
            <td class="time">${escapeHtml(result.time)}</td>
            <td>${escapeHtml(result.date)}<small class="result-event-name">${escapeHtml(getEventName(result))}</small></td>
            <td>
                <form method="post" action="/results/delete">
                    <input type="hidden" name="id" value="${escapeHtml(result.id)}">
                    <input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}">
                    <button class="remove-result-button" type="submit">Remove</button>
                </form>
            </td>
        </tr>`).join("");
}

function renderPodiumName(result) {
    return escapeHtml(result ? result.name : "Awaiting driver");
}

function renderPodiumTime(result) {
    return escapeHtml(result ? result.time : "—");
}

function currentPeriod() {
    return `${new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date())} LEADERBOARDS`.toUpperCase();
}

function renderHome(request, response) {
    const filteredResults = filterResults({ driver: request.query.driver });
    const searchTerm = escapeHtml(request.query.driver || "");
    const hasError = request.query.error === "invalid";

    renderTemplate("index.html", {
        leaderboardPeriod: currentPeriod(),
        driverFilter: searchTerm,
        leaderboardRows: renderLeaderboardRows(
            filteredResults,
            searchTerm ? "No drivers match your search." : "No drivers have been recorded yet."
        ),
        formMessage: hasError ? "Enter a name, valid lap time, event, and date." : ""
    }, response);
}

function renderLeaderboardPage(request, response) {
    renderTemplate("table-skeleton.html", {
        leaderboardPeriod: currentPeriod(),
        leaderboardRows: renderLeaderboardRows(getSortedResults()),
        formMessage: request.query.error === "invalid"
            ? "Enter a name, valid lap time, event, and date."
            : ""
    }, response);
}

function renderResultsPage(request, response) {
    const filters = {
        driver: String(request.query.driver || ""),
        date: String(request.query.date || ""),
        event: String(request.query.event || "")
    };
    const topDrivers = getSortedResults().slice(0, 3);
    const events = [...new Set(leaderboard.map(getEventName))]
        .sort((first, second) => first.localeCompare(second));
    const eventOptions = [
        `<option value="">All events</option>`,
        ...events.map((eventName) => `<option value="${escapeHtml(eventName)}"${eventName === filters.event ? " selected" : ""}>${escapeHtml(eventName)}</option>`)
    ].join("");
    const queryString = new URLSearchParams(filters).toString();
    const returnTo = `/results${queryString ? `?${queryString}` : ""}`;

    renderTemplate("The Data Entry.html", {
        firstDriverName: renderPodiumName(topDrivers[0]),
        firstDriverTime: renderPodiumTime(topDrivers[0]),
        secondDriverName: renderPodiumName(topDrivers[1]),
        secondDriverTime: renderPodiumTime(topDrivers[1]),
        thirdDriverName: renderPodiumName(topDrivers[2]),
        thirdDriverTime: renderPodiumTime(topDrivers[2]),
        driverFilter: escapeHtml(filters.driver),
        dateFilter: escapeHtml(filters.date),
        eventOptions,
        resultsRows: renderResultsRows(filterResults(filters), returnTo)
    }, response);
}

app.get(["/", "/index.html"], renderHome);
app.get(["/leaderboard", "/table-skeleton.html"], renderLeaderboardPage);
app.get(["/results", "/The Data Entry.html"], renderResultsPage);

app.post("/times", (request, response) => {
    const name = String(request.body.name || "").trim();
    const time = String(request.body.time || "").trim();
    const eventName = String(request.body.eventName || "").trim();
    const date = String(request.body.date || "");
    const validTime = /^\d{2}:\d{2}\.\d{2}$/.test(time) && Number(time.slice(3, 5)) < 60;
    const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    const parsedDate = dateParts
        ? new Date(Date.UTC(Number(dateParts[1]), Number(dateParts[2]) - 1, Number(dateParts[3])))
        : null;
    const validDate = Boolean(parsedDate)
        && parsedDate.getUTCFullYear() === Number(dateParts[1])
        && parsedDate.getUTCMonth() + 1 === Number(dateParts[2])
        && parsedDate.getUTCDate() === Number(dateParts[3]);

    if (!name || !validTime || !eventName || !validDate) {
        const destination = request.body.returnTo === "/leaderboard" ? "/leaderboard" : "/";
        return response.redirect(303, `${destination}?error=invalid`);
    }

    leaderboard.push({
        id: crypto.randomUUID(),
        name: name.toUpperCase(),
        time,
        eventName,
        date
    });

    const destination = request.body.returnTo === "/leaderboard" ? "/leaderboard" : "/";
    response.redirect(303, destination);
});

app.post("/results/delete", (request, response) => {
    const resultId = String(request.body.id || "");
    leaderboard = leaderboard.filter((result) => result.id !== resultId);

    const returnTo = String(request.body.returnTo || "/results");
    response.redirect(303, returnTo.startsWith("/results") && !returnTo.startsWith("//") ? returnTo : "/results");
});

app.get("/api/leaderboard", (request, response) => {
    response.json(getSortedResults());
});

// Keep the JSON submission endpoint available for clients that use the API.
app.post("/api/leaderboard", (request, response) => {
    const name = String(request.body.name || "").trim();
    const time = String(request.body.time || "").trim();
    const date = String(request.body.date || "");

    if (!name || !/^\d{2}:\d{2}\.\d{2}$/.test(time)) {
        return response.status(400).json({ error: "A driver name and valid lap time are required." });
    }

    leaderboard.push({ id: crypto.randomUUID(), name: name.toUpperCase(), time, date, eventName: "Unspecified event" });
    response.status(201).json({ message: "Time added successfully!" });
});

app.use(express.static(__dirname));

if (require.main === module) {
    app.listen(port, () => {
        console.log(`LiveLap server running at http://localhost:${port}`);
    });
}

module.exports = app;
