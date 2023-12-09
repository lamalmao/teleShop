const { Scenes, Markup } = require('telegraf');
const managerIncome = new Scenes.BaseScene('manager-income');
const escapeHTML = require('escape-html');
const goods = require('../../models/goods');
const users = require('../../models/users');
const { Types } = require('mongoose');

managerIncome.enterHandler = async ctx => {
  try {
    const user = await users.findOne(
      {
        telegramID: ctx.scene.state.manager || ctx.from.id
      },
      {
        role: 1,
        stats: 1,
        username: 1
      }
    );

    if (user.role === 'client') {
      throw new Error('No access');
    }

    let totalIncome = 0;
    let message = `<u>Доход мененджера ${escapeHTML(user.username)}</u>\n`;
    for (const stat of user.stats) {
      const itemIncome = await goods.findById(new Types.ObjectId(stat.id), {
        managerReward: 1
      });
      if (!itemIncome) {
        continue;
      }

      const reward =
        stat.count === 0
          ? 0.0
          : itemIncome.managerReward
            ? (itemIncome.managerReward * stat.count).toFixed(2)
            : '?';
      totalIncome += typeof reward === 'number' ? reward : 0;
      message = message.concat(
        `\n<i>${escapeHTML(stat.title)}:</i> <code>${reward}р</code>`
      );
    }

    message = message.concat(`\n\n<b>Итого: ${totalIncome.toFixed(2)}р</b>`);

    if (ctx.scene.state.manager) {
      ctx.scene.state.menu = ctx.callbackQuery.message.message_id;
    } else {
      ctx.scene.state.menu = ctx.callbackQuery.message;
    }

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: Markup.inlineKeyboard([
        [
          Markup.button.callback(
            'Назад',
            ctx.scene.state.manager ? 'back-admin' : 'back-manager'
          )
        ]
      ]).reply_markup
    });
  } catch (error) {
    console.log(error);
    ctx.scene.leave();
  }
};

managerIncome.action('back-manager', ctx =>
  ctx.scene.enter('manager_menu', ctx.scene.state)
);

managerIncome.action('back-admin', ctx =>
  ctx.scene.enter('showManagers', ctx.scene.state)
);

managerIncome.leaveHandler = ctx => {
  ctx.scene.state.manager = undefined;
};

module.exports = managerIncome;
