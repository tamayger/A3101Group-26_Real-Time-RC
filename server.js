const crypto = require("crypto");
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;
const templateCache = new Map();

const initialEvents = [
    { id: "event-morning-qualifier", name: "Saturday Morning Qualifier", date: "2026-11-07", status: "completed" },
    { id: "event-afternoon-finals", name: "Saturday Afternoon Finals", date: "2026-11-07", status: "completed" },
    { id: "event-sunday-practice", name: "Sunday Club Practice", date: "2026-11-08", status: "completed" }
];

const initialParticipants = [
    { eventId: "event-morning-qualifier", driverId: "driver-alex-qualifier", name: "ALEX RIVERA", vehicle: "Yokomo YD-2Z" },
    { eventId: "event-morning-qualifier", driverId: "driver-bea-qualifier", name: "BEA SANTOS", vehicle: "MST RMX 2.5" },
    { eventId: "event-morning-qualifier", driverId: "driver-carlos-qualifier", name: "CARLOS REYES", vehicle: "Sakura D5S" },
    { eventId: "event-morning-qualifier", driverId: "driver-dani-qualifier", name: "DANI FLORES", vehicle: "Tamiya TT-02" },
    { eventId: "event-afternoon-finals", driverId: "driver-alex-finals", name: "ALEX RIVERA", vehicle: "MST RMX 2.5" },
    { eventId: "event-afternoon-finals", driverId: "driver-emery-finals", name: "EMERY LIM", vehicle: "Yokomo RD 2.0" },
    { eventId: "event-afternoon-finals", driverId: "driver-faye-finals", name: "FAYE MENDOZA", vehicle: "Reve D RDX" },
    { eventId: "event-sunday-practice", driverId: "driver-bea-practice", name: "BEA SANTOS", vehicle: "MST RMX 2.5" },
    { eventId: "event-sunday-practice", driverId: "driver-gio-practice", name: "GIO NAVARRO", vehicle: "Yokomo YD-2Z" },
    { eventId: "event-sunday-practice", driverId: "driver-hana-practice", name: "HANA CRUZ", vehicle: "Tamiya TT-02" }
];

const initialLapTimes = [
    ["event-morning-qualifier", 1, "driver-alex-qualifier", "00:24.53"],
    ["event-morning-qualifier", 1, "driver-bea-qualifier", "00:25.12"],
    ["event-morning-qualifier", 1, "driver-carlos-qualifier", "00:26.48"],
    ["event-morning-qualifier", 1, "driver-dani-qualifier", "00:27.01"],
    ["event-morning-qualifier", 2, "driver-alex-qualifier", "00:23.98"],
    ["event-morning-qualifier", 2, "driver-bea-qualifier", "N/A"],
    ["event-morning-qualifier", 2, "driver-carlos-qualifier", "00:25.84"],
    ["event-morning-qualifier", 2, "driver-dani-qualifier", "00:26.75"],
    ["event-morning-qualifier", 3, "driver-alex-qualifier", "00:23.61"],
    ["event-morning-qualifier", 3, "driver-bea-qualifier", "00:24.76"],
    ["event-morning-qualifier", 3, "driver-carlos-qualifier", "00:25.32"],
    ["event-morning-qualifier", 3, "driver-dani-qualifier", "N/A"],
    ["event-afternoon-finals", 1, "driver-alex-finals", "00:22.94"],
    ["event-afternoon-finals", 1, "driver-emery-finals", "00:24.18"],
    ["event-afternoon-finals", 1, "driver-faye-finals", "00:25.41"],
    ["event-afternoon-finals", 2, "driver-alex-finals", "00:22.71"],
    ["event-afternoon-finals", 2, "driver-emery-finals", "00:23.96"],
    ["event-afternoon-finals", 2, "driver-faye-finals", "00:24.88"],
    ["event-afternoon-finals", 3, "driver-alex-finals", "00:22.58"],
    ["event-afternoon-finals", 3, "driver-emery-finals", "N/A"],
    ["event-afternoon-finals", 3, "driver-faye-finals", "00:24.52"],
    ["event-sunday-practice", 1, "driver-bea-practice", "00:25.07"],
    ["event-sunday-practice", 1, "driver-gio-practice", "00:26.19"],
    ["event-sunday-practice", 1, "driver-hana-practice", "00:27.42"],
    ["event-sunday-practice", 2, "driver-bea-practice", "00:24.81"],
    ["event-sunday-practice", 2, "driver-gio-practice", "N/A"],
    ["event-sunday-practice", 2, "driver-hana-practice", "00:26.90"]
];

const dataDirectory = path.join(__dirname, "data");
const dataFile = path.join(dataDirectory, "livelap.json");

function createInitialData() {
    const drivers = new Map();
    const eventDrivers = initialParticipants.map(({ eventId, driverId, name, vehicle }) => {
        drivers.set(driverId, { id: driverId, name });
        return { eventId, driverId, vehicle, active: true };
    });
    const participants = new Map(initialParticipants.map((participant) => [participant.driverId, participant]));
    const eventDates = new Map(initialEvents.map((event) => [event.id, event.date]));
    const runs = initialLapTimes.map(([eventId, lapGroup, driverId, time], index) => ({
        id: `seed-run-${String(index + 1).padStart(3, "0")}`,
        eventId,
        driverId,
        lapGroup,
        vehicle: participants.get(driverId).vehicle,
        time,
        date: eventDates.get(eventId),
        createdAt: `${eventDates.get(eventId)}T09:${String(index % 60).padStart(2, "0")}:00.000Z`
    }));
    return { events: initialEvents.map((event) => ({ ...event })), drivers: [...drivers.values()], eventDrivers, runs };
}

function loadData() {
    fs.mkdirSync(dataDirectory, { recursive: true });
    if (!fs.existsSync(dataFile)) {
        const initialData = createInitialData();
        fs.writeFileSync(dataFile, JSON.stringify(initialData, null, 2));
        return initialData;
    }
    const stored = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    if (!["events", "drivers", "eventDrivers", "runs"].every((key) => Array.isArray(stored[key]))) {
        throw new Error(`Invalid data format in ${dataFile}`);
    }
    let migrated = false;
    stored.eventDrivers.forEach((eventDriver) => {
        if (!eventDriver.vehicle || typeof eventDriver.vehicle !== "string") {
            const matchingRun = stored.runs.find((run) => run.eventId === eventDriver.eventId && run.driverId === eventDriver.driverId);
            eventDriver.vehicle = matchingRun?.vehicle || "";
            migrated = true;
        }
    });
    const firstEventForDriver = new Map();
    stored.eventDrivers.forEach((eventDriver) => {
        const firstEventId = firstEventForDriver.get(eventDriver.driverId);
        if (!firstEventId) {
            firstEventForDriver.set(eventDriver.driverId, eventDriver.eventId);
            return;
        }
        if (firstEventId === eventDriver.eventId) return;

        const originalDriver = stored.drivers.find((driver) => driver.id === eventDriver.driverId);
        if (!originalDriver) return;
        const eventDriverId = crypto.randomUUID();
        stored.drivers.push({ id: eventDriverId, name: originalDriver.name });
        stored.runs.forEach((run) => {
            if (run.eventId === eventDriver.eventId && run.driverId === eventDriver.driverId) {
                run.driverId = eventDriverId;
            }
        });
        eventDriver.driverId = eventDriverId;
        firstEventForDriver.set(eventDriverId, eventDriver.eventId);
        migrated = true;
    });
    const attemptCounts = new Map();
    [...stored.runs].sort((first, second) =>
        String(first.createdAt || first.date || "").localeCompare(String(second.createdAt || second.date || "")))
        .forEach((run) => {
            const key = `${run.eventId}:${run.driverId}`;
            const currentAttempt = attemptCounts.get(key) || 0;
            if (!Number.isInteger(run.lapGroup) || run.lapGroup < 1) {
                run.lapGroup = currentAttempt + 1;
                migrated = true;
            }
            attemptCounts.set(key, Math.max(currentAttempt, run.lapGroup));
        });
    if (migrated) fs.writeFileSync(dataFile, JSON.stringify(stored, null, 2));
    return stored;
}

let data = loadData();

function saveData() {
    const temporaryFile = `${dataFile}.tmp`;
    fs.writeFileSync(temporaryFile, JSON.stringify(data, null, 2));
    fs.renameSync(temporaryFile, dataFile);
}

function getLeaderboard() {
    const events = new Map(data.events.map((event) => [event.id, event]));
    const drivers = new Map(data.drivers.map((driver) => [driver.id, driver]));
    return data.runs.map((run) => ({
        ...run,
        name: drivers.get(run.driverId)?.name || "Unknown driver",
        eventName: events.get(run.eventId)?.name || "Unknown event",
        date: run.date || events.get(run.eventId)?.date || ""
    }));
}

let leaderboard = getLeaderboard();

function refreshLeaderboard() {
    leaderboard = getLeaderboard();
}

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

function parseCookies(header = "") {
    return Object.fromEntries(header.split(";").map((part) => {
        const separator = part.indexOf("=");
        return separator < 0 ? ["", ""] : [part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1).trim())];
    }).filter(([name]) => name));
}

function getDefaultEvent() {
    return [...data.events].sort((first, second) =>
        second.date.localeCompare(first.date) || String(second.createdAt || "").localeCompare(String(first.createdAt || "")))[0];
}

function setActiveEventCookie(response, eventId) {
    response.setHeader("Set-Cookie", `livelapEventId=${encodeURIComponent(eventId)}; Path=/; Max-Age=31536000; SameSite=Lax`);
}

function clearActiveEventCookie(response) {
    response.setHeader("Set-Cookie", "livelapEventId=; Path=/; Max-Age=0; SameSite=Lax");
}

app.use((request, response, next) => {
    const cookies = parseCookies(request.headers.cookie);
    const selectedEvent = data.events.find((event) => event.id === cookies.livelapEventId);
    const defaultEvent = getDefaultEvent();
    request.activeEventId = selectedEvent?.id || defaultEvent?.id || "";
    if ((!selectedEvent || !cookies.livelapEventId) && defaultEvent) {
        setActiveEventCookie(response, defaultEvent.id);
    }
    next();
});

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

function isValidLapTime(time) {
    const match = /^(\d{2}):(\d{2})\.(\d{2})$/.exec(String(time || ""));
    return Boolean(match) && Number(match[1]) <= 99 && Number(match[2]) < 60;
}

function normalizeLapTime(time) {
    const value = String(time || "").trim();
    if (/^(N\/A|NA)$/i.test(value)) return "N/A";
    return value;
}

function hasLapTime(time) {
    return isValidLapTime(time);
}

function isValidDate(date) {
    const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ""));
    if (!dateParts) return false;

    const parsedDate = new Date(Date.UTC(Number(dateParts[1]), Number(dateParts[2]) - 1, Number(dateParts[3])));
    return parsedDate.getUTCFullYear() === Number(dateParts[1])
        && parsedDate.getUTCMonth() + 1 === Number(dateParts[2])
        && parsedDate.getUTCDate() === Number(dateParts[3]);
}

function formatGap(hundredths) {
    const minutes = Math.floor(hundredths / 6000);
    const seconds = Math.floor((hundredths % 6000) / 100);
    const fraction = hundredths % 100;
    return `+${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(fraction).padStart(2, "0")}`;
}

function formatLapTime(hundredths) {
    const minutes = Math.floor(hundredths / 6000);
    const seconds = Math.floor((hundredths % 6000) / 100);
    const fraction = hundredths % 100;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(fraction).padStart(2, "0")}`;
}

function getSortedResults(records = leaderboard) {
    return [...records].sort((first, second) => timeToHundredths(first.time) - timeToHundredths(second.time));
}

function getDriverStandings(records = leaderboard) {
    const drivers = new Map();
    records.forEach((result) => {
        const key = result.name.trim().toLocaleUpperCase();
        if (!drivers.has(key)) drivers.set(key, []);
        drivers.get(key).push(result);
    });

    const standings = [...drivers.values()].map((runs) => {
        const timedRuns = runs.filter((run) => hasLapTime(run.time));
        const sortedRuns = getSortedResults(timedRuns);
        const totalHundredths = timedRuns.reduce((total, run) => total + timeToHundredths(run.time), 0);
        const recentRuns = runs.map((run, index) => ({ run, index })).sort((first, second) => {
            const firstTime = Date.parse(first.run.createdAt || `${normalizeDate(first.run.date)}T00:00:00Z`);
            const secondTime = Date.parse(second.run.createdAt || `${normalizeDate(second.run.date)}T00:00:00Z`);
            return secondTime - firstTime || second.index - first.index;
        });
        return {
            name: (sortedRuns[0] || runs[0]).name,
            vehicle: getVehicleName(sortedRuns[0] || runs[0]),
            time: sortedRuns[0]?.time || "N/A",
            previousTime: recentRuns[1]?.run.time || "—",
            attempts: runs.length,
            average: timedRuns.length ? formatLapTime(Math.round(totalHundredths / timedRuns.length)) : "—",
            gap: sortedRuns[0] ? timeToHundredths(sortedRuns[0].time) : Number.MAX_SAFE_INTEGER
        };
    });

    return standings.sort((first, second) => first.gap - second.gap);
}

function getEventName(result) {
    return result.eventName || "Unspecified event";
}

function getVehicleName(result) {
    return result.vehicle || "Vehicle not specified";
}

function groupResultsByLap(records) {
    const groups = new Map();
    records.forEach((result) => {
        const lapGroup = Number.isInteger(result.lapGroup) && result.lapGroup > 0 ? result.lapGroup : 1;
        if (!groups.has(lapGroup)) groups.set(lapGroup, []);
        groups.get(lapGroup).push(result);
    });
    return [...groups.entries()]
        .sort(([first], [second]) => first - second)
        .map(([lapGroup, runs]) => [lapGroup, getSortedResults(runs)]);
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

function filterResults(query = {}, activeEventId = "") {
    const driver = String(query.driver || "").trim().toLowerCase();
    const vehicle = String(query.vehicle || "").trim().toLowerCase();
    const date = String(query.date || "");

    return getSortedResults().filter((result) => {
        const matchesDriver = result.name.toLowerCase().includes(driver);
        const matchesVehicle = getVehicleName(result).toLowerCase().includes(vehicle);
        const matchesDate = !date || normalizeDate(result.date) === date;
        const matchesEvent = !activeEventId || result.eventId === activeEventId;
        return matchesDriver && matchesVehicle && matchesDate && matchesEvent;
    });
}

function renderLeaderboardRows(records, emptyMessage = "No drivers have been recorded yet.") {
    if (records.length === 0) {
        return `<tr class="empty-state"><td colspan="7">${escapeHtml(emptyMessage)}</td></tr>`;
    }

    const leader = records.find((driver) => driver.gap !== Number.MAX_SAFE_INTEGER);
    const leaderTime = leader?.gap;
    return records.map((driver, index) => `
        <tr>
            <td class="rank">${index + 1}</td>
            <td class="name">${escapeHtml(driver.name)}</td>
            <td>${escapeHtml(driver.vehicle)}</td>
            <td class="time">${escapeHtml(driver.time)}</td>
            <td class="previous-time">${escapeHtml(driver.previousTime)}</td>
            <td>${driver.attempts}</td>
            <td class="time-gap">${driver.gap === Number.MAX_SAFE_INTEGER ? "N/A" : driver === leader ? "LEADER" : formatGap(driver.gap - leaderTime)}</td>
        </tr>`).join("");
}

function renderRaceOrderMarkers(standings) {
    if (standings.length === 0) {
        return `<span class="race-order-empty">Waiting for the first recorded run</span>`;
    }

    return standings.slice(0, 10).map((driver, index) => {
        const query = new URLSearchParams({ driver: driver.name }).toString();
        return `<a class="race-order-marker" href="/results?${escapeHtml(query)}" title="View ${escapeHtml(driver.name)} results">
            <span class="race-order-position">${index + 1}</span>
            <span class="race-order-name">${escapeHtml(driver.name)}</span>
        </a>`;
    }).join("");
}

function renderResultsRows(records, returnTo) {
    if (records.length === 0) {
        const message = leaderboard.length === 0
            ? "No results have been recorded yet."
            : "No results match these filters.";
        return `<tr><td class="empty-state" colspan="7">${escapeHtml(message)}</td></tr>`;
    }

    return groupResultsByLap(records).map(([lapGroup, groupRuns]) => {
        const timedRuns = groupRuns.filter((result) => hasLapTime(result.time));
        const fastestTime = timedRuns[0] ? timeToHundredths(timedRuns[0].time) : null;
        const heading = `<tr class="lap-group-heading"><th colspan="7">Lap ${lapGroup}</th></tr>`;
        let rank = 0;
        const rows = groupRuns.map((result) => {
            const timed = hasLapTime(result.time);
            const isFastest = timed && timeToHundredths(result.time) === fastestTime;
            const rankLabel = timed ? String(++rank) : "—";
            const gapLabel = !timed ? "N/A" : isFastest ? "FASTEST" : formatGap(timeToHundredths(result.time) - fastestTime);
            return `
        <tr${isFastest ? ' class="fastest-driver"' : ""}>
            <td class="rank">${rankLabel}</td>
            <td class="name">${escapeHtml(result.name)}</td>
            <td>${escapeHtml(getVehicleName(result))}</td>
            <td class="time">${escapeHtml(result.time)}</td>
            <td class="time-gap">${gapLabel}</td>
            <td>${escapeHtml(result.date)}<small class="result-event-name">${escapeHtml(getEventName(result))}</small></td>
            <td>
                <form method="post" action="/results/delete">
                    <input type="hidden" name="id" value="${escapeHtml(result.id)}">
                    <input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}">
                    <button class="remove-result-button" type="submit">Remove</button>
                </form>
            </td>
        </tr>`;
        }).join("");
        return `${heading}${rows}`;
    }).join("");
}

function renderDriverStandingsRows(standings) {
    if (standings.length === 0) {
        return `<tr><td class="empty-state" colspan="7">No driver standings match these filters.</td></tr>`;
    }

    const leader = standings.find((driver) => driver.gap !== Number.MAX_SAFE_INTEGER);
    const leaderTime = leader?.gap;
    return standings.map((driver, index) => `
        <tr${index === 0 ? ' class="fastest-driver"' : ""}>
            <td class="rank">${index + 1}</td>
            <td class="name">${escapeHtml(driver.name)}</td>
            <td>${escapeHtml(driver.vehicle)}</td>
            <td class="time">${escapeHtml(driver.time)}</td>
            <td>${driver.attempts}</td>
            <td>${escapeHtml(driver.average)}</td>
            <td class="time-gap">${driver.gap === Number.MAX_SAFE_INTEGER ? "N/A" : driver === leader ? "LEADER" : formatGap(driver.gap - leaderTime)}</td>
        </tr>`).join("");
}

function csvCell(value) {
    const text = String(value ?? "");
    const safeText = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
    return `"${safeText.replaceAll('"', '""')}"`;
}

function renderPodiumName(result) {
    return escapeHtml(result ? result.name : "Awaiting driver");
}

function renderPodiumTime(result) {
    return escapeHtml(result ? result.time : "—");
}

function getEventSnapshot(records = leaderboard, activeEventId = "") {
    const latestRun = [...records].sort((first, second) =>
        normalizeDate(second.date).localeCompare(normalizeDate(first.date))
    )[0];

    if (!latestRun) {
        const selectedEvent = data.events.find((event) => event.id === activeEventId);
        if (selectedEvent) {
            const today = new Date().toISOString().slice(0, 10);
            const status = selectedEvent.date === today ? "Race day" : selectedEvent.date > today ? "Scheduled" : "Completed";
            const statusClass = selectedEvent.date === today ? "status-live" : selectedEvent.date > today ? "status-scheduled" : "status-complete";
            return { name: selectedEvent.name, status, statusClass };
        }
        return { name: "No event recorded", status: "Awaiting first run", statusClass: "status-waiting" };
    }

    const runDate = normalizeDate(latestRun.date);
    const today = new Date().toISOString().slice(0, 10);
    const status = runDate === today ? "Race day" : runDate > today ? "Scheduled" : "Completed";
    const statusClass = runDate === today ? "status-live" : runDate > today ? "status-scheduled" : "status-complete";
    return { name: getEventName(latestRun), status, statusClass };
}

function currentPeriod(eventId) {
    const event = data.events.find((item) => item.id === eventId);
    if (!event || !isValidDate(event.date)) return "NO EVENT SELECTED";
    const eventDate = new Date(`${event.date}T00:00:00Z`);
    return `${new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(eventDate)} LEADERBOARD`.toUpperCase();
}

function renderEventSelector(activeEventId, returnTo) {
    const events = [...data.events].sort((first, second) =>
        second.date.localeCompare(first.date) || first.name.localeCompare(second.name));
    if (!events.length) {
        return `<div class="event-switcher"><span>No events yet</span><a href="/events">Create an event</a></div>`;
    }
    return [
        `<form class="event-switcher" method="post" action="/select-event">`,
        `<label for="activeEventSelect">Current event</label>`,
        `<select id="activeEventSelect" name="eventId" onchange="this.form.submit()">`,
        ...events.map((event) => `<option value="${escapeHtml(event.id)}"${event.id === activeEventId ? " selected" : ""}>${escapeHtml(event.name)} · ${escapeHtml(event.date)}</option>`),
        `</select><input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}"></form>`
    ].join("");
}

function findEventDriver(eventId, name, includeInactive = false) {
    const normalizedName = String(name || "").trim().toLocaleUpperCase();
    const membership = data.eventDrivers.find((item) => {
        if (item.eventId !== eventId || (!includeInactive && item.active === false)) return false;
        const driver = data.drivers.find((entry) => entry.id === item.driverId);
        return driver?.name.toLocaleUpperCase() === normalizedName;
    });
    const driver = membership && data.drivers.find((item) => item.id === membership.driverId);
    return { driver, membership };
}

function getEventLapGroups(eventId) {
    return [...new Set(data.runs
        .filter((run) => run.eventId === eventId && Number.isInteger(run.lapGroup) && run.lapGroup > 0)
        .map((run) => run.lapGroup))].sort((first, second) => first - second);
}

function getNextLapGroup(eventId) {
    return Math.max(0, ...getEventLapGroups(eventId)) + 1;
}

function renderLapGroupOptions(eventId, requestedGroup) {
    const groups = getEventLapGroups(eventId);
    const nextGroup = getNextLapGroup(eventId);
    const availableGroups = [...new Set([...groups, nextGroup])].sort((first, second) => first - second);
    const requested = Number(requestedGroup);
    const selectedGroup = availableGroups.includes(requested) ? requested : nextGroup;
    return availableGroups.map((group) =>
        `<option value="${group}"${group === selectedGroup ? " selected" : ""}>Lap ${group}</option>`
    ).join("");
}

function renderRunEntryRows(eventId, lapGroup) {
    const memberships = data.eventDrivers.filter((membership) => membership.eventId === eventId && membership.active !== false && membership.vehicle);
    const drivers = new Map(data.drivers.map((driver) => [driver.id, driver]));
    const sortedMemberships = memberships
        .map((membership) => ({ membership, driver: drivers.get(membership.driverId) }))
        .filter((entry) => entry.driver)
        .sort((first, second) => first.driver.name.localeCompare(second.driver.name));
    if (!sortedMemberships.length) {
        return '<tr><td class="empty-state" colspan="3">Add event drivers and their cars on <a href="/events">Manage Events</a> first.</td></tr>';
    }
    return sortedMemberships.map(({ membership, driver }) => {
        const recordedRun = data.runs.find((run) => run.eventId === eventId
            && run.driverId === driver.id && run.lapGroup === Number(lapGroup));
        return `<tr>
            <td class="name">${escapeHtml(driver.name)}</td>
            <td>${escapeHtml(membership.vehicle)}</td>
            <td><input class="lap-time-entry" type="text" name="lapTime_${escapeHtml(driver.id)}" value="${escapeHtml(recordedRun?.time || "")}" placeholder="MM:SS.hh or N/A" inputmode="text" autocomplete="off" aria-label="Lap time for ${escapeHtml(driver.name)}" pattern="([0-9]{2}:[0-5][0-9]\\.[0-9]{2}|N/A|NA)" title="Use MM:SS.hh format or enter N/A." required></td>
        </tr>`;
    }).join("");
}

function renderActiveEventName(eventId) {
    const event = data.events.find((item) => item.id === eventId);
    return escapeHtml(event ? event.name : "No event selected");
}

function renderHome(request, response) {
    refreshLeaderboard();
    const eventResults = leaderboard.filter((result) => result.eventId === request.activeEventId);
    const lapGroup = Number(request.query.lapGroup) || getNextLapGroup(request.activeEventId);
    const filteredResults = filterResults({ driver: request.query.driver }, request.activeEventId);
    const sortedResults = getSortedResults(eventResults);
    const filteredStandings = getDriverStandings(filteredResults);
    const eventSnapshot = getEventSnapshot(eventResults, request.activeEventId);
    const searchTerm = escapeHtml(request.query.driver || "");
    const hasError = request.query.error === "invalid";

    renderTemplate("index.html", {
        leaderboardPeriod: currentPeriod(request.activeEventId),
        runCount: String(eventResults.length),
        driverCount: String(new Set(eventResults.map((result) => result.name)).size),
        fastestLap: escapeHtml(sortedResults[0]?.time || "—"),
        currentEventName: escapeHtml(eventSnapshot.name),
        eventStatus: escapeHtml(eventSnapshot.status),
        eventStatusClass: eventSnapshot.statusClass,
        driverFilter: searchTerm,
        leaderboardRows: renderLeaderboardRows(
            filteredStandings,
            searchTerm ? "No drivers match your search." : "No drivers have been recorded yet."
        ),
        raceOrderMarkers: renderRaceOrderMarkers(filteredStandings),
        formMessage: hasError ? "Enter MM:SS.hh or N/A for every driver in this lap group." : "",
        activeEventName: renderActiveEventName(request.activeEventId),
        eventSelector: renderEventSelector(request.activeEventId, request.originalUrl),
        lapGroupOptions: renderLapGroupOptions(request.activeEventId, lapGroup),
        runEntryRows: renderRunEntryRows(request.activeEventId, lapGroup),
        runSubmitDisabled: data.eventDrivers.some((membership) => membership.eventId === request.activeEventId && membership.active !== false && membership.vehicle) ? "" : "disabled"
    }, response);
}

function renderLeaderboardPage(request, response) {
    refreshLeaderboard();
    const eventResults = leaderboard.filter((result) => result.eventId === request.activeEventId);
    const lapGroup = Number(request.query.lapGroup) || getNextLapGroup(request.activeEventId);
    const sortedResults = getSortedResults(eventResults);
    const standings = getDriverStandings(sortedResults);
    const eventSnapshot = getEventSnapshot(eventResults, request.activeEventId);
    renderTemplate("table-skeleton.html", {
        leaderboardPeriod: currentPeriod(request.activeEventId),
        runCount: String(sortedResults.length),
        driverCount: String(standings.length),
        fastestLap: escapeHtml(sortedResults[0]?.time || "—"),
        currentEventName: escapeHtml(eventSnapshot.name),
        eventStatus: escapeHtml(eventSnapshot.status),
        eventStatusClass: eventSnapshot.statusClass,
        leaderboardRows: renderLeaderboardRows(standings),
        raceOrderMarkers: renderRaceOrderMarkers(standings),
        formMessage: request.query.error === "invalid"
            ? "Enter MM:SS.hh or N/A for every driver in this lap group."
            : "",
        activeEventName: renderActiveEventName(request.activeEventId),
        eventSelector: renderEventSelector(request.activeEventId, request.originalUrl),
        lapGroupOptions: renderLapGroupOptions(request.activeEventId, lapGroup),
        runEntryRows: renderRunEntryRows(request.activeEventId, lapGroup),
        runSubmitDisabled: data.eventDrivers.some((membership) => membership.eventId === request.activeEventId && membership.active !== false && membership.vehicle) ? "" : "disabled"
    }, response);
}

function renderResultsPage(request, response) {
    refreshLeaderboard();
    const filters = {
        driver: String(request.query.driver || ""),
        vehicle: String(request.query.vehicle || ""),
        date: String(request.query.date || "")
    };
    const eventResults = leaderboard.filter((result) => result.eventId === request.activeEventId);
    const topDrivers = getDriverStandings(eventResults).slice(0, 3);
    const vehicles = [...new Set(eventResults.map(getVehicleName))]
        .sort((first, second) => first.localeCompare(second));
    const vehicleOptions = [
        `<option value="">All vehicles</option>`,
        ...vehicles.map((vehicle) => `<option value="${escapeHtml(vehicle)}"${vehicle === filters.vehicle ? " selected" : ""}>${escapeHtml(vehicle)}</option>`)
    ].join("");
    const queryString = new URLSearchParams(filters).toString();
    const returnTo = `/results${queryString ? `?${queryString}` : ""}`;
    const filteredResults = filterResults(filters, request.activeEventId);
    const filteredStandings = getDriverStandings(filteredResults);
    const filteredDriverCount = filteredStandings.length;
    const fastestFilteredTime = filteredResults[0]?.time || "—";

    renderTemplate("The Data Entry.html", {
        firstDriverName: renderPodiumName(topDrivers[0]),
        firstDriverTime: renderPodiumTime(topDrivers[0]),
        firstDriverVehicle: escapeHtml(topDrivers[0] ? getVehicleName(topDrivers[0]) : "—"),
        secondDriverName: renderPodiumName(topDrivers[1]),
        secondDriverTime: renderPodiumTime(topDrivers[1]),
        secondDriverVehicle: escapeHtml(topDrivers[1] ? getVehicleName(topDrivers[1]) : "—"),
        thirdDriverName: renderPodiumName(topDrivers[2]),
        thirdDriverTime: renderPodiumTime(topDrivers[2]),
        thirdDriverVehicle: escapeHtml(topDrivers[2] ? getVehicleName(topDrivers[2]) : "—"),
        driverFilter: escapeHtml(filters.driver),
        dateFilter: escapeHtml(filters.date),
        eventSelector: renderEventSelector(request.activeEventId, request.originalUrl),
        vehicleOptions,
        resultCount: String(filteredResults.length),
        driverCount: String(filteredDriverCount),
        fastestFilteredTime: escapeHtml(fastestFilteredTime),
        comparisonScope: "in the selected event",
        resultsRows: renderResultsRows(filteredResults, returnTo),
        driverStandingsRows: renderDriverStandingsRows(filteredStandings),
        exportUrl: escapeHtml(`/results/export${queryString ? `?${queryString}` : ""}`)
    }, response);
}

app.get(["/", "/index.html"], renderHome);
app.get(["/leaderboard", "/table-skeleton.html"], renderLeaderboardPage);
app.get(["/results", "/The Data Entry.html"], renderResultsPage);

app.post("/select-event", (request, response) => {
    const eventId = String(request.body.eventId || "");
    const event = data.events.find((item) => item.id === eventId);
    if (!event) return response.redirect(303, "/events");
    setActiveEventCookie(response, event.id);
    const returnTo = String(request.body.returnTo || "/");
    response.redirect(303, returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/");
});

app.get("/events", (request, response) => {
    const events = [...data.events].sort((first, second) =>
        second.date.localeCompare(first.date) || first.name.localeCompare(second.name));
    const eventRows = events.length
        ? events.map((event) => {
            const driverCount = new Set(data.eventDrivers.filter((item) => item.eventId === event.id && item.active !== false).map((item) => item.driverId)).size;
            const runCount = data.runs.filter((run) => run.eventId === event.id).length;
            const activeBadge = event.id === request.activeEventId ? '<span class="active-event-badge">Active</span>' : "";
            return `<tr><td class="name">${escapeHtml(event.name)} ${activeBadge}</td><td>${escapeHtml(event.date)}</td><td>${driverCount}</td><td>${runCount}</td><td><form method="post" action="/events/remove" onsubmit="return confirm('Remove this event and all its recorded runs?')"><input type="hidden" name="eventId" value="${escapeHtml(event.id)}"><button class="remove-result-button" type="submit">Remove</button></form></td></tr>`;
        }).join("")
        : '<tr><td class="empty-state" colspan="5">No events yet. Create one to record a run.</td></tr>';
    const activeEvent = data.events.find((event) => event.id === request.activeEventId);
    const eventNotice = request.query.event === "removed"
        ? '<p class="event-feedback" role="status">Event and its recorded runs were removed.</p>'
        : "";
    const assignedDriverIds = new Set(data.eventDrivers
        .filter((eventDriver) => eventDriver.eventId === request.activeEventId && eventDriver.active !== false)
        .map((eventDriver) => eventDriver.driverId));
    const assignedDrivers = data.drivers.filter((driver) => assignedDriverIds.has(driver.id));
    const driverRows = assignedDrivers.length
        ? assignedDrivers.map((driver) => {
            const membership = data.eventDrivers.find((item) => item.eventId === request.activeEventId && item.driverId === driver.id);
            const runCount = data.runs.filter((run) => run.eventId === request.activeEventId && run.driverId === driver.id).length;
            return `<tr><td>${escapeHtml(driver.name)}</td><td>${escapeHtml(membership?.vehicle || "Car not assigned")}</td><td>${runCount}</td><td><form method="post" action="/event-drivers/remove" onsubmit="return confirm('Remove this driver from the event? Their recorded runs will be kept.')"><input type="hidden" name="driverId" value="${escapeHtml(driver.id)}"><button class="remove-result-button" type="submit">Remove</button></form></td></tr>`;
        }).join("")
        : '<tr><td class="empty-state" colspan="4">No drivers have been added to this event yet.</td></tr>';
    const driverMessage = request.query.driver === "added"
        ? '<p class="event-feedback" role="status">Driver added to the active event.</p>'
        : request.query.driver === "exists"
            ? '<p class="event-feedback" role="status">Driver is already in this event; the car assignment was updated.</p>'
            : request.query.driver === "missing"
                ? '<p class="event-feedback" role="status">Add this driver and assign a car before recording a run.</p>'
            : request.query.driver === "removed"
                ? '<p class="event-feedback" role="status">Driver removed from the active event. Recorded runs were kept.</p>'
            : "";
    const activeEventManagement = activeEvent ? `
        <section class="event-driver-management" aria-labelledby="eventDriversHeading">
            <h2 id="eventDriversHeading">Drivers in ${escapeHtml(activeEvent.name)}</h2>
            <p>Add a driver and the car they will use for this event. Driver records stay separate between events; re-enter a name here to update this event’s car assignment.</p>
            ${driverMessage}
            <form method="post" action="/event-drivers" class="results-filter-bar event-driver-form">
                <label class="results-filter-field" for="eventDriverName">Driver name
                    <input id="eventDriverName" name="driverName" maxlength="60" required placeholder="Driver name for this event">
                </label>
                <label class="results-filter-field" for="eventDriverVehicle">Car for this event
                    <input id="eventDriverVehicle" name="vehicle" maxlength="60" required placeholder="e.g. Yokomo YD-2">
                </label>
                <button class="results-filter-submit" type="submit">Add driver</button>
            </form>
            <div class="results-table-scroll"><table id="eventDriversTable"><thead><tr><th>Driver</th><th>Car for this event</th><th>Recorded Runs</th><th>Action</th></tr></thead><tbody>${driverRows}</tbody></table></div>
        </section>` : `
        <section class="event-driver-management"><h2>Manage event drivers</h2><p>Create an event first, then select it from the navigation to add its drivers.</p></section>`;

    renderTemplate("events.html", {
        eventSelector: renderEventSelector(request.activeEventId, request.originalUrl),
        eventRows,
        eventNotice,
        activeEventManagement
    }, response);
});

app.post("/events", (request, response) => {
    const name = String(request.body.name || "").trim();
    const date = String(request.body.date || "");
    if (!name || name.length > 80 || !isValidDate(date)) {
        return response.redirect(303, "/events?error=invalid");
    }
    const event = { id: crypto.randomUUID(), name, date, status: "scheduled", createdAt: new Date().toISOString() };
    data.events.push(event);
    saveData();
    setActiveEventCookie(response, event.id);
    response.redirect(303, "/events");
});

app.post("/events/remove", (request, response) => {
    const eventId = String(request.body.eventId || "");
    const event = data.events.find((item) => item.id === eventId);
    if (!event) return response.redirect(303, "/events");

    data.events = data.events.filter((item) => item.id !== eventId);
    data.eventDrivers = data.eventDrivers.filter((item) => item.eventId !== eventId);
    data.runs = data.runs.filter((run) => run.eventId !== eventId);
    const remainingDriverIds = new Set(data.eventDrivers.map((item) => item.driverId));
    data.drivers = data.drivers.filter((driver) => remainingDriverIds.has(driver.id));
    saveData();

    if (request.activeEventId === eventId) {
        const replacementEvent = getDefaultEvent();
        if (replacementEvent) setActiveEventCookie(response, replacementEvent.id);
        else clearActiveEventCookie(response);
    }
    response.redirect(303, "/events?event=removed");
});

app.post("/event-drivers", (request, response) => {
    const event = data.events.find((item) => item.id === request.activeEventId);
    const name = String(request.body.driverName || "").trim();
    const vehicle = String(request.body.vehicle || "").trim();
    if (!event || !name || name.length > 60 || !vehicle || vehicle.length > 60) return response.redirect(303, "/events");

    let { driver, membership } = findEventDriver(event.id, name, true);
    if (!driver) {
        driver = { id: crypto.randomUUID(), name: name.toLocaleUpperCase() };
        data.drivers.push(driver);
    }
    if (membership) {
        membership.vehicle = vehicle;
        membership.active = true;
        saveData();
        return response.redirect(303, "/events?driver=exists");
    }
    data.eventDrivers.push({ eventId: event.id, driverId: driver.id, vehicle, active: true });
    saveData();
    response.redirect(303, "/events?driver=added");
});

app.post("/event-drivers/remove", (request, response) => {
    const driverId = String(request.body.driverId || "");
    const membership = data.eventDrivers.find((item) =>
        item.eventId === request.activeEventId && item.driverId === driverId && item.active !== false);
    if (!membership) return response.redirect(303, "/events");
    membership.active = false;
    saveData();
    response.redirect(303, "/events?driver=removed");
});

app.get("/results/export", (request, response) => {
    refreshLeaderboard();
    const records = filterResults(request.query, request.activeEventId);
    const lines = [
        ["Rank", "Lap Group", "Driver", "Vehicle", "Lap Time", "Gap to Fastest in Lap", "Date", "Event"].map(csvCell).join(","),
        ...groupResultsByLap(records).flatMap(([lapGroup, groupRuns]) => {
            const timedRuns = groupRuns.filter((result) => hasLapTime(result.time));
            const fastest = timedRuns[0] ? timeToHundredths(timedRuns[0].time) : null;
            let rank = 0;
            return groupRuns.map((result) => {
                const timed = hasLapTime(result.time);
                const isFastest = timed && timeToHundredths(result.time) === fastest;
                return [
                    timed ? ++rank : "",
                    `Lap ${lapGroup}`,
                    result.name,
                    getVehicleName(result),
                    result.time,
                    !timed ? "N/A" : isFastest ? "FASTEST" : formatGap(timeToHundredths(result.time) - fastest),
                    normalizeDate(result.date),
                    getEventName(result)
                ].map(csvCell).join(",");
            });
        })
    ];

    response.setHeader("Content-Disposition", 'attachment; filename="livelap-results.csv"');
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.send("\uFEFF" + lines.join("\r\n"));
});

app.post("/times", (request, response) => {
    const lapGroup = Number(request.body.lapGroup);
    const event = data.events.find((item) => item.id === request.activeEventId);
    if (!event) return response.redirect(303, "/events");
    const destination = request.body.returnTo === "/leaderboard" ? "/leaderboard" : "/";
    const invalidRedirect = () => response.redirect(303, `${destination}?error=invalid&lapGroup=${encodeURIComponent(Number.isInteger(lapGroup) && lapGroup > 0 ? lapGroup : getNextLapGroup(event.id))}`);
    if (!Number.isInteger(lapGroup) || lapGroup < 1) return invalidRedirect();

    const submissions = Object.entries(request.body)
        .filter(([key]) => key.startsWith("lapTime_"))
        .map(([key, value]) => ({ driverId: key.slice("lapTime_".length), time: normalizeLapTime(value) }));
    if (!submissions.length || submissions.some(({ time }) => !hasLapTime(time) && time !== "N/A")) return invalidRedirect();

    const participantEntries = submissions.map((submission) => {
        const membership = data.eventDrivers.find((item) => item.eventId === event.id
            && item.driverId === submission.driverId && item.active !== false && item.vehicle);
        return membership ? { ...submission, membership } : null;
    });
    if (participantEntries.some((entry) => !entry)) return invalidRedirect();

    const recordedAt = new Date().toISOString();
    participantEntries.forEach(({ driverId, time, membership }) => {
        const existingRun = data.runs.find((run) => run.eventId === event.id
            && run.driverId === driverId && run.lapGroup === lapGroup);
        if (existingRun) {
            existingRun.time = time;
            existingRun.vehicle = membership.vehicle;
            existingRun.date = event.date;
            existingRun.createdAt = recordedAt;
        } else {
            data.runs.push({
                id: crypto.randomUUID(), eventId: event.id, driverId, lapGroup,
                vehicle: membership.vehicle, time, date: event.date, createdAt: recordedAt
            });
        }
    });
    saveData();
    refreshLeaderboard();

    const nextGroup = getNextLapGroup(event.id);
    response.redirect(303, `${destination}?lapGroup=${nextGroup}#entryModal`);
});

app.post("/results/delete", (request, response) => {
    const resultId = String(request.body.id || "");
    data.runs = data.runs.filter((result) => result.id !== resultId);
    saveData();
    refreshLeaderboard();

    const returnTo = String(request.body.returnTo || "/results");
    response.redirect(303, returnTo.startsWith("/results") && !returnTo.startsWith("//") ? returnTo : "/results");
});

app.get("/api/leaderboard", (request, response) => {
    refreshLeaderboard();
    response.json(filterResults(request.query, request.activeEventId));
});

app.get("/api/standings", (request, response) => {
    refreshLeaderboard();
    response.json(getDriverStandings(filterResults(request.query, request.activeEventId)));
});

// Keep the JSON submission endpoint available for clients that use the API.
app.post("/api/leaderboard", (request, response) => {
    const name = String(request.body.name || "").trim();
    const time = normalizeLapTime(request.body.time);
    const event = data.events.find((item) => item.id === request.activeEventId);
    const requestedLapGroup = Number(request.body.lapGroup);
    const lapGroup = Number.isInteger(requestedLapGroup) && requestedLapGroup > 0
        ? requestedLapGroup
        : event ? getNextLapGroup(event.id) : 0;

    if (!name || name.length > 60 || (!hasLapTime(time) && time !== "N/A") || !event) {
        return response.status(400).json({ error: "Select an active event and registered driver, and enter MM:SS.hh or N/A." });
    }

    const { driver, membership } = findEventDriver(event.id, name);
    if (!driver || !membership?.vehicle) {
        return response.status(400).json({ error: "Add this driver and their car to the active event first." });
    }
    const existingRun = data.runs.find((run) => run.eventId === event.id && run.driverId === driver.id && run.lapGroup === lapGroup);
    if (existingRun) {
        existingRun.time = time;
        existingRun.vehicle = membership.vehicle;
        existingRun.date = event.date;
        existingRun.createdAt = new Date().toISOString();
    } else {
        data.runs.push({ id: crypto.randomUUID(), eventId: event.id, driverId: driver.id, lapGroup, vehicle: membership.vehicle, time, date: event.date, createdAt: new Date().toISOString() });
    }
    saveData();
    refreshLeaderboard();
    response.status(201).json({ message: "Time added successfully!" });
});

app.use(express.static(__dirname));

if (require.main === module) {
    app.listen(port, () => {
        console.log(`LiveLap server running at http://localhost:${port}`);
    });
}

module.exports = app;
module.exports.createInitialData = createInitialData;
