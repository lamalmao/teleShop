const { Scenes, Markup } = require('telegraf');
const path = require('path');

const users = require('../../models/users');
const payments = require('../../models/payments');
const orders = require('../../models/orders');
const keys = require('../keyboard');

const storyImage = path.join(
  process.cwd(),
  'files',
  'images',
  'blank_history.jpg'
);

const paymentsStory = new Scenes.BaseScene('paymentsStory');

paymentsStory.enterHandler = async function (ctx) {
  try {
    const refills = await payments.find({
      user: ctx.from.id,
      status: 'paid'
    });

    const ordersList = await orders.find({
      client: ctx.from.id,
      paid: true
    });

    let msg,
      keyboard = [];
    const story = refills.concat(ordersList);

    await ctx.telegram.editMessageMedia(
      ctx.from.id,
      ctx.scene.state.menu.message_id,
      undefined,
      {
        type: 'photo',
        media: {
          source: storyImage
        }
      }
    );

    if (story.length === 0) {
      msg = 'Вы еще не совершали платежей';
    } else {
      msg = 'Ваши пополнения и покупки';

      for (let payment of story.sort((a, b) => (a.date > b.date ? 1 : -1))) {
        const date = new Date(payment.date).toLocaleDateString('ru-RU', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });

        if (payment.itemTitle) {
          keyboard.push([
            Markup.button.callback(
              `-${payment.amount}₽ - ${payment.itemTitle}`,
              `order#${payment.orderID}`
            )
          ]);
        } else {
          keyboard.push([
            Markup.button.callback(
              `+${payment.amount}₽ от ${date}`,
              `payment#${payment.paymentID}`
            )
          ]);
        }
      }
    }

    keyboard.push([Markup.button.callback('Назад', keys.BackMenu.buttons)]);

    await ctx.telegram.editMessageCaption(
      ctx.from.id,
      ctx.scene.state.menu.message_id,
      undefined,
      msg
    );
    await ctx.telegram.editMessageReplyMarkup(
      ctx.from.id,
      ctx.scene.state.menu.message_id,
      undefined,
      Markup.inlineKeyboard(keyboard).reply_markup
    );
  } catch (e) {
    null;
    ctx.scene.enter('profile', {
      menu: ctx.scene.state.menu
    });
  }
};

paymentsStory.action(keys.BackMenu.buttons, ctx => {
  let target = ctx.scene.state.view ? 'paymentsStory' : 'profile';

  ctx.scene.enter(target, {
    menu: ctx.scene.state.menu
  });
});

paymentsStory.action(/payment#\d+/, async ctx => {
  try {
    ctx.scene.state.view = true;

    const paymentID = Number(/\d+$/.exec(ctx.callbackQuery.data)[0]);
    const payment = await payments.findOne({
      paymentID: paymentID
    });

    if (!payment) throw new Error('Платеж не найден');

    await ctx.telegram.editMessageCaption(
      ctx.from.id,
      ctx.scene.state.menu.message_id,
      undefined,
      `Платеж <code>${
        payment.transactionID || payment.paymentID
      }</code>\n\nДата: <b>${new Date(
        payment.date
      ).toLocaleString()} по МСК</b>\nСумма: <b>${
        payment.amount
      } руб.</b>\n<b>С помощью: </b> ${payment.service || '-'}`,
      {
        parse_mode: 'HTML'
      }
    );
    await ctx.telegram.editMessageReplyMarkup(
      ctx.from.id,
      ctx.scene.state.menu.message_id,
      undefined,
      keys.BackMenu.keyboard.reply_markup
    );
  } catch (e) {
    null;
    ctx.answerCbQuery(e.message).catch(_ => null);
    ctx.scene.enter('paymentsStory', {
      menu: ctx.scene.state.menu
    });
  }
});

module.exports = paymentsStory;
