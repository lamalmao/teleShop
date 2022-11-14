const { Scenes, Markup, Context } = require('telegraf');

const users = require('../../models/users');
const orders = require('../../models/orders');
const keys = require('../keyboard');
const messages = require('../messages');

const takeOrder = new Scenes.BaseScene('take_order');

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
          [  Markup.button.url('Связаться с пользователем', `tg://user?id=${order.client}`) ]
        ];
        if (order.status === 'processing') {
          keyboard.push(
            [ Markup.button.callback('Заказ выполнен', 'order_done') ],
            [ Markup.button.callback('Оформить возврат', 'order_refund') ]
          )
        }
        keyboard.push([Markup.button.callback('Назад', 'manager_menu')]);
 
        keyboard = Markup.inlineKeyboard(keyboard);

        const data = order.data.login ? `<i>Логин:</i> <code>${order.data.login}</code>\n<i>Пароль:</i> <code>${order.data.password}</code>` : '[ДАННЫЕ УДАЛЕНЫ]';
        const msg = `Заказ <code>${order.orderID}</code>\n\n<i>Товар:</i> ${order.itemTitle}\n<i>Статус:</i> ${statuses.get(order.status)}\n<i>Дата:</i> ${new Date(order.date).toLocaleString('ru-RU')}\n\n<b>Данные для выполнения</b>\n\n<i>Платформа:</i> ${platforms.get(order.platform)}\n${data}`;

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
    await ctx.scene.state.order.save();

    ctx.telegram.sendMessage(
      ctx.scene.state.order.client,
      messages.order_done.format(ctx.scene.state.order.orderID),
      {
        parse_mode: 'HTML'
      }
    ).catch(_ => null);

    ctx.answerCbQuery('Готово, клиент уведомлен')
      .catch(_ => null);
    ctx.scene.enter('manager_menu')
  } catch (e) {
    console.log(e);
    ctx.scene.enter('manager_menu');
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
    ctx.scene.state.order.refundStatus = false;
    ctx.scene.state.order.data = {
      login: '',
      password: ''
    };

    await ctx.scene.state.order.save();

    ctx.telegram.sendMessage(
      ctx.scene.state.order.client,
      messages.order_refund.format(ctx.scene.state.order.orderID),
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
})

module.exports = takeOrder;