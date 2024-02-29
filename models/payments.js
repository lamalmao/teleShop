const { Schema, model } = require('mongoose');
const crypto = require('crypto');
const axios = require('axios');
const { getSign } = require('../payment_service/skinsback');

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
  },
  service: {
    type: String,
    enum: [
      'lava',
      'anypay',
      'system',
      'card',
      'promo',
      'freekassa',
      'skinsback'
    ]
  },
  uahAmount: Number,
  issuer: Number,
  promo: String
});

Payment.methods.genUrl = function () {
  const signString = `RUB:${this.amount.toFixed(2)}:${global.paymentToken}:${
    global.projectID
  }:${this.paymentID}`;
  const sign = crypto.createHash('md5').update(signString).digest('hex');

  // prettier-ignore
  return `https://anypay.io/merchant?merchant_id=${global.projectID}&pay_id=${this.paymentID}&amount=${this.amount.toFixed(2)}&currency=RUB&sign=${sign}`;
};

Payment.methods.createLavaPayment = async function () {
  try {
    const body = {
      sum: this.amount,
      orderId: this.paymentID,
      shopId: global.lavaProjectId
    };

    const signature = crypto
      .createHmac('sha256', global.lavaToken)
      .update(JSON.stringify(body))
      .digest('hex');

    const response = await axios.post(
      'https://api.lava.ru/business/invoice/create',
      body,
      {
        headers: {
          Signature: signature,
          Accept: 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.status !== 200) {
      throw new Error(response.data.error);
    }

    const data = response.data.data;
    return data.url ? data.url : null;
  } catch (error) {
    console.log(error.message);
  }
};

Payment.methods.createFreekassaPaymentURL = function () {
  try {
    const sign = crypto
      .createHash('md5')
      .update(
        `${global.freekassaId}:${this.amount}:${global.freekassaSecret}:RUB:${this.paymentID}`
      )
      .digest()
      .toString('hex');

    const url = new URL('https://pay.freekassa.ru/');
    url.searchParams.set('m', global.freekassaId);
    url.searchParams.set('oa', this.amount);
    url.searchParams.set('currency', 'RUB');
    url.searchParams.set('o', this.paymentID);
    url.searchParams.set('s', sign);

    return url.href;
  } catch (error) {
    console.log(error.message);
  }
};

Payment.methods.createSkinsbackPayment = async function () {
  try {
    const body = {
      method: 'create',
      shopid: global.skinsbackId,
      order_id: this.paymentID.toString(),
      currency: 'rub',
      min_amount: this.amount
    };

    const sign = getSign(global.skinsbackToken, body);
    body.sign = sign;

    const response = await axios.post('https://skinsback.com/api.php', body, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (response.status !== 200) {
      return null;
    }

    return response.data.url;
  } catch (error) {
    console.log(error.message);
    return null;
  }
};

const payments = model('payments', Payment);

module.exports = payments;
