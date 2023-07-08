const fs = require("fs");
const path = require("path");

const botMessages = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "menu.json").toString())
);

module.exports = botMessages;
