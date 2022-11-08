const { Scenes, Markup } = require('telegraf');

const keys = require('../keyboard');

const goods = require('../../models/goods');

const goodsManage = new Scenes.BaseScene('goods');

goodsManage.enterHandler = async function(ctx) {
  try {
    const message = ctx.scene.state.menu.message_id;

    await ctx.telegram.editMessageText(ctx.from.id, message, undefined, 'Меню управления товарами');
    await ctx.telegram.editMessageReplyMarkup(ctx.from.id, message, undefined, keys.GoodsManageMenu.keyboard.reply_markup);
  } catch (e) {
    console.log(e);
    ctx.scene.enter('admin', { menu: ctx.scene.state.menu });
  }
};

goodsManage.action(keys.GoodsManageMenu.buttons.back, ctx => {
  ctx.scene.enter('admin', { menu: ctx.scene.state.menu });
});

goodsManage.action(keys.GoodsManageMenu.buttons.addItem, ctx => {
  ctx.scene.enter('addItem', { menu: ctx.scene.state.menu });
});

goodsManage.action(keys.GoodsManageMenu.buttons.showItems, ctx => {
  ctx.scene.enter('showGoods', { page: 0 });
});

module.exports = goodsManage;