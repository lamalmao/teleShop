const { Scenes, Markup } = require("telegraf");
const cardsCategories = require("../../models/cards-categories");
const cards = require("../../models/cards");
const escapeHTML = require("escape-html");
const { Types } = require("mongoose");

const manageCardCategory = new Scenes.BaseScene("manage-card-category");

manageCardCategory.enterHandler = async (ctx) => {
  try {
    const id = ctx.scene.state.id;
    const category = await cardsCategories.findById(id);
    if (!category) {
      throw new Error("Категория не найдена");
    }

    const active = await cards.countDocuments({
      category: id,
      $and: [
        { busy: false },
        { hidden: false },
        {
          hold: {
            $lte: new Date(),
          },
        },
      ],
    });

    const unavailable = await cards.countDocuments({
      category: id,
      $or: [
        { busy: true },
        { hidden: true },
        {
          hold: {
            $gt: new Date(),
          },
        },
      ],
    });

    //prettier-ignore
    ctx.telegram.editMessageText(ctx.from.id, ctx.scene.state.menu.message_id, undefined, `Категория <b>${escapeHTML(category.title)}</b>\n\n<i>Активных карт:</i> ${active}\n<i>Неактивных (в холде, в работе и скрытые)</i>: ${unavailable}`, {
      parse_mode: 'HTML',
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('Добавить карту', 'add-card'), Markup.button.callback('Загрузить карты', 'load-cards')],
        [Markup.button.callback('Список карт', 'cards-list')],
        [Markup.button.callback('Переименовать', 'rename'), Markup.button.callback('Удалить', 'delete')],
        [Markup.button.callback('Назад', 'back')]
      ]).reply_markup
    }).catch(() => null);
  } catch (error) {
    console.log(error);
    ctx.reply(error.message).catch(() => null);
    ctx.scene.enter("card-categories", ctx.scene.state);
  }
};

manageCardCategory.action("rename", async (ctx) => {
  try {
    await ctx.telegram.editMessageText(
      ctx.from.id,
      ctx.scene.state.menu.message_id,
      undefined,
      "Введите новое название категории",
      {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback("Отмена", "cancel")],
        ]).reply_markup,
      }
    );

    ctx.scene.state.action = "rename";
  } catch (error) {
    console.log(error);
  }
});

manageCardCategory.action("load-cards", (ctx) =>
  ctx.scene.enter("load-cards", ctx.scene.state)
);

manageCardCategory.action("delete", async (ctx) => {
  try {
    const categories = await cardsCategories.find(
      {
        _id: {
          $ne: ctx.scene.state.id,
        },
      },
      {
        title: 1,
      }
    );

    const keyboard = [[Markup.button.callback("Не перемещать", "cancel")]];
    for (const category of categories) {
      keyboard.push([
        Markup.button.callback(
          category.title,
          `delete-to:${category._id.toString()}`
        ),
      ]);
    }

    keyboard.push([Markup.button.callback("Назад", "reenter")]);
    await ctx.editMessageText(`Переместить все карты после удаления в`, {
      reply_markup: Markup.inlineKeyboard(keyboard).reply_markup,
    });
  } catch (error) {
    console.log(error);
  }
});

manageCardCategory.action(/^delete-to:[a-z0-9]+$/, async (ctx) => {
  try {
    const raw = /:([a-z0-9]+)$/.exec(ctx.callbackQuery.data);
    if (!raw) {
      return;
    }

    const target = raw[1];
    await cardsCategories.deleteOne({
      _id: ctx.scene.state.id,
    });

    await cards.updateMany(
      {
        category: ctx.scene.state.id,
      },
      target === "none"
        ? {
            $unset: {
              category: "",
            },
          }
        : {
            $set: {
              category: new Types.ObjectId(target),
            },
          }
    );
  } catch (error) {
    console.log(error);
  } finally {
    ctx.scene.enter("card-categories", ctx.scene.state);
  }
});

manageCardCategory.action("cancel", (ctx) =>
  ctx.scene.enter("manage-card-category", ctx.scene.state)
);

manageCardCategory.action("cards-list", (ctx) =>
  ctx.scene.enter("cards-list", ctx.scene.state)
);

manageCardCategory.action("add-card", (ctx) =>
  ctx.scene.enter("add-card", ctx.scene.state)
);

manageCardCategory.action("back", (ctx) =>
  ctx.scene.enter("card-categories", ctx.scene.state)
);

manageCardCategory.action(/^rename-to:.+$/, async (ctx) => {
  try {
    const raw = /:(.+)$/.exec(ctx.callbackQuery.data);
    if (!raw) {
      throw new Error("No data");
    }

    const title = raw[1];
    await cardsCategories.updateOne(
      {
        _id: ctx.scene.state.id,
      },
      {
        $set: {
          title,
        },
      }
    );
  } catch (error) {
    console.log(error);
  } finally {
    ctx.scene.enter("manage-card-category", ctx.scene.state);
  }
});

manageCardCategory.on(
  "message",
  (ctx, next) => {
    ctx.deleteMessage().catch(() => null);
    if (ctx.scene.state.action) {
      next();
    }
  },
  async (ctx) => {
    try {
      if (ctx.scene.state.action !== "rename") {
        return;
      }

      await ctx.telegram.editMessageText(
        ctx.from.id,
        ctx.scene.state.menu.message_id,
        undefined,
        `Установить новое имя категории - <b>"${escapeHTML(
          ctx.message.text
        )}"</b>?`,
        {
          parse_mode: "HTML",
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback("Да", `rename-to:${ctx.message.text}`)],
            [Markup.button.callback("Нет", "cancel")],
          ]).reply_markup,
        }
      );
    } catch (error) {
      console.log(error);
    }
  }
);

manageCardCategory.leaveHandler = (ctx) => {
  ctx.scene.state.action = undefined;
};

module.exports = manageCardCategory;
