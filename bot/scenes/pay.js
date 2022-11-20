const { Scenes, Markup } = require('telegraf');
const crypto = require('crypto');

const payments = require('../../models/payments');
const messages = require('../messages');
const pay = new Scenes.BaseScene('pay');

pay.enterHandler = async function(ctx) {
  try {
    let payment = await payments.create({
      user: ctx.from.id,
      amount: ctx.scene.state.amount,
      paymentID: crypto.randomInt(1000000, 9999999),
      payment_message: ctx.scene.state.menu.message_id
    });

    const payUrl = payment.genUrl();

    await ctx.telegram.editMessageCaption(
      ctx.from.id,
      ctx.scene.state.menu.message_id,
      undefined,
      messages.payment.provided.format(ctx.scene.state.amount),
      {
        reply_markup: Markup.inlineKeyboard([
          [ Markup.button.url('Оплатить', payUrl) ]
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