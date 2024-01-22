const { Scenes, Markup } = require('telegraf');
const users = require('../../models/users');
const promotions = require('../../models/promotions');
const { Types } = require('mongoose');

const promotionsList = new Scenes.BaseScene('promotions-list');
const pageSize = 40;

promotionsList.enterHandler = async ctx => {
  try {
    const check = await users.exists({
      telegramID: ctx.from.id,
      role: 'admin'
    });
    if (!check) {
      throw new Error('No access');
    }

    const { page, menu } = ctx.scene.state;
    const skip = page * pageSize;

    const count = await promotions.count({});
    const pages = Math.ceil(count / pageSize);

    const promos = await promotions.find(
      {},
      {
        value: 1,
        amount: 1,
        uses: 1,
        durability: 1
      },
      {
        sort: {
          date: 1
        },
        skip,
        limit: pageSize
      }
    );

    const keys = [
      [Markup.button.callback('Назад', 'exit')],
      [
        Markup.button.callback('<', 'page:back', !(page > 0)),
        Markup.button.callback('>', 'page:forward', !(page < pages - 1))
      ]
    ];
    for (const promo of promos) {
      keys.push([
        Markup.button.callback(
          `${promo.value} (${promo.uses}/${promo.durability}) - ${promo.amount}`,
          `peek:${promo._id}р`
        )
      ]);
    }

    ctx.telegram
      .editMessageText(
        ctx.from.id,
        menu.message_id,
        undefined,
        'Список промокодов',
        {
          parse_mode: 'HTML',
          reply_markup: Markup.inlineKeyboard(keys).reply_markup
        }
      )
      .catch(e => console.log(e.message));
  } catch (error) {
    console.log(error);
    ctx.scene.leave();
  }
};

promotionsList.action(/page:(back|forward)/, async ctx => {
  try {
    const { direction } = /(?<direction>back|forward)/.exec(
      ctx.callbackQuery.data
    ).groups;
    const move = direction === 'forward' ? 1 : -1;

    ctx.scene.enter('promotions-list', {
      ...ctx.scene.state,
      page: ctx.scene.state.page + move
    });
  } catch (error) {
    console.log(error);
  }
});

promotionsList.action('exit', ctx =>
  ctx.scene.enter('promotions', ctx.scene.state)
);

promotionsList.action(/peek:[a-z0-9]+/, async ctx => {
  try {
    const id = new Types.ObjectId(
      /:(?<id>[a-z0-9]+)/.exec(ctx.callbackQuery.data).groups.id
    );

    ctx.scene.enter('manage-promotion', {
      ...ctx.scene.state,
      previousScene: 'promotions-list',
      id
    });
  } catch (error) {
    console.log(error);
  }
});

module.exports = promotionsList;
