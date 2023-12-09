const { Scenes, Markup } = require('telegraf');

const users = require('../../models/users');
const orders = require('../../models/orders');
const keys = require('../keyboard');
const escapeHTML = require('escape-html');

const managersInfo = new Scenes.BaseScene('showManagers');

managersInfo.enterHandler = async function (ctx) {
  try {
    const user = await users.findOne(
      {
        telegramID: ctx.from.id
      },
      'role'
    );

    if (user.role === 'admin') {
      const managers = await users.find(
        {
          role: 'manager'
        },
        'telegramID username'
      );

      let keyboard = [[Markup.button.callback('Назад', keys.BackMenu.buttons)]];

      for (let manager of managers) {
        keyboard.push([
          Markup.button.callback(
            `${manager.username}:${manager.telegramID}`,
            `manager#${manager.telegramID}`
          )
        ]);
      }

      ctx.telegram
        .editMessageText(
          ctx.from.id,
          ctx.scene.state.menu?.message_id ||
            ctx.callbackQuery.message.message_id,
          undefined,
          'Список менеджеров',
          {
            reply_markup: Markup.inlineKeyboard(keyboard).reply_markup
          }
        )
        .catch(_ => null);
    } else {
      ctx.telegram
        .deleteMessage(ctx.from.id, ctx.callbackQuery.message.message_id)
        .catch(_ => null);
      ctx.answerCbQuery('У вас нет прав').catch(_ => null);
      ctx.scene.leave();
    }
  } catch (e) {
    null;
    ctx.scene.enter('admin', {
      menu: ctx.callbackQuery.message
    });
  }
};

managersInfo.action(keys.BackMenu.buttons, ctx => {
  ctx.scene.enter('admin', {
    menu: ctx.callbackQuery.message
  });
});

managersInfo.action(/manager#\d+/, async ctx => {
  try {
    const userID = /\d+/.exec(ctx.callbackQuery.data)[0];
    const user = await users.findOne({
      telegramID: userID
    });

    if (user) {
      const works = await orders.find(
        {
          manager: user.telegramID
        },
        'status itemTitle orderID'
      );

      const stats = genStats(works);
      const sum = stats.done + stats.processing + stats.refund;

      const doneP = ((stats.done / sum) * 100).toFixed(2);
      const processingP = ((stats.processing / sum) * 100).toFixed(2);
      const refundP = ((stats.refund / sum) * 100).toFixed(2);

      let msg = `<b>Статистика менеджера</b> ${
        user.telegramID
      }:<a href="tg://user?id=${user.telegramID}">${
        user.username
      }</a>\n\n<b>Статистика за все время</b>\nВсего заказов взято: ${sum}\nВыполнено: ${
        stats.done
      } = ${Number.isNaN(doneP) ? 0 : doneP}%\nВ работе: ${
        stats.processing
      } = ${Number.isNaN(processingP) ? 0 : processingP}%\nВозвраты: ${
        stats.refund
      } = ${
        Number.isNaN(refundP) ? 0 : refundP
      }%\n\n<b>Статистика по последним заказам</b>\n`;

      let summary = 0;
      for (let stat of user.stats) {
        msg += `<i>${stat.title}</i>: ${stat.count}\n`;
        summary += stat.count;
      }
      if (summary > 0) msg += `<b>Всего:</b> ${summary}\n`;

      let inWork = '';
      for (let order of works) {
        if (order.status === 'processing') {
          inWork += `\n<code>${order.orderID}</code>: "${order.itemTitle}"`;
        }
      }
      msg += '\n<b>Активные заказы</b>';
      msg += inWork !== '' ? inWork : '\n<i>Активных заказов нет</i>';

      ctx.telegram
        .editMessageText(
          ctx.from.id,
          ctx.callbackQuery.message.message_id,
          undefined,
          msg,
          {
            reply_markup: Markup.inlineKeyboard([
              [
                Markup.button.callback(
                  'Удалить из менеджеров',
                  `delete#${user.telegramID}`
                )
              ],
              [Markup.button.callback('Доход', `income:${user.telegramID}`)],
              [
                Markup.button.callback(
                  'Штраф/Поощрение',
                  `manage-income#${user.telegramID}`
                )
              ],
              [
                Markup.button.callback(
                  'Сбросить статистику',
                  `drop#${user.telegramID}`
                )
              ],
              [Markup.button.callback('Назад', `manager#${user.telegramID}`)]
            ]).reply_markup,
            parse_mode: 'HTML'
          }
        )
        .catch(_ => null);
    }
  } catch (e) {
    null;
    ctx.scene.reenter();
  }
});

managersInfo.on(
  'message',
  (ctx, next) => {
    ctx.deleteMessage().catch(() => null);
    if (!ctx.scene.state.target) {
      return;
    }

    next();
  },
  async (ctx, next) => {
    try {
      if (ctx.scene.state.target !== 'amount') {
        next();
        return;
      }

      const amount = Number(ctx.message.text);
      if (Number.isNaN(amount) || amount === 0) {
        ctx
          .reply('Значение должны быть числом, и не равно нулю')
          .then(msg =>
            setTimeout(
              () => ctx.deleteMessage(msg.message_id).catch(() => null),
              2500
            )
          )
          .catch(() => null);

        return;
      }

      ctx.scene.state.amount = amount;
      ctx.scene.state.target = 'description';
      await ctx.telegram.editMessageText(
        ctx.from.id,
        ctx.scene.state.menu,
        undefined,
        `<b>Укажите причину ${amount > 0 ? 'поощрения' : 'штрафа'}</b>`,
        {
          parse_mode: 'HTML',
          reply_markup: Markup.inlineKeyboard([
            [
              Markup.button.callback(
                'Отмена',
                `manager#${ctx.scene.state.incomeTarget}`
              )
            ]
          ]).reply_markup
        }
      );
    } catch (e) {
      console.log(e);
    }
  },
  async ctx => {
    try {
      if (ctx.scene.state.target !== 'description') {
        return;
      }

      const description = ctx.message.text;
      const manager = await users.findOne(
        { telegramID: ctx.scene.state.incomeTarget },
        { username: 1 }
      );
      if (!manager) {
        return;
      }

      ctx.scene.state.description = description;
      await ctx.telegram.editMessageText(
        ctx.from.id,
        ctx.scene.state.menu,
        undefined,
        `<b>Сохранить ${
          ctx.scene.state.amount > 0 ? 'поощрение' : 'штраф'
        } для менеджера <code>${escapeHTML(
          manager.username
        )}</code>?</b>\n\n<i>Сумма:</i> ${ctx.scene.state.amount.toFixed(
          2
        )}р\n<i>Причина:</i> ${escapeHTML(ctx.scene.state.description)}`,
        {
          parse_mode: 'HTML',
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('Да', 'save-income')],
            [
              Markup.button.callback(
                'Нет',
                `manager#${ctx.scene.state.incomeTarget}`
              )
            ]
          ]).reply_markup
        }
      );
    } catch (e) {
      console.log(e);
    }
  }
);

managersInfo.action('save-income', async ctx => {
  try {
    await users.updateOne(
      {
        telegramID: ctx.scene.state.incomeTarget
      },
      {
        $push: {
          incomeFactors: {
            amount: ctx.scene.state.amount,
            description: ctx.scene.state.description
          }
        }
      }
    );
  } catch (e) {
    console.log(e);
  } finally {
    ctx.scene.state = undefined;
    ctx.scene.reenter();
  }
});

managersInfo.action(/manage-income#\d+/, async ctx => {
  try {
    const raw = /#(\d+)$/.exec(ctx.callbackQuery.data);
    if (!raw) {
      return;
    }

    const managerId = Number(raw[1]);
    ctx.scene.state.menu = ctx.callbackQuery.message.message_id;

    await ctx.editMessageText(
      '<b>Укажите сумму</b>\n<i>Отрицательная сумма будет записана как штраф, положительная - как поощрение</i>',
      {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('Назад', `manager#${managerId}`)]
        ]).reply_markup
      }
    );

    ctx.scene.state.incomeTarget = managerId;
    ctx.scene.state.target = 'amount';
  } catch (e) {
    console.log(e);
  }
});

managersInfo.action(/income:\d+/, ctx => {
  try {
    const raw = /:(\d+)$/.exec(ctx.callbackQuery.data);
    if (!raw) {
      return;
    }

    const managerId = Number(raw[1]);
    ctx.scene.state.manager = managerId;
    ctx.scene.enter('manager-income', ctx.scene.state);
  } catch (error) {
    console.log(error);
  }
});

managersInfo.action(/delete#\d+/, async ctx => {
  try {
    const userID = /\d+/.exec(ctx.callbackQuery.data)[0];
    const user = await users.findOne({
      telegramID: userID
    });

    if (user) {
      ctx.scene.state.user = userID;

      await ctx.telegram.editMessageText(
        ctx.from.id,
        ctx.callbackQuery.message.message_id,
        undefined,
        `Вы хотите убрать у пользователя <code>${userID}</code> роль менеджера?`,
        {
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('Да', keys.YesNoMenu.buttons.yes)],
            [Markup.button.callback('Нет', `manager#${userID}`)]
          ]).reply_markup,
          parse_mode: 'HTML'
        }
      );
    } else {
      ctx.answerCbQuery('Пользователь не найден').catch(_ => null);
      ctx.scene.reenter();
    }
  } catch (e) {
    null;
    ctx.scene.reenter();
  }
});

managersInfo.action(/drop#\d+/, async ctx => {
  try {
    const userID = /\d+/.exec(ctx.callbackQuery.data)[0];
    const user = await users.findOne(
      {
        telegramID: userID
      },
      'username'
    );

    if (!user) {
      ctx.answerCbQuery('Пользователь не найден').catch(_ => null);
      ctx.scene.reenter();
    } else {
      ctx.scene.state.target = userID;
      await ctx.telegram.editMessageText(
        ctx.from.id,
        ctx.callbackQuery.message.message_id,
        undefined,
        `Вы точно хотите сбросить статистику менеджера <a href="tg://user?id=${userID}">${user.username}</a>?`,
        {
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('Да', 'drop')],
            [Markup.button.callback('Нет', `manager#${userID}`)]
          ]).reply_markup,
          parse_mode: 'HTML'
        }
      );
    }
  } catch (e) {
    null;
    ctx.scene.reenter();
  }
});

managersInfo.action('drop', async ctx => {
  try {
    await users.updateOne(
      {
        telegramID: ctx.scene.state.target
      },
      {
        $set: {
          stats: [],
          incomeFactors: []
        }
      }
    );

    await ctx.telegram.editMessageText(
      ctx.from.id,
      ctx.callbackQuery.message.message_id,
      undefined,
      'Готово',
      {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('Назад', `manager#${ctx.scene.state.target}`)]
        ]).reply_markup
      }
    );
  } catch (e) {
    null;
    ctx.scene.reenter();
  }
});

managersInfo.action(keys.YesNoMenu.buttons.yes, async ctx => {
  try {
    await users.updateOne(
      {
        telegramID: ctx.scene.state.user
      },
      {
        $set: {
          role: 'client'
        }
      }
    );

    ctx.answerCbQuery('Готово').catch(_ => null);

    ctx.scene.reenter();
  } catch (e) {
    null;
    ctx.scene.reenter();
  }
});

managersInfo.action('prev', ctx => ctx.scene.reenter());

function genStats(works) {
  let result = {
    processing: 0,
    done: 0,
    refund: 0
  };

  for (let order of works) result[order.status]++;

  return result;
}

module.exports = managersInfo;
