const { Scenes, Markup } = require('telegraf');
const path = require('path');
const { Types } = require('mongoose');
const tickets = require('../../models/tickets');

const managerTickets = new Scenes.BaseScene('manager-tickets');

managerTickets.enterHandler = async ctx => {
  try {
    ctx.deleteMessage().catch(() => null);
    const menu = await ctx.replyWithPhoto(
      {
        type: 'photo',
        source: path.resolve('files', 'images', 'blank_support.jpg')
      },
      {
        caption: '<b>Меню поддержки</b>',
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
          [
            Markup.button.callback('Список тикетов', 'list'),
            Markup.button.callback('Взять тикет по ID', 'take-by-id')
          ],
          [Markup.button.callback('Мои тикеты', 'my-tickets')],
          [Markup.button.callback('Назад', 'exit')]
        ]).reply_markup
      }
    );

    ctx.scene.state.menu = menu.message_id;
  } catch (error) {
    console.log(error);
    ctx.scene.leave();
  }
};

managerTickets.action('take-by-id', async ctx => {
  try {
    ctx.scene.state.search = true;
    await ctx.editMessageCaption('Введите ID тикета', {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('Отмена', 'reenter')]
      ]).reply_markup
    });
  } catch (error) {
    console.log(error);
  }
});

managerTickets.on(
  'message',
  (ctx, next) => {
    ctx.deleteMessage().catch(() => null);
    if (!ctx.scene.state.search) {
      return;
    }

    next();
  },
  async ctx => {
    try {
      const { text } = ctx.message;
      const raw = /(?<ticketId>[a-z0-9]{24})/i.exec(text);
      if (!raw) {
        ctx
          .reply('Введенное значение не является ID тикета')
          .then(msg =>
            setTimeout(
              () => ctx.deleteMessage(msg.message_id).catch(() => null),
              3000
            )
          )
          .catch(() => null);
        return;
      }

      const { ticketId } = raw.groups;
      const result = await tickets.updateOne(
        {
          _id: new Types.ObjectId(ticketId),
          client: {
            $ne: ctx.from.id
          },
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
          .reply('Тикет не найден или он был открыт вами')
          .then(msg =>
            setTimeout(
              () => ctx.deleteMessage(msg.message_id).catch(() => null),
              3000
            )
          )
          .catch(() => null);
        return;
      }

      ctx.scene.enter('see-ticket', {
        role: 'manager',
        ticket: new Types.ObjectId(ticketId),
        skip: 0,
        menu: ctx.scene.state.menu
      });
    } catch (error) {
      console.log(error);
    }
  }
);

managerTickets.action('reenter', ctx =>
  ctx.scene.enter('manager-tickets', {
    menu: ctx.scene.state.menu
  })
);
managerTickets.action('list', ctx => ctx.scene.enter('free-tickets'));
managerTickets.action('my-tickets', ctx =>
  ctx.scene.enter('free-tickets', {
    findByManager: true
  })
);

managerTickets.action('exit', ctx => {
  ctx.deleteMessage().catch(() => null);
  ctx
    .reply('Меню...')
    .then(msg =>
      ctx.scene.enter('manager_menu', {
        menu: msg.message_id
      })
    )
    .catch(() => ctx.scene.leave());
});

managerTickets.leaveHandler = ctx => {
  ctx.scene.state.search = undefined;
};

module.exports = managerTickets;
