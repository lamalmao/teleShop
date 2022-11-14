const { Scenes, Markup } = require('telegraf');

const users = require('../../models/users');
const orders = require('../../models/orders');
const keys = require('../keyboard');

const refunds = new Scenes.BaseScene(keys.AdminMenu.buttons.refunds);

refunds.enterHandler = async function(ctx) {
  try {
    ctx.answerCbQuery()
      .catch(_ => null);

    const user = await users.findOne({
      telegramID: ctx.from.id
    }, 'role');

    if (user.role === 'admin') {
      const activeRefund = await orders.find({
        status: 'refund',
        paid: true,
        refundStatus: 'waiting'
      }, 'orderID itemTitle');

      let keyboard = [
        [
          Markup.button.callback('Обновить', keys.AdminMenu.buttons.refunds), 
          Markup.button.callback('Назад', keys.BackMenu.buttons)
        ]
      ];
      for (let order of activeRefund.slice(activeRefund.length - 48)) {
        keyboard.push([
          Markup.button.callback(`${order.orderID}: "${order.itemTitle}"`, `proceed_refund#${order.orderID}`)
        ]);
      }

      await ctx.telegram.editMessageText(
        ctx.from.id,
        ctx.callbackQuery.message.message_id,
        undefined,
        'Невыполненные возвраты',
        {
          reply_markup: Markup.inlineKeyboard(keyboard).reply_markup
        }
      );
    } else {
      ctx.answerCbQuery('У вас нет доступа')
        .catch(_ => null);
      ctx.telegram.deleteMessage(
        ctx.from.id,
        ctx.callbackQuery.message.message_id
      ).catch(_ => null);

      ctx.scene.leave();
    }
  } catch (e) {
    console.log(e.message);
  }
};

refunds.action(/proceed_refund#\d+/, async ctx => {
  try {
    const orderID = /\d+/.exec(ctx.callbackQuery.data)[0];
    const order = await orders.findOne({
      orderID: orderID,
      refundStatus: 'waiting'
    });

    if (!order) {
      ctx.answerCbQuery('Запрос на возврат не найден, или уже был завершен')
        .catch(_ => null);
      ctx.scene.reenter();
    } else {
      const keyboard = [
        [
          Markup.button.callback('Выполнен', `approve#${orderID}`),
          Markup.button.callback('Отклонить', `decline#${orderID}`)
        ],
        [ Markup.button.url('Связаться с пользователем', `tg://user?id=${order.client}`) ],
        [ Markup.button.callback('Обновить', `proceed_refund#${orderID}`) ],
        [ Markup.button.callback('Назад', keys.AdminMenu.buttons.refunds) ]
      ];
      const data = order.refundData ? `<code>${order.refundData}</code>` : '<b>пользователь еще не предоставил данные</b>'
      const msg = `Заказ <code>${order.orderID}</code>\n\n<i>Товар:</i> ${order.itemTitle}\n<i>Цена:</i> <b>${order.amount}₽</b>\n<i>Дата:</i> ${new Date(order.date).toLocaleString('ru-RU')}\n\n<i>Информация для возврата средств:\n</i> ${data}`;

      await ctx.telegram.editMessageText(
        ctx.from.id,
        ctx.callbackQuery.message.message_id,
        undefined,
        msg,
        {
          reply_markup: Markup.inlineKeyboard(keyboard).reply_markup,
          parse_mode: 'HTML'
        }
      );
    }
  } catch (e) {
    console.log(e.message);
  }
});

refunds.action(/(approve|decline)#\d+/, async ctx => {
  try {
    ctx.scene.state.orderID = /\d+/.exec(ctx.callbackQuery.data)[0];
    ctx.scene.state.action = /[a-z]+/.exec(ctx.callbackQuery.data)[0];

    await ctx.telegram.editMessageText(
      ctx.from.id,
      ctx.callbackQuery.message.message_id,
      undefined,
      `Подтвердите действие - "${ctx.scene.state.action === 'approve' ? 'возврат выполнен' : 'отклонить возврат'}"`,
      {
        reply_markup: keys.YesNoMenu.keyboard.reply_markup
      }
    );
  } catch (e) {
    console.log(e);
    ctx.scene.enter('admin', {
      menu: ctx.callbackQuery.message
    });
  }
});

refunds.action(keys.YesNoMenu.buttons.no, ctx => {
  ctx.scene.reenter();
});

refunds.action(keys.YesNoMenu.buttons.yes, async ctx => {
  try {
    const order = await orders.findOne({
      orderID: ctx.scene.state.orderID,
      refundStatus: 'waiting'
    });
    
    if (order) {
      const status = ctx.scene.state.action === 'approve' ? 'approved' : 'rejected';

      await orders.updateOne({
        orderID: ctx.scene.state.orderID
      }, {
        $set: {
          refundStatus: status
        }
      });

      ctx.telegram.sendMessage(
        order.client,
        `Возврат денег за заказ <code>${order.orderID}</code> был <b>${status === 'approved' ? 'выполнен' : 'отклонен'}</b>`,
        {
          parse_mode: 'HTMl'
        }
      ).catch(_ => null);

      ctx.answerCbQuery('Готово')
        .catch(_ => null);

      ctx.scene.reenter();
    } else {
      ctx.answerCbQuery('Возврат уже был завершен')
        .catch(_ => null);
      ctx.scene.reenter();
    }
  } catch (e) {
    console.log(e);
    ctx.scene.enter('admin', {
      menu: ctx.callbackQuery.message
    });
  }
});

refunds.action(keys.AdminMenu.buttons.refunds, async ctx => {
  ctx.scene.enter(keys.AdminMenu.buttons.refunds);
});

refunds.action(keys.BackMenu.buttons, ctx => ctx.scene.enter('admin', {
  menu: ctx.callbackQuery.message
}));

module.exports = refunds;