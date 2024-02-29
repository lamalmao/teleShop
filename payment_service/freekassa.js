const payments = require('../models/payments');
const users = require('../models/users');
const crypto = require('crypto');

const allowedIPs = [
  '168.119.157.136',
  '168.119.60.227',
  '138.201.88.124',
  '178.154.197.79',
  '::1'
];

const CURRENCIES = new Map([
  ['1', 'FK WALLET RUB'],
  ['2', 'FK WALLET USD'],
  ['3', 'FK WALLET EUR'],
  ['4', 'VISA RUB'],
  ['6', 'Yoomoney'],
  ['7', 'VISA UAH'],
  ['8', 'MasterCard RUB'],
  ['9', 'MasterCard UAH'],
  ['10', 'Qiwi'],
  ['11', 'VISA EUR'],
  ['12', 'МИР'],
  ['13', 'ОНЛАЙН БАНК'],
  ['14', 'USDT (ERC20)'],
  ['15', 'USDT (TRC20)'],
  ['16', 'Bitcoin Cash'],
  ['17', 'BNB'],
  ['18', 'DASH'],
  ['19', 'Dogecoin'],
  ['20', 'ZCash'],
  ['21', 'Monero'],
  ['22', 'Waves'],
  ['23', 'Ripple'],
  ['24', 'Bitcoin'],
  ['25', 'Litecoin'],
  ['26', 'Ethereum'],
  ['27', 'SteamPay'],
  ['28', 'Мегафон'],
  ['32', 'VISA USD'],
  ['33', 'Perfect Money USD'],
  ['34', 'Shiba Inu'],
  ['35', 'QIWI API'],
  ['36', 'Card RUB API'],
  ['37', 'Google pay'],
  ['38', 'Apple pay'],
  ['39', 'Tron'],
  ['40', 'Webmoney WMZ'],
  ['41', 'VISA / MasterCard KZT'],
  ['42', 'СБП'],
  ['44', 'СБП (API)']
]);

const checkSign = (sign, payment, token, shopId) => {
  const { amount, paymentID } = payment;

  const checkSign = crypto
    .createHash('md5')
    .update(`${shopId}:${amount}:${token}:${paymentID}`)
    .digest()
    .toString('hex');
  return sign === checkSign;
};

const freekassaHandler = freekassaSettings => {
  return async (req, res, next) => {
    try {
      const ip = req.socket.remoteAddress;
      if (!allowedIPs.includes(ip)) {
        res.status(401).json({ error: 'Forbidden' });
        return;
      }

      const {
        intid,
        MERCHANT_ORDER_ID: paymentID,
        SIGN: externalSign,
        AMOUNT: amount,
        TEST: test
      } = req.body;

      if (test == 1) {
        res.end('YES');
        return;
      }

      if (
        !checkSign(
          externalSign,
          {
            amount,
            paymentID
          },
          freekassaSettings.token,
          freekassaSettings.shopId
        )
      ) {
        res.status(401).end('Failed sign check');
        return;
      }

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
            transactionID: intid,
            service: 'freekassa'
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
            balance: payment.amount
          }
        }
      );

      res.locals = {
        message: payment.payment_message,
        user: payment.user,
        amount: payment.amount,
        answer: 'YES'
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
  freekassaHandler,
  freekassaCurrencies: CURRENCIES
};
