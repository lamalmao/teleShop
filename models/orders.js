const { Schema, model, SchemaTypes } = require("mongoose");

const Order = new Schema({
  orderID: {
    type: Number,
    required: true,
    unique: true,
  },
  client: {
    type: Number,
    required: true,
  },
  manager: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    required: true,
    enum: ["untaken", "processing", "done", "refund", "canceled", "delivered"],
    default: "untaken",
  },
  paid: {
    type: Boolean,
    default: false,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  item: {
    type: String,
    required: true,
  },
  itemTitle: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  platform: {
    type: String,
    enum: ["ps", "pc", "android", "xbox", "nintendo"],
  },
  data: {
    login: String,
    password: String,
  },
  game: {
    type: String,
    enum: global.games,
    required: true,
  },
  refundData: String,
  refundStatus: {
    type: String,
    enum: ["rejected", "approved", "waiting"],
  },
  extra: {
    message: String,
    choice: String,
  },
  keyIssued: {
    type: Boolean,
    default: false,
  },
  keyUsed: {
    type: SchemaTypes.ObjectId,
    required: false,
  },
  key: String,
  card: SchemaTypes.ObjectId,
  cardNumber: String,
  cardPaid: Boolean,
});

const orders = model("orders", Order);

module.exports = orders;
