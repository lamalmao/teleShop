const { Scenes, Markup } = require('telegraf');
const crypto = require('crypto');
const path = require('path');
const axios = require('axios');

const payments = require('../../models/payments');
const messages = require('../messages');
const pay = new Scenes.BaseScene('pay');
const refillImage = path.join(process.cwd(), 'files', 'images', 'blank_refill.jpg');

pay.enterHandler = async function(ctx) {
  try {
    let payment = await payments.create({
      user: ctx.from.id,
      amount: ctx.scene.state.amount,
      paymentID: crypto.randomInt(1000000, 9999999),
      payment_message: ctx.scene.state.menu.message_id
    });

    const anyPayUrl = payment.genUrl();
    const lavaUrl = await payment.createLavaPayment();

    await ctx.telegram.editMessageMedia(
      ctx.from.id,
      ctx.scene.state.menu.message_id,
      undefined,
      {
        type: 'photo',
        media: {
          source: refillImage
        }
      }
    );

    console.log(lavaUrl);

    await ctx.telegram.editMessageCaption(
      ctx.from.id,
      ctx.scene.state.menu.message_id,
      undefined,
      messages.payment.provided.format(ctx.scene.state.amount),
      {
        reply_markup: Markup.inlineKeyboard([
          [ Markup.button.url('Оплатить через AnyPay', anyPayUrl) ],
          [Markup.button.url('Оплатить через Lava', lavaUrl ? lavaUrl : 'https://google.com', lavaUrl === null)],
          [Markup.button.callback('Проверить платёж', 'lava-check#' + payment.paymentID, lavaUrl === null)]
        ]).reply_markup,
        parse_mode: 'HTML'
      }
    );
  } catch (e) {
    console.log(e);
  } finally {
    ctx.scene.enter('start');
  }
};

module.exports = pay;