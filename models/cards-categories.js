const { Schema, model } = require("mongoose");

const CardCategory = new Schema({
  title: {
    type: String,
    required: true,
    unique: true,
  },
  date: {
    type: Date,
    required: true,
    default: Date.now,
  },
});

const cardsCategories = model("cards-categories", CardCategory);
module.exports = cardsCategories;
