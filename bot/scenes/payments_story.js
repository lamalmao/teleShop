const { Scenes, Markup } = require('telegraf');

const users = require('../../models/users');
const payments = require('../../models/payments');
const keys = require('../keyboard');

const paymentsStory = new Scenes.BaseScene('paymentsStory');

paymentsStory.enterHandler = async function(ctx) {
  try {
    const story = await payments.find({
      user: ctx.from.id,
      status: 'paid'
    });

    let msg, keyboard = [];
    
    if (!story) {
      msg = 'Вы еще не совершали платежей'
    } else {
      msg = 'Ваши пополнения и покупки';

      for (let payment of story.sort((a, b) => a.date > b.date ? 1 : -1)) {
        const date = new Date(payment.date).toLocaleDateString('ru-RU', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
        keyboard.push([ Markup.button.callback(`+${payment.amount}₽ от ${date}`, `payment#${payment.paymentID}`) ]);
      }

      keyboard.push([ Markup.button.callback('Назад', keys.BackMenu.buttons) ]);
    }

    await ctx.telegram.editMessageCaption(ctx.from.id, ctx.scene.state.menu.message_id, undefined, msg);
    await ctx.telegram.editMessageReplyMarkup(ctx.from.id, ctx.scene.state.menu.message_id, undefined, Markup.inlineKeyboard(keyboard).reply_markup);
  } catch (e) {
    console.log(e.message);
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

    await ctx.telegram.editMessageCaption(ctx.from.id, ctx.scene.state.menu.message_id, undefined, `Платеж <code>${paymentID}</code>\n\nДата: <b>${new Date(payment.date).toLocaleString()} по МСК</b>\nСумма: <b>${payment.amount} руб.</b>`, {
      parse_mode: 'HTML'
    });
    await ctx.telegram.editMessageReplyMarkup(ctx.from.id, ctx.scene.state.menu.message_id, undefined, keys.BackMenu.keyboard.reply_markup);
  } catch (e) {
    console.log(e);
    ctx.answerCbQuery(e.message).catch(_ => null);
    ctx.scene.enter('paymentsStory', {
      menu: ctx.scene.state.menu
    });
  }
});

module.exports = paymentsStory;