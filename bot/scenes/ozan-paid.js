const { Scenes, Markup } = require('telegraf');
const orders = require('../../models/orders');
const goods = require('../../models/goods');
const ozanAccounts = require('../../models/ozan-accounts');

const ozanPaid = new Scenes.BaseScene('ozan-paid');

ozanPaid.enterHandler = async ctx => {
  try {
    const { order } = ctx.scene.state;
    if (!order) {
      ctx.deleteMessage().catch(() => null);
      ctx.scene.leave();
      return;
    }

    const orderObj = await orders.findOne(
      {
        orderID: order,
        ozan: true,
        ozanPaid: false
      },
      {
        item: 1
      }
    );

    if (!orderObj) {
      ctx.editMessageText('Более не актуально').catch(() => null);
      ctx.scene.leave();
      return;
    }

    const item = await goods.findById(orderObj.item, {
      'netCost.LIR': 1
    });
    if (!item) {
      ctx.answerCbQuery('Не удалось найти товар').catch(() => null);
      ctx.deleteMessage().catch(() => null);
      ctx.scene.leave();
      return;
    }

    ctx.scene.state.menu = ctx.callbackQuery.message.message_id;
    ctx.scene.state.amount = item.netCost.LIR;
    await ctx.editMessageText(
      `<b>Подтверждение оплаты (${item.netCost.LIR} лир) со счёта ozan для заказа ${order}</b>\n<i>Если необходимо указать другую сумму платежа - напишите ее</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('Оплатить', 'accept')],
          [Markup.button.callback('Отмена', 'exit')]
        ]).reply_markup
      }
    );
  } catch (error) {
    console.log(error);
    ctx.scene.leave();
  }
};

ozanPaid.on('message', async ctx => {
  try {
    ctx.deleteMessage().catch(() => null);

    const { order } = ctx.scene.state;
    const amount = Number(ctx.message.text);
    if (Number.isNaN(amount) || amount < 0) {
      ctx
        .reply('Введите 0 или положительное число')
        .then(msg =>
          setTimeout(
            () => ctx.deleteMessage(msg.message_id).catch(() => null),
            2500
          )
        )
        .catch(() => null);
      return;
    }

    ctx.scene.state.amount = amount;
    ctx.telegram
      .editMessageText(
        ctx.from.id,
        ctx.scene.state.menu,
        undefined,
        `<b>Подтверждение оплаты (${amount} лир) со счёта ozan для заказа ${order}</b>\n<i>Если необходимо указать другую сумму платежа - напишите ее</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('Оплатить', 'accept')],
            [Markup.button.callback('Отмена', 'exit')]
          ]).reply_markup
        }
      )
      .catch(() => null);
  } catch (error) {
    console.log(error);
  }
});

ozanPaid.action('accept', async ctx => {
  try {
    const { order, amount } = ctx.scene.state;
    const ozanAccount = await ozanAccounts.findOne({ employer: ctx.from.id });
    if (!ozanAccount) {
      throw new Error('No account');
    }

    await ozanAccount.createTransaction({
      order,
      description: 'Выполнение заказа',
      amount: -amount,
      issuer: ctx.from.id
    });

    await orders.updateOne(
      {
        orderID: order
      },
      {
        $set: {
          ozanPaid: true
        }
      }
    );

    ctx.answerCbQuery('Платеж подтвержден').catch(() => null);
  } catch (error) {
    console.log(error);
  } finally {
    ctx.scene.enter('take_order', {
      orderID: ctx.scene.state.order
    });
  }
});

ozanPaid.action('exit', ctx =>
  ctx.scene.enter('take_order', {
    orderID: ctx.scene.state.order
  })
);

module.exports = ozanPaid;
