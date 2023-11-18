const { Scenes, Markup } = require("telegraf");
const path = require("path");

const categories = require("../../models/categories");
const keys = require("../keyboard");

const blank = path.join(process.cwd(), "files", "images", "blank_shop.jpg");

const shop = new Scenes.BaseScene("shop");

shop.enterHandler = async function (ctx) {
  try {
    const sections = await categories.find(
      {
        type: "main",
        hidden: false,
      },
      "_id title"
    );

    let keyboard = [],
      line = [],
      first = true,
      length = sections.length;
    for (let i = 0; i < length; i++) {
      line.push(
        Markup.button.callback(
          sections[i].title,
          `main_section#${sections[i]._id}`
        )
      );

      if (!first || i + 1 === length) {
        keyboard.push(line);
        line = [];
      }

      first = !first;
    }
    keyboard.push([Markup.button.callback("Назад", keys.BackMenu.buttons)]);

    await ctx.telegram.editMessageMedia(
      ctx.from.id,
      ctx.callbackQuery.message.message_id,
      undefined,
      {
        type: "photo",
        media: {
          source: blank,
        },
      },
      {
        caption: "Выберите категорию",
        reply_markup: Markup.inlineKeyboard(keyboard).reply_markup,
      }
    );

    ctx.scene.leave();
  } catch (e) {
    null;
    ctx.scene.enter("start", {
      menu: ctx.scene.state.menu,
    });
  }
};

module.exports = shop;
