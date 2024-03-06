const payments = require('../models/payments');
const users = require('../models/users');
const { checkRSASign } = require('./gmSigns');

const gmHandler = () => {
  return async (req, res, next) => {
    try {
      const {
        status,
        invoice: transactionID,
        project_invoice: paymentID,
        signature: sign,
        amount: receivedAmount
      } = req.body;

      if (status !== 'Paid') {
        res.status(400).end('Not interested');
        return;
      }

      const signBody = structuredClone(req.body);
      delete signBody.signature;

      console.log(req.body);

      const signCheck = checkRSASign(signBody, sign);
      console.log(signCheck);
      if (!signCheck) {
        res.status(401).json({
          error: 'Wrong signature'
        });
        return;
      }

      const amount = Math.round(Number(receivedAmount));
      const payment = await payments.findOneAndUpdate(
        {
          paymentID: Number(paymentID),
          status: {
            $ne: 'paid'
          }
        },
        {
          $set: {
            status: 'paid',
            transactionID,
            service: 'gamemoney',
            date: new Date(),
            amount
          }
        }
      );

      if (!payment) {
        res.status(404).json({
          error: 'Payment not found'
        });
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
        answer: JSON.stringify({ success: 'true' })
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
  gmHandler
};
