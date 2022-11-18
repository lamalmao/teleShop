const { Scenes } = require('telegraf');

const keys = require('../keyboard');

const ManageUsers = new Scenes.BaseScene('managers');

ManageUsers.enterHandler = async ctx => {
  try {
    const AdminMenuMessageId = ctx.scene.state.menu.message_id,
      userId = ctx.from.id;

    await ctx.editMessageText('Меню управления менеджерами', AdminMenuMessageId);
    await ctx.editMessageReplyMarkup(keys.ManagersMenu.keyboard.reply_markup, AdminMenuMessageId);
  } catch (e) {
    console.log(e.message);
    ctx.scene.enter('admin', ctx.scene.state);
  }
};

ManageUsers.on('callback_query', async ctx => {
  try {
    const cb = ctx.callbackQuery.data;

    if (cb) {
      switch (cb) {
        case keys.ManagersMenu.buttons.back:
          ctx.scene.enter('admin', ctx.scene.state);
          break;
        case keys.ManagersMenu.buttons.addManager:
          ctx.scene.enter('addManager', ctx.scene.state);
          break;
        case keys.ManagersMenu.buttons.managersList:
          ctx.scene.enter('showManagers', ctx.scene.state);
          break;
      }
    }
  } catch (e) {
    ctx.scene.enter('admin', ctx.scene.state)
  }
});

module.exports = ManageUsers;