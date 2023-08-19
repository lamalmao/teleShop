const { Scenes } = require('telegraf');
const payments = require('../../models/payments');
const crypto = require('crypto');
const axios = require('axios');
const users = require('../../models/users');

const lavaCheck = new Scenes.BaseScene('lava-check');

const checkLavaPayment = async (paymentID) => {
  try {
    const body = {
      shopId: global.lavaProjectId,
      orderId: paymentID
    }

    const signature = crypto
      .createHmac('sha256', global.lavaToken)
      .update(JSON.stringify(body))
      .digest('hex');

    const response = await axios.post('https://api.lava.ru/business/invoice/status',
      body,
      {
        headers: {
          Signature: signature,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }
    );

    const data = response.data.data;
    return data.status === 'success';
  } catch {
    return false
  }
}

lavaCheck.enterHandler = async (ctx) => {
  try {
    const data = /(\d+)/i.exec(ctx.callbackQuery.data);
    if (!data) {
      throw new Error('No data');
    }

    const paymentID = Number(data[1]);
    const payment = await payments.findOne({
      paymentID,
      status: 'waiting'
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    const check = await checkLavaPayment(paymentID);
    if (!check) {
      throw new Error('Payment not paid yed');
    }

    payment.status = 'paid';
    payment.save().catch(() => null);

    await users.updateOne({
      telegramID: payment.user
    }, {
      $inc: {
        balance: payment.amount
      }
    });

    await ctx.editMessageText(`Ваш баланс пополнен на ${payment.amount} ₽`);
  } catch (error) {
    console.log(error.message)
  } finally {
    ctx.scene.leave();
  }
}

module.exports = lavaCheck;