const { model, Schema } = require('mongoose');

const TicketSchema = new Schema({
  client: {
    type: Number,
    required: true
  },
  manager: Number,
  theme: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  done: {
    type: Boolean,
    required: true,
    default: false
  },
  created: {
    type: Date,
    required: true,
    default: Date.now
  },
  waitingForUser: {
    type: Boolean,
    required: true,
    default: false
  },
  mark: {
    type: Number,
    default: 0
  },
  lastAnswer: Date,
  closed: Date
});

const tickets = model('tickets', TicketSchema);
module.exports = tickets;
