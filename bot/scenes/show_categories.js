const { Scenes, Markup } = require('telegraf');

const keys = require('../keyboard');
const categories = require('../../models/categories');
const categoryMessage = require('../category_message');

const showCategories = new Scenes.BaseScene('showCategories');

showCategories.enterHandler = async function(ctx) {
  try {
    const categoriesList = await categories.find();
    const message = ctx.scene.state.menu.message_id;
    ctx.scene.state.cb = ctx.callbackQuery.id;

    console.log(message);

    if (categoriesList.length > 0) {
      const cb = Markup.button.callback;
      let categoriesKeyboardList = [];
      ctx.scene.state.categories = categoriesList;

      for (let category of categoriesList)
        categoriesKeyboardList.push([ cb(`${category.title} - ${category.type === 'main' ? 'основная' : 'вложенная' }`, category._id) ]);
      categoriesKeyboardList.push([ cb('Назад', keys.BackMenu.buttons) ]);

      const keyboard = Markup.inlineKeyboard(categoriesKeyboardList);

      await ctx.telegram.editMessageText(ctx.from.id, message, undefined, 'Список категорий:');
      await ctx.telegram.editMessageReplyMarkup(ctx.from.id, message, undefined, keyboard.reply_markup);
    } else {
      await ctx.telegram.editMessageText(ctx.from.id, message, undefined, 'Категорий пока нет');
      await ctx.telegram.editMessageReplyMarkup(ctx.from.id, message, undefined, keys.BackMenu.keyboard.reply_markup);
    }
  } catch (e) {
    console.log(e);
    ctx.scene.enter('categories', { menu: ctx.scene.state });
  }
};

showCategories.on('callback_query', 
  async (ctx, next) => {
    if (ctx.callbackQuery.data === keys.BackMenu.buttons) ctx.scene.enter('categories', { menu: ctx.scene.state.menu });
    else next();
  },
  async ctx => {
    try {
      const chosen = ctx.scene.state.categories.find(c => c._id == ctx.callbackQuery.data);
      const { message, keyboard } = await genCategoryData(chosen);

      ctx.deleteMessage(ctx.scene.state.menu.message_id).catch(_ => null);

      ctx.scene.enter('editCategory', { category: chosen, message, keyboard });
    } catch (e) {
      console.log(e);
      ctx.scene.enter('categories', { menu: ctx.scene.state.menu });
    }
  }
);

async function genCategoryData(category) {
  const cb = Markup.button.callback;

  let keyboard = [],
    message = await categoryMessage(category);
  if (category.type === 'main') keyboard.push([ cb('Изменить обложку', 'editBackground') ]);
  else keyboard.push([ cb('Переместить', 'relocate') ]);

  keyboard.push([ cb('Переименовать', 'rename'), cb('Изменить описание', 'editDescription') ]);
  keyboard.push([ cb('Перерисовать обложку', 'rerender') ]);
  keyboard.push([ cb('Удалить', 'delete'), cb('Переключить видимость', 'hide') ]);
  keyboard.push([ cb('Назад', keys.BackMenu.buttons) ]);

  return {
    message: message,
    keyboard: Markup.inlineKeyboard(keyboard)
  };
}

module.exports = showCategories;