const fs = require("fs");
const path = require("path");
const createInitialData = require("../server").createInitialData;

const dataDirectory = path.join(__dirname, "..", "data");
const dataFile = path.join(dataDirectory, "livelap.json");

fs.mkdirSync(dataDirectory, { recursive: true });
fs.writeFileSync(dataFile, `${JSON.stringify(createInitialData(), null, 2)}\n`);
console.log(`Sample event and lap data written to ${dataFile}`);
