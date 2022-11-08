const { Scenes } = require('telegraf');
const users = require('../../models/users');
const sendMenu = require('../menu');

const start = new Scenes.BaseScene('start');

start.enterHandler = async function(ctx) {
  // ctx.deleteMessage().catch(_ => null);

  try {
    const userId = ctx.from.id;

    const user = await users.findOne({
      telegramID: userId
    });

    if (!user) {
      users.create({
        telegramID: userId,
        username: ctx.from.username ? ctx.from.username : ctx.from.first_name
      });
    }

    await sendMenu(ctx);
  } catch (e) {
    console.log(e);
  } finally {
    ctx.scene.leave();
  }
};

module.exports = start;