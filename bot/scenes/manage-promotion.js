const { Scenes, Markup } = require('telegraf');
const users = require('../../models/users');
const promotions = require('../../models/promotions');
const escapeHTML = require('escape-html');
const payments = require('../../models/payments');
const moment = require('moment');

const managePromotion = new Scenes.BaseScene('manage-promotion');

managePromotion.enterHandler = async ctx => {
  try {
    const check = await users.exists({
      telegramID: ctx.from.id,
      role: 'admin'
    });
    if (!check) {
      throw new Error('No access');
    }

    const { menu, id } = ctx.scene.state;
    const promotion = await promotions.findById(id);
    if (!promotion) {
      ctx.answerCbQuery('Промокод не найден').catch(() => null);
      throw new Error('Promotion not found');
    }

    ctx.telegram
      .editMessageText(
        ctx.from.id,
        menu.message_id,
        undefined,
        `<u>Промокод <code>${escapeHTML(
          promotion.value
        )}</code></u>\n\n<b>Применений:</b> <i>${promotion.uses}/${
          promotion.durability
        }</i>\n<b>Сумма:</b> <i>${promotion.amount} руб</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('Удалить', 'delete')],
            [Markup.button.callback('Применения', 'usages')],
            [Markup.button.callback('Назад', 'exit')]
          ]).reply_markup
        }
      )
      .catch(() => null);
  } catch (error) {
    console.log(error);
    ctx.scene.enter(ctx.scene.state.previousScene, ctx.scene.state);
  }
};

managePromotion.action('exit', ctx =>
  ctx.scene.enter(ctx.scene.state.previousScene || 'admin', ctx.scene.state)
);

managePromotion.action('delete', async ctx => {
  try {
    await ctx.editMessageText('Вы уверены что хотите удалить промокод?', {
      parse_mode: 'HTML',
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('Да', 'accept-delete')],
        [Markup.button.callback('Нет', 'back')]
      ]).reply_markup
    });
  } catch (error) {
    console.log(error);
  }
});

managePromotion.action('accept-delete', async ctx => {
  try {
    await promotions.findByIdAndDelete(ctx.scene.state.id);
    ctx.answerCbQuery('Промокод удален').catch(() => null);
  } catch (error) {
    console.log(error);
  } finally {
    ctx.scene.enter(ctx.scene.state.previousScene, {
      ...ctx.scene.state,
      page: 0
    });
  }
});

managePromotion.action('usages', async ctx => {
  try {
    const promotion = await promotions.findById(ctx.scene.state.id, {
      value: 1
    });
    if (!promotion) {
      return;
    }

    const usages = await payments.find({
      promo: promotion.value
    });
    if (usages.length === 0) {
      ctx.answerCbQuery('Промокод не был использован').catch(() => null);
      return;
    }

    let data = '';
    for (const usage of usages) {
      data = data.concat(
        `${usage.user}: ${moment(usage.date).format(
          'DD:MM:YYYY [в] HH:mm:ss'
        )}\n`
      );
    }

    await ctx.replyWithDocument(
      {
        filename: `${promotion.value.replace(/[ ]/g, '_')}-usages.txt`,
        source: Buffer.from(data)
      },
      {
        caption: `Использования промокода <code>${escapeHTML(
          promotion.value
        )}</code>`,
        parse_mode: 'HTML'
      }
    );
  } catch (error) {
    console.log(error);
  }
});

managePromotion.action('back', ctx =>
  ctx.scene.enter('manage-promotion', ctx.scene.state)
);

module.exports = managePromotion;
