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

Payment.methods.genUrl = () => {
  const signString = `RUB:${this.amount.toFixed(2)}:${global.paymentToken}:${global.projectID}:${this.paymentID}`;
  const sign = crypto.createHash('md5').update(signString).digest('hex');

  // prettier-ignore
  return `https://anypay.io/merchant?merchant_id=${global.projectID}&pay_id=${this.paymentID}&amount=${this.amount.toFixed(2)}&currency=RUB&sign=${sign}`;
};

Payment.methods.createLavaPayment = async () => {
  try {
    const body = {
      sum: amount,
      orderId: id,
      shopId: projectId
    };

    const signature = crypto
      .createHmac('sha256', global)
      .update(JSON.stringify(body))
      .digest('hex');

    const response = await axios.post(
      'https://api.lava.ru/business/invoice/create',
      body,
      {
        headers: {
          Signature: signature,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.status !== 200) {
      throw new Error(response.data.error);
    }

    const data = response.data.data;
    return data.url ? data.url : null;
  } catch {
    return null;
  }
}

const payments = model('payments', Payment);

module.exports = payments;