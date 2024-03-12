const { Scenes, Markup } = require('telegraf');
const crypto = require('crypto');
const path = require('path');

const payments = require('../../models/payments');
const messages = require('../messages');
const pay = new Scenes.BaseScene('pay');
const refillImage = path.join(
  process.cwd(),
  'files',
  'images',
  'blank_refill.jpg'
);

pay.enterHandler = async function (ctx) {
  try {
    let payment = await payments.create({
      user: ctx.from.id,
      amount: ctx.scene.state.amount,
      paymentID: crypto.randomInt(1000000, 9999999),
      payment_message: ctx.scene.state.menu.message_id
    });

    const anyPayUrl = payment.genUrl();
    const freekassaUrl = payment.createFreekassaPaymentURL();

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

    await ctx.telegram.editMessageCaption(
      ctx.from.id,
      ctx.scene.state.menu.message_id,
      undefined,
      messages.payment.provided.format(ctx.scene.state.amount),
      {
        reply_markup: Markup.inlineKeyboard([
          [
            Markup.button.callback(
              'GameMoney (оплата картой) 🇷🇺🇰🇿',
              `create-payment-link:gm-rub:${payment.paymentID}`,
              !global.paymentMethods.gm
            )
          ],
          [
            Markup.button.callback(
              'Lava (СБП) 🇷🇺',
              `create-payment-link:lava:${payment.paymentID}`,
              !global.paymentMethods.lava
            )
          ],
          [
            Markup.button.callback(
              'AnyPay 🇷🇺🇰🇿🇧🇾',
              `create-payment-link:anypay:${payment.paymentID}`,
              !global.paymentMethods.anypay
            )
          ],
          [
            Markup.button.callback(
              'Freekassa 🇷🇺',
              `create-payment-link:freekassa:${payment.paymentID}`,
              !global.paymentMethods.freekassa
            )
          ],
          // [
          //   Markup.button.callback(
          //     'Зарубежные карты 🌎',
          //     `create-payment-link:gm-usd:${payment.paymentID}`,
          //     !global.paymentMethods.gm
          //   )
          // ],
          [
            Markup.button.callback(
              'Перевод на карту 🇺🇦',
              `ua-card-refill:${payment.paymentID}`,
              !global.paymentMethods.uacard
            )
          ],
          [
            Markup.button.callback(
              'Оплата скинами CS2, Dota 2, Rust 🔫',
              `create-payment-link:skinsback:${payment.paymentID}`,
              !global.paymentMethods.skinsback
            )
          ],
          [
            Markup.button.callback(
              'Криптовалюта ⚡️',
              `create-payment-link:anypay:${payment.paymentID}`,
              !global.paymentMethods.anypay
            )
          ]
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
