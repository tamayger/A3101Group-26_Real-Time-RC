
// Get existing data from localStorage
let results = JSON.parse(localStorage.getItem("liveLapResults")) || [];


// ==========================================
// DATA ENTRY
// ==========================================

const form = document.getElementById("raceForm");

if (form) {

    form.addEventListener("submit", function(event) {

        event.preventDefault();

        // Get values from the form
        const name = document.getElementById("name").value.trim();
        const time = document.getElementById("time").value.trim();
        const date = document.getElementById("date").value;

        // Create new result
        const newResult = {
            name: name.toUpperCase(),
            time: time,
            date: date
        };

        // Add result
        results.push(newResult);

        // Save data
        localStorage.setItem(
            "liveLapResults",
            JSON.stringify(results)
        );

        // Clear form
        form.reset();

        // Show message
        document.getElementById("message").textContent =
            "Result successfully added!";

    });

}


// ==========================================
// LEADERBOARD RENDERING
// ==========================================

const leaderboardBody =
    document.getElementById("leaderboardBody");

if (leaderboardBody) {

    renderLeaderboard();

}


function renderLeaderboard() {

    // Clear existing rows
    leaderboardBody.innerHTML = "";

    // Sort fastest time first
    results.sort(function(a, b) {
        return convertTime(a.time) - convertTime(b.time);
    });


    // Create table rows
    results.forEach(function(result, index) {

        const row = document.createElement("tr");

        row.innerHTML = `
            <td class="rank">${index + 1}</td>
            <td class="time">${result.time}</td>
            <td class="name">${result.name}</td>
            <td>${result.date}</td>
        `;

        leaderboardBody.appendChild(row);

    });

}


// ==========================================
// CONVERT TIME
// Example: 01:23.16
// ==========================================

function convertTime(time) {

    const parts = time.split(":");

    const minutes = parseInt(parts[0]);
    const seconds = parseFloat(parts[1]);

    return (minutes * 60) + seconds;

}
