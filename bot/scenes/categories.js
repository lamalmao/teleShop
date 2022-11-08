const { Scenes } = require('telegraf');

const keys = require('../keyboard');

const categories = new Scenes.BaseScene('categories');

categories.enterHandler = async function(ctx) {
  try {
    const message = ctx.scene.state.menu.message_id;

    await ctx.telegram.editMessageText(ctx.from.id, message, undefined, 'Панель управления категориями товаров');
    await ctx.telegram.editMessageReplyMarkup(ctx.from.id, message, undefined, keys.CategoriesManageMenu.keyboard.reply_markup);
  } catch (e) {
    console.log(e);
    ctx.scene.enter('admin', ctx.scene.state);
  }
};

categories.on('callback_query', async ctx => {
  try {
    const cb = ctx.callbackQuery.data;

    if (cb === keys.CategoriesManageMenu.buttons.back) ctx.scene.enter('admin', ctx.scene.state);
    else ctx.scene.enter(cb, ctx.scene.state).catch(_ => ctx.answerCbQuery('Неизвестная ошибка').catch(_ => null));
  } catch (e) {
    console.log(e);
    ctx.scene.reenter('categories', ctx.scene.state);
  }
});

// categories.command('start', ctx => {
//   ctx.deleteMessage(ctx.scene.state.menu.message_id).catch(_ => null);
//   ctx.scene.enter('start');
// })

module.exports = categories;