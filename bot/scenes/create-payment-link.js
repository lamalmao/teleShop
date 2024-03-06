const { Scenes, Markup } = require('telegraf');
const payments = require('../../models/payments');

const createPaymentLink = new Scenes.BaseScene('create-payment-link');

createPaymentLink.enterHandler = async ctx => {
  try {
    const raw =
      /create-payment-link:(?<service>gm-rub|gm-usd|lava|freekassa|skinsback|anypay):(?<payment>\d+)/.exec(
        ctx.callbackQuery.data
      );
    if (!raw) {
      return;
    }

    const { service, payment: paymentID } = raw.groups;
    const payment = await payments.findOne({
      status: 'waiting',
      paymentID: Number(paymentID)
    });

    if (!payment) {
      await ctx.reply('Данный счёт уже оплачен');
      ctx.scene.leave();
      return;
    }

    let url;
    switch (service) {
      case 'lava':
        url = await payment.createLavaPayment();
        break;
      case 'freekassa':
        url = payment.createFreekassaPaymentURL();
        break;
      case 'anypay':
        url = payment.genUrl();
        break;
      case 'skinsback':
        url = await payment.createSkinsbackPayment();
        break;
      case 'gm-rub':
        url = await payment.createGmPayment('RUB');
        break;
      case 'gm-usd':
        url = await payment.createGmPayment('USD');
        break;
    }

    await ctx.editMessageCaption(
      `<b>Ваша <a href="${url}">ссылка</a> для оплаты платежа <code>${paymentID}</code> на сумму ${payment.amount} рублей</b>`,
      {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.url(`Оплата ${payment.amount} ₽`, url)]
        ]).reply_markup,
        disable_web_page_preview: true
      }
    );
  } catch (error) {
    console.log(error);
  } finally {
    ctx.scene.leave();
  }
};

module.exports = createPaymentLink;
