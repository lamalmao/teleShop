const { Scenes, Markup } = require("telegraf");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const goods = require("../../models/goods");
const categories = require("../../models/categories");
const { parseFile, delivery } = require("../../models/delivery");
const { parseManagerKeysFile } = require("../../models/manager-keys");

const itemMenu = require("../item_menu");
const keys = require("../keyboard");
const axios = require("axios");
const render = require("../../render");
const { Types } = require("mongoose");
const item = require("./item");
const managerKey = require("../../models/manager-keys");
const escapeHTML = require("escape-html");

const cancelMenu = Markup.inlineKeyboard([
  Markup.button.callback("Отмена", "cancel"),
]);

const manageItem = new Scenes.BaseScene("manageItem");

manageItem.enterHandler = async function (ctx) {
  try {
    ctx.scene.state.target = undefined;

    const menuId = ctx.scene.state.menu.message_id;
    const item = ctx.scene.state.item;

    const itemMessage = await itemMenu.genItemMessage(item, true);
    const itemKeyboard = itemMenu.genItemKeyboard(item, true);

    ctx.scene.state.message = itemMessage;
    ctx.scene.state.keyboard = itemKeyboard;

    await ctx.telegram.editMessageMedia(ctx.from.id, menuId, undefined, {
      media: {
        source: path.join(process.cwd(), "files", "images", item.bigImage),
      },
      type: "photo",
    });
    await ctx.telegram.editMessageCaption(
      ctx.from.id,
      menuId,
      undefined,
      itemMessage,
      {
        reply_markup: itemKeyboard.reply_markup,
      }
    );

    ctx.scene.state.item = item;
  } catch (e) {
    ctx.reply(`Ошибка: ${e.message}`).catch((_) => null);
    ctx.telegram
      .deleteMessage(ctx.from.id, ctx.scene.state.menu?.message_id)
      .catch(() => null);
    ctx.scene.enter("showGoods", {
      menu: ctx.scene.state.menu,
      category: ctx.scene.state.category,
    });
  }
};

manageItem.action("cancel", (ctx) => {
  ctx.scene.state.target = undefined;
  ctx.scene.state.validation = undefined;
  ctx.scene.state.action = undefined;

  ctx.scene.enter("manageItem", {
    item: ctx.scene.state.item,
    menu: ctx.scene.state.menu,
    category: ctx.scene.state.category,
  });
});

manageItem.action(keys.BackMenu.buttons, (ctx) => {
  ctx.scene.enter("showGoods", {
    menu: ctx.scene.state.menu,
    category: ctx.scene.state.category,
  });
});

manageItem.action("downloadKeys", async (ctx) => {
  try {
    await ctx.sendChatAction("upload_document");

    let keys;
    if (ctx.scene.state.item.itemType === "auto") {
      keys = await delivery.find(
        {
          item: ctx.scene.state.item._id,
          delivered: false,
          accessable: true,
        },
        {
          value: 1,
        }
      );
    } else {
      keys = await managerKey.find(
        {
          item: ctx.scene.state.item._id,
          used: false,
        },
        {
          value: 1,
        }
      );
    }

    if (!keys || keys.length === 0) {
      await ctx.answerCbQuery("Ключей нет");
      return;
    }

    let data = "";
    for (const key of keys) {
      data += key.value + "\n";
    }

    await ctx.replyWithDocument(
      {
        filename: `${ctx.scene.state.item._id.toString()}.txt`,
        source: Buffer.from(data),
      },
      {
        caption: `Ключи для <b>${escapeHTML(ctx.scene.state.item.title)}</b>`,
        parse_mode: "HTML",
      }
    );
  } catch (error) {
    ctx.scene.enter("manageItem", {
      menu: ctx.scene.state.menu,
      category: ctx.scene.state.category,
    });
  } finally {
    ctx.answerCbQuery().catch(() => null);
  }
});

manageItem.action("changeExtra", (ctx) => {
  ctx.scene.enter("change_extra", {
    menu: ctx.scene.state.menu,
    category: ctx.scene.state.category,
    item: ctx.scene.state.item,
  });
});

manageItem.action("switchSuspend", async (ctx) => {
  try {
    await goods.findByIdAndUpdate(ctx.scene.state.item._id, {
      $set: {
        suspended: !ctx.scene.state.item.suspended,
      },
    });

    const item = await goods.findById(ctx.scene.state.item._id);
    ctx.scene.state.item = item;
  } catch {
    ctx.answerCbQuery("Что-то пошло не так").catch(() => null);
  } finally {
    ctx.scene.enter("manageItem", {
      item: ctx.scene.state.item,
      menu: ctx.scene.state.menu,
    });
  }
});

manageItem.action(/new#\S+/i, async (ctx) => {
  try {
    ctx.scene.state.target = undefined;
    ctx.scene.state.validation = undefined;
    ctx.scene.state.action = undefined;
    ctx.scene.state.csv = false;

    const targetCategory = /[a-zA-Z0-9]+$/.exec(ctx.callbackQuery.data)[0];
    const oldCategory = ctx.scene.state.item.category;

    ctx.scene.state.item.category = targetCategory;
    await ctx.scene.state.item.save();

    render
      .renderShopPage(oldCategory)
      .then((blank) => {
        render
          .genImageFromHTML(blank)
          .then((filename) => {
            categories
              .findByIdAndUpdate(oldCategory, {
                $set: {
                  image: filename,
                },
              })
              .catch(() => null);
          })
          .catch(() => null);
      })
      .catch(() => null);

    render
      .renderShopPage(targetCategory)
      .then((blank) => {
        render
          .genImageFromHTML(blank)
          .then((filename) => {
            categories
              .findByIdAndUpdate(targetCategory, {
                $set: {
                  image: filename,
                },
              })
              .catch((err) => null);
          })
          .catch((err) => null);
      })
      .catch((err) => null);

    ctx.scene.enter("manageItem", {
      menu: ctx.scene.state.menu,
      item: ctx.scene.state.item,
      category: ctx.scene.state.category,
    });
  } catch (e) {
    null;

    ctx.reply(`Ошибка: ${e.message}`).catch((_) => null);
    ctx.telegram
      .deleteMessage(ctx.from.id, ctx.scene.state.menu.message_id)
      .catch((_) => null);
    ctx.scene.enter("showGoods", {
      menu: ctx.scene.state.menu,
      category: ctx.scene.state.category,
    });
  }
});

manageItem.action(
  [keys.YesNoMenu.buttons.yes, keys.YesNoMenu.buttons.no],
  async (ctx) => {
    try {
      if (ctx.scene.state.action) {
        switch (ctx.scene.state.target) {
          case "deleteKeys":
            if (ctx.callbackQuery.data === keys.YesNoMenu.buttons.no) {
              ctx.scene.enter("manageItem", {
                menu: ctx.scene.state.menu,
                item: ctx.scene.state.item,
                category: ctx.scene.state.category,
              });

              return;
            }

            let result;
            if (ctx.scene.state.item.itemType === "auto") {
              result = await delivery.deleteMany({
                item: ctx.scene.state.item._id,
              });
            } else {
              result = await managerKey.deleteMany({
                item: ctx.scene.state.item._id,
              });
            }

            const item = await goods.findById(ctx.scene.state.item._id);
            ctx.scene.enter("manageItem", {
              menu: ctx.scene.state.menu,
              item,
              category: ctx.scene.state.category,
            });

            break;
          case "delete":
            if (ctx.callbackQuery.data === keys.YesNoMenu.buttons.yes) {
              await goods.findByIdAndDelete(ctx.scene.state.item._id);

              const update = ctx.scene.state.item.category;

              render
                .renderShopPage(update)
                .then((blank) => {
                  render
                    .genImageFromHTML(blank)
                    .then((filename) => {
                      categories
                        .findByIdAndUpdate(update, {
                          $set: {
                            image: filename,
                          },
                        })
                        .catch((err) => null);
                    })
                    .catch((err) => null);
                })
                .catch((err) => null);

              ctx.scene.enter("showGoods", {
                menu: ctx.scene.state.menu,
                category: ctx.scene.state.category,
              });
            } else {
              ctx.scene.enter("manageItem", {
                menu: ctx.scene.state.menu,
                item: ctx.scene.state.item,
                category: ctx.scene.state.category,
              });
            }
            break;
          case "isVBucks":
            if (ctx.callbackQuery.data === keys.YesNoMenu.buttons.yes) {
              ctx.scene.state.item.isVBucks = !ctx.scene.state.item.isVBucks;
              await ctx.scene.state.item.save();
            }

            ctx.scene.enter("manageItem", {
              menu: ctx.scene.state.menu,
              item: ctx.scene.state.item,
              category: ctx.scene.state.category,
            });
            break;
          case "managerKeys":
            if (ctx.callbackQuery.data === keys.YesNoMenu.buttons.yes) {
              ctx.scene.state.item.managerKeys =
                !ctx.scene.state.item.managerKeys;
              await ctx.scene.state.item.save();
            }

            ctx.scene.enter("manageItem", {
              menu: ctx.scene.state.menu,
              item: ctx.scene.state.item,
              category: ctx.scene.state.category,
            });
            break;
        }

        ctx.scene.state.target = undefined;
        ctx.scene.state.validation = undefined;
        ctx.scene.state.action = undefined;
      } else {
        ctx.scene.enter("manageItem", {
          menu: ctx.scene.state.menu,
          item: ctx.scene.state.item,
          category: ctx.scene.state.category,
        });
      }
    } catch (e) {
      null;

      ctx.reply(`Ошибка: ${e.message}`).catch((_) => null);
      ctx.telegram
        .deleteMessage(ctx.from.id, ctx.scene.state.menu.message_id)
        .catch((_) => null);
      ctx.scene.enter("showGoods", {
        menu: ctx.scene.state.menu,
        category: ctx.scene.state.category,
      });
    }
  }
);

manageItem.action("changeDeliveryType", (ctx) => {
  ctx.scene.enter("change-delivery-type", {
    item: ctx.scene.state.item,
    menu: ctx.scene.state.menu,
  });
});

manageItem.action(/loadKeys:(manager|deliveries)/, async (ctx) => {
  try {
    const rawTarget = /loadKeys:(managers|deliveries)/.exec(
      ctx.callbackQuery.data
    );

    if (!rawTarget) {
      throw new Error("No data");
    }

    const target = rawTarget[1];
    ctx.scene.state.csv = true;
    ctx.scene.state.csvTarget = target;

    await ctx.telegram.editMessageCaption(
      ctx.from.id,
      ctx.callbackQuery.message.message_id,
      undefined,
      'Отправьте <b>.csv</b> файл с ключами, которые будут загружены.\nКлючи должны храниться в колонке <b>"keys"</b>',
      {
        reply_markup: Markup.inlineKeyboard([
          Markup.button.url(
            "Пример",
            "https://docs.google.com/spreadsheets/d/1ZP3rAY7a87Db1a-wXMRkxRdTURGVlE1XJ-uIfhsma-s/edit?usp=sharing"
          ),
          Markup.button.callback("Назад", "cancel"),
        ]).reply_markup,
        parse_mode: "HTML",
      }
    );
  } catch (e) {
    null;
    ctx.reply(`Ошибка: ${e.message}`).catch((_) => null);
    ctx.telegram
      .deleteMessage(ctx.from.id, ctx.scene.state.menu.message_id)
      .catch((_) => null);
    ctx.scene.enter("showGoods", {
      menu: ctx.scene.state.menu,
      category: ctx.scene.state.category,
    });
  }
});

manageItem.on(
  "document",
  async (ctx, next) => {
    ctx.deleteMessage().catch((_) => null);
    if (ctx.scene.state.csv && ctx.message.document.mime_type === "text/csv")
      next();
  },
  async (ctx) => {
    try {
      const link = await ctx.telegram.getFileLink(ctx.message.document.file_id);

      const localCtx = ctx;
      ctx.scene.state.csv = false;

      if (ctx.scene.state.csvTarget === "deliveries") {
        axios({
          method: "get",
          url: link.href,
          responseType: "stream",
        }).then((res) => {
          parseFile(res.data, ctx.scene.state.item)
            .on("done", (result) => {
              localCtx
                .reply(
                  `Готово!\nУспешно загружено: ${result.done}\nОшибок: ${result.failed}`
                )
                .then((msg) => {
                  setTimeout(function () {
                    localCtx.telegram
                      .deleteMessage(localCtx.from.id, msg.message_id)
                      .catch((_) => null);
                  }, 5000);
                })
                .catch((_) => null);
            })
            .on("error", (err) => {
              localCtx
                .reply(`Что-то пошло не так:\n<code>${err.message}</code>`, {
                  parse_mode: "HTML",
                })
                .catch((_) => null);
            });
        });
      } else if (ctx.scene.state.csvTarget === "managers") {
        axios({
          method: "get",
          url: link.href,
          responseType: "stream",
        }).then((res) => {
          parseManagerKeysFile(res.data, ctx.scene.state.item)
            .on("done", (result) => {
              localCtx
                .reply(
                  `Готово!\nУспешно загружено: ${result.done}\nОшибок: ${result.failed}`
                )
                .then((msg) => {
                  setTimeout(function () {
                    localCtx.telegram
                      .deleteMessage(localCtx.from.id, msg.message_id)
                      .catch((_) => null);
                  }, 5000);
                })
                .catch((_) => null);
            })
            .on("error", (err) => {
              localCtx
                .reply(`Что-то пошло не так:\n<code>${err.message}</code>`, {
                  parse_mode: "HTML",
                })
                .catch((_) => null);
            });
        });
      }

      ctx.scene.enter("manageItem", {
        menu: ctx.scene.state.menu,
        item: ctx.scene.state.item,
      });
    } catch (e) {
      null;
      ctx.reply(`Ошибка: ${e.message}`).catch((_) => null);
      ctx.telegram
        .deleteMessage(ctx.from.id, ctx.scene.state.menu.message_id)
        .catch((_) => null);
      ctx.scene.enter("showGoods", {
        menu: ctx.scene.state.menu,
        category: ctx.scene.state.category,
      });
    }
  }
);

manageItem.on("callback_query", async (ctx, next) => {
  try {
    if (!ctx.scene.state.action) {
      let msg,
        keyboard = cancelMenu,
        action = "message",
        validation = "false",
        goOn = true;

      switch (ctx.callbackQuery.data) {
        case "rename":
          msg = "Введите новое название";
          target = "title";
          break;
        case "editDescription":
          msg = 'Введите новое описание\n\n"-" для пустого описания';
          target = "description";
          break;
        case "editBigDescription":
          msg = 'Введите новое описание\n\n"-" для пустого описания';
          target = "bigDescription";
          break;
        case "changePrice":
          msg = "Укажите новую цену";
          target = "price";
          validation = "number";
          break;
        case "changeDiscount":
          msg = "Укажите скидку в процентах";
          target = "discount";
          validation = "discount";
          break;
        case "editImage":
          msg = "Отправьте новое изображение";
          target = "photo";
          break;
        case "delete":
          msg = "Вы уверены?";
          keyboard = keys.YesNoMenu.keyboard;
          target = "delete";
          break;
        case "switchIsVBucks":
          msg = "Вы уверены?";
          target = "isVBucks";
          keyboard = keys.YesNoMenu.keyboard;
          break;
        case "keysForManagers":
          msg = "Вы уверены?";
          target = "managerKeys";
          keyboard = keys.YesNoMenu.keyboard;
          break;
        case "deleteKeys":
          msg = "Вы уверены?";
          target = "deleteKeys";
          keyboard = keys.YesNoMenu.keyboard;
          break;
        case "changeFonts":
          msg =
            "Введите через пробел новые размеры шрифта заголова и описания на карточке товара";
          target = "fonts";
          validation = "fonts";
          keysboard = keys.BackMenu.keyboard;
          break;
        case "move":
          target = "category";
          msg = "Выберите новую категорию";
          keyboard = [];

          const targets = await categories.find(
            {
              type: "sub",
              _id: {
                $ne: Types.ObjectId(ctx.scene.state.item.category),
              },
            },
            "_id title"
          );

          for (let cat of targets)
            keyboard.push([
              Markup.button.callback(cat.title, "new#" + cat._id),
            ]);
          keyboard.push([
            Markup.button.callback("Отмена", keys.BackMenu.buttons),
          ]);

          keyboard = Markup.inlineKeyboard(keyboard);
          break;
        case "hiddenSwitch":
          goOn = false;

          ctx.scene.state.item.hidden = !ctx.scene.state.item.hidden;
          await ctx.scene.state.item.save();

          const itemMessage = await itemMenu.genItemMessage(
            ctx.scene.state.item,
            true
          );
          const itemKeyboard = itemMenu.genItemKeyboard(
            ctx.scene.state.item,
            true
          );

          render
            .renderShopPage(ctx.scene.state.item.category)
            .then((blank) => {
              render
                .genImageFromHTML(blank)
                .then((filename) => {
                  categories
                    .findByIdAndUpdate(ctx.scene.state.item.category, {
                      $set: {
                        image: filename,
                      },
                    })
                    .catch((_) => null);
                })
                .catch((_) => null);
            })
            .catch((_) => null);

          ctx.scene.reenter("manageItem", {
            menu: ctx.scene.state.menu,
            message: itemMessage,
            keyboard: itemKeyboard,
            category: ctx.scene.state.category,
          });

          break;
      }

      if (goOn) {
        ctx.scene.state.target = target;
        ctx.scene.state.validation = validation;
        ctx.scene.state.action = action;

        await ctx.telegram.editMessageCaption(
          ctx.from.id,
          ctx.scene.state.menu.message_id,
          undefined,
          msg
        );
        await ctx.telegram.editMessageReplyMarkup(
          ctx.from.id,
          ctx.scene.state.menu.message_id,
          undefined,
          keyboard.reply_markup
        );
      }
    }
  } catch (e) {
    null;

    ctx.reply(`Ошибка: ${e.message}`).catch((_) => null);
    ctx.telegram
      .deleteMessage(ctx.from.id, ctx.scene.state.menu.message_id)
      .catch((_) => null);
    ctx.scene.enter("showGoods", {
      menu: ctx.scene.state.menu,
      category: ctx.scene.state.category,
    });
  }
});

manageItem.on("photo", async (ctx) => {
  try {
    if (ctx.scene.state.target === "photo" && ctx.message.photo) {
      const link = await ctx.telegram.getFileLink(
        ctx.message.photo[ctx.message.photo.length - 1].file_id
      );
      const filename = crypto.randomBytes(8).toString("hex") + ".jpg";

      axios({
        method: "get",
        url: link.href,
        responseType: "stream",
      })
        .then((res) => {
          ctx.deleteMessage().catch((_) => null);

          const writer = fs.createWriteStream(
            path.join(process.cwd(), "files", "images", filename)
          );

          res.data.pipe(writer);

          let problem;

          writer.on("error", (err) => {
            problem = true;
            writer.close();
            throw err;
          });

          writer.on("close", async (_) => {
            if (!problem) {
              ctx.scene.state.item.image = filename;

              await ctx.scene.state.item.save();

              ctx.telegram.editMessageCaption(
                ctx.from.id,
                ctx.scene.state.menu.message_id,
                undefined,
                "Подождите, перерисовывается обложка товара и категории."
              );

              const bigImageBlank = await render.renderItemPage(
                ctx.scene.state.item._id
              );
              const bigImage = await render.genImageFromHTML(bigImageBlank);

              ctx.scene.state.item.bigImage = bigImage;
              await ctx.scene.state.item.save();

              const categoryBlank = await render.renderShopPage(
                ctx.scene.state.item.category
              );
              const categoryImage = await render.genImageFromHTML(
                categoryBlank
              );

              await categories.findByIdAndUpdate(
                ctx.scene.state.item.category,
                {
                  $set: {
                    image: categoryImage,
                  },
                }
              );
            }

            ctx.scene.enter("manageItem", {
              menu: ctx.scene.state.menu,
              item: ctx.scene.state.item,
              category: ctx.scene.state.category,
            });
          });
        })
        .catch((err) => {
          throw err;
        });
    }
  } catch (e) {
    null;

    ctx
      .reply(`Ошибка: ${e.message}`)
      .then((msg) => {
        setTimeout(
          (_) =>
            ctx.telegram
              .deleteMessage(ctx.from.id, msg.message_id)
              .catch((_) => null),
          5000
        );
      })
      .catch(() => null);

    ctx.scene.enter("manageItem", {
      menu: ctx.scene.state.menu,
      category: ctx.scene.state.category,
      item: ctx.scene.state.item,
    });
  }
});

manageItem.on("message", async (ctx) => {
  try {
    ctx.deleteMessage().catch(() => null);
    let needToRender = true;

    if (ctx.scene.state.action === "message" && !ctx.message.photo) {
      let newValue = ctx.message.text.trim();

      if (ctx.scene.state.target === "bigDescription") needToRender = false;
      if (
        ctx.scene.state.target === "description" ||
        ctx.scene.state.target === "bigDescription"
      ) {
        newValue = newValue === "-" ? "" : newValue;
      }

      switch (ctx.scene.state.validation) {
        case "number":
          newValue = Number(newValue);
          if (Number.isNaN(newValue))
            throw new Error("Значение должно быть числом");
          break;
        case "discount":
          newValue = Number(newValue);
          if (Number.isNaN(newValue))
            throw new Error("Значение должно быть числом");
          else if (newValue < 0 || newValue > 100)
            throw new Error("Скидка должна быть в промежутке от 0 до 100%");
          break;
        case "fonts":
          const values = /(\d+)\s+(\d+)/.exec(newValue);
          if (!values) throw new Error("Введите два числа через пробел");
          const itemTitleFont = Number(values[1]);
          const itemDescriptionFont = Number(values[2]);
          ctx.scene.state.item.titleFontSize = itemTitleFont;
          ctx.scene.state.item.descriptionFontSize = itemDescriptionFont;
          break;
      }

      if (ctx.scene.state.validation !== "fonts")
        ctx.scene.state.item[ctx.scene.state.target] = newValue;
      await ctx.scene.state.item.save();

      if (needToRender) {
        ctx.telegram.editMessageCaption(
          ctx.from.id,
          ctx.scene.state.menu.message_id,
          undefined,
          "Подождите, перерисовывается обложка товара и категории."
        );
        const bigImageBlank = await render.renderItemPage(
          ctx.scene.state.item._id
        );
        const bigImage = await render.genImageFromHTML(bigImageBlank);

        ctx.scene.state.item.bigImage = bigImage;
        await ctx.scene.state.item.save();

        const categoryBlank = await render.renderShopPage(
          ctx.scene.state.item.category
        );
        const categoryImage = await render.genImageFromHTML(categoryBlank);

        await categories.findByIdAndUpdate(ctx.scene.state.item.category, {
          $set: {
            image: categoryImage,
          },
        });
      }
      ctx.scene.enter("manageItem", {
        menu: ctx.scene.state.menu,
        item: ctx.scene.state.item,
        category: ctx.scene.state.category,
      });
    }
  } catch (e) {
    null;

    ctx
      .reply(`Ошибка: ${e.message}`)
      .then((msg) => {
        setTimeout(
          (_) =>
            ctx.telegram
              .deleteMessage(ctx.from.id, msg.message_id)
              .catch((_) => null),
          5000
        );
      })
      .catch((_) => null);

    ctx.scene.enter("manageItem", {
      menu: ctx.scene.state.menu,
      category: ctx.scene.state.category,
      item: ctx.scene.state.item,
    });
  }
});

module.exports = manageItem;
