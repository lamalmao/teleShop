const { Telegraf, session } = require('telegraf');
const stage = require('./scenes');
const clean = require('../cleanup');
const users = require('../models/users');
const payments = require('../models/payments');
const keys = require('./keyboard');
const messages = require('./messages');

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

  bot.on('callback_query', (ctx, next) => {
    console.log(ctx.callbackQuery.data);
    ctx.answerCbQuery().catch(_ => null);
    next();
  });

  bot.action('profile', ctx => ctx.scene.enter('profile', { menu: ctx.callbackQuery.message }));

  bot.action('shop', ctx => ctx.scene.enter('shop'));

  bot.action([keys.Menu.buttons.questions, keys.Menu.buttons.guarantees, keys.Menu.buttons.comments, keys.Menu.buttons.support], async ctx => {
    try {
      await ctx.telegram.editMessageCaption(ctx.from.id, ctx.callbackQuery.message.message_id, undefined, messages[ctx.callbackQuery.data], {
        parse_mode: 'HTML',
        reply_markup: keys.BackMenu.keyboard.reply_markup
      });
    } catch (e) {
      console.log(e.message);
      ctx.telegram.deleteMessage(ctx.from.id, ctx.callbackQuery.message.message_id)
        .catch(_ => null);
    }
  })

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

  bot.action(/main_section#\w+/, ctx => ctx.scene.enter('mainCategory'));
  bot.action(/sub_section#\w+/, ctx => ctx.scene.enter('subCategory'));
  bot.action(/item#\w+/, ctx => ctx.scene.enter('item'));
  bot.action(/buy#\w+/, ctx => ctx.scene.enter('buy'));
  bot.action(/ref#\d+/, ctx => {
    const amount = Number(/\d+$/.exec(ctx.callbackQuery.data)[0]);
    ctx.scene.enter('pay', {
      menu: ctx.callbackQuery.message,
      amount: amount
    });
  });
  bot.action(/accept#\w+/, ctx => ctx.scene.enter('accept_purchase'));

  bot.action(keys.BackMenu.buttons, ctx => ctx.scene.enter('start', {
    menu: ctx.callbackQuery.message
  }));


  // bot.on('callback_query', ctx => {
  //   console.log(ctx.callbackQuery.data);
  //   ctx.deleteMessage(ctx.callbackQuery.message.message_id)
  //     .catch(_ => null)
  // });

  bot.on('message', ctx => ctx.scene.enter('start'));

  return bot;
}

module.exports = CreateBot;