const { Scenes, Markup } = require('telegraf');
const path = require('path');

const goodsModel = require('../../models/goods');
// const categories = require('../../models/categories');

const keys = require('../keyboard');
const genItemsListPages = require('../gen_pages');
const goods = require('../../models/goods');

const showGoods = new Scenes.BaseScene('showGoods');

showGoods.enterHandler = async function(ctx) {
  try {
    ctx.telegram.deleteMessage(ctx.from.id, ctx.callbackQuery.message.message_id).catch(_ => null);

    const goods = await goodsModel.find(undefined, '_id title');
    if (goods.length > 0) {
      ctx.scene.state.pages = genItemsListPages(goods);      
      ctx.scene.state.page = ctx.scene.state.page < ctx.scene.state.pages.size ? ctx.scene.state.page : ctx.scene.state.page - 1;

      const menu = await ctx.replyWithPhoto({
        source: path.join(process.cwd(), 'files', 'images', 'blank_logo.jpg')
      }, {
        caption: 'Все товары',
        reply_markup: ctx.scene.state.pages.get(ctx.scene.state.page).reply_markup
      });

      ctx.scene.state.menu = menu;
    } else ctx.reply('Нет товаров', keys.BackMenu.keyboard);
  } catch (e) {
    console.log(e);
    ctx.reply(`Что-то пошло не так`)
      .then(msg => ctx.scene.enter('goods', { menu: msg }))
      .catch(_ => null);
  }
};

showGoods.action(keys.BackMenu.buttons, ctx => {
  ctx.telegram.deleteMessage(ctx.from.id, ctx.callbackQuery.message.message_id).catch(_ => null);
  ctx.reply(`Возвращаемся...`)
      .then(msg => ctx.scene.enter('goods', { menu: msg }))
      .catch(_ => null);
});

showGoods.action(['next', 'prev'], async function(ctx) {
  try {
    if (ctx.callbackQuery.data === 'next') ctx.scene.state.page++;
    else ctx.scene.state.page--;

    await ctx.telegram.editMessageReplyMarkup(ctx.from.id, ctx.scene.state.menu.message_id, undefined, ctx.scene.state.pages.get(ctx.scene.state.page).reply_markup);
  } catch (e) {
    ctx.telegram.deleteMessage(ctx.from.id, ctx.callbackQuery.message.message_id).catch(_ => null);
    ctx.reply('Что-то пошло не так')
      .then(msg => ctx.scene.enter('goods', { menu: msg }))
      .catch(_ => null); 
  }
});

showGoods.action(/item#\w+/i, async ctx => {
    const itemID = /[^#]+$/.exec(ctx.callbackQuery.data)[0];
    const item = await goods.findById(itemID);

    if (item) ctx.scene.enter('manageItem', { menu: ctx.scene.state.menu, item: item, page: ctx.scene.state.page });
    else ctx.answerCbQuery('Не удалось найти товар в базе данных, возможно он был удален').catch(_ => null);
  }
);


module.exports = showGoods;