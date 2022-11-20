const { Scenes, Markup } = require('telegraf');

const users = require('../../models/users');
const orders = require('../../models/orders');
const messages = require('../messages');

const userRefund = new Scenes.WizardScene('user_refund',
  async ctx => {
    try {
      const orderID = ctx.scene.state.refundID ? ctx.scene.state.refundID : /\d+/.exec(ctx.callbackQuery.data)[0];

      console.log(orderID);

      const order = await orders.findOne({
        orderID: orderID,
        client: ctx.from.id,
        status: 'refund'
      });

      ctx.scene.state.refundID = orderID;

      if (order) {
        ctx.scene.state.order = order;

        const msg = await ctx.telegram.editMessageText(
          ctx.from.id,
          ctx.callbackQuery.message.message_id,
          undefined,
          messages.refund_instructions[0],
          {
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard([
              [ Markup.button.callback('QIWI', 'qiwi') ],
              [ Markup.button.callback('Банковская карта', 'card') ]
            ]).reply_markup
          }
        );
        
        ctx.scene.state.message = msg;
        ctx.wizard.next();
      } else ctx.scene.leave();
    } catch (e) {
      console.log(e);
      ctx.answerCbQuery('Что-то пошло не так, попробуйте снова')
        .catch(_ => null);
      ctx.scene.leave();
    }
  },
  async ctx => {
    try {
      if (ctx.updateType === 'callback_query') {
        if (ctx.callbackQuery.data === 'qiwi' || ctx.callbackQuery.data === 'card') {
          ctx.scene.state.target = ctx.callbackQuery.data;
          msg = messages.refund_instructions[ctx.callbackQuery.data === 'qiwi' ? 1 : 2];

          await ctx.telegram.editMessageText(
            ctx.from.id,
            ctx.callbackQuery.message.message_id,
            undefined,
            msg,
            {
              parse_mode: 'HTML',
              reply_markup: Markup.inlineKeyboard([
                [ Markup.button.callback('Назад', 'back') ]
              ]).reply_markup
            }
          );

          ctx.scene.state.message = ctx.callbackQuery.message;
          ctx.scene.state.msg = msg;

          ctx.wizard.next();
        } else ctx.answerCbQuery('Не та кнопка, выберите платежную систему').catch(_ => null);
      }
    } catch (e) {
      console.log(e);
      ctx.answerCbQuery('Что-то пошло не так, попробуйте снова')
        .catch(_ => null);
      ctx.scene.leave();
    }
  },
  async ctx => {
    try {
      if (ctx.updateType === 'message') {
        const value = ctx.message.text.replace(/[\+\- \(\)]/g, ''),
          wallet = ctx.scene.state.target === 'qiwi' ? value : value.substring(0, 16);

        console.log(wallet);

        if (ctx.scene.state.target === 'card' && /\d{16}/.test(wallet) || ctx.scene.state.target === 'qiwi' && /\d+/.test(wallet)) {
          ctx.scene.state.wallet = wallet;

          await ctx.telegram.editMessageText(
            ctx.from.id,
            ctx.scene.state.message.message_id,
            undefined,
            `<b>Все верно?</b>\n\n<b>${ctx.scene.state.target === 'qiwi' ? 'QIWI' : 'Банковская карта'}</b> ${ctx.scene.state.wallet}\n\nВнимательно проверьте данные для возврат средств!`,
            {
              reply_markup: Markup.inlineKeyboard([
                [ Markup.button.callback('Да', 'refund_success') ],
                [ Markup.button.callback('Нет', 'back') ]
              ]).reply_markup,
              parse_mode: 'HTML'
            }
          );
          ctx.wizard.next();
        } else {
          await ctx.telegram.editMessageText(
            ctx.from.id,
            ctx.scene.state.message.message_id,
            undefined,
            ctx.scene.state.msg + '\n\nОшибка: неверный формат выбранного кошелька',
            {
              parse_mode: 'HTML'
            }
          )
        }
      } else if (ctx.updateType === 'callback_query' && ctx.callbackQuery.data === 'back') {
        console.log('LEMME IN')
        ctx.scene.reenter({
          refundID: ctx.scene.state.refundID
        });
      }
    } catch (e) {
      console.log(e);
      ctx.answerCbQuery('Что-то пошло не так')
        .catch(_ => null);
      ctx.scene.leave();
    }
  },
  async ctx => {
    try {
      if (ctx.updateType === 'callback_query' && ctx.callbackQuery.data === 'refund_success') {
        await orders.updateOne({
          orderID: ctx.scene.state.refundID
        }, {
          $set: {
            refundData: `${ctx.scene.state.target === 'qiwi' ? 'QIWI' : 'Банковская карта'}: ${ctx.scene.state.wallet}`
          }
        });

        await ctx.telegram.editMessageText(
          ctx.from.id,
          ctx.scene.state.message.message_id,
          undefined,
          'Ожидайте возврат на указанные реквизиты'
        );
        ctx.scene.leave();
      } else if (ctx.updateType === 'callback_query' && ctx.callbackQuery.data === 'back') {
        ctx.scene.reenter({
          refundID: ctx.scene.state.userRefund
        });
      }
    } catch (e) {
      console.log(e)
    }
  }
);

userRefund.action('no', ctx => {
  console.log('reenter');
  ctx.scene.enter('user_refund', {
    refundID: ctx.scene.state.refundID
  });
});

userRefund.on('message', (ctx, next) => {
  ctx.deleteMessage()
    .catch(_ => null);
  next();
});

module.exports = userRefund;