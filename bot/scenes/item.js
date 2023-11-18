const { Scenes, Markup } = require("telegraf");
const path = require("path");

const goods = require("../../models/goods");
const messages = require("../messages");

const images = path.join(process.cwd(), "files", "images");

const item = new Scenes.BaseScene("item");

item.enterHandler = async function (ctx) {
  try {
    const itemID = /\w+$/.exec(ctx.callbackQuery.data)[0];
    const targetItem = await goods.findById(itemID);

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("Купить", `buy#${itemID}`)],
      [Markup.button.callback("Назад", `sub_section#${targetItem.category}`)],
    ]);

    if (!targetItem.hidden) {
      await ctx.telegram.editMessageMedia(
        ctx.from.id,
        ctx.callbackQuery.message.message_id,
        undefined,
        {
          type: "photo",
          media: {
            source: path.join(images, targetItem.bigImage),
          },
        }
      );
      await ctx.telegram.editMessageCaption(
        ctx.from.id,
        ctx.callbackQuery.message.message_id,
        undefined,
        `<b>Товар:</b> ${
          targetItem.title
        }\n<b>Цена:</b> ${targetItem.getPrice()} ₽\n\n<b>Описание:</b> ${
          targetItem.bigDescription
        }${targetItem.isVBucks ? "\n\n" + messages.item_extra : ""}`,
        {
          reply_markup: keyboard.reply_markup,
          parse_mode: "HTML",
        }
      );
    } else
      ctx.answerCbQuery("На данный момент товар недоступен").catch((_) => null);

    ctx.scene.leave();
  } catch (e) {
    null;
    ctx.answerCbQuery("Что-то пошло не так").catch((_) => null);
    ctx.scene.enter("shop");
  }
};

module.exports = item;
