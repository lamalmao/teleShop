const express = require('express');

const users = require('../models/users');
const payments = require('../models/payments');

function createPaymentProvider(bot) {
  const app = express();

  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  app.post('/payment', async (req, res) => {
    try {
      var msg = 'OK';

      const payment = await payments.findOne({
        paymentID: Number(req.body.pay_id),
        status: 'waiting'
      });
      if (!payment) throw new Error('Payment not found');
      
      if (req.body.status === 'paid') {
        payment.status = 'paid';
        payment.transactionID = Number(req.body.transaction_id);
        
        const user = await users.findOne({
          telegramID: payment.user
        }, 'balance refills telegramID');

        user.balance += payment.amount;
        user.refills++;

        payment.save().catch(_ => null);
        user.save().catch(_ => null);

        bot.telegram.editMessageCaption(user.telegramID, payment.payment_message, undefined, `Ваш баланс пополнен на ${payment.amount} рублей`)
          .catch(_ => null);
      }
    } catch (e) {
      console.log(e.message);
      res.status(400);
      msg = e.message
    } finally {
      res.end(msg);
    }
  });

  return app;
}

module.exports = createPaymentProvider;