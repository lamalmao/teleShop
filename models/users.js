const { Schema, model } = require('mongoose');

const User = new Schema({
  telegramID: {
    type: Number,
    required: true,
    unique: true
  },
  username: {
    type: String,
    required: true
  },
  balance: {
    type: Number,
    required: true,
    default: 0
  },
  join_date: {
    type: Date,
    required: true,
    default: Date.now
  },
  role: {
    type: String,
    required: true,
    enum: {
      values: ['client', 'admin', 'manager'],
      message: 'Несуществующая роль'
    },
    default: 'client'
  },
  purchases: {
    type: Number,
    default: 0
  },
  invitedBy: {
    type: Number,
    default: null
  },
  refills: {
    type: Number,
    default: 0
  },
  game: {
    type: String,
    enum: global.games
  },
  stats: {
    type: [
      {
        id: String,
        title: String,
        count: Number
      }
    ],
    default: []
  },
  onlineUntil: Date
});

const users = model('users', User);

module.exports = users;