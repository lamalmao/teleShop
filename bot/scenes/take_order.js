const { Scenes, Markup } = require('telegraf');
const { Types } = require('mongoose');
const escape = require('escape-html');
const path = require('path');

const users = require('../../models/users');
const orders = require('../../models/orders');
const goods = require('../../models/goods');

const keys = require('../keyboard');
const messages = require('../messages');

const takeOrder = new Scenes.BaseScene('take_order');

const images = path.join(process.cwd(), 'files', 'images');

const statuses = new Map();
statuses.set('untaken', 'не занят');
statuses.set('processing', 'в работе');
statuses.set('done', 'выполнен');
statuses.set('refund', 'оформлен возврат');

const platforms = new Map();
platforms.set('pc', 'PC / macOS');
platforms.set('ps', 'Playstation 4/5');
platforms.set('android', 'Android');
platforms.set('nintendo', 'Nintendo');
platforms.set('xbox', 'XBox');

takeOrder.enterHandler = async function(ctx) {
  try {
    const user = await users.findOne({
      telegramID: ctx.from.id
    });

    if (user.role === 'admin' || user.role === 'manager') {
      const orderID = ctx.scene.state.orderID ? ctx.scene.state.orderID : /\d+/.exec(ctx.callbackQuery.data)[0];
      const order = await orders.findOne({
        orderID: orderID,
        $or: [
          { status: 'untaken' },
          { manager: ctx.from.id }
        ]
      });

      const client = await users.findOne({
        telegramID: order.client
      }, 'username');

      if (!order) {
        ctx.answerCbQuery('Заказ не найден или занят')
          .catch(_ => null);
        ctx.scene.enter('orders_list');
      } else {
        if (order.status === 'untaken') {
          order.status = 'processing';
          order.manager = ctx.from.id;
          await order.save();
        }
      
        let keyboard = [
          [ 
            Markup.button.callback('Профиль клиента', `get_profile`),
            Markup.button.callback('Связаться с клиентом', `req_contact#${order.client}`) 
          ],
          // [  Markup.button.url('Связаться с пользователем', `get_user#${order.client}#${order.orderID}`) ]
        ];
        if (order.status === 'processing') {
          keyboard.push(
            [ Markup.button.callback('Заказ выполнен', 'order_done') ],
            [ Markup.button.callback('Оформить возврат', 'order_refund') ],
            [ Markup.button.callback('Отменить заказ', 'order_cancel') ],
            [ Markup.button.callback('Отказаться от выполнения', 'order_reject') ]
          )
        }
        keyboard.push([Markup.button.callback('Назад', 'manager_menu')]);
 
        keyboard = Markup.inlineKeyboard(keyboard);

        const data = order.data.login ? `<i>Логин:</i> <code>${escape(order.data.login)}</code>\n<i>Пароль:</i> <code>${escape(order.data.password)}</code>` : '[ДАННЫЕ УДАЛЕНЫ]';
        const msg = `Заказ <code>${order.orderID}</code>\n\n<i>Клиент:</i> <a href="tg://user?id=${order.client}">${client.username}</a>\n<i>Товар:</i> ${order.itemTitle}\n<i>Статус:</i> ${statuses.get(order.status)}\n<i>Дата:</i> ${new Date(order.date).toLocaleString('ru-RU')}\n\n<b>Данные для выполнения</b>\n\n<i>Платформа:</i> ${platforms.get(order.platform)}\n${data}`;

        ctx.scene.state.order = order;

        await ctx.telegram.editMessageText(
          ctx.from.id,
          ctx.callbackQuery.message.message_id,
          undefined,
          msg,
          {
            reply_markup: keyboard.reply_markup,
            parse_mode: 'HTML'
          }
        );
      }
    } else {
      ctx.answerCbQuery('У вас нет прав')
        .catch(_ => null);
      ctx.scene.leave();
    }
  } catch (e) {
    ctx.telegram.deleteMessage(
      ctx.from.id,
      ctx.callbackQuery.message.message_id
    ).catch(_ => null);
    console.log(e);
    ctx.scene.enter('manager_menu');
  }
};

takeOrder.on('callback_query', async (ctx, next) => {
  try {
    const user = await users.findOne({
      telegramID: ctx.from.id
    }, '_id role');
    
    if (user.role === 'manager' || user.role === 'admin') next();
    else {
      ctx.answerCbQuery('У вас более нет доступа')
        .catch(_ => null);
      ctx.deleteMessage()
        .catch(_ => null);
      ctx.scene.leave();
    }
  } catch (e) {
    console.log(e);
    ctx.scene.leave();
  }
});

takeOrder.action('get_profile', async ctx => {
  try {
    const user = await users.findOne({
      telegramID: ctx.scene.state.order.client
    }, 'username');

    const thisCTX = ctx;

    ctx.reply(`Профиль пользователя: ${user.username}`, {
      reply_markup: Markup.inlineKeyboard([
        [ Markup.button.url('Профиль', `tg://user?id=${ctx.scene.state.order.client}`) ],
        [ Markup.button.callback('Удалить сообщение', 'kill') ]
      ]).reply_markup
    }).catch(_ => {
      thisCTX.reply(`Профиль пользователя закрыт, запросите его контакт`)
        .then(msg => {
          setTimeout(_ => {
            thisCTX.telegram.deleteMessage(
              thisCTX.from.id,
              msg.message_id
            ).catch(_ => null)
          }, 2000);
        }).catch(_ => null);
    }).then(_ => thisCTX.answerCbQuery().catch(_ => null));

  } catch (e) {
    console.log(err);
    ctx.scene.leave();
  }
});

takeOrder.action('kill', ctx => {
  ctx.telegram.deleteMessage(
    ctx.from.id,
    ctx.callbackQuery.message.message_id
  ).catch(_ => null);
});

takeOrder.action('order_done', async ctx => {
  try {
    await ctx.telegram.editMessageText(
      ctx.from.id,
      ctx.callbackQuery.message.message_id,
      undefined,
      `Вы подтверждаете, что заказ\n\n<code>${ctx.scene.state.order.orderID}</code>\n<b>${ctx.scene.state.order.itemTitle}</b>\n\nвыполнен?`,
      {
        reply_markup: Markup.inlineKeyboard([
          [ Markup.button.callback('Да', 'done') ],
          [ Markup.button.callback('Нет', `manager_take#${ctx.scene.state.order.orderID}`) ]
        ]).reply_markup,
        parse_mode: 'HTML'
      }
    );
  } catch (e) {
    console.log(e);
    ctx.scene.enter('manager_menu');
  }
});

takeOrder.action('done', async ctx => {
  try {
    ctx.scene.state.order.status = 'done';
    ctx.scene.state.order.data = {
      login: '',
      password: ''
    };
    ctx.scene.state.order.date = new Date();
    await ctx.scene.state.order.save();

    ctx.telegram.sendMessage(
      ctx.scene.state.order.client,
      messages.order_done.format(ctx.scene.state.order.orderID, ctx.scene.state.order.itemTitle),
      {
        parse_mode: 'HTML',
        disable_web_page_preview: true
      }
    ).catch(_ => null);

    const res = await users.updateOne({
      telegramID: ctx.from.id,
      'stats.id': ctx.scene.state.order.item
    }, {
      $inc: {
        'stats.$.count': 1
      }
    });

    if (res.modifiedCount !== 1) {
      await users.updateOne({
        telegramID: ctx.from.id,
      }, {
        $push: {
          stats: {
            id: ctx.scene.state.order.item,
            title: ctx.scene.state.order.itemTitle,
            count: 1
          }
        }
      })
    }

    await goods.updateOne({
      _id: Types.ObjectId(ctx.scene.state.order.item)
    }, {
      $inc: {
        sells: 1
      }
    });

    await users.updateOne({
      telegramID: ctx.scene.state.order.client
    }, {
      $inc: {
        purchases: 1
      }
    });

    ctx.answerCbQuery('Готово, клиент уведомлен')
      .catch(_ => null);
    ctx.scene.enter('manager_menu');
  } catch (e) {
    console.log(e);
    ctx.scene.enter('manager_menu');
  }
});

takeOrder.action('order_reject', async ctx => {
  try {
    await ctx.telegram.editMessageText(
      ctx.from.id,
      ctx.callbackQuery.message.message_id,
      undefined,
      `Вы хотите отказаться от заказа: ${ctx.scene.state.order.orderID}?`,
      {
        reply_markup: Markup.inlineKeyboard([
          [ Markup.button.callback('Да', 'reject') ],
          [ Markup.button.callback('Нет', `manager_take#${ctx.scene.state.order.orderID}`) ]
        ]).reply_markup,
        parse_mode: 'HTML'
      }
    );
  } catch (e) {
    console.log(e);
    ctx.scene.enter('orders_list');
  }
});

takeOrder.action('reject', async ctx => {
  try {
    await orders.updateOne({
      orderID: ctx.scene.state.order.orderID
    }, {
      $set: {
        status: 'untaken',
        manager: 0
      }
    });

    ctx.scene.enter('orders_list');
  } catch (e) {
    console.log(e);
    ctx.scene.enter('orders_list');
  }
});

takeOrder.action('order_refund', async ctx => {
  try {
    await ctx.telegram.editMessageText(
      ctx.from.id,
      ctx.callbackQuery.message.message_id,
      undefined,
      `Вы подтверждаете, что по заказу\n\n<code>${ctx.scene.state.order.orderID}</code>\n<b>${ctx.scene.state.order.itemTitle}</b>\n\необходимо вернуть деньги покупателю?`,
      {
        reply_markup: Markup.inlineKeyboard([
          [ Markup.button.callback('Да', 'refund') ],
          [ Markup.button.callback('Нет', `manager_take#${ctx.scene.state.order.orderID}`) ]
        ]).reply_markup,
        parse_mode: 'HTML'
      }
    );
  } catch (e) {
    console.log(e);
    ctx.scene.enter('orders_list');
  }
});

takeOrder.action('refund', async ctx => {
  try {
    ctx.scene.state.order.status = 'refund';
    ctx.scene.state.order.refundStatus = 'waiting';
    // ctx.scene.state.order.data = {
    //   login: '',
    //   password: ''
    // };

    await ctx.scene.state.order.save();

    ctx.telegram.sendMessage(
      ctx.scene.state.order.client,
      messages.order_refund.format(ctx.scene.state.order.orderID, ctx.scene.state.order.itemTitle),
      {
        reply_markup: Markup.inlineKeyboard([
          [ Markup.button.callback('Указать данные', `refund_data#${ctx.scene.state.order.orderID}`) ]
        ]).reply_markup,
        parse_mode: 'HTML'
      }
    ).catch(_ => null);

    ctx.answerCbQuery('Возврат оформлен, пользователь получил просьбу передать данные для возврата')
      .catch(_ => null);

    ctx.scene.enter('orders_list');
  } catch (e) {
    console.log(e);
    ctx.scene.enter('manager_menu');
  }
});

takeOrder.action(/req_contact#\d+/, async ctx => {
  try {
    const user = Number(/\d+/.exec(ctx.callbackQuery.data)[0]);
    ctx.telegram.sendMessage(user, `Нам необходимо связаться с вами по поводу заказа <b>${ctx.scene.state.order.itemTitle}</b> - <code>${ctx.scene.state.order.orderID}</code>\n\nПожалуйста нажмите на кнопку под сообщением и следуйте инструкциям`, {
      parse_mode: 'HTML',
      reply_markup: Markup.inlineKeyboard([
        [ Markup.button.callback('Продолжить', `res_contact#${ctx.from.id}#${ctx.scene.state.order.orderID}`) ]
      ]).reply_markup
    }).catch(err => console.log(err));
    ctx.reply('Пользователь уведомлен, ожидайте его контакт')
      .then(msg => {
        setTimeout(_ => {
          ctx.telegram.deleteMessage(msg.from.id, msg.message_id)
            .catch(_ => null);
        }, 1500);    
      })
      .catch(_ => null);
  } catch (e) {
    console.log(e);
    ctx.scene.enter('manager_menu');
  }
});

takeOrder.action('order_cancel', async ctx => {
  try {
    await ctx.telegram.editMessageText(
      ctx.from.id,
      ctx.callbackQuery.message.message_id,
      undefined,
      `Отменить заказ <code>${ctx.scene.state.order.orderID}</code>\n<b>${ctx.scene.state.order.itemTitle}</b>?`,
      {
        reply_markup: Markup.inlineKeyboard([
          [ Markup.button.callback('Да', 'cancel_accept') ],
          [ Markup.button.callback('Нет', `manager_take#${ctx.scene.state.order.orderID}`) ]
        ]).reply_markup,
        parse_mode: 'HTML'
      }
    );
  } catch (e) {
    console.log(e);
    ctx.scene.enter('manager_menu');
  }
});

takeOrder.action('cancel_accept', async ctx => {
  try {
    await orders.updateOne({
      orderID: ctx.scene.state.order.orderID
    }, {
      $set: {
        status: 'canceled',
        data: {
          login: '',
          password: ''
        }
      }
    });

    await users.updateOne({
      telegramID: ctx.scene.state.order.client
    }, {
      $inc: {
        balance: ctx.scene.state.order.amount
      }
    });

    ctx.telegram.sendPhoto(
      ctx.scene.state.order.client,
      {
        source: path.join(images, 'blank_logo.jpg')
      }, 
      {
        caption: `Заказ <code>${ctx.scene.state.order.orderID}</code> - <b>${ctx.scene.state.order.itemTitle}</b> был отменен\n<b>${ctx.scene.state.order.amount}</b> рублей были возвращены на Ваш баланс`,
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
          [ Markup.button.callback('Профиль', keys.Menu.buttons.profile) ]
        ]).reply_markup
      }
    ).catch(_ => null);

    ctx.answerCbQuery('Заказ был отменен, деньги возвращены пользователю')
      .catch(_ => null);
    
    ctx.scene.enter('manager_menu');
  } catch (e) {
    console.log(e);
    ctx.scene.enter('manager_menu');
  }
});

// takeOrder.action(/get_user#\d+#\d+/, async ctx => {
//   try {
//     const data = /get_user#(\d+)#(\d+)/.exec(ctx.callbackQuery.data),
//       client = data[1],
//       order = data[2];
    
//     await ctx.replyWithContact()
//   } catch (e) {
//     console.log(e);
//     ctx.scene.enter('manager_menu');
//   }
// })

module.exports = takeOrder;