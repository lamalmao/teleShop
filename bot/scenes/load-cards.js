const { Scenes, Markup } = require("telegraf");
const cardsCategories = require("../../models/cards-categories");
const axios = require("axios");
const { parse } = require("csv-parse/sync");
const cards = require("../../models/cards");
// const { parse } = require("csv-parser/sync");

const loadCards = new Scenes.BaseScene("load-cards");

loadCards.enterHandler = async (ctx) => {
  try {
    const category = await cardsCategories.findById(ctx.scene.state.id);
    if (!category) {
      throw new Error("Category not found");
    }

    await ctx.telegram.editMessageText(
      ctx.from.id,
      ctx.scene.state.menu.message_id,
      undefined,
      "Отправьте <b>.csv</b> файл с картами",
      {
        parse_mode: "HTML",
        reply_markup: Markup.inlineKeyboard([
          [
            Markup.button.url(
              "Пример",
              "https://docs.google.com/spreadsheets/d/1mB_cg6JLeH2FAiD1D-AxzB-E-F2HOJBpwxsyQazDgXQ/edit?usp=sharing"
            ),
            Markup.button.callback("Назад", "exit"),
          ],
        ]).reply_markup,
      }
    );
  } catch (error) {
    console.log(error);
    ctx.scene.enter("manage-card-category", ctx.scene.state);
  }
};

loadCards.on(
  "document",
  (ctx, next) => {
    ctx.deleteMessage().catch(() => null);
    if (ctx.message.document.mime_type === "text/csv") {
      next();
    }
  },
  async (ctx) => {
    try {
      await ctx.telegram.editMessageText(
        ctx.from.id,
        ctx.scene.state.menu.message_id,
        undefined,
        "Загружаю..."
      );
      ctx.sendChatAction("upload_document").catch(() => null);
      const link = await ctx.telegram.getFileLink(ctx.message.document.file_id);

      const res = await axios({
        method: "get",
        url: link,
        responseType: "text",
      });
      const file = await res.data;

      const parsedCards = parse(file, {
        columns: true,
        skip_empty_lines: true,
      });

      const tasks = [];
      for (const parsedCard of parsedCards) {
        tasks.push(
          new Promise(async (resolve, reject) => {
            try {
              const balance = Number(parsedCard.balance);

              const card = await cards.create({
                ...parsedCard,
                category: ctx.scene.state.id,
                cardholder: parsedCard.cardholder.toUpperCase(),
                balance: Number.isNaN(balance) ? 0 : balance,
              });

              if (!Number.isNaN(balance)) {
                await card.createTransaction(card._id, {
                  amount: balance,
                  currency: card.currency,
                  issuer: ctx.from.id,
                  description: "Начальный баланс",
                  busy: false,
                  sendToHold: false,
                  cardBalance: 0,
                });
              }

              resolve(card._id);
            } catch (error) {
              reject(error);
            }
          })
        );
      }

      const results = await Promise.allSettled(tasks);
      let count = 0;
      for (const result of results) {
        if (result.status === "fulfilled") {
          count += 1;
        }
      }

      const instance = ctx;
      ctx
        .reply(`Успешно добавлено ${count} карт(ы)`)
        .then((msg) =>
          setTimeout(
            () =>
              instance.telegram
                .deleteMessage(instance.from.id, msg.message_id)
                .catch(() => null),
            5000
          )
        )
        .catch(() => null);
    } catch (error) {
      console.log(error);
    } finally {
      ctx.scene.enter("manage-card-category", ctx.scene.state);
    }
  }
);

loadCards.action("exit", (ctx) =>
  ctx.scene.enter("manage-card-category", ctx.scene.state)
);

module.exports = loadCards;
