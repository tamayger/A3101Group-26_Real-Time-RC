const express = require('express');
const app = express();
const port = 3000;

// Serve the static HTML, CSS, and JS files from the current directory
app.use(express.static(__dirname));
app.use(express.json()); // Allows server to read incoming JSON data

// In-memory data store (replaces the hardcoded HTML)
let leaderboard = [
    { time: "00:24.53", name: "TYRESE MARIANO", date: "2026-SEP-06" },
    { time: "01:23.16", name: "RICARDO MARMOL", date: "2026-SEP-06" },
    { time: "01:32.62", name: "ANTHONY BERNALES", date: "2026-SEP-06" },
    { time: "02:04.08", name: "JONATHAN BACANI", date: "2026-SEP-01" }
];

// GET route to send leaderboard data to the frontend
app.get('/api/leaderboard', (req, res) => {
    res.json(leaderboard);
});

app.listen(port, () => {
    console.log("LiveLap server running at http://localhost:" + port);
});