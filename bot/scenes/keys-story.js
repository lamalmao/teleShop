const { Scenes, Markup } = require('telegraf');
const keyActions = require('../../models/key-actions');
const escapeHTML = require('escape-html');
const users = require('../../models/users');
const moment = require('moment');

const keysStory = new Scenes.BaseScene('keys-story');

keysStory.enterHandler = async ctx => {
  try {
    await ctx.editMessageText(
      '<b>Чтобы посмотреть действия, совершенные с ключом - введите его</b>',
      {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('Назад', 'exit')]
        ]).reply_markup
      }
    );
  } catch (error) {
    console.log(error);
    ctx.scene.enter('admin', ctx.scene.state);
  }
};

keysStory.on('message', async ctx => {
  try {
    ctx.deleteMessage().catch(() => null);
    const value = ctx.message.text;
    if (!value) {
      return;
    }

    const actions = await keyActions.find({
      key: value.trim()
    });

    if (actions.length === 0) {
      ctx
        .reply('Ничего не найдено')
        .then(msg =>
          setTimeout(
            () => ctx.deleteMessage(msg.message_id).catch(() => null),
            2500
          )
        )
        .catch(() => null);
      return;
    }

    let text = `<b>История действий для ключа <code>${escapeHTML(
      value.trim()
    )}</code></b>\n<i>Для истории другого ключа - введите его</i>\n`;
    for (const action of actions) {
      const manager = await users.findOne(
        {
          telegramID: action.manager
        },
        {
          username: 1
        }
      );

      let type = 'неизвестно';
      switch (action.action) {
        case 'returned':
          type = 'вернул';
          break;
        case 'taken':
          type = 'взял';
          break;
        case 'used':
          type = 'использовал';
          break;
      }

      text = text.concat(
        `\n<i>Менеджер:</i> <a href="tg://user?id=${action.manager}">${
          escapeHTML(manager.username) || 'неизвестно'
        }</a>\n<i>Заказ:</i> <code>${
          action.order
        }</code>\n<i>Действие: ${type}</i>\n<i>Дата: ${moment(action.date)
          .locale('ru')
          .format('DD.MM.YYYY [в] HH:mm:ss')}</i>\n`
      );
    }

    ctx.telegram
      .editMessageText(
        ctx.from.id,
        ctx.scene.state.menu.message_id,
        undefined,
        text,
        {
          parse_mode: 'HTML',
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('Назад', 'exit')]
          ]).reply_markup
        }
      )
      .catch(() => null);
  } catch (error) {
    console.log(error);
  }
});

keysStory.action('exit', ctx => ctx.scene.enter('admin', ctx.scene.state));

module.exports = keysStory;
