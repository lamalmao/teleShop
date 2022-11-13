const { Scenes } = require('telegraf');

const users = require('../../models/users');
const orders = require('../../models/orders');
const messages = require('../messages');

const acceptPurchase = new Scenes.BaseScene('accept_purchase');

acceptPurchase.enterHandler = async function(ctx) {
  try {
    const orderID = /\d+/.exec(ctx.callbackQuery.data)[0];
    const order = await orders.findOne({
      orderID: orderID,
      paid: false
    });

    if (order) {
      const user = await users.findOne({
        telegramID: ctx.from.id
      }, '_id balance');

      if (user.balance < order.amount) {
        ctx.answerCbQuery('Недостаточно денег на балансе')
          .catch(_ => null);
        ctx.scene.enter('shop');
      } else {
        user.balance -= order.amount;
        user.save().catch(_ => null);

        order.paid = true;
        order.save().catch(_ => null);

        ctx.scene.state.menu = ctx.callbackQuery.message;

        await ctx.telegram.editMessageCaption(
          ctx.from.id,
          ctx.callbackQuery.message.message_id,
          undefined,
          messages.buy_success.format(order.orderID),
          {
            parse_mode: 'HTML'
          }
        );

        ctx.scene.enter('start');
      }
    } else {
      ctx.answerCbQuery('Такого заказа нет или он уже был оплачен')
        .catch(_ => null);
      ctx.scene.enter('shop');
    }
  } catch (e) {
    console.log(e);
    ctx.answerCbQuery('Что-то пошло не так')
      .catch(_ => null);
    ctx.scene.enter('start', {
      menu: ctx.callbackQuery.message
    });
  }
}

module.exports = acceptPurchase;