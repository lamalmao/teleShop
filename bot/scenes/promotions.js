const { Scenes, Markup } = require('telegraf');
const users = require('../../models/users');
const promotions = require('../../models/promotions');

const promotionsScene = new Scenes.BaseScene('promotions');

promotionsScene.enterHandler = async ctx => {
  try {
    const check = await users.exists({
      telegramID: ctx.from.id,
      role: 'admin'
    });
    if (!check) {
      throw new Error('No access');
    }

    ctx.scene.state.menu = ctx.callbackQuery.message;
    await ctx.telegram.editMessageText(
      ctx.from.id,
      ctx.scene.state.menu.message_id,
      undefined,
      'Меню управления промокодами\n<i>Если надо найти промокод по его значению - введите его</i>',
      {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('Создать промокод', 'create-promo')],
          [Markup.button.callback('Список промокодов', 'promotions-list')],
          [Markup.button.callback('Назад', 'exit')]
        ]).reply_markup
      }
    );
  } catch (error) {
    console.log(error);
    ctx.scene.enter('admin', ctx.scene.state);
  }
};

promotionsScene.on(
  'message',
  (ctx, next) => {
    try {
      ctx.deleteMessage().catch(() => null);
      next();
    } catch (error) {
      console.log(error);
    }
  },
  async ctx => {
    try {
      const promotion = await promotions.findOne(
        {
          value: ctx.message.text.trim()
        },
        {
          _id: 1
        }
      );
      if (!promotion) {
        ctx
          .reply('Промокод не найден')
          .then(msg =>
            setTimeout(
              () => ctx.deleteMessage(msg.message_id).catch(() => null),
              2500
            )
          )
          .catch(() => null);
        return;
      }

      ctx.scene.enter('manage-promotion', {
        ...ctx.scene.state,
        id: promotion.id,
        previousScene: 'promotions'
      });
    } catch (error) {
      console.log(error);
    }
  }
);

promotionsScene.action('create-promo', ctx =>
  ctx.scene.enter('create-promo', ctx.scene.state)
);

promotionsScene.action('promotions-list', ctx =>
  ctx.scene.enter('promotions-list', {
    ...ctx.scene.state,
    page: 0
  })
);

promotionsScene.action('exit', ctx =>
  ctx.scene.enter('admin', ctx.scene.state)
);

module.exports = promotionsScene;
