const { Types } = require('mongoose');
const { Scenes, Markup } = require('telegraf');
const orders = require('../../models/orders');
const sendMenu = require('../menu');
const escapeHTML = require('escape-html');
const users = require('../../models/users');
const goods = require('../../models/goods');
const crypto = require('crypto');

const giftAccessProceed = new Scenes.BaseScene('gift-access-proceed');

giftAccessProceed.enterHandler = async ctx => {
  try {
    const raw = /:(?<item>[a-z0-9]+)$/.exec(ctx.callbackQuery.data);
    if (!raw) {
      throw new Error('No order data');
    }

    const id = new Types.ObjectId(raw.groups.item);
    const item = await goods.findOne({
      _id: id
    });

    if (!item) {
      await ctx.editMessageCaption('Товар не найден');
      await sendMenu(ctx);
      ctx.scene.leave();
      return;
    }

    const checkActiveOrders = await orders.exists({
      client: ctx.from.id,
      item: id.toString(),
      paid: true,
      status: 'processing'
    });

    if (checkActiveOrders) {
      await ctx.editMessageCaption('У вас уже оформлен такой заказ');
      await sendMenu(ctx);
      ctx.scene.leave();
      return;
    }

    const orderID = await genUniqueID();
    const order = await orders.create({
      orderID,
      amount: item.getPrice(),
      client: ctx.from.id,
      item: item._id.toString(),
      itemTitle: item.title
    });

    ctx.scene.state = {
      menu: ctx.callbackQuery.message.message_id,
      waiting: true,
      id: order._id
    };

    await ctx.editMessageCaption('Укажите ваш никнейм в игре', {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('Назад', 'exit')]
      ]).reply_markup
    });
  } catch (error) {
    console.log(error);
    ctx.scene.leave();
  }
};

giftAccessProceed.on('message', async ctx => {
  try {
    ctx.deleteMessage().catch(() => null);

    const { waiting, menu } = ctx.scene.state;
    if (!waiting) {
      return;
    }

    const username = ctx.message.text.trim();
    ctx.scene.state.username = username;
    ctx.telegram
      .editMessageCaption(
        ctx.from.id,
        menu,
        undefined,
        `Никнейм: ${escapeHTML(
          username
        )}\n<i>Если хотите указать другой - напишите его сюда же</i>\n\nОформляем заказ?`,
        {
          parse_mode: 'HTML',
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('Да', 'accept')],
            [Markup.button.callback('Нет', 'exit')]
          ]).reply_markup
        }
      )
      .catch(() => null);
  } catch (error) {
    console.log(error);
  }
});

giftAccessProceed.action('accept', async ctx => {
  try {
    const { username, id } = ctx.scene.state;

    const order = await orders.findById(id);
    const user = await users.findOne(
      {
        telegramID: ctx.from.id
      },
      {
        balance: 1
      }
    );

    if (user.balance < order.amount) {
      ctx
        .reply('На вашем счету недостаточно средств')
        .then(msg =>
          setTimeout(
            () => ctx.deleteMessage(msg.message_id).catch(() => null),
            2500
          )
        )
        .catch(() => null);

      ctx.scene.enter('pay', {
        amount: order.amount - user.balance,
        menu: ctx.callbackQuery.message
      });

      return;
    }

    await users.updateOne(
      {
        telegramID: ctx.from.id
      },
      {
        $set: {
          onlineUntil: new Date(Date.now() + 15 * 60 * 1000)
        }
      }
    );

    await orders.updateOne(
      {
        _id: id
      },
      {
        $set: {
          paid: true,
          data: {
            login: username,
            password: '-'
          },
          sendAfter: `Примите заявки от наших аккаунтов в друзья и ожидайте 48 часов. Деньги за товар "${order.itemTitle}" будут возвращены и вы сможете пользоваться системой подарков`
        }
      }
    );

    await ctx.reply(`Заказ<code> ${order.orderID}</code> оформлен`, {
      parse_mode: 'HTML'
    });

    ctx.deleteMessage().catch(() => null);
    await sendMenu(ctx);
    ctx.scene.leave();
  } catch (error) {
    console.log(error);
  }
});

giftAccessProceed.action('exit', ctx => {
  sendMenu(ctx, ctx.callbackQuery.message);
  ctx.scene.leave();
});

async function genUniqueID() {
  const id = crypto.randomInt(100000, 999999);
  const check = await orders.findOne(
    {
      orderID: id
    },
    '_id'
  );

  if (check) return await genUniqueID();
  else return id;
}

module.exports = giftAccessProceed;
