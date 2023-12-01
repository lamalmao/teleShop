const { Schema, SchemaTypes, model } = require("mongoose");

const CardTransaction = new Schema({
  card: {
    type: SchemaTypes.ObjectId,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    enum: ["UAH", "EUR", "USD"],
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
    required: true,
  },
  issuer: {
    type: Number,
    required: true,
  },
  success: {
    type: Boolean,
    required: true,
    default: true,
  },
  balanceAfter: {
    type: Number,
    required: true,
  },
  description: String,
  orderId: Number,
});

const cardTransactions = model("cards-transactions", CardTransaction);

module.exports = cardTransactions;
