const { Scenes, Markup } = require('telegraf');
const promotions = require('../../models/promotions');
const escapeHTML = require('escape-html');

const activatePromo = new Scenes.BaseScene('activate-promo');

activatePromo.enterHandler = async ctx => {
  try {
    await ctx.editMessageCaption('Введите промокод', {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('Отмена', 'exit')]
      ]).reply_markup
    });
  } catch (error) {
    console.log(error);
    ctx.scene.enter('profile', ctx.scenes.state);
  }
};

activatePromo.on('message', async ctx => {
  try {
    const value = ctx.message.text.trim();
    const promotion = await promotions.findOne({
      value
    });
    if (!promotion) {
      ctx
        .reply('Промокода не существует')
        .then(msg =>
          setTimeout(() =>
            setTimeout(
              () => ctx.deleteMessage(msg.message_id).catch(() => null),
              2500
            )
          )
        )
        .catch(() => null);
      return;
    }

    const result = await promotion.usePromo(ctx.from.id);
    if (typeof result === 'number') {
      await ctx.reply(
        `Промокод "${escapeHTML(
          promotion.value
        )}" активирован. Ваш баланс пополнен на ${promotion.amount} руб`
      );

      ctx.scene.enter('profile', ctx.scene.state);
    } else {
      ctx
        .reply(`Ошибка: ${result}`)
        .then(msg =>
          setTimeout(() =>
            setTimeout(
              () => ctx.deleteMessage(msg.message_id).catch(() => null),
              2500
            )
          )
        )
        .catch(() => null);
      return;
    }
  } catch (error) {
    console.log(error);
  }
});

activatePromo.action('exit', ctx =>
  ctx.scene.enter('profile', ctx.scene.state)
);

module.exports = activatePromo;
