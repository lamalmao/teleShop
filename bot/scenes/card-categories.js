const { Types } = require("mongoose");
const { Scenes, Markup } = require("telegraf");
const cardsCategoriesModel = require("../../models/cards-categories");

const cardsCategories = new Scenes.BaseScene("card-categories");

cardsCategories.enterHandler = async (ctx) => {
  try {
    const keyboard = [
      [Markup.button.callback("➕ Создать категорию", "create-category")],
      [Markup.button.callback("◎ Карты без категории", "no-category")],
    ];

    const categories = await cardsCategoriesModel.find();
    for (const category of categories) {
      keyboard.push([
        Markup.button.callback(category.title, `card-category:${category._id}`),
      ]);
    }

    keyboard.push([Markup.button.callback("🔙 Назад", "back")]);

    ctx.telegram
      .editMessageText(
        ctx.from.id,
        ctx.scene.state.menu.message_id,
        undefined,
        "Категории карт",
        {
          reply_markup: Markup.inlineKeyboard(keyboard).reply_markup,
        }
      )
      .catch(() => null);
  } catch (error) {
    console.log(error);
    ctx.reply("Что-то пошло не так").catch(() => null);
    ctx.scene.enter("admin", ctx.scene.state);
  }
};

cardsCategories.action("no-category", (ctx) => {
  ctx.scene.state.id = undefined;
  ctx.scene.enter("cards-list", ctx.scene.state);
});

cardsCategories.action("create-category", (ctx) =>
  ctx.scene.enter("create-card-category", ctx.scene.state)
);

cardsCategories.action("back", (ctx) =>
  ctx.scene.enter("admin", ctx.scene.state)
);

cardsCategories.action(/^card-category:[a-z0-9]+$/i, (ctx) => {
  try {
    const raw = /:([a-z0-9]+)$/i.exec(ctx.callbackQuery.data);
    if (!raw) {
      throw new Error("Не найден ID");
    }

    const id = new Types.ObjectId(raw[1]);
    ctx.scene.enter("manage-card-category", {
      ...ctx.scene.state,
      id,
    });
  } catch (error) {
    ctx.answerCbQuery(error.message).catch(() => null);
  }
});

module.exports = cardsCategories;
