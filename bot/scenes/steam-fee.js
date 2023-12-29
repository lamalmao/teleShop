const { Scenes, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');

const steamFee = new Scenes.BaseScene('steam-fee');

steamFee.enterHandler = async ctx => {
  try {
    const shopFee = fs.readFileSync(path.resolve('steam.txt')).toString();
    const menu = await ctx.reply(
      `Комиссия магазина: ${shopFee}%\nИтоговый коэффициент: ${global.steamFee}\n\n<i>Чтобы изменить комиссию - введите новую в %</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('Назад', 'exit')]
        ]).reply_markup
      }
    );
    ctx.scene.state.menu = menu.message_id;
  } catch (error) {
    console.log(error);
    ctx.scene.leave();
  }
};

steamFee.on('message', async ctx => {
  try {
    ctx.deleteMessage().catch(() => null);

    const fee = Number(ctx.message.text);
    if (fee > 100 || fee < 1) {
      ctx
        .reply('Размер комиссии должен быть в промежутке от 1 до 100')
        .then(msg =>
          setTimeout(
            () => ctx.deleteMessage(msg.message_id).catch(() => null),
            2500
          )
        )
        .catch(() => null);
      return;
    }

    ctx.scene.state.fee = fee;
    ctx.telegram
      .editMessageText(
        ctx.from.id,
        ctx.scene.state.menu,
        undefined,
        `Сохранить комиссию в ${fee}%?\nИтоговый коэффициент будет составлять ${(
          1.1 +
          fee / 100
        ).toFixed(
          2
        )}\n\n<i>Можно указать другую комиссию - отправив сообщение с ней</i>`,
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
});

steamFee.action('save', async ctx => {
  try {
    const { fee } = ctx.scene.state;

    global.steamFee = Number((1.1 + fee / 100).toFixed(2));
    fs.writeFileSync(path.resolve('steam.txt'), fee.toString());

    ctx.answerCbQuery('Сохранено').catch(() => null);
    ctx.deleteMessage().catch(() => null);
  } catch (error) {
    console.log(error);
  } finally {
    ctx.scene.leave();
  }
});

steamFee.action('exit', ctx => {
  ctx.deleteMessage().catch(() => null);
  ctx.scene.leave();
});

module.exports = steamFee;
