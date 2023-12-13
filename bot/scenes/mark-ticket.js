const { Scenes, Markup } = require('telegraf');
const tickets = require('../../models/tickets');

const markTicket = new Scenes.BaseScene('mark-ticket');

markTicket.enterHandler = async ctx => {
  try {
    const { ticket } = ctx.scene.state;
    if (!ticket) {
      throw new Error('No ticket id');
    }

    await ctx.editMessageText(
      `<b>Спасибо за ваше обращение. Мы рады, что нам удалось вам помочь.</b>\n<i>Оцените работу нашего сотрудника от 1 до 5</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('1', 'mark:1')],
          [Markup.button.callback('2', 'mark:2')],
          [Markup.button.callback('3', 'mark:3')],
          [Markup.button.callback('4', 'mark:4')],
          [Markup.button.callback('5', 'mark:5')]
        ]).reply_markup
      }
    );
  } catch (error) {
    ctx.deleteMessage().catch(() => null);
    console.log(error);
    ctx.scene.leave();
  }
};

markTicket.action(/mark:\d/, async ctx => {
  try {
    const raw = /:(?<mark>\d)$/.exec(ctx.callbackQuery.data);
    if (!raw) {
      throw new Error('No mark specified');
    }

    const mark = Number(raw.groups.mark);

    const result = await tickets.updateOne(
      {
        _id: ctx.scene.state.ticket,
        mark: 0
      },
      {
        $set: {
          mark
        }
      }
    );

    if (result.modifiedCount === 1) {
      await ctx.editMessageText(
        'Спасибо за вашу оценку.\nОна поможет контролировать качество работы нашей поддержки'
      );
    } else {
      await ctx.editMessageText('Оценка уже была выставлена');
    }
  } catch (error) {
    console.log(error);
  } finally {
    ctx.scene.leave();
  }
});

module.exports = markTicket;
