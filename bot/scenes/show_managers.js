const { Scenes } = require('telegraf');

const keys = require('../keyboard');
const users = require('../../models/users');

const showManagers = new Scenes.WizardScene('showManagers',
  async ctx => {
    try {
      const message = ctx.scene.state.menu.message_id;

      var managers = await users.find({
        role: 'manager'
      }, 'telegramID username join_date');

      console.log(managers);

      // Временно
      ctx.scene.enter('admin', ctx.scene.state);
    } catch (e) {
      console.log(e);
      ctx.scene.enter('admin', ctx.scene.state);
    }
  }
);

module.exports = showManagers;