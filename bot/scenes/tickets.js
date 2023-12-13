const { Scenes, Markup } = require('telegraf');
const escapeHTML = require('escape-html');
const users = require('../../models/users');
const fs = require('fs');
const path = require('path');
const { Types } = require('mongoose');
const tickets = require('../../models/tickets');
const moment = require('moment');
const { admin } = require('googleapis/build/src/apis/admin');

const ticketsScene = new Scenes.BaseScene('tickets');

ticketsScene.enterHandler = async ctx => {
  try {
    ctx.deleteMessage().catch(() => null);
    const user = await users.findOne(
      {
        telegramID: ctx.from.id
      },
      {
        role: 1
      }
    );
    if (user?.role !== 'admin') {
      ctx.scene.leave();
      return;
    }

    const menu = await ctx.reply('<b>Меню тикетов</b>', {
      parse_mode: 'HTML',
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('Изменить сообщение', 'change:message')],
        [Markup.button.callback('Изменить темы тикетов', 'change:themes')],
        [Markup.button.callback('Тикет по ID', 'peek')],
        [Markup.button.callback('Назад', 'exit')]
      ]).reply_markup
    });

    ctx.scene.state.ticketsMenu = menu.message_id;
  } catch (error) {
    console.log(error);
    ctx.scene.enter('admin');
  }
};

ticketsScene.action(
  /^change:(message|themes)$/,
  (ctx, next) => {
    try {
      const raw = /:(?<target>message|themes)/.exec(ctx.callbackQuery.data);
      if (!raw) {
        return;
      }

      const { target } = raw.groups;
      ctx.scene.state.target = target;

      next();
    } catch (error) {
      console.log(error);
    }
  },
  async (ctx, next) => {
    try {
      const { target } = ctx.scene.state;
      if (target !== 'message') {
        next();
        return;
      }

      await ctx.editMessageText(
        `<u>Сообщение на данный момент</u>\n\n${global.helpMessage}\n\n<i>Если вы хотите его изменить - отправьте новое значение</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('Отмена', 'cancel')]
          ]).reply_markup
        }
      );
    } catch (error) {
      console.log(error);
    }
  },
  async ctx => {
    try {
      const { target } = ctx.scene.state;
      if (target !== 'themes') {
        return;
      }

      const keyboard = [];
      const themes = global.ticketThemes;
      for (const theme of Object.keys(themes)) {
        keyboard.push([
          Markup.button.callback(theme, 'ignore'),
          Markup.button.callback('x', `delete:${theme}`)
        ]);
      }
      keyboard.push([
        Markup.button.callback('Добавить новую', 'add-theme'),
        Markup.button.callback('Отмена', 'cancel')
      ]);

      await ctx.editMessageText(
        '<b>Доступные темы для тикетов</b>\n<i>Вы можете их удалять и добавлять новые</i>',
        {
          parse_mode: 'HTML',
          reply_markup: Markup.inlineKeyboard(keyboard).reply_markup
        }
      );
    } catch (error) {
      console.log(error);
    }
  }
);

ticketsScene.on(
  'message',
  (ctx, next) => {
    ctx.deleteMessage().catch(() => null);
    if (!ctx.message.text) {
      return;
    }

    next();
  },
  async (ctx, next) => {
    try {
      const { target, ticketsMenu } = ctx.scene.state;
      if (target !== 'message') {
        next();
        return;
      }

      const message = ctx.message.text;
      if (message.length > 1500) {
        ctx
          .reply('Сообщение слишком длинное')
          .then(msg =>
            setTimeout(
              () => ctx.deleteMessage(msg.message_id).catch(() => null),
              2500
            )
          )
          .catch(() => null);
        return;
      }

      ctx.scene.state.message = message;
      await ctx.telegram.editMessageText(
        ctx.from.id,
        ticketsMenu,
        undefined,
        `<b>Сохранить новое значение?</b>\n\n${escapeHTML(
          message
        )}\n\n<i>Если хотите изменить - введите новое</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('Да', 'save-new-message')],
            [Markup.button.callback('Нет', 'cancel')]
          ]).reply_markup
        }
      );
    } catch (error) {
      console.log(error);
    }
  },
  async (ctx, next) => {
    try {
      const { target, ticketsMenu } = ctx.scene.state;
      if (target !== 'add-theme') {
        next();
        return;
      }

      const { text } = ctx.message;
      if (text.length > 50) {
        ctx
          .reply('Сообщение слишком длинное')
          .then(msg =>
            setTimeout(
              () => ctx.deleteMessage(msg.message_id).catch(() => null),
              2500
            )
          )
          .catch(() => null);
        return;
      }

      if (Object.keys(global.ticketThemes).includes(text)) {
        ctx
          .reply('Такая тема уже существует')
          .then(msg =>
            setTimeout(
              () => ctx.deleteMessage(msg.message_id).catch(() => null),
              2500
            )
          )
          .catch(() => null);
        return;
      }

      ctx.scene.state.newTheme = text;
      await ctx.telegram.editMessageText(
        ctx.from.id,
        ticketsMenu,
        undefined,
        `<b>Новая тема</b>\n${escapeHTML(
          text
        )}\n\n<i>Если хотите изменить - отправьте новое значение</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('Добавить', 'save-theme')],
            [Markup.button.callback('Отмена', 'cancel')]
          ]).reply_markup
        }
      );
    } catch (error) {
      console.log(error);
    }
  },
  async ctx => {
    try {
      const { target, ticketsMenu } = ctx.scene.state;
      if (target !== 'ticket-id') {
        return;
      }

      const raw = /(?<ticketRaw>[a-z0-9]{12,24})/i.exec(ctx.message.text);
      if (!raw) {
        ctx
          .reply('Введенное значение не является ID')
          .then(msg =>
            setTimeout(
              () => ctx.deleteMessage(msg.message_id).catch(() => null),
              2500
            )
          )
          .catch(() => null);
        return;
      }

      const { ticketRaw } = raw.groups;
      const ticketId = new Types.ObjectId(ticketRaw.toLowerCase());
      const ticket = await tickets.findById(new Types.ObjectId(ticketId), {
        done: 1,
        title: 1,
        created: 1,
        closed: 1
      });

      if (!ticket) {
        ctx
          .reply('Тикет не найден')
          .then(msg =>
            setTimeout(
              () => ctx.deleteMessage(msg.message_id).catch(() => null),
              2500
            )
          )
          .catch(() => null);
        return;
      }

      ctx.scene.state.ticket = ticketId;
      ctx.telegram
        .editMessageText(
          ctx.from.id,
          ticketsMenu,
          undefined,
          `<b>Тикет ${ticketRaw.toUpperCase()}</b>${
            ticket.done
              ? '\n<i>Закрыт ' +
                moment(ticket.closed)
                  .locale('ru')
                  .format('DD.MM.YYYY [в] HH:mm:ss') +
                '</i>'
              : ''
          }`,
          {
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard([
              [
                Markup.button.callback('Посмотреть', 'take-ticket:view'),
                Markup.button.callback(
                  'Взять',
                  'take-ticket:retake',
                  ticket.done
                )
              ],
              [Markup.button.callback('Назад', 'cancel')]
            ]).reply_markup
          }
        )
        .catch(() => null);
    } catch (error) {
      console.log(error);
    }
  }
);

ticketsScene.action(/^take-ticket:(view|retake)$/, async ctx => {
  try {
    const { ticket } = ctx.scene.state;
    if (!ticket) {
      ctx.scene.enter('tickets');
      return;
    }

    const raw = /:(?<mode>view|retake)$/.exec(ctx.callbackQuery.data);
    if (!raw) {
      return;
    }

    const { mode } = raw.groups;
    if (mode === 'retake') {
      const result = await tickets.updateOne(
        {
          _id: ticket,
          done: false
        },
        {
          $set: {
            manager: ctx.from.id
          }
        }
      );

      if (result.matchedCount === 0) {
        ctx
          .reply('Заказ уже закрыт')
          .then(msg =>
            setTimeout(
              () => ctx.deleteMessage(msg.message_id).catch(() => null),
              2500
            )
          )
          .catch(() => null);
        return;
      }
    }

    const menu = await ctx.replyWithPhoto(
      {
        source: path.resolve('files', 'images', 'blank_support.jpg')
      },
      {
        caption: 'Загружаю...'
      }
    );

    ctx.scene.enter('see-ticket', {
      ticket,
      menu: menu.message_id,
      role: 'admin',
      view: mode === 'view',
      skip: 0
    });
  } catch (error) {
    console.log(error);
  }
});

ticketsScene.action('peek', async ctx => {
  try {
    ctx.scene.state.target = 'ticket-id';
    await ctx.editMessageText('<b>Введите ID заказа</b>', {
      parse_mode: 'HTML',
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('Отмена', 'cancel')]
      ]).reply_markup
    });
  } catch (error) {
    console.log(error);
  }
});

ticketsScene.action('save-theme', async ctx => {
  try {
    const { newTheme } = ctx.scene.state;
    if (!newTheme) {
      throw new Error('No theme');
    }

    const themes = global.ticketThemes;
    themes[newTheme] = 1;
    global.ticketThemes = themes;

    const payload = JSON.stringify(themes);
    fs.writeFileSync(path.resolve('ticketThemes.json'), payload);

    ctx.answerCbQuery('Готово').catch(() => null);
  } catch (error) {
    console.log(error);
  } finally {
    ctx.scene.enter('tickets');
  }
});

ticketsScene.action('save-new-message', async ctx => {
  try {
    const { message } = ctx.scene.state;
    if (!message) {
      throw new Error('No message');
    }

    global.helpMessage = message;

    fs.writeFileSync(path.resolve('help.txt'), message);

    ctx.answerCbQuery('Сообщение сохранено').catch(() => null);
  } catch (error) {
    console.log(error);
  } finally {
    ctx.scene.enter('tickets');
  }
});

ticketsScene.action(/delete:.+/, async ctx => {
  try {
    const raw = /^delete:(?<theme>.+)$/.exec(ctx.callbackQuery.data);
    if (!raw) {
      ctx.scene.enter('tickets');
      return;
    }

    const { theme } = raw.groups;
    const themes = global.ticketThemes;

    delete themes[theme];
    global.ticketThemes = themes;

    const payload = JSON.stringify(themes);
    fs.writeFileSync(path.resolve('ticketThemes.json'), payload);

    ctx.answerCbQuery('Готово').catch(() => null);
    ctx.scene.enter('tickets');
  } catch (error) {
    console.log(error);
  }
});

ticketsScene.action('add-theme', async ctx => {
  try {
    await ctx.editMessageText(
      'Введите название новой темы (не более 50 символов)',
      {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('Отмена', 'cancel')]
        ]).reply_markup
      }
    );

    ctx.scene.state.target = 'add-theme';
  } catch (error) {
    console.log(error);
    ctx.scene.enter('tickets');
  }
});

ticketsScene.action('exit', ctx => {
  ctx.scene.enter('admin');
});

ticketsScene.action('cancel', ctx => ctx.scene.enter('tickets'));

ticketsScene.leaveHandler = ctx => {
  ctx.scene.state.message = undefined;
  if (ctx.scene.state.ticketsMenu) {
    ctx.deleteMessage(ctx.scene.state.ticketsMenu).catch(() => null);
  }
};

module.exports = ticketsScene;
