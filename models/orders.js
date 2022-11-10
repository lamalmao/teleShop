const { Schema, model } = require('mongoose');

const Order = new Schema({
  orderID: {
    type: Number,
    required: true,
    unique: true
  },
  client: {
    type: Number,
    required: true
  },
  manager: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    required: true,
    enum: ['untaken', 'processing', 'done', 'refund'],
    default: 'untaken'
  },
  date: {
    type: Date,
    default: Date.now()
  },
  item: {
    type: String,
    required: true
  },
  itemTitle: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  data: {
    login: String,
    password: String
  }
});

const orders = model('orders', Order);

module.exports = orders;