const { Scenes, Markup } = require('telegraf');

const users = require('../../models/users');
const orders = require('../../models/orders');
const messages = require('../messages');

const userRefund = new Scenes.WizardScene('user_refund',
  async ctx => {
    try {
      const orderID = /\d+/.exec(ctx.callbackQuery.data)[0];
      const order = await orders.findOne({
        orderID: orderID,
        client: ctx.from.id,
        status: 'refund'
      });

      ctx.editMessageReplyMarkup(Markup.removeKeyboard())
        .catch(_ => null);

      if (order) {
        ctx.scene.state.order = order;

        const msg = await ctx.reply(messages.refund_instruction, {
          parse_mode: 'HTML'
        });
        
        ctx.scene.state.message = msg;
        ctx.wizard.next();
      } ctx.scene.leave();
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
        ctx.scene.state.data = ctx.message.text;
        ctx.scene.state.msg = await ctx.reply(`Проверьте:\n\n${ctx.message.text}\n\nВсе верно?`, {
          reply_markup: Markup.inlineKeyboard([
            [ Markup.button.callback('Да', 'refund_accept_data') ],
            [ Markup.button.callback('Нет', 'refund_decline_data') ]
          ]).reply_markup
        });
        ctx.wizard.next();
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
      if (ctx.updateType === 'callback_query') {
        ctx.telegram.editMessageReplyMarkup(
          ctx.from.id,
          ctx.scene.state.msg.message_id,
          undefined,
          Markup.removeKeyboard()
        );

        if (ctx.callbackQuery.data === 'refund_accept_data') {
          await orders.updateOne({
            orderID: ctx.scene.state.order.orderID
          }, {
            $set: {
              refundData: ctx.scene.state.data
            }
          });

          await ctx.reply(messages.refund_data_success);
          ctx.scene.leave();
        } else {
          await ctx.reply(messages.refund_instruction);
          ctx.wizard.back();
        }
      }
    } catch (e) {
      console.log(e);
      ctx.answerCbQuery('Что-то пошло не так, попробуйте снова')
        .catch(_ => null);
      ctx.scene.leave();
    }
  }
);

module.exports = userRefund;