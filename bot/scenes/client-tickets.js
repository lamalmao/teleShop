const { Scenes, Markup } = require('telegraf');
const tickets = require('../../models/tickets');
const sendMenu = require('../menu');
const { Types } = require('mongoose');

const clientTickets = new Scenes.BaseScene('client-tickets');
clientTickets.enterHandler = async ctx => {
  try {
    const ticketsList = await tickets.find(
      {
        client: ctx.from.id
      },
      {
        title: 1,
        done: 1
      },
      {
        sort: {
          created: -1
        }
      }
    );

    if (ticketsList.length === 0) {
      ctx.answerCbQuery('У вас нет тикетов').catch(() => null);
      ctx.scene.leave();
      return;
    }

    const keyboard = [];
    for (const ticket of ticketsList) {
      keyboard.push([
        Markup.button.callback(
          `${ticket.done ? '✅' : '🕑'} - ${ticket.title}`,
          `ticket:${ticket._id.toString()}`
        )
      ]);
    }
    keyboard.push([Markup.button.callback('Назад', 'exit')]);

    await ctx.telegram.editMessageCaption(
      ctx.from.id,
      ctx.scene.state.menu || ctx.callbackQuery.message.message_id,
      undefined,
      '<b>Ваши тикеты</b>',
      {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard(keyboard).reply_markup
      }
    );
  } catch (error) {
    console.log(error);
    ctx.scene.leave();
  }
};

clientTickets.action(/ticket:([a-z0-9]+)$/, async ctx => {
  try {
    const raw = /:(?<ticketId>[a-z0-9]+)$/.exec(ctx.callbackQuery.data);
    if (!raw) {
      return;
    }

    const { ticketId } = raw.groups;
    const ticket = new Types.ObjectId(ticketId);

    ctx.scene.enter('see-ticket', {
      ticket,
      role: 'client',
      skip: 0,
      menu: ctx.callbackQuery.message.message_id
    });
  } catch (error) {
    console.log(error);
  }
});

clientTickets.action('exit', ctx => {
  sendMenu(ctx, ctx.callbackQuery.message).catch(() => null);
  ctx.scene.leave();
});

module.exports = clientTickets;
