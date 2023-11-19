const { Scenes, Markup } = require("telegraf");
const path = require("path");
const crypto = require("crypto");
const axios = require("axios");
const fs = require("fs");

const categories = require("../../models/categories");
const keys = require("../keyboard");
const categoryMessage = require("../category_message");
const render = require("../../render");

const images = path.join(process.cwd(), "files", "images");

const editCategory = new Scenes.BaseScene("editCategory");

editCategory.command("start", (ctx) => ctx.scene.enter("start"));

editCategory.enterHandler = async function (ctx) {
  try {
    const { category, message, keyboard } = ctx.scene.state;

    const menu = await ctx.replyWithPhoto(
      {
        source: path.join(images, category.image),
      },
      {
        caption: message,
        reply_markup: keyboard.reply_markup,
      }
    );

    ctx.scene.state.menu = menu;
  } catch (e) {
    null;
    ctx.scene.enter("admin");
  }
};

editCategory.on(
  "callback_query",
  async (ctx, next) => {
    ctx.scene.state.action = ctx.callbackQuery.data;
    ctx.scene.state.cb = ctx.callbackQuery.id;

    if (ctx.scene.state.action === keys.BackMenu.buttons) {
      ctx.deleteMessage(ctx.scene.state.menu.message_id).catch((_) => null);
      const newMenu = await ctx.reply("...");

      ctx.scene.enter("showCategories", { menu: newMenu });
    } else next();
  },
  async (ctx, next) => {
    try {
      if (ctx.scene.state.method === "callback") {
        if (ctx.scene.state.target === "delete") {
          ctx.telegram
            .deleteMessage(ctx.from.id, ctx.scene.state.menu.message_id)
            .catch((_) => null);

          ctx.scene.state.target = undefined;
          ctx.scene.state.method = undefined;
          ctx.scene.state.action = undefined;

          if (ctx.callbackQuery.data === keys.YesNoMenu.buttons.yes) {
            await categories.deleteOne({ _id: ctx.scene.state.category._id });

            const menu = await ctx.reply("...");
            ctx.scene.enter("showCategories", { menu });
          } else
            ctx.scene.reenter("editCategory", {
              category: ctx.scene.state.category,
              message: ctx.scene.state.message,
              keyboard: ctx.scene.state.keyboard,
            });
        } else if (ctx.scene.state.target === "hide") {
          ctx.telegram
            .deleteMessage(ctx.from.id, ctx.scene.state.menu.message_id)
            .catch((_) => null);

          ctx.scene.state.target = undefined;
          ctx.scene.state.method = undefined;
          ctx.scene.state.action = undefined;

          if (ctx.callbackQuery.data === keys.YesNoMenu.buttons.yes) {
            await categories.updateOne(
              {
                _id: ctx.scene.state.category._id,
              },
              {
                $set: {
                  hidden: !ctx.scene.state.category.hidden,
                },
              }
            );

            ctx.scene.state.category.hidden = !ctx.scene.state.category.hidden;
            ctx.scene.state.message = await categoryMessage(
              ctx.scene.state.category
            );

            ctx
              .answerCbQuery("Видимость категории изменена")
              .catch((_) => null);
          }

          ctx.scene.reenter({
            category: ctx.scene.state.category,
            message: ctx.scene.state.category,
            keyboard: ctx.scene.state.keyboard,
          });
        } else {
          ctx.scene.state.category[ctx.scene.state.target] =
            ctx.callbackQuery.data;
          await categories.updateOne(
            {
              _id: ctx.scene.state.category._id,
            },
            ctx.scene.state.category
          );

          ctx.answerCbQuery("Новое значение установлено").catch((_) => null);
          ctx.telegram.deleteMessage(
            ctx.from.id,
            ctx.scene.state.menu.message_id
          );

          ctx.scene.state.message = await categoryMessage(
            ctx.scene.state.category
          );

          ctx.scene.state.action = undefined;
          ctx.scene.state.target = undefined;
          ctx.scene.state.method = undefined;

          ctx.scene.reenter({
            category: ctx.scene.state.category,
            message: ctx.scene.state.category,
            keyboard: ctx.scene.state.keyboard,
          });
        }
      } else next();
    } catch (e) {
      null;
      ctx
        .deleteMessage(ctx.callbackQuery.message.message_id)
        .catch((_) => null);
      ctx.answerCbQuery("Что-то пошло не так").catch((_) => null);
      ctx.scene.reenter({
        category: ctx.scene.state.category,
        message: ctx.scene.state.category,
        keyboard: ctx.scene.state.keyboard,
      });
    }
  },
  async (ctx, next) => {
    try {
      let msg, method, nowshow;
      switch (ctx.callbackQuery.data) {
        case "rename":
          msg = "Введите новое название категории";
          method = "chat";
          ctx.scene.state.target = "title";
          break;
        case "editDescription":
          msg = "Введите новое описание категории";
          method = "chat";
          ctx.scene.state.target = "description";
          break;
        case "relocate":
          msg = "Выберите новую родительскую категорию";
          ctx.scene.state.target = "parent";

          var keyboard = [];
          const mainCategories = await categories.find(
            { type: "main" },
            "_id title"
          );
          for (let c of mainCategories) {
            keyboard.push([Markup.button.callback(c.title, c._id)]);
          }
          keyboard = Markup.inlineKeyboard(keyboard);

          method = "callback";
          break;
        case "delete":
          msg = "Вы уверены?";
          var keyboard = keys.YesNoMenu.keyboard;
          method = "callback";
          ctx.scene.state.target = "delete";
          break;
        case "hide":
          msg = "Вы уверены?";
          var keyboard = keys.YesNoMenu.keyboard;
          method = "callback";
          ctx.scene.state.target = "hide";
          break;
        case "rerender":
          nowshow = true;

          ctx.telegram.editMessageCaption(
            ctx.from.id,
            ctx.scene.state.menu.message_id,
            undefined,
            "Подождите..."
          );
          const newBlankFileName = await render.renderShopPage(
            ctx.scene.state.category._id
          );
          const newCategoryImageFileName = await render.genImageFromHTML(
            newBlankFileName
          );

          await categories.updateOne(
            {
              _id: ctx.scene.state.category._id,
            },
            {
              $set: {
                image: newCategoryImageFileName,
              },
            }
          );

          ctx.scene.state.category.image = newCategoryImageFileName;
          ctx.answerCbQuery("Готово").catch((_) => null);

          ctx.telegram
            .deleteMessage(ctx.from.id, ctx.scene.state.menu.message_id)
            .catch((_) => null);
          ctx.scene.state.menu = undefined;

          ctx.scene.reenter({
            category: ctx.scene.state.category,
            message: ctx.scene.state.category,
            keyboard: ctx.scene.state.keyboard,
          });
          break;
        case "editBackground":
          msg = "Отправьте новую обложку";
          method = "photo";
          ctx.scene.state.target = "image";
          break;
        default:
          break;
      }

      if (!nowshow) {
        ctx.scene.state.method = method;
        await ctx.telegram.editMessageCaption(
          ctx.from.id,
          ctx.scene.state.menu.message_id,
          undefined,
          msg
        );
        if (method === "callback")
          await ctx.telegram.editMessageReplyMarkup(
            ctx.from.id,
            ctx.scene.state.menu.message_id,
            undefined,
            keyboard.reply_markup
          );
      }
    } catch (e) {
      null;
      ctx
        .deleteMessage(ctx.callbackQuery.message.message_id)
        .catch((_) => null);
      ctx.answerCbQuery("Что-то пошло не так").catch((_) => null);
      ctx.scene.reenter({
        category: ctx.scene.state.category,
        message: ctx.scene.state.category,
        keyboard: ctx.scene.state.keyboard,
      });
    }
  }
);

editCategory.on(
  "photo",
  async (ctx, next) => {
    ctx.deleteMessage();
    if (ctx.scene.state.target === "image") next();
  },
  async (ctx) => {
    try {
      const link = await ctx.telegram.getFileLink(
        ctx.message.photo[ctx.message.photo.length - 1].file_id
      );
      const filename = crypto.randomBytes(8).toString("hex") + ".jpg";
      ctx.deleteMessage(ctx.scene.state.menu.message_id);

      axios({
        method: "get",
        url: link.href,
        responseType: "stream",
      }).then((res) => {
        const writer = fs.createWriteStream(
          path.join(process.cwd(), "files", "images", filename)
        );

        res.data.pipe(writer);
        let problem;

        ctx.scene.state.target = undefined;
        ctx.scene.state.method = undefined;
        ctx.scene.state.action = undefined;

        writer.on("error", (err) => {
          problem = true;
          ctx.telegram
            .answerCbQuery(ctx.scene.state.cb, `Ошибка: ${err.message}`)
            .catch((_) => null);

          ctx.scene.reenter("editCategory", {
            category: ctx.scene.category,
            keyboard: ctx.scene.keyboard,
            message: ctx.scene.state.message,
          });
          writer.close();
        });

        writer.on("close", async (_) => {
          if (!problem) {
            ctx.scene.state.category.image = filename;
            await categories.updateOne(
              {
                _id: ctx.scene.state.category._id,
              },
              ctx.scene.state.category
            );

            ctx.scene.reenter("editCategory", {
              category: ctx.scene.category,
              keyboard: ctx.scene.keyboard,
              message: await categoryMessage(ctx.scene.state.category),
            });
          }
        });
      });
    } catch (e) {
      null;
      ctx.deleteMessage(ctx.scene.state.menu.message_id).catch((_) => null);
      ctx.telegram
        .answerCbQuery(ctx.scene.state.cb, "Что-то пошло не так")
        .catch((_) => null);
      ctx.scene.reenter({
        category: ctx.scene.state.category,
        message: ctx.scene.state.category,
        keyboard: ctx.scene.state.keyboard,
      });
    }
  }
);

editCategory.on(
  "message",
  async (ctx, next) => {
    ctx.deleteMessage().catch((_) => null);
    var msg;
    if (ctx.message.text) msg = ctx.message.text.trim();

    if (!msg)
      ctx.telegram
        .answerCbQuery(ctx.scene.state.cb, "Пустое сообщение")
        .catch((_) => null);
    else if (ctx.scene.state.method === "chat") {
      ctx.scene.state.msg = msg;
      next();
    }
  },
  async (ctx) => {
    try {
      ctx.scene.state.category[ctx.scene.state.target] = ctx.scene.state.msg;

      await categories.updateOne(
        {
          _id: ctx.scene.state.category._id,
        },
        ctx.scene.state.category
      );

      ctx.telegram
        .answerCbQuery(`Новое значение установлено`)
        .catch((_) => null);

      ctx.scene.state.message = await categoryMessage(ctx.scene.state.category);

      ctx.scene.state.action = undefined;
      ctx.scene.state.target = undefined;
      ctx.scene.state.method = undefined;

      ctx.deleteMessage(ctx.scene.state.menu.message_id).catch((_) => null);
      ctx.scene.reenter({
        category: ctx.scene.state.category,
        message: ctx.scene.state.category,
        keyboard: ctx.scene.state.keyboard,
      });
    } catch (e) {
      null;
      ctx.deleteMessage(ctx.scene.state.menu.message_id).catch((_) => null);
      ctx.telegram
        .answerCbQuery(ctx.scene.state.cb, "Что-то пошло не так")
        .catch((_) => null);
      ctx.scene.reenter({
        category: ctx.scene.state.category,
        message: ctx.scene.state.category,
        keyboard: ctx.scene.state.keyboard,
      });
    }
  }
);

module.exports = editCategory;
