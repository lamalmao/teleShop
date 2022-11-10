const { Scenes, Markup } = require('telegraf');
const path = require('path');

const goods = require('../../models/goods');

const images = path.join(process.cwd(), 'files', 'images');

const item = new Scenes.BaseScene('item');

item.enterHandler = async function(ctx) {
  try {
    const itemID = /\w+$/.exec(ctx.callbackQuery.data)[0];
    const targetItem = await goods.findById(itemID);

    const keyboard = Markup.inlineKeyboard([
      [ Markup.button.callback('Купить', `buy#${itemID}`) ],
      [ Markup.button.callback('Назад', `sub_section#${targetItem.category}`) ]
    ]);

    if (!targetItem.hidden) {
      await ctx.telegram.editMessageMedia(ctx.from.id, ctx.callbackQuery.message.message_id, undefined, {
        type: 'photo',
        media: {
          source: path.join(images, targetItem.bigImage)
        }
      }, {
        caption: targetItem.title,
        reply_markup: keyboard.reply_markup
      });
    } else ctx.answerCbQuery('На данный момент товар недоступен').catch(_ => null);

    ctx.scene.leave();
  } catch (e) {
    console.log(e);
    ctx.answerCbQuery('Что-то пошло не так')
      .catch(_ => null);
    ctx.scene.enter('shop');
  }
};

module.exports = item;