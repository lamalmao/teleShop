const { Scenes, Markup } = require('telegraf');
const tickets = require('../../models/tickets');
const { Types } = require('mongoose');
const ticketMessage = require('../../models/ticket-messages');

const freeTickets = new Scenes.BaseScene('free-tickets');

freeTickets.enterHandler = async ctx => {
  try {
    const availableTickets = await tickets.find(
      {
        done: false,
        manager: ctx.scene.state.findByManager
          ? ctx.from.id
          : {
              $exists: false
            }
      },
      {
        theme: 1
      }
    );

    const keyboard = [];
    const now = Date.now();
    for (const ticket of availableTickets.slice(0, 50)) {
      const date = await ticketMessage.findOne(
        {
          ticket: ticket._id
        },
        {
          creationDate: 1
        },
        {
          sort: {
            creationDate: 1
          }
        }
      );

      const minutes = Math.ceil((now - date.creationDate.getTime()) / 60000);
      const hours = Math.floor(minutes / 60);

      keyboard.push([
        Markup.button.callback(
          `${ticket.theme} - ${
            hours > 0 ? '~' + hours + 'ч' : minutes + 'м'
          } без ответа`,
          `get:${ticket._id.toString()}`
        )
      ]);
    }

    keyboard.push(
      [
        Markup.button.callback(
          'Обновить',
          'refresh',
          !!ctx.scene.state.findByManager
        )
      ],
      [Markup.button.callback('Назад', 'exit')]
    );

    ctx.telegram
      .editMessageCaption(
        ctx.from.id,
        ctx.scene.state.menu || ctx.callbackQuery.message.message_id,
        undefined,
        `<b>Доступные тикеты</b>`,
        {
          parse_mode: 'HTML',
          reply_markup: Markup.inlineKeyboard(keyboard).reply_markup
        }
      )
      .catch(() => null);
  } catch (error) {
    console.log(error);
    ctx.scene.leave();
  }
};

freeTickets.action(/get:([a-z0-9]+)$/, async ctx => {
  try {
    const raw = /:(?<ticketId>[a-z0-9]+)$/.exec(ctx.callbackQuery.data);
    if (!raw) {
      return;
    }

    const { ticketId } = raw.groups;
    const ticket = new Types.ObjectId(ticketId);

    const update = await tickets.updateOne(
      {
        _id: ticket,
        client: {
          $ne: ctx.from.id
        },
        manager: ctx.scene.state.findByManager
          ? ctx.from.id
          : {
              $exists: false
            }
      },
      {
        $set: {
          manager: ctx.from.id
        }
      }
    );

    if (update.modifiedCount === 0 && !ctx.scene.state.findByManager) {
      ctx
        .answerCbQuery(
          'Тикет уже взят или вы пытаетесь взять тикет, созданный вами'
        )
        .catch(() => null);
      ctx.scene.enter('free-tickets');
      return;
    }
    ctx.answerCbQuery().catch(() => null);

    ctx.scene.enter('see-ticket', {
      menu: ctx.callbackQuery.message.message_id,
      role: 'manager',
      skip: 0,
      ticket
    });
  } catch (error) {
    console.log(error);
  }
});

freeTickets.action('refresh', ctx => ctx.scene.enter('free-tickets'));
freeTickets.action('exit', ctx => ctx.scene.enter('manager-tickets'));

module.exports = freeTickets;
