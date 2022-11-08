const keys = require('./keyboard');

async function EnterAdmin(ctx) {
  if (!ctx.scene.state.menu) return await ctx.reply('Панель администратора', keys.AdminMenu.keyboard);
  else {
    await ctx.editMessageText('Панель администратора', ctx.scene.state.menu.message_id);
    await ctx.editMessageReplyMarkup(keys.AdminMenu.keyboard.reply_markup, ctx.scene.state.menu.message_id);
    return ctx.scene.state.menu;
  }
}

module.exports = EnterAdmin;