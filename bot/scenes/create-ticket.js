const { Scenes, Markup } = require('telegraf');
const sendMenu = require('../menu');
const orders = require('../../models/orders');
const tickets = require('../../models/tickets');
const escapeHTML = require('escape-html');
const ticketMessage = require('../../models/ticket-messages');

const createTicket = new Scenes.BaseScene('create-ticket');

createTicket.enterHandler = async ctx => {
  try {
    const keyboard = [
      [Markup.button.callback('Когда сделают мой заказ?', 'order-waiting')]
    ];
    for (const theme of Object.keys(global.ticketThemes)) {
      keyboard.push([Markup.button.callback(theme, `theme:${theme}`)]);
    }
    keyboard.push([Markup.button.callback('Назад', 'exit')]);

    await ctx.editMessageCaption(`<b>Выберите тему вашего вопроса</b>`, {
      parse_mode: 'HTML',
      reply_markup: Markup.inlineKeyboard(keyboard).reply_markup
    });
  } catch (error) {
    console.log(error);
    ctx.scene.leave();
  }
};

createTicket.action('order-waiting', async ctx => {
  try {
    const userOrders = await orders.find(
      {
        client: ctx.from.id,
        paid: true,
        status: {
          $in: ['processing', 'untaken']
        }
      },
      {
        orderID: 1
      }
    );

    let ordersMessage = 'заказов нет';
    if (userOrders.length > 0) {
      const list = [];
      for (const { orderID } of userOrders) {
        list.push(`<code>${orderID}</code>`);
      }

      ordersMessage = list.join(', ');
    } else {
      await ctx.editMessageCaption('У вас нет активных заказов');
      return;
    }

    await ctx.editMessageCaption(
      `Ваши заказы: ${ordersMessage}\n\n${global.helpMessage}`,
      {
        parse_mode: 'HTML'
      }
    );
  } catch (error) {
    console.log(error);
  } finally {
    ctx.scene.leave();
    sendMenu(ctx).catch(() => null);
  }
});

createTicket.action(
  /theme:.+$/,
  async (ctx, next) => {
    try {
      const check = await tickets.exists({
        client: ctx.from.id,
        done: false
      });

      if (check) {
        await ctx.editMessageCaption('У вас уже открыт тикет');
        await sendMenu(ctx);
        ctx.scene.leave();
        return;
      }

      next();
    } catch (error) {
      console.log(error);
    }
  },
  async ctx => {
    try {
      const raw = /:(?<theme>.+)$/.exec(ctx.callbackQuery.data);
      if (!raw) {
        throw new Error('No theme found');
      }

      const { theme } = raw.groups;

      const message = '<b>Напишите заголовок тикета</b>\n<i>До 50 символов</i>';
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('Отмена', 'exit')]
      ]);

      ctx.scene.state = {
        menu: ctx.callbackQuery.message.message_id,
        previous: new Map([
          [
            'title',
            {
              target: 'title',
              message,
              keyboard
            }
          ]
        ]),
        target: 'title',
        ticket: {
          theme
        }
      };

      await ctx.editMessageCaption(message, {
        parse_mode: 'HTML',
        reply_markup: keyboard.reply_markup
      });
    } catch (error) {
      console.log(error);
    }
  }
);

createTicket.on(
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
      if (ctx.scene.state.target !== 'title') {
        next();
        return;
      }

      const title = ctx.message.text;
      if (title.length > 50) {
        ctx
          .reply('Длина заголовка не может быть более 50 символов')
          .then(msg =>
            setTimeout(
              () => ctx.deleteMessage(msg.message_id).catch(() => null),
              2000
            )
          )
          .catch(() => null);

        return;
      }

      ctx.scene.state.ticket.title = title;
      ctx.scene.state.previousTarget = 'title';

      ctx.telegram
        .editMessageCaption(
          ctx.from.id,
          ctx.scene.state.menu,
          undefined,
          `Заголовок: <b>${escapeHTML(
            title
          )}</b>\n\nЕсли вы хотите его изменить, просто введите новый`,
          {
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard([
              [Markup.button.callback('Далее', 'next')],
              [Markup.button.callback('Назад', 'back')]
            ]).reply_markup
          }
        )
        .catch(() => null);
    } catch (error) {
      console.log(error);
    }
  },
  async (ctx, next) => {
    try {
      if (ctx.scene.state.target !== 'message') {
        next();
        return;
      }

      const ticketMessage = ctx.message.text;
      if (ticketMessage.length > 700) {
        ctx
          .reply('Длина сообщения не может быть более 700 символов')
          .then(msg =>
            setTimeout(
              () => ctx.deleteMessage(msg.message_id).catch(() => null),
              2000
            )
          )
          .catch(() => null);

        return;
      }

      ctx.scene.state.ticket.message = ticketMessage;

      ctx.telegram
        .editMessageCaption(
          ctx.from.id,
          ctx.scene.state.menu,
          undefined,
          `<i>${escapeHTML(
            ticketMessage
          )}</i>\n\n<b>Все верно? Если вы хотите изменить сообщение, просто введите новое</b>`,
          {
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard([
              [Markup.button.callback('Далее', 'next')],
              [Markup.button.callback('Назад', 'back')]
            ]).reply_markup
          }
        )
        .catch(() => null);
    } catch (error) {
      console.log(error);
    }
  }
);

createTicket.on(
  'photo',
  (ctx, next) => {
    ctx.deleteMessage().catch(() => null);
    if (!ctx.scene.state.target === 'image') {
      return;
    }

    next();
  },
  async ctx => {
    try {
      const image = ctx.message.photo[ctx.message.photo.length - 1].file_id;
      if (image === ctx.scene.state.ticket.image) {
        return;
      }

      ctx.scene.state.ticket.image = image;

      ctx.telegram
        .editMessageMedia(
          ctx.from.id,
          ctx.scene.state.menu,
          undefined,
          {
            type: 'photo',
            media: image,
            caption:
              '<b>Изображение сохранено, если хотите его изменить - просто отправьте другое</b>',
            parse_mode: 'HTML'
          },
          {
            reply_markup: Markup.inlineKeyboard([
              [Markup.button.callback('Далее', 'next')],
              [Markup.button.callback('Назад', 'back')]
            ]).reply_markup
          }
        )
        .catch(e => console.log(e));
    } catch (error) {
      console.log(error);
    }
  }
);

createTicket.action(
  'next',
  async (ctx, next) => {
    try {
      if (!ctx.scene.state.target) {
        return;
      }

      let message,
        keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('Назад', 'back')]
        ]),
        target;
      switch (ctx.scene.state.target) {
        case 'title':
          target = 'message';
          message = '<b>Опишите вашу проблему</b>\n<i>До 700 символов</i>';
          break;
        case 'message':
          target = 'image';
          message =
            'Если считаете нужным для решения вашего вопроса наличие скриншота. Отправьте его в этот чат и я передам его менеджеру.\n\n<i>Иначе просто нажмите далее</i>';
          keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('Далее', 'next')],
            [Markup.button.callback('Назад', 'back')]
          ]);
          break;
        case 'image':
          next();
          return;
        default:
          ctx.scene.leave();
          return;
      }

      ctx.scene.state.previous.set(target, {
        target: ctx.scene.state.target,
        keyboard
      });

      ctx.scene.state.previousTarget = ctx.scene.state.target;
      ctx.scene.state.target = target;

      await ctx.editMessageCaption(message, {
        parse_mode: 'HTML',
        reply_markup: keyboard.reply_markup
      });
    } catch (error) {
      console.log(error);
    }
  },
  async ctx => {
    try {
      const { theme, title, message, image } = ctx.scene.state.ticket;

      const ticket = await tickets.create({
        client: ctx.from.id,
        theme,
        title
      });

      await ticketMessage.create({
        ticket: ticket._id,
        question: {
          text: message,
          image
        }
      });

      ctx.scene.enter('see-ticket', {
        menu: ctx.callbackQuery.message.message_id,
        ticket: ticket._id,
        role: 'client'
      });
    } catch (error) {
      console.log(error);
    }
  }
);

createTicket.action('back', async ctx => {
  try {
    const data = ctx.scene.state.previous.get(ctx.scene.state.previousTarget);

    ctx.scene.state.target = data.target;
    ctx.scene.state.previousTarget = ctx.scene.state.previous.get(
      data.target
    ).target;

    ctx
      .editMessageCaption(data.message, {
        parse_mode: 'HTML',
        reply_markup: data.keyboard.reply_markup
      })
      .catch(() => null);
  } catch (error) {
    console.log(error);
  }
});

createTicket.action('exit', async ctx => {
  try {
    await sendMenu(ctx, ctx.callbackQuery.message);
  } catch (error) {
    console.log(error);
  } finally {
    ctx.scene.leave();
  }
});

module.exports = createTicket;
