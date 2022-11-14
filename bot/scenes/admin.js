const { Scenes } = require('telegraf');

const keys = require('../keyboard');
const users = require('../../models/users');
const EnterAdmin = require('../admin');

const adminPanel = new Scenes.WizardScene('admin', 
  async ctx => {
    try {
      const user = await users.findOne({
        telegramID: ctx.from.id
      }, 'role');

      if (user) {
        if (user.role !== 'admin') await ctx.scene.leave();
        else {
          ctx.scene.state.menu = await EnterAdmin(ctx);
          await ctx.wizard.next();
        }
      } else await ctx.scene.leave();
    } catch (e) {
      console.log(e);
      ctx.reply('Что-то пошло не так').catch(_ => null);
      ctx.scene.state = undefined;
      ctx.scene.reenter('admin', { menu: undefined } );
      console.log(e.message);
    }
  },
  async ctx => {
    try {
      if (ctx.callbackQuery) {
        const query = ctx.callbackQuery.data;
        if (query === keys.AdminMenu.buttons.exit) {
          ctx.scene.leave();
          ctx.deleteMessage(ctx.scene.state.menu.message_id).catch(_ => null);
        }
        else ctx.scene.enter(query, ctx.scene.state).catch(_ => ctx.answerCbQuery('Неизвестная ошибка').catch(_ => null));
      } 
      else if (ctx.message.from.id === ctx.from.id) {
        if (ctx.message.text === '/start' || ctx.message.text === '/menu') {
          await ctx.deleteMessage(ctx.scene.state.menu.message_id);
          ctx.scene.enter('start');
        }
      }
    } catch (e) {
      console.log(e);
      ctx.scene.leave();
    }
  }
);

module.exports = adminPanel;