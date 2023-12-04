const { Scenes, Markup } = require("telegraf");
const cardsCategories = require("../../models/cards-categories");
const cards = require("../../models/cards");
const escapeHTML = require("escape-html");
const { Types } = require("mongoose");

const cardsList = new Scenes.BaseScene("cards-list");

cardsList.enterHandler = async (ctx) => {
  try {
    if (ctx.scene.state.lowBalance) {
      ctx.scene.state.id = undefined;
    }

    let category;
    if (ctx.scene.state.id) {
      category = (await cardsCategories.findById(ctx.scene.state.id, {
        title: 1,
      })) || {
        title: "Not found",
      };
    } else if (ctx.scene.state.lowBalance) {
      category = {
        title: "Карты с низким балансом",
      };
    } else {
      category = {
        title: "Без категории",
      };
    }

    let filter;
    if (ctx.scene.state.lowBalance) {
      filter = {
        $or: [
          {
            currency: "UAH",
            balance: { $lte: 250 },
          },
          {
            currency: "USD",
            balance: { $lte: 6 },
          },
          {
            currency: "EUR",
            balance: { $lte: 6 },
          },
        ],
      };
    } else if (ctx.scene.state.id) {
      filter = {
        category: ctx.scene.state.id,
      };
    } else {
      filter = {
        category: {
          $exists: false,
        },
      };
    }

    const categoryCards = await cards.find(
      filter,
      {
        number: 1,
        cvc: 1,
        duration: 1,
        hidden: 1,
        hold: 1,
        busy: 1,
        currency: 1,
        balance: 1,
      },
      {
        sort: {
          balance: 1,
        },
      }
    );

    const pages = [];
    const now = new Date();
    const pageSize = 15;
    const count = categoryCards.length;
    const pagesCount = Math.ceil(count / pageSize);

    if (count === 0) {
      ctx.answerCbQuery("Карт нет");
      if (ctx.scene.state.id) {
        ctx.scene.enter("manage-card-category", ctx.scene.state);
      } else {
        ctx.scene.enter("card-categories", ctx.scene.state);
      }
      return;
    }

    for (let i = 0; i < pagesCount; i++) {
      const page = [];

      for (let j = i * pageSize; j < (i + 1) * pageSize; j++) {
        const card = categoryCards[j];
        if (!card) {
          continue;
        }
        const check = !card.hidden && card.hold < now && !card.busy;

        let outOfMoney = false;
        switch (card.currency) {
          case "EUR":
            outOfMoney = card.balance <= 6;
            break;
          case "USD":
            outOfMoney = card.balance <= 6;
            break;
          case "UAH":
            outOfMoney = card.balance <= 250;
            break;
        }

        page.push([
          Markup.button.callback(
            `${outOfMoney ? "🟡 " : ""}${
              check ? "🟢" : "🔴"
            } *${card.number.slice(12)} ${card.duration} ${
              card.cvc
            } (${card.balance.toFixed(2)} ${card.currency})`,
            `card:${card._id.toString()}`
          ),
        ]);
      }

      page.push(
        [
          Markup.button.callback("<", "page:back", i === 0),
          Markup.button.callback(
            ">",
            "page:forward",
            !(i + 1 < pagesCount && pagesCount > 1)
          ),
        ],
        [
          Markup.button.callback(
            "⬆️ Переместить все",
            "move-homeless",
            !!ctx.scene.state.id || ctx.scene.state.lowBalance
          ),
        ],
        [Markup.button.callback("Назад", "exit")]
      );

      pages.push(page);
    }

    ctx.scene.state.pages = pages;
    ctx.scene.state.page = 0;

    await ctx.telegram.editMessageText(
      ctx.from.id,
      ctx.scene.state.menu.message_id,
      undefined,
      `<b>Карты в "${escapeHTML(category.title)}"</b>`,
      {
        parse_mode: "HTML",
        reply_markup: Markup.inlineKeyboard(pages[0]).reply_markup,
      }
    );
  } catch (error) {
    console.log(error);
    ctx.answerCbQuery("Что-то пошло не так").catch(() => null);
    ctx.scene.enter("manage-card-category", ctx.scene.state);
  }
};

cardsList.action(/card:[a-z0-9]+/i, (ctx) => {
  try {
    const raw = /:([a-z0-9]+)$/i.exec(ctx.callbackQuery.data);
    if (!raw) return;

    const card = new Types.ObjectId(raw[1]);
    ctx.scene.enter("manage-card", {
      ...ctx.scene.state,
      card,
    });
  } catch {
    null;
  }
});

cardsList.action(/page:(back|forward)/, async (ctx) => {
  try {
    const shift =
      /(back|forward)/.exec(ctx.callbackQuery.data)[1] === "forward" ? 1 : -1;

    ctx.scene.state.page += shift;
    const page = ctx.scene.state.pages[ctx.scene.state.page];

    if (!page) {
      ctx.scene.enter("cards-list", ctx.scene.state);
      return;
    }

    await ctx.telegram.editMessageReplyMarkup(
      ctx.from.id,
      ctx.scene.state.menu.message_id,
      undefined,
      Markup.inlineKeyboard(page).reply_markup
    );
  } catch (error) {
    console.log(error);
  }
});

cardsList.action("move-homeless", async (ctx) => {
  try {
    const categories = await cardsCategories.find();
    if (categories.length === 0) {
      await ctx.answerCbQuery("Некуда перемещать");
      return;
    }

    const keyboard = [];
    for (const category of categories) {
      keyboard.push([
        Markup.button.callback(
          category.title,
          `move-to:${category._id.toString()}`
        ),
      ]);
    }

    keyboard.push([Markup.button.callback("Назад", "cancel")]);

    await ctx.telegram.editMessageText(
      ctx.from.id,
      ctx.scene.state.menu.message_id,
      undefined,
      "Выберите куда переместить карты",
      {
        reply_markup: Markup.inlineKeyboard(keyboard).reply_markup,
      }
    );
  } catch (error) {
    null;
  }
});

cardsList.action(/move-to:[a-z0-9]+/, async (ctx) => {
  try {
    const raw = /:([a-z0-9]+)$/.exec(ctx.callbackQuery.data);
    if (!raw) {
      throw new Error("No data found");
    }

    const category = new Types.ObjectId(raw[1]);
    await cards.updateMany(
      {
        category: {
          $exists: false,
        },
      },
      {
        $set: {
          category,
        },
      }
    );

    ctx.scene.state.id = category;
    ctx.scene.enter("cards-list", ctx.scene.state);
  } catch (error) {
    ctx.scene.enter("cards-list", ctx.scene.state);
  }
});

cardsList.action("cancel", (ctx) =>
  ctx.scene.enter("cards-list", ctx.scene.state)
);

cardsList.action("exit", (ctx) =>
  ctx.scene.enter(
    ctx.scene.state.id ? "manage-card-category" : "card-categories",
    ctx.scene.state
  )
);

cardsList.leaveHandler = (ctx) => {
  ctx.scene.state.lowBalance = undefined;
  ctx.scene.state.pages = [];
  ctx.scene.state.page = undefined;
};

module.exports = cardsList;
