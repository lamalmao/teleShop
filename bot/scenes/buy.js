const { Scenes, Markup } = require('telegraf');
const { Types } = require('mongoose');

const goods = require('../../models/goods');
const users = require('../../models/users');
const keys = require('../keyboard');

const buy = new Scenes.BaseScene('buy');

buy.enterHandler = async function(ctx) {
  try {
    if (global.suspend) {
      ctx.reply('Продажи временно приостановлены, попробуйте позже')
        .then(msg => {
          setTimeout(() => {
            ctx.telegram.deleteMessage(
              ctx.from.id,
              msg.message_id
            ).catch(_ => null);
          }, 1500);
        })
        .catch(_ => null);
      ctx.scene.leave();
      return;
    }

    const itemID = /\w+$/.exec(ctx.callbackQuery.data)[0];

    const item = await goods.findOne({
      _id: Types.ObjectId(itemID)
    });

    if (item.hidden) {
      ctx.answerCbQuery('На данный момент товар недоступен')
        .catch(_ => null);
      ctx.scene.enter(`shop`);
    } else {
      const user = await users.findOne({
        telegramID: ctx.from.id
      }, '_id balance');

      const dif = (user.balance - item.getPrice()).toFixed(2);
      if (dif < 0) {
        await ctx.telegram.editMessageCaption(
          ctx.from.id,
          ctx.callbackQuery.message.message_id,
          undefined,
          `На вашем счету не хватает ${Math.abs(dif)} руб. для покупки "${item.title}"`,
          {
            reply_markup: Markup.inlineKeyboard([
              [Markup.button.callback('Пополнить баланс', `ref#${Math.abs(dif)}`)],
              [Markup.button.callback('Назад', `item#${itemID}`)]
            ]).reply_markup
          }
        );
      } else {
        await ctx.telegram.editMessageCaption(
          ctx.from.id,
          ctx.callbackQuery.message.message_id,
          undefined,
          `Вы хотите приобрести <b>${item.title}</b> за <b>${item.getPrice()}</b> ₽, верно?`,
          {
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard([
              [ Markup.button.callback('Да', `proceed#${itemID}`) ],
              [ Markup.button.callback('Нет', `item#${itemID}`) ]
            ]).reply_markup
          }
        )
      }
      ctx.scene.leave();
    }
  } catch (e) {
    console.log(e);
    ctx.answerCbQuery('Что-то пошло не так')
      .catch(_ => null);
    ctx.scene.enter('shop');
  }
}

module.exports = buy;