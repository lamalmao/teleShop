const { Schema, model } = require('mongoose');

const KeyAction = new Schema({
  manager: {
    type: Number,
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: ['taken', 'returned', 'used']
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  key: {
    type: String,
    required: true
  },
  order: Number
});

const keyActions = model('key-actions', KeyAction);
module.exports = keyActions;
