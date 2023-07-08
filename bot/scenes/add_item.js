const { Scenes, Markup } = require("telegraf");
const fs = require("fs");
const axios = require("axios");
const crypto = require("crypto");
const path = require("path");

const keys = require("../keyboard");
const goods = require("../../models/goods");
const categories = require("../../models/categories");
const regenerate = require("../../render");

const images = path.join(process.cwd(), "files", "images");

const addItem = new Scenes.WizardScene(
  "addItem",
  async (ctx) => {
    try {
      const message = ctx.scene.state.menu.message_id;
      const targetCategories = await categories.find(
        { type: "sub" },
        "_id title"
      );

      if (targetCategories) {
        ctx.scene.state.categories = targetCategories;
        await ctx.telegram.editMessageText(
          ctx.from.id,
          message,
          undefined,
          "Введите название товара"
        );
        await ctx.telegram.editMessageReplyMarkup(
          ctx.from.id,
          message,
          undefined,
          keys.BackMenu.keyboard.reply_markup
        );
        ctx.scene.state.newItem = new goods();

        ctx.wizard.next();
      } else {
        ctx
          .answerCbQuery("Для начала создайте хотя бы одну вложенную категорию")
          .catch((_) => null);
        ctx.scene.enter("goods", { menu: ctx.scene.state.menu });
      }
    } catch (e) {
      ctx
        .reply(`Ошибка: ${e.message}`)
        .then((msg) => {
          setTimeout((_) =>
            ctx.telegram
              .deleteMessage(ctx.from.id, msg.message_id)
              .catch((_) => null)
          );
        }, 5000)
        .catch((_) => null);
      ctx.scene.enter("goods", { menu: ctx.scene.state.menu });
      console.log(e);
    }
  },
  async (ctx) => {
    try {
      ctx.deleteMessage().catch((_) => null);
      const message = ctx.scene.state.menu.message_id;

      if (ctx.updateType === "message" && !ctx.message.photo) {
        ctx.scene.state.newItem.title = ctx.message.text.trim();
        await ctx.telegram.editMessageText(
          ctx.from.id,
          message,
          undefined,
          'Введите описание товара, которое будет на его изображении\n\n"-" для пустого описания'
        );
        await ctx.telegram.editMessageReplyMarkup(
          ctx.from.id,
          message,
          undefined,
          keys.BackMenu.keyboard.reply_markup
        );

        ctx.wizard.next();
      }
    } catch (e) {
      ctx
        .reply(`Ошибка: ${e.message}`)
        .then((msg) => {
          setTimeout((_) =>
            ctx.telegram
              .deleteMessage(ctx.from.id, msg.message_id)
              .catch((_) => null)
          );
        }, 5000)
        .catch((_) => null);
      ctx.scene.enter("goods", { menu: ctx.scene.state.menu });
      console.log(e);
    }
  },
  async (ctx) => {
    try {
      ctx.deleteMessage().catch((_) => null);
      const message = ctx.scene.state.menu.message_id;

      if (ctx.updateType === "message" && !ctx.message.photo) {
        ctx.scene.state.newItem.description =
          ctx.message.text.trim() === "-" ? "" : ctx.message.text;
        await ctx.telegram.editMessageText(
          ctx.from.id,
          message,
          undefined,
          'Введите описание товара, которое будет в сообщении под карточкой товара\n\n"-" для пустого описания'
        );
        await ctx.telegram.editMessageReplyMarkup(
          ctx.from.id,
          message,
          undefined,
          keys.BackMenu.keyboard.reply_markup
        );

        ctx.wizard.next();
      }
    } catch (e) {
      ctx
        .reply(`Ошибка: ${e.message}`)
        .then((msg) => {
          setTimeout((_) =>
            ctx.telegram
              .deleteMessage(ctx.from.id, msg.message_id)
              .catch((_) => null)
          );
        }, 5000)
        .catch((_) => null);
      ctx.scene.enter("goods", { menu: ctx.scene.state.menu });
      console.log(e);
    }
  },
  async (ctx) => {
    try {
      ctx.deleteMessage().catch((_) => null);
      const message = ctx.scene.state.menu.message_id;

      if (ctx.updateType === "message" && !ctx.message.photo) {
        ctx.scene.state.newItem.bigDescription =
          ctx.message.text.trim() === "-" ? "" : ctx.message.text;
        await ctx.telegram.editMessageText(
          ctx.from.id,
          message,
          undefined,
          "Введите через пробел размеры шрифт названия товара в изображении категории и размер шрифта описания в его картчке.\n\nСтандратный размер шрифта для названия 54, для описания 30"
        );
        await ctx.telegram.editMessageReplyMarkup(
          ctx.from.id,
          message,
          undefined,
          keys.BackMenu.keyboard.reply_markup
        );

        ctx.wizard.next();
      }
    } catch (e) {
      ctx
        .reply(`Ошибка: ${e.message}`)
        .then((msg) => {
          setTimeout((_) =>
            ctx.telegram
              .deleteMessage(ctx.from.id, msg.message_id)
              .catch((_) => null)
          );
        }, 5000)
        .catch((_) => null);
      ctx.scene.enter("goods", { menu: ctx.scene.state.menu });
      console.log(e);
    }
  },
  async (ctx) => {
    try {
      if (ctx.updateType === "message") {
        ctx.deleteMessage().catch((_) => null);

        fonts = /(\d+)+\s+(\d+)/.exec(ctx.message.text);
        if (!fonts) {
          const curCtx = ctx;
          ctx
            .reply("Введите два числа через пробел")
            .then((msg) => {
              setTimeout(function () {
                curCtx.telegram
                  .deleteMessage(curCtx.from.id, msg.message_id)
                  .catch((_) => null);
              }, 2000);
            })
            .catch((_) => null);
          return;
        }

        const titleFontSize = Number(fonts[1]);
        const descriptionFontSize = Number(fonts[2]);

        ctx.scene.state.newItem.titleFontSize = titleFontSize;
        ctx.scene.state.newItem.descriptionFontSize = descriptionFontSize;

        await ctx.telegram.editMessageText(
          ctx.from.id,
          ctx.scene.state.menu.message_id,
          undefined,
          "Укажите цену товара",
          {
            reply_markup: keys.BackMenu.keyboard.reply_markup,
          }
        );
        ctx.wizard.next();
      }
    } catch (e) {
      ctx
        .reply(`Ошибка: ${e.message}`)
        .then((msg) => {
          setTimeout((_) =>
            ctx.telegram
              .deleteMessage(ctx.from.id, msg.message_id)
              .catch((_) => null)
          );
        }, 5000)
        .catch((_) => null);
      ctx.scene.enter("goods", { menu: ctx.scene.state.menu });
      console.log(e);
    }
  },
  async (ctx) => {
    try {
      ctx.deleteMessage().catch((_) => null);

      if (ctx.updateType === "message" && !ctx.message.photo) {
        let price = Number(ctx.message.text.trim()),
          problem = false,
          msg,
          keyboard = [[Markup.button.callback("Назад", keys.BackMenu.buttons)]];

        if (Number.isNaN(price)) {
          problem = true;
          msg = "Цена должна быть числом";
        } else if (price <= 0) {
          problem = true;
          msg = "Цена должна быть больше 0";
        } else {
          msg = "Товар для";
          for (let game of global.games) {
            keyboard.push([Markup.button.callback(game, game)]);
          }
          ctx.scene.state.newItem.price = price.toFixed(2);
        }

        await ctx.telegram.editMessageText(
          ctx.from.id,
          ctx.scene.state.menu.message_id,
          undefined,
          msg,
          {
            reply_markup: Markup.inlineKeyboard(keyboard).reply_markup,
          }
        );

        if (!problem) ctx.wizard.next();
      }
    } catch (e) {
      ctx
        .reply(`Ошибка: ${e.message}`)
        .then((msg) => {
          setTimeout((_) =>
            ctx.telegram
              .deleteMessage(ctx.from.id, msg.message_id)
              .catch((_) => null)
          );
        }, 5000)
        .catch((_) => null);
      ctx.scene.enter("goods", { menu: ctx.scene.state.menu });
      console.log(e);
    }
  },
  async (ctx) => {
    try {
      if (ctx.updateType === "callback_query") {
        const cb = ctx.callbackQuery.data;
        if (cb !== keys.BackMenu.buttons) {
          ctx.scene.state.newItem.game = cb;

          const msg =
            "Заказ выполянется менеджером, доставляется покупателю или выполняется менеджером без передачи логина и пароля через бота?";
          const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback("Выполняется менеджером", "manual")],
            [Markup.button.callback("Доставляется покупателю", "auto")],
            [
              Markup.button.callback(
                "Менеджером без передачи через бота",
                "manualSkipProceed"
              ),
            ],
            [Markup.button.callback("Назад", keys.BackMenu.buttons)],
          ]);

          await ctx.telegram.editMessageText(
            ctx.from.id,
            ctx.callbackQuery.message.message_id,
            undefined,
            msg,
            {
              reply_markup: keyboard.reply_markup,
            }
          );
          ctx.wizard.next();
        }
      } else ctx.deleteMessage().catch((_) => null);
    } catch (e) {
      ctx
        .reply(`Ошибка: ${e.message}`)
        .then((msg) => {
          setTimeout((_) =>
            ctx.telegram
              .deleteMessage(ctx.from.id, msg.message_id)
              .catch((_) => null)
          );
        }, 5000)
        .catch((_) => null);
      ctx.scene.enter("goods", { menu: ctx.scene.state.menu });
      console.log(e);
    }
  },
  async (ctx) => {
    try {
      if (ctx.updateType === "callback_query") {
        const cb = ctx.callbackQuery.data;
        if (cb !== keys.BackMenu.buttons) {
          ctx.scene.state.newItem.itemType = cb;
          var msg,
            jump = 4,
            key;

          if (
            ctx.scene.state.newItem.game === "brawlstars" &&
            ctx.scene.state.newItem.itemType === "manual"
          ) {
            msg =
              'Добавить дополнительный вопрос?\nЕсли да, то напишите его, иначе нажмите на "Далее"';
            key = Markup.inlineKeyboard([
              [Markup.button.callback("Далее", "skip_extra")],
            ]);
            jump = 2;
          } else if (
            ctx.scene.state.newItem.game === "fortnite" &&
            ctx.scene.state.newItem.itemType !== "manualSkipProceed"
          ) {
            msg = "Товар является В-Баксами?";
            key = keys.YesNoMenu.keyboard;
            jump = 1;
          } else {
            msg = "Загрузите обложку товара";
            key = keys.BackMenu.keyboard;
          }

          await ctx.telegram.editMessageText(
            ctx.from.id,
            ctx.callbackQuery.message.message_id,
            undefined,
            msg,
            {
              reply_markup: key.reply_markup,
            }
          );
          ctx.wizard.selectStep(ctx.wizard.cursor + jump);
        }
      } else ctx.deleteMessage().catch((_) => null);
    } catch (e) {
      ctx
        .reply(`Ошибка: ${e.message}`)
        .then((msg) => {
          setTimeout((_) =>
            ctx.telegram
              .deleteMessage(ctx.from.id, msg.message_id)
              .catch((_) => null)
          );
        }, 5000)
        .catch((_) => null);
      ctx.scene.enter("goods", { menu: ctx.scene.state.menu });
      console.log(e);
    }
  },
  async (ctx) => {
    try {
      if (ctx.updateType === "callback_query") {
        ctx.scene.state.newItem.isVBucks =
          ctx.callbackQuery.data === keys.YesNoMenu.buttons.yes;

        await ctx.telegram.editMessageText(
          ctx.from.id,
          ctx.scene.state.menu.message_id,
          undefined,
          "Отправьте обложку",
          {
            reply_markup: keys.BackMenu.keyboard.reply_markup,
          }
        );

        ctx.wizard.selectStep(ctx.wizard.cursor + 3);
      }
    } catch (e) {
      ctx
        .reply(`Ошибка: ${e.message}`)
        .then((msg) => {
          setTimeout((_) =>
            ctx.telegram
              .deleteMessage(ctx.from.id, msg.message_id)
              .catch((_) => null)
          );
        }, 5000)
        .catch((_) => null);
      ctx.scene.enter("goods", { menu: ctx.scene.state.menu });
      console.log(e);
    }
  },
  async (ctx) => {
    try {
      var msg = "Загрузите обложку товара",
        jump = 2,
        next = false;
      if (ctx.updateType === "message") {
        ctx.deleteMessage().catch((_) => null);
        msg =
          "Перечислите варианты ответа списком, как на примере ниже:<i>\n\nВариант 1\nВариант 2\nВариант 3\nВариант 4</i>";
        const extraMessage = ctx.message.text;
        ctx.scene.state.newItem.extra.message = extraMessage;
        jump = 1;

        await ctx.telegram.editMessageText(
          ctx.from.id,
          ctx.scene.state.menu.message_id,
          undefined,
          msg,
          {
            parse_mode: "HTML",
          }
        );

        next = true;
      } else if (ctx.updateType === "callback_query") {
        if (ctx.callbackQuery.data === "skip_extra") {
          await ctx.telegram.editMessageText(
            ctx.from.id,
            ctx.scene.state.menu.message_id,
            undefined,
            msg,
            {
              reply_markup: keys.BackMenu.keyboard.reply_markup,
            }
          );
          next = true;
        }
      }

      if (next) ctx.wizard.selectStep(ctx.wizard.cursor + jump);
    } catch (e) {
      ctx
        .reply(`Ошибка: ${e.message}`)
        .then((msg) => {
          setTimeout((_) =>
            ctx.telegram
              .deleteMessage(ctx.from.id, msg.message_id)
              .catch((_) => null)
          );
        }, 5000)
        .catch((_) => null);
      ctx.scene.enter("goods", { menu: ctx.scene.state.menu });
      console.log(e);
    }
  },
  async (ctx) => {
    try {
      if (ctx.updateType === "message") {
        ctx.deleteMessage().catch((_) => null);

        const extraOptions = ctx.message.text.split("\n");
        ctx.scene.state.newItem.extra.options = extraOptions;

        const msg = "Загрузите обложку";
        await ctx.telegram.editMessageText(
          ctx.from.id,
          ctx.scene.state.menu.message_id,
          undefined,
          msg,
          {
            reply_markup: keys.BackMenu.keyboard.reply_markup,
          }
        );

        ctx.wizard.next();
      }
    } catch (e) {
      ctx
        .reply(`Ошибка: ${e.message}`)
        .then((msg) => {
          setTimeout((_) =>
            ctx.telegram
              .deleteMessage(ctx.from.id, msg.message_id)
              .catch((_) => null)
          );
        }, 5000)
        .catch((_) => null);
      ctx.scene.enter("goods", { menu: ctx.scene.state.menu });
      console.log(e);
    }
  },
  async (ctx) => {
    try {
      // ctx.deleteMessage().catch(_ => null);
      const message = ctx.scene.state.menu.message_id;
      const photo = ctx.message.photo || ctx.message.sticker || undefined;

      if (ctx.updateType === "message" && photo) {
        ctx.telegram
          .editMessageText(
            ctx.from.id,
            message,
            undefined,
            "Подождите пока изображение загрузится на сервер"
          )
          .catch((_) => null);

        const filename = crypto.randomBytes(8).toString("hex") + ".jpg";
        const link = await ctx.telegram.getFileLink(
          photo[photo.length - 1].file_id
        );

        axios({
          method: "get",
          url: link.href,
          responseType: "stream",
        })
          .then((res) => {
            const writer = fs.createWriteStream(path.join(images, filename));
            let problem = false;
            res.data.pipe(writer);

            writer.on("error", (err) => {
              problem = true;
              ctx.scene.enter("goods", { menu: ctx.scene.state.menu });

              ctx
                .reply(`Ошибка: ${err.message}`)
                .then((msg) =>
                  setTimeout((_) =>
                    ctx.telegram
                      .deleteMessage(ctx.from.id, msg.message_id)
                      .catch((_) => null)
                  )
                )
                .catch((_) => null);

              writer.close();
            });

            writer.on("close", async (_) => {
              if (!problem) {
                try {
                  ctx.deleteMessage().catch((_) => null);

                  ctx.scene.state.newItem.image = filename;

                  let keyboard = [];
                  for (let category of ctx.scene.state.categories) {
                    keyboard.push([
                      Markup.button.callback(category.title, category._id),
                    ]);
                  }
                  keyboard.push([
                    Markup.button.callback("Назад", keys.BackMenu.buttons),
                  ]);

                  await ctx.telegram.editMessageText(
                    ctx.from.id,
                    ctx.scene.state.menu.message_id,
                    undefined,
                    "В какую категорию поместить товар?"
                  );
                  await ctx.telegram.editMessageReplyMarkup(
                    ctx.from.id,
                    ctx.scene.state.menu.message_id,
                    undefined,
                    Markup.inlineKeyboard(keyboard).reply_markup
                  );

                  ctx.wizard.next();
                } catch (e) {
                  console.log(e.message);
                  ctx.scene.enter("goods", { menu: ctx.scene.state.menu });
                }
              }
            });
          })
          .catch((err) => {
            console.log(err.message);
            ctx.scene.enter("goods", { menu: ctx.scene.state.menu });
          });
      }
    } catch (e) {
      ctx
        .reply(`Ошибка: ${e.message}`)
        .then((msg) => {
          setTimeout((_) =>
            ctx.telegram
              .deleteMessage(ctx.from.id, msg.message_id)
              .catch((_) => null)
          );
        }, 5000)
        .catch((_) => null);
      ctx.scene.enter("goods", { menu: ctx.scene.state.menu });
      console.log(e);
    }
  },
  async (ctx) => {
    try {
      ctx.deleteMessage().catch((_) => null);

      if (ctx.updateType == "callback_query") {
        console.log(ctx.callbackQuery.data);

        ctx.scene.state.newItem.category = ctx.callbackQuery.data;
        await ctx.scene.state.newItem.save(async (err, item) => {
          if (!err) {
            let msg = `Товар ${ctx.scene.state.newItem.title} успешно добавлен`;
            ctx.answerCbQuery(msg).catch((_) => null);
            const menu = await ctx.reply(msg);
            ctx.scene.enter("goods", { menu: menu });

            regenerate
              .renderShopPage(ctx.callbackQuery.data)
              .then(async (file) => {
                regenerate.genImageFromHTML(file).then((file) => {
                  categories
                    .updateOne(
                      { _id: ctx.callbackQuery.data },
                      {
                        image: file,
                      }
                    )
                    .then((_) =>
                      ctx.answerCbQuery("Обложка обновлена").catch((_) => null)
                    )
                    .catch(
                      (err) =>
                        `Ошибка во время генерации изображения ${err.message}`
                    );
                });
              })
              .catch((err) => console.log(err));

            regenerate
              .renderItemPage(item._id)
              .then(async (file) => {
                regenerate.genImageFromHTML(file).then((file) => {
                  goods
                    .updateOne(
                      { _id: item._id },
                      {
                        bigImage: file,
                      }
                    )
                    .then((_) =>
                      ctx
                        .answerCbQuery("Обложка товара готова")
                        .catch((_) => null)
                    )
                    .catch(
                      (err) =>
                        `Ошибка во время генерации изображения ${err.message}`
                    );
                });
              })
              .catch((err) => console.log(err));
          } else {
            console.log(err.message);
            ctx
              .answerCbQuery(
                `Ошибка во время сохранения товара: ${err.message}`
              )
              .catch((_) => null);
            ctx.scene.enter("goods", { menu: ctx.scene.state.menu });
          }
        });
      }
    } catch (e) {
      ctx
        .reply(`Ошибка: ${e.message}`)
        .then((msg) => {
          setTimeout((_) =>
            ctx.telegram
              .deleteMessage(ctx.from.id, msg.message_id)
              .catch((_) => null)
          );
        }, 5000)
        .catch((_) => null);
      ctx.scene.enter("goods", { menu: ctx.scene.state.menu });
      console.log(e);
    }
  }
);

addItem.action(keys.BackMenu.buttons, (ctx) => {
  ctx.scene.enter("goods", { menu: ctx.scene.state.menu });
});

module.exports = addItem;
