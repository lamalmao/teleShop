const { Scenes, Markup } = require('telegraf');

const users = require('../../models/users');
const orders = require('../../models/orders');
const keys = require('../keyboard');

const statuses = new Map();
statuses.set('untaken', 'ожидает');
statuses.set('processing', 'в работе');
statuses.set('done', 'выполнен');
statuses.set('refund', 'оформлен возврат');

const platforms = new Map();
platforms.set('pc', 'PC / macOS');
platforms.set('ps', 'Playstation 4/5');
platforms.set('android', 'Android');
platforms.set('nintendo', 'Nintendo');
platforms.set('xbox', 'XBox');

const orderData = new Scenes.BaseScene('order_data');

orderData.enterHandler = async function(ctx) {
  try {
    const orderID = /\d+/.exec(ctx.callbackQuery.data)[0];
    const order = await orders.findOne({
      orderID: orderID
    });

    if (order) {
      const msg = `<b>Заказ</b> <code>${order.orderID}</code>\n\n<i>Товар:</i> <b>${order.itemTitle}</b>\n<i>Цена:</i> <b>${order.amount}₽</b>\n<i>Дата:</i> <b>${new Date(order.date).toLocaleString()}</b>\n\n<i>Статус:</i> <b>${statuses.get(order.status)}</b>\n<i>Платформа:</i> <b>${platforms.get(order.platform)}</b>`;

      await ctx.telegram.editMessageCaption(
        ctx.from.id,
        ctx.callbackQuery.message.message_id,
        undefined,
        msg,
        {
          reply_markup: Markup.inlineKeyboard([
            [ Markup.button.callback('Назад', 'back') ]
          ]).reply_markup,
          parse_mode: 'HTML'
        }
      );
    } else {
      ctx.answerCbQuery('Данный заказ не найден')
        .catch(_ => null);
      ctx.scene.enter('paymentsStory', {
        menu: ctx.callbackQuery.message
      })
    }
  } catch (e) {
    console.log(e);
    ctx.scene.enter('profile', {
      menu: ctx.callbackQuery.message
    });
  }
};

orderData.action('back', async ctx => {
  try {
    ctx.scene.enter('paymentsStory', {
      menu: ctx.callbackQuery.message
    });
  } catch (e) {
    console.log(e);
    ctx.scene.enter('start', {
      menu: ctx.callbackQuery.message
    });
  }
});

module.exports = orderData;