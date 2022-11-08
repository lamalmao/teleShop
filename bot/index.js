const { Telegraf, session } = require('telegraf');
const stage = require('./scenes');
const clean = require('../cleanup');
const users = require('../models/users');

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

  bot.on('callback_query', ctx => ctx.deleteMessage(ctx.callbackQuery.message.message_id).catch(_ => null));

  return bot;
}

module.exports = CreateBot;