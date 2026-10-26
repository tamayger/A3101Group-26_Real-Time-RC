(function updateLeaderboardPeriod() {
    const leaderboardPeriod = document.getElementById("leaderboardPeriod");

    if (!leaderboardPeriod) {
        return;
    }

    const currentMonthAndYear = new Intl.DateTimeFormat("en", {
        month: "long",
        year: "numeric"
    }).format(new Date());
    leaderboardPeriod.textContent = `${currentMonthAndYear} LEADERBOARDS`.toUpperCase();
})();
