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
    const lavaUrl = await payment.createLavaPayment();
    const skinsbackUrl = await payment.createSkinsbackPayment();
    const gmUrl = await payment.createGmPayment();

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
            Markup.button.url(
              'GameMoney (оплата картой с минимальной комиссией) 🇷🇺',
              gmUrl || 'https://google.com',
              !(global.paymentMethods.gm && gmUrl)
            )
          ],
          [
            Markup.button.url(
              'Lava (СБП) 🇷🇺',
              lavaUrl ? lavaUrl : 'https://google.com',
              !(lavaUrl && global.paymentMethods.lava)
            )
          ],
          [
            Markup.button.url(
              'AnyPay 🇷🇺🇰🇿🇧🇾',
              anyPayUrl,
              !global.paymentMethods.anypay
            )
          ],

          [
            Markup.button.url(
              'Freekassa 🇷🇺',
              freekassaUrl,
              !global.paymentMethods.freekassa
            )
          ],
          [
            Markup.button.callback(
              'Перевод на карту 🇺🇦',
              `ua-card-refill:${payment.paymentID}`,
              !global.paymentMethods.uacard
            )
          ],
          [
            Markup.button.url(
              'Оплата скинами CS2, Dota 2, Rust 🔫',
              skinsbackUrl || 'https://google.com',
              !(skinsbackUrl && global.paymentMethods.skinsback)
            )
          ],
          [Markup.button.url('Криптовалюта ⚡️', anyPayUrl)]
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
