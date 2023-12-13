const { Schema, SchemaTypes, model } = require('mongoose');

const MessageSchema = new Schema({
  text: String,
  image: String,
  date: {
    type: Date,
    default: Date.new
  }
});

const TicketMessageSchema = new Schema({
  ticket: {
    type: SchemaTypes.ObjectId,
    required: true
  },
  creationDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  answerDate: Date,
  question: {
    type: MessageSchema,
    required: true
  },
  manager: Number,
  answer: MessageSchema
});

const ticketMessage = model('ticket-messages', TicketMessageSchema);
module.exports = ticketMessage;
