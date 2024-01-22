const { Scenes, Markup } = require('telegraf');
const payments = require('../../models/payments');
const sendMenu = require('../menu');
const path = require('path');
const moment = require('moment');

const uaCardRefill = new Scenes.BaseScene('ua-card-refill');

uaCardRefill.enterHandler = async ctx => {
  try {
    const raw = /:(?<paymentId>\d+)$/.exec(ctx.callbackQuery.data);
    if (!raw) {
      ctx.answerCbQuery('ID Платежа не передан').catch(() => null);
      throw new Error('No data found');
    }

    const { paymentId } = raw.groups;
    const paymentID = Number(paymentId);
    const payment = await payments.findOne({
      paymentID,
      status: 'waiting'
    });
    if (!payment) {
      ctx
        .reply('Платеж не найден или уже оплачен')
        .then(msg =>
          setTimeout(
            () => ctx.deleteMessage(msg.message_id).catch(() => null),
            2500
          )
        )
        .catch(() => null);
      throw new Error('Payment not found');
    }

    ctx.scene.state.payment = payment;

    await ctx.sendPhoto(
      {
        source: path.resolve('files', 'images', 'blank_shop.jpg')
      },
      {
        caption:
          'Этот способ оплаты можно использовать только при наличии украинской банковской карты 💳\n\nОплата доступна любой картой выпущенной на территории Украины 🇺🇦',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('Да', 'agreed')],
          [Markup.button.callback('Назад', 'exit')]
        ]).reply_markup
      }
    );
  } catch (error) {
    console.log(error);
    ctx.scene.leave();
  }
};

uaCardRefill.action('agreed', async ctx => {
  try {
    const { payment } = ctx.scene.state;
    const uahAmount = Math.ceil(payment.amount / global.rubToUah);
    ctx.scene.state.uahAmount = uahAmount;

    await payments.updateOne(
      {
        paymentID: payment.paymentID
      },
      {
        $set: {
          uahAmount
        }
      }
    );

    await ctx.editMessageCaption(
      `Счет <code>${payment.paymentID}</code> на ${payment.amount} ₽ успешно создан / Текущий курс 1 ₴ = ${global.rubToUah} ₽ для успешного пополнения вам нужно перевести ${uahAmount} ₴ на карту <code>${global.uaRefillCard}</code>\n\nПереводите точную сумму, иначе ваш платеж может быть не зачислен\n\nТакже учитывайте комиссию вашего банка при переводе средств\n\nПосле успешного перевода средств, нажмите кнопку <b>Оплатил</b>\n\n<b>⚠️ Нажимать строго только после того, как вы совершили перевод средств</b>`,
      {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('Оплатил', 'paid')],
          [Markup.button.callback('Назад', 'exit')]
        ]).reply_markup
      }
    );
  } catch (error) {
    console.log(error);
    ctx.scene.leave();
  }
});

uaCardRefill.action('paid', async ctx => {
  try {
    ctx.scene.state.target = 'screenshot';
    await ctx.editMessageCaption(
      'Отправьте скриншот/фото перевода средств\n\nПожалуйста, пока Вы не отправите изображение - не выходите в главное меню - иначе ваш платеж не будет отправлен на проверку'
    );
  } catch (error) {
    console.log(error);
  }
});

uaCardRefill.on('photo', async ctx => {
  try {
    const { payment, uahAmount, target } = ctx.scene.state;
    if (target !== 'screenshot' || !ctx.message?.photo) {
      return;
    }

    const image = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    ctx.telegram
      .sendPhoto(global.cardWorkerID, image, {
        caption: `Счет <code>${
          payment.paymentID
        }</code> (пользователь <a href="tg://id?user=${ctx.from.id}">${
          ctx.from.id
        }</a>) на ${payment.amount} ₽ успешно оплачен ${moment(
          new Date()
        ).format(
          'DD.MM.YYYY [в] HH:mm'
        )}, проверьте поступление средств на сумму ${uahAmount} ₴`,
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
          [
            Markup.button.callback(
              'Средства получены',
              `approve-ua-card-payment:${payment.paymentID}`
            )
          ],
          [
            Markup.button.callback(
              'Платеж не поступил',
              `decline-ua-card-payment:${payment.paymentID}`
            )
          ]
        ]).reply_markup
      })
      .catch(e => console.log(e));

    await ctx.reply(
      'Ваш платеж отправлен на проверку администратору\n\n✔️ После проверки вы получите уведомление, а средства будут начислены на ваш баланс'
    );

    await sendMenu(ctx);
    ctx.scene.leave();
  } catch (error) {
    console.log(error);
  }
});

uaCardRefill.action('exit', ctx => ctx.scene.enter('shop'));

module.exports = uaCardRefill;
