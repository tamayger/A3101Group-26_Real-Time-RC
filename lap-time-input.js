(() => {
    function formatLapTimeInput(input) {
        input.addEventListener("input", () => {
            const textValue = input.value.trim().toUpperCase();
            if (/^(N|N\/|N\/A|NA)$/.test(textValue)) {
                input.value = textValue;
                input.setSelectionRange(input.value.length, input.value.length);
                return;
            }

            const cursorPosition = input.selectionStart ?? input.value.length;
            const digitsBeforeCursor = input.value
                .slice(0, cursorPosition)
                .replace(/\D/g, "").length;
            const digits = input.value.replace(/\D/g, "").slice(0, 6);

            let formattedTime = digits.slice(0, 2);

            if (digits.length > 2) {
                formattedTime += `:${digits.slice(2, 4)}`;
            }

            if (digits.length > 4) {
                formattedTime += `.${digits.slice(4, 6)}`;
            }

            input.value = formattedTime;

            let newCursorPosition = 0;
            let digitsCounted = 0;

            while (newCursorPosition < formattedTime.length && digitsCounted < digitsBeforeCursor) {
                if (/\d/.test(formattedTime[newCursorPosition])) {
                    digitsCounted++;
                }
                newCursorPosition++;
            }

            while (/[:.]/.test(formattedTime[newCursorPosition] || "")) {
                newCursorPosition++;
            }

            input.setSelectionRange(newCursorPosition, newCursorPosition);
        });
    }

    document.querySelectorAll("#newTime, #time, .lap-time-entry").forEach(formatLapTimeInput);

    const lapGroupSelect = document.querySelector("#lapGroup");
    if (lapGroupSelect) {
        lapGroupSelect.addEventListener("change", () => {
            const nextUrl = new URL(window.location.href);
            nextUrl.searchParams.set("lapGroup", lapGroupSelect.value);
            nextUrl.searchParams.delete("error");
            nextUrl.hash = "entryModal";
            window.location.assign(nextUrl);
        });
    }

    const entryModal = document.querySelector("#entryModal");
    if (entryModal) {
        const openEntryModal = () => {
            if (typeof entryModal.showModal === "function") entryModal.showModal();
            else entryModal.setAttribute("open", "");
        };

        document.querySelectorAll("[data-open-modal]").forEach((button) => {
            button.addEventListener("click", openEntryModal);
        });

        document.querySelectorAll("[data-close-modal]").forEach((button) => {
            button.addEventListener("click", () => entryModal.close());
        });

        window.addEventListener("hashchange", () => {
            if (window.location.hash === "#entryModal") openEntryModal();
        });

        entryModal.addEventListener("click", (event) => {
            if (event.target === entryModal) entryModal.close();
        });

        const query = new URLSearchParams(window.location.search);
        if (window.location.hash === "#entryModal" || query.get("error") === "invalid") {
            openEntryModal();
        }
    }

    function createCell(row, value, className = "") {
        const cell = document.createElement("td");
        if (className) cell.className = className;
        cell.textContent = value;
        row.append(cell);
        return cell;
    }

    function formatGap(hundredths) {
        const minutes = Math.floor(hundredths / 6000);
        const seconds = Math.floor((hundredths % 6000) / 100);
        const fraction = hundredths % 100;
        return `+${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(fraction).padStart(2, "0")}`;
    }

    function refreshRaceOrder(results) {
        const track = document.querySelector(".race-order-track");
        if (!track) return;

        const fragment = document.createDocumentFragment();
        if (results.length === 0) {
            const empty = document.createElement("span");
            empty.className = "race-order-empty";
            empty.textContent = "Waiting for the first recorded run";
            fragment.append(empty);
        } else {
            results.slice(0, 10).forEach((driver, index) => {
                const marker = document.createElement("a");
                marker.className = "race-order-marker";
                marker.href = `/results?driver=${encodeURIComponent(driver.name)}`;
                marker.title = `View ${driver.name} results`;

                const position = document.createElement("span");
                position.className = "race-order-position";
                position.textContent = String(index + 1);

                const name = document.createElement("span");
                name.className = "race-order-name";
                name.textContent = driver.name;

                marker.append(position, name);
                fragment.append(marker);
            });
        }

        track.replaceChildren(fragment);
    }

    async function refreshLeaderboard(tbody) {
        if (document.visibilityState === "hidden") return;

        try {
            const apiUrl = new URL("/api/standings", window.location.origin);
            const isHomePage = window.location.pathname === "/" || window.location.pathname === "/index.html";
            const driverFilter = isHomePage ? new URLSearchParams(window.location.search).get("driver") || "" : "";
            if (driverFilter) apiUrl.searchParams.set("driver", driverFilter);

            const response = await fetch(apiUrl, { headers: { Accept: "application/json" }, cache: "no-store" });
            if (!response.ok) throw new Error("Leaderboard refresh failed");

            const results = await response.json();
            const fragment = document.createDocumentFragment();
            if (results.length === 0) {
                const row = document.createElement("tr");
                row.className = "empty-state";
                const cell = document.createElement("td");
                cell.colSpan = 7;
                cell.textContent = driverFilter ? "No drivers match your search." : "No drivers have been recorded yet.";
                row.append(cell);
                fragment.append(row);
            } else {
                results.forEach((result, index) => {
                    const row = document.createElement("tr");
                    createCell(row, String(index + 1), "rank");
                    createCell(row, result.name, "name");
                    createCell(row, result.vehicle || "Vehicle not specified");
                    createCell(row, result.time, "time");
                    createCell(row, result.previousTime || "—", "previous-time");
                    createCell(row, String(result.attempts || 1));
                    createCell(row, index === 0 ? "LEADER" : formatGap(result.gap - results[0].gap), "time-gap");
                    fragment.append(row);
                });
            }

            tbody.replaceChildren(fragment);
            refreshRaceOrder(results);
            document.querySelectorAll("[data-live-status]").forEach((indicator) => {
                indicator.classList.remove("is-stale");
                indicator.title = "Leaderboard is up to date.";
            });
        } catch {
            // Keep the last server-rendered leaderboard visible if refresh is unavailable.
            document.querySelectorAll("[data-live-status]").forEach((indicator) => {
                indicator.classList.add("is-stale");
                indicator.title = "Live refresh is unavailable. Showing the latest loaded results.";
            });
        }
    }

    const liveLeaderboard = document.querySelector("[data-live-board]");
    if (liveLeaderboard) {
        refreshLeaderboard(liveLeaderboard);
        window.setInterval(() => refreshLeaderboard(liveLeaderboard), 15000);
    }
})();
