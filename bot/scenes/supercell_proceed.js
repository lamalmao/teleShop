const { Scenes, Markup } = require('telegraf');
const crypto = require('crypto');

const goods = require('../../models/goods');
const orders = require('../../models/orders');
const users = require('../../models/users');

const messages = require('../messages');
const keys = require('../keyboard');

const sellProceed = new Scenes.BaseScene('supercell_proceed');

sellProceed.enterHandler = async function(ctx) {
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

    const itemID = /[0-9a-zA-Z]+$/.exec(ctx.callbackQuery.data)[0];
    const item = await goods.findById(itemID);
    const price = item.getPrice();

    if (!item) throw new Error('Данный товар не найден');
    if (item.hidden) throw new Error('Товар временно недоступен для покупки');

    const user = await users.findOne({
      telegramID: ctx.from.id
    }, 'balance');

    if (!user) throw new Error('Ошибка: пользователь не найден');
    if (user.balance < price) throw new Error('На вашем балансе недостаточно средств');

    ctx.scene.state.item = item;
    ctx.scene.state.menu = ctx.callbackQuery.message;
    ctx.scene.state.order = await orders.create({
      orderID: await genUniqueID(),
      item: itemID,
      itemTitle: item.title,
      amount: price,
      game: 'brawlstars',
      client: ctx.from.id
    });

    const msg = messages.supercell_instruction.format(item.title, price);

    await ctx.telegram.editMessageCaption(
      ctx.from.id,
      ctx.callbackQuery.message.message_id,
      undefined,
      msg,
      {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
          [ Markup.button.callback('Отмена', `item#${item._id}`) ]
        ]).reply_markup
      }
    );
  } catch (e) {
    console.log(e);
    ctx.reply(e.message)
      .then(msg => {
        setTimeout(function() {
          ctx.telegram.deleteMessage(
            ctx.from.id,
            msg.message_id
          ).catch();
        }, 2000);
      })
      .catch();
    ctx.scene.enter('shop', {
      menu: ctx.callbackQuery.message
    });
  }
};

sellProceed.on('message',
  (ctx, next) => {
    ctx.deleteMessage().catch();

    const check = /^(([^<>()[\]\.,;:\s@\"]+(\.[^<>()[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i.test(ctx.message.text);

    if (!check) {
      ctx.reply('Введенная почта невалидна, попробуйте снова')
        .then(msg => {
          setTimeout(function() {
            ctx.telegram.deleteMessage(
              ctx.from.id,
              msg.message_id
            ).catch();
          }, 3000);
        })
        .catch();
    } else next();
  },
  async (ctx, next) => {
    try {
      ctx.scene.state.order.data.login = ctx.message.text;
      await ctx.scene.state.order.save();

      next();
    } catch (e) {
      console.log(e);
      ctx.scene.enter('shop', {
        menu: ctx.scene.state.menu
      });
    }
  },
  async (ctx, next) => {
    try {
      if (ctx.scene.state.item.extra.message) {
        let keyboard = [];
        for (let button of ctx.scene.state.item.extra.options) {
          keyboard.push([
            Markup.button.callback(button, `extra#${button}`)
          ])
        }

        await ctx.telegram.editMessageCaption(
          ctx.from.id,
          ctx.scene.state.menu.message_id,
          undefined,
          ctx.scene.state.item.extra.message,
          {
            reply_markup: Markup.inlineKeyboard(keyboard).reply_markup
          }
        );
        ctx.scene.state.extra = true;
      } else {
        console.log('lul');
        checkout(ctx);
      }
    } catch (e) {
      console.log(e);
      ctx.scene.enter('shop', {
        menu: ctx.scene.state.menu
      });
    }
  },
  async ctx => {
    try {
      console.log('wtf');
      checkout(ctx);
    } catch (e) {
      console.log(e);
      ctx.scene.enter('shop', {
        menu: ctx.scene.state.menu
      });
    }
  }
);

sellProceed.action(/extra#+/, async ctx => {
  try {
    const choice = /[^#]+$/.exec(ctx.callbackQuery.data)[0];

    ctx.scene.state.order.extra.choice = choice;
    ctx.scene.state.order.extra.message = ctx.scene.state.item.extra.message;
    await ctx.scene.state.order.save();

    checkout(ctx);
  } catch (e) {
    console.log(e);
    ctx.scene.enter('shop', {
      menu: ctx.scene.state.menu
    });
  }
});

async function checkout(ctx) {
  try {
    var msg = messages.supercell_checkout.format(ctx.scene.state.order.itemTitle, ctx.scene.state.order.amount, ctx.scene.state.order.data.login);

    if (ctx.scene.state.item.extra.message) {
      msg += '\n\n' + messages.supercell_extra_checkout.format(ctx.scene.state.order.extra.message, ctx.scene.state.order.extra.choice);
    }

    await ctx.telegram.editMessageCaption(
      ctx.from.id,
      ctx.scene.state.menu.message_id,
      undefined,
      msg,
      {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
          [ Markup.button.callback('Все верно', `accept#${ctx.scene.state.order.orderID}`) ],
          [ Markup.button.callback('Назад', `supercell_proceed#${ctx.scene.state.item._id}`) ]
        ]).reply_markup
      }
    );
  } catch (e) {
    console.log(e);
    ctx.scene.enter('shop', {
      menu: ctx.scene.state.menu
    });
  }
}

async function genUniqueID() {
  const id = crypto.randomInt(100000, 999999);
  const check = await orders.findOne({
    orderID: id
  }, '_id');

  if (check) return await genUniqueID();
  else return id;
}

module.exports = sellProceed;