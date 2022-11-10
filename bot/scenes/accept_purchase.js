const { Scenes, Markup } = require('telegraf');
const { Types } = require('mongoose');
const crypto = require('crypto');

const goods = require('../../models/goods');
const users = require('../../models/users');
const orders = require('../../models/orders');
const messages = require('../messages');

const acceptPurchase = new Scenes.BaseScene('accept_purchase');

acceptPurchase.enterHandler = async function(ctx) {
  try {
    const itemID = /\w+$/.exec(ctx.callbackQuery.data)[0];
    const item = await goods.findById(itemID);

    if (!item.hidden) {
      const user = await users.findOne({
        telegramID: ctx.from.id
      }, '_id balance');

      const price = item.getPrice();

      if (user.balance < price) {
        ctx.answerCbQuery('Недостаточно денег на балансе')
          .catch(_ => null);
        ctx.scene.enter('shop');
      } else {
        user.balance -= price;
        user.save().catch(_ => null);

        const id = await genUniqueID();

        const order = await orders.create({
          orderID: id,
          client: ctx.from.id,
          item: item._id,
          amount: price,
          itemTitle: item.title
        });

        ctx.scene.state.order = order;
        ctx.scene.state.menu = ctx.callbackQuery.message;

        await ctx.telegram.editMessageCaption(
          ctx.from.id,
          ctx.callbackQuery.message.message_id,
          undefined,
          messages.buy_instructions
        );
        ctx.scene.state.dataWaiting = true;
      }
    } else {
      ctx.answerCbQuery('Данный товар недоступен')
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

acceptPurchase.on('message', (ctx, next) => {
    ctx.deleteMessage().catch(_ => null);

    if (ctx.scene.state.dataWaiting) {
      const data = /(\S+)[ ]+(\S+)/gi.exec(ctx.message.text);

      if (data) {
        ctx.scene.state.data = {
          login: data[1],
          password: data[2]
        };
        next();
      } else {
        ctx.telegram.editMessageCaption(
          ctx.from.id,
          ctx.scene.state.menu.message_id,
          undefined,
          messages.buy_instructions + '\n\nНеверно введены данные аккаунта, попробуйте снова'
        ).catch(_ => null);
      }
    };
  },
  async ctx => {
    try {
      await orders.updateOne({
        _id: ctx.scene.state.order._id
      }, {
        $set: {
          data: ctx.scene.state.data
        }
      });

      await ctx.telegram.editMessageCaption(
        ctx.from.id,
        ctx.scene.state.menu.message_id,
        undefined,
        messages.buy_success.format(ctx.scene.state.order.orderID),
        {
          parse_mode: 'HTML'
        }
      );

      ctx.scene.enter('start');
    } catch (e) {
      console.log(e);
      ctx.answerCbQuery('Что-то пошло не так')
        .catch(_ => null);
      ctx.scene.enter('start', {
        menu: ctx.callbackQuery.message
      });
    }
});

async function genUniqueID() {
  const id = crypto.randomInt(100000, 999999);
  const check = await orders.findOne({
    orderID: id
  }, '_id');

  if (check) return await genUniqueID();
  else return id;
}

module.exports = acceptPurchase;