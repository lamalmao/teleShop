const { Scenes, Markup } = require('telegraf');
const path = require('path');
const fs = require('fs');

const uaCardSettings = new Scenes.BaseScene('ua-card-settings');

uaCardSettings.enterHandler = async ctx => {
  try {
    await ctx.reply(
      `Курс: 1 грн = ${global.rubToUah} руб\nКарта: ${global.uaRefillCard}`,
      {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('Изменить курс', 'change:course')],
          [Markup.button.callback('Изменить карту', 'change:card')],
          [Markup.button.callback('Назад', 'exit')]
        ]).reply_markup
      }
    );
  } catch (error) {
    console.log(error);
    ctx.scene.leave();
  }
};

uaCardSettings.action(/change:(course|card)/, async ctx => {
  try {
    const raw = /(?<target>course|card)/.exec(ctx.callbackQuery.data);
    if (!raw) {
      return;
    }

    const { target } = raw.groups;
    ctx.scene.state.target = target;
    ctx.scene.state.menu = ctx.callbackQuery.message.message_id;

    await ctx.editMessageText('Введите новое значение', {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('Отмена', 'exit')]
      ]).reply_markup
    });
  } catch (error) {
    console.log(error);
  }
});

uaCardSettings.on('message', async ctx => {
  try {
    ctx.deleteMessage().catch(() => null);
    const { target, menu } = ctx.scene.state;

    if (!target || !['course', 'card'].includes(target) || !ctx.message.text) {
      return;
    }

    let finished = false;
    const value = ctx.message.text.trim();
    if (target === 'course') {
      const course = Number(value);
      if (Number.isNaN(course) || course <= 0) {
        ctx
          .reply('Курс должен быть числом больше 0')
          .then(msg =>
            setTimeout(
              () => ctx.deleteMessage(msg.message_id).catch(() => null),
              2500
            )
          )
          .catch(() => null);
        return;
      }

      fs.writeFileSync(path.resolve('rub-to-uah.txt'), course.toString());
      global.rubToUah = course;
      finished = true;
    } else {
      fs.writeFileSync(path.resolve('ua-card.txt'), value);
      global.uaRefillCard = value;
      finished = true;
    }

    if (finished) {
      ctx.deleteMessage(menu).catch(() => null);
      ctx.scene.enter('ua-card-settings');
    }
  } catch (error) {
    console.log(error);
  }
});

uaCardSettings.action('exit', ctx => {
  ctx.deleteMessage().catch(() => null);
  ctx.scene.leave();
});

module.exports = uaCardSettings;
