(() => {
    function formatLapTimeInput(input) {
        input.addEventListener("input", () => {
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

    document.querySelectorAll("#newTime, #time").forEach(formatLapTimeInput);
})();
