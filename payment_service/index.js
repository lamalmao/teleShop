const express = require('express');

const users = require('../models/users');
const payments = require('../models/payments');
const multer = require('multer');
const { freekassaHandler } = require('./freekassa');
const { skinsbackHandler } = require('./skinsback');

const formsParser = multer();

const allowedIPs = [
  '185.162.128.38',
  '185.162.128.39',
  '185.162.128.88',
  '127.0.0.1',
  '94.154.189.246',
  '45.149.129.248',
  '45.95.28.52',
  '62.122.172.72',
  '188.168.214.8',
  '62.122.173.38'
];

function createPaymentProvider(bot, freekassaSettings, skinsbackToken) {
  const app = express();

  const notifyUser = (req, res) => {
    const { message, user, amount, answer } = res.locals;

    bot.telegram
      .editMessageCaption(
        user,
        message,
        undefined,
        `Ваш баланс пополнен на ${amount} ₽`
      )
      .catch(() =>
        bot.telegram
          .sendMessage(user, `Ваш баланс пополнен на ${amount} ₽`)
          .catch(() => null)
      );

    res.end(answer);
  };

  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  app.use('/payment', async (req, res, next) => {
    if (allowedIPs.includes(req.socket.remoteAddress)) next();
    else {
      console.log(`Попытка проведения платежа с ${res.socket.remoteAddress}`);
      res.status(401).end('No access');
    }
  });

  app.post('/payment', async (req, res) => {
    try {
      var msg = 'OK';

      const paymentID = req.body.pay_id ? req.body.pay_id : req.body.order_id;

      const payment = await payments.findOne({
        paymentID: Number(paymentID),
        status: 'waiting'
      });
      if (!payment) throw new Error('Payment not found');

      if (
        req.body.status === 'paid' ||
        req.body.status === 'success' ||
        (req.body.status instanceof Array
          ? req.body.status.includes('paid')
          : false)
      ) {
        payment.status = 'paid';
        payment.transactionID = Number(
          req.body.transaction_id
            ? req.body.transaction_id instanceof Array
              ? req.body.transaction_id[0]
              : req.body.transaction_id
            : req.body.invoice_id
        );

        payment.service = req.body.transaction_id ? 'anypay' : 'lava';

        if (Number.isNaN(payment.transactionID) || !payment.transactionID) {
          payment.transactionID = 0;
        }

        const user = await users.findOne(
          {
            telegramID: payment.user
          },
          'balance refills telegramID'
        );

        user.balance += payment.amount;
        user.refills++;

        payment.save().catch(err => console.log(err.message));
        user.save().catch(err => console.log(err.message));

        bot.telegram
          .editMessageCaption(
            user.telegramID,
            payment.payment_message,
            undefined,
            `Ваш баланс пополнен на ${payment.amount} ₽`
          )
          .catch(_ => null);
      }
    } catch (e) {
      console.log(e.message);
      res.status(400);
      msg = e.message;
    } finally {
      res.end(msg);
    }
  });

  app.post(
    '/freekassa',
    formsParser.none(),
    freekassaHandler(freekassaSettings),
    notifyUser
  );

  app.post('/skinsback', skinsbackHandler(skinsbackToken), notifyUser);

  return app;
}

module.exports = createPaymentProvider;
