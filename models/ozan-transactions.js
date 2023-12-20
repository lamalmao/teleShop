const { Schema, model, SchemaTypes } = require('mongoose');

const OzanTransaction = new Schema({
  amount: {
    type: Number,
    required: true
  },
  order: {
    type: Number,
    required: false
  },
  account: {
    type: SchemaTypes.ObjectId,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  success: {
    type: Boolean,
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  issuer: {
    type: Number,
    required: true
  }
});

const ozanTransactions = model('ozan-transaction', OzanTransaction);
module.exports = ozanTransactions;
