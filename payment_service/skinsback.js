const crypto = require('crypto');
const payments = require('../models/payments');
const users = require('../models/users');

const getSign = (token, body) => {
  let params = '';

  Object.keys(body)
    .sort()
    .forEach(key => {
      if (key === 'sign') {
        return;
      }

      const value = body[key];
      if (typeof value === 'object') {
        return;
      }

      params = params.concat(`${key}:${value};`);
    });

  const sign = crypto.createHmac('sha1', token).update(params).digest('hex');
  return sign;
};

const skinsbackHandler = skinsbackToken => {
  return async (req, res, next) => {
    try {
      const {
        sign,
        status,
        transaction_id,
        order_id: paymentID,
        amount: rawAmount
      } = req.body;
      const checkedSign = getSign(skinsbackToken, req.body);
      if (checkedSign !== sign) {
        res.status(401).json({ error: 'Wrong signature' });
        return;
      }

      const amount = Math.ceil(Number(rawAmount));

      if (status !== 'success') {
        res.end('ok');
        return;
      }

      const payment = await payments.findOneAndUpdate(
        {
          paymentID,
          status: {
            $ne: 'paid'
          }
        },
        {
          $set: {
            status: 'paid',
            transaction_id,
            service: 'skinsback',
            amount
          }
        }
      );

      if (!payment) {
        res.status(400).json({ error: 'Payment not found' });
        return;
      }

      await users.updateOne(
        {
          telegramID: payment.user
        },
        {
          $inc: {
            balance: amount
          }
        }
      );

      res.locals = {
        message: payment.payment_message,
        user: payment.user,
        amount,
        answer: JSON.stringify({ status: 'Payment provided' })
      };

      next();
    } catch (error) {
      console.log(error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  };
};

module.exports = {
  skinsbackHandler,
  getSign
};
