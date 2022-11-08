const { Telegraf, session } = require('telegraf');
const stage = require('./scenes');
const clean = require('../cleanup');
const users = require('../models/users');
const payments = require('../models/payments');

function CreateBot(token) {
  const bot = new Telegraf(token);

  bot.use(session());
  bot.use(stage.middleware());

  bot.start(ctx => ctx.scene.enter('start'));
  bot.command('admin', ctx => ctx.scene.enter('admin'));
  bot.command('clean',
    async ctx => {
      const user = await users.findOne({
        telegramID: ctx.from.id,
        role: 'admin'
      }, 'role')

      if (user) clean();
  });

  bot.action('profile', ctx => ctx.scene.enter('profile', { menu: ctx.callbackQuery.message }));

  bot.action(/cancelPayment#\d+/, async ctx => {
    try {
      const paymentID = Number(/\d+$/.exec(ctx.callbackQuery.data)[0]);

      await payments.updateOne({
        paymentID: paymentID,
        status: 'waiting'
      }, {
        $set: {
          status: 'rejected'
        }
      });

      ctx.telegram.deleteMessage(ctx.from.id, ctx.callbackQuery.message.message_id).catch(_ => null);
    } catch (e) {
      ctx.answerCbQuery('Что-то пошло не так').catch(_ => null);
    } finally {
      ctx.scene.enter('start');
    }
  });

  bot.on('callback_query', ctx => ctx.deleteMessage(ctx.callbackQuery.message.message_id).catch(_ => null));

  return bot;
}

module.exports = CreateBot;