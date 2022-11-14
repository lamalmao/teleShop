const { Schema, model } = require('mongoose');
const crypto = require('crypto');

const Payment = new Schema({
  user: {
    required: true,
    type: Number
  },
  status: {
    type: String,
    required: true,
    enum: ['waiting', 'paid', 'rejected'],
    default: 'waiting'
  },
  paymentID: {
    type: Number,
    required: true,
    unique: true
  },
  payment_message: Number,
  amount: Number,
  transactionID: Number,
  date: {
    type: Date,
    default: Date.now
  }
});

Payment.methods.genUrl = function() {
  const signString = `RUB:${this.amount.toFixed(2)}:${global.paymentToken}:${global.projectID}:${this.paymentID}`;
  const sign = crypto.createHash('md5').update(signString).digest('hex');

  return `https://anypay.io/merchant?merchant_id=${global.projectID}&pay_id=${this.paymentID}&amount=${this.amount.toFixed(2)}&currency=RUB&sign=${sign}`;
};

const payments = model('payments', Payment);

module.exports = payments;