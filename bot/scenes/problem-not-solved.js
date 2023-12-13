const { Scenes, Markup } = require('telegraf');
const path = require('path');
const keys = require('../keyboard');

const problemNotSolved = new Scenes.BaseScene('problem-not-solved');

problemNotSolved.enterHandler = async ctx => {
  try {
    ctx.deleteMessage().catch(() => null);

    await ctx.replyWithPhoto(
      {
        source: path.resolve('files', 'images', 'blank_support.jpg')
      },
      {
        caption:
          'Сожалеем, что не получилось решить ваш вопрос. \nПредлагаем вам создать еще один тикет, где просим более детально описать вашу проблему и приложить скриншот для лучшего понимания вашей ситуации',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('Создать тикет', 'create-ticket')],
          [Markup.button.callback('Главное меню', keys.BackMenu.buttons)]
        ]).reply_markup
      }
    );
  } catch (error) {
    console.log(error);
  } finally {
    ctx.scene.leave();
  }
};

module.exports = problemNotSolved;
