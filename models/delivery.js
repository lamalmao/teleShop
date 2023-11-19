const { Schema, Types, model } = require("mongoose");
const CSVParser = require("csv-parser");

const Delivery = new Schema({
  item: {
    type: Types.ObjectId,
    required: true,
  },
  value: {
    type: String,
    required: true,
    get: getValue,
    set: setValue,
  },
  delivered: {
    type: Boolean,
    default: false,
  },
  accessable: {
    type: Boolean,
    default: true,
  },
  addDate: {
    type: Date,
    default: Date.now(),
  },
  departureDate: Date,
});

function setValue(value) {
  return global.key.encrypt(value, "base64");
}

function getValue(value) {
  return global.key.decrypt(value).toString("utf-8");
}

function parseTableToBase(file, item) {
  var dbTasks = [];

  file
    .pipe(CSVParser())
    .on("data", (data) => {
      dbTasks.push(
        delivery.create({
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

Delivery.methods.parseFile = parseTableToBase;

const delivery = model("delivery", Delivery);

module.exports.delivery = delivery;
module.exports.parseFile = parseTableToBase;
