const { Scenes, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');

const changeOzanCardCost = new Scenes.BaseScene('change-ozan-card-cost');
changeOzanCardCost.enterHandler = async ctx => {
  try {
    ctx.scene.state.menu = ctx.callbackQuery.message.message_id;
    await ctx.editMessageText('Укажите новую сумму в лирах', {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('Отмена', 'exit')]
      ]).reply_markup
    });
  } catch (error) {
    console.log(error);
    ctx.scene.leave();
  }
};

changeOzanCardCost.on(
  'message',
  (ctx, next) => {
    ctx.deleteMessage().catch(() => null);
    next();
  },
  async ctx => {
    try {
      const amount = Number(ctx.message.text.trim());
      if (Number.isNaN(amount) || amount <= 0) {
        ctx
          .reply('Значение должно быть положительным числом')
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
      ctx.telegram
        .editMessageText(
          ctx.from.id,
          ctx.scene.state.menu,
          undefined,
          `Новое значение ${amount}\n<i>Если хотите изменить - укажите новое</i>`,
          {
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard([
              [Markup.button.callback('Сохранить', 'save')],
              [Markup.button.callback('Отмена', 'exit')]
            ]).reply_markup
          }
        )
        .catch(() => null);
    } catch (error) {
      console.log(error);
    }
  }
);

changeOzanCardCost.action('save', async ctx => {
  try {
    global.ozanCardCost = ctx.scene.state.amount;
    fs.writeFileSync(
      path.resolve('ozan-card-cost.txt'),
      global.ozanCardCost.toString()
    );

    ctx.answerCbQuery('Сохранено').catch(() => null);
  } catch (error) {
    console.log(error);
  } finally {
    ctx.deleteMessage().catch(() => null);
    ctx.scene.leave();
  }
});

changeOzanCardCost.action('exit', ctx => {
  ctx.deleteMessage().catch(() => null);
  ctx.scene.leave();
});

module.exports = changeOzanCardCost;
