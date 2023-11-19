const csvParser = require("csv-parser");
const { Schema, model, SchemaTypes, Types } = require("mongoose");

const ManagerKey = new Schema({
  date: {
    type: Date,
    default: Date.now,
  },
  value: {
    type: String,
    required: true,
  },
  used: {
    type: Boolean,
    required: true,
    default: false,
  },
  item: {
    type: SchemaTypes.ObjectId,
    required: true,
  },
});

const managerKey = model("manager-keys", ManagerKey);

function parseTableToBase(file, item) {
  let dbTasks = [];

  file
    .pipe(csvParser())
    .on("data", (data) => {
      dbTasks.push(
        managerKey.create({
          item: Types.ObjectId(item),
          value: data.keys,
        })
      );
    })
    .on("end", async (_) => {
      const result = await Promise.allSettled(dbTasks);
      console.log(`Parsed ${result.length} entries`);

      const length = result.length;
      const done = result.filter((i) => i.status === "fulfilled").length;

      file.emit("done", {
        done,
        failed: length - done,
      });
    });

  return file;
}

module.exports = managerKey;
module.exports.parseManagerKeysFile = parseTableToBase;
