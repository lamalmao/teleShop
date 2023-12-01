const escapeHTML = require("escape-html");
const { Scenes, Markup } = require("telegraf");
const cardsCategories = require("../../models/cards-categories");

const createCardCategory = new Scenes.WizardScene(
  "create-card-category",
  async (ctx) => {
    try {
      ctx.wizard.state.category = {};

      await ctx.editMessageText("Введите название категории", {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback("Назад", "exit")],
        ]).reply_markup,
      });

      ctx.wizard.next();
    } catch (error) {
      ctx.answerCbQuery("Что-то пошло не так").catch(() => null);
    }
  },
  async (ctx) => {
    try {
      if (ctx.updateType !== "message" || !ctx.message?.text) {
        return;
      }

      ctx.deleteMessage().catch(() => null);

      const title = ctx.message.text;
      ctx.wizard.state.category.title = title;

      await ctx.telegram.editMessageText(
        ctx.from.id,
        ctx.scene.state.menu.message_id,
        undefined,
        `Создать категорию с названием "<b>${escapeHTML(title)}</b>"?`,
        {
          parse_mode: "HTML",
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback("Да", "yes")],
            [Markup.button.callback("Отмена", "exit")],
          ]).reply_markup,
        }
      );

      ctx.wizard.next();
    } catch (error) {
      console.log(error);
      ctx.reply("Что-то пошло не так").catch(() => null);
    }
  },
  async (ctx) => {
    try {
      if (ctx.callbackQuery?.data !== "yes") {
        return;
      }

      const category = await cardsCategories.create({
        title: ctx.wizard.state.category.title,
      });

      ctx.scene.state.id = category._id;

      ctx.scene.enter("manage-card-category", ctx.scene.state);
    } catch (error) {
      console.log(error);
      ctx.answerCbQuery("Что-то пошло не так").catch(() => null);
    }
  }
);

createCardCategory.action("exit", (ctx) =>
  ctx.scene.enter("card-categories", ctx.scene.state)
);

module.exports = createCardCategory;
