const { Scenes, Markup } = require("telegraf");
const cards = require("../../models/cards");
const cardTransactions = require("../../models/cards-transactions");
const escapeHTML = require("escape-html");
const moment = require("moment");
const users = require("../../models/users");
const { Types } = require("mongoose");
const { stringify } = require("csv-stringify");

const cardTransactionsScene = new Scenes.BaseScene("card-transactions");

cardTransactionsScene.enterHandler = async (ctx) => {
  try {
    const card = await cards.findById(ctx.scene.state.card, {
      number: 1,
    });

    if (!card) {
      throw new Error("Card not found");
    }

    const transactions = await cardTransactions.find(
      {
        card,
      },
      {
        amount: 1,
        card: 1,
        date: 1,
        currency: 1,
        description: 1,
        issuer: 1,
        orderId: 1,
        success: 1,
        balanceAfter: 1,
      },
      {
        sort: {
          date: -1,
        },
      }
    );

    ctx.scene.state.transactions = transactions;
    ctx.scene.state.number = card.number;
    let message = `<b>Транзакции карты <code>${card.number}</code></b>\n<i>Введите номер транзакции, чтобы узнать подробности</i>\n\n`;

    let i = 1;
    for (const transaction of transactions) {
      message = message.concat(
        `<b>${i}.</b> <i>${escapeHTML(
          moment(transaction.date)
            .locale("ru")
            .format("DD.MM.YYYY [в] HH:mm:ss")
        )}</i> | <code>${transaction.amount > 0 ? "+" : ""}${
          transaction.amount
        } ${transaction.currency}</code> | <code>${
          transaction.success ? "✔️" : "❌"
        }</code>\n`
      );
      i += 1;
    }

    ctx.telegram
      .editMessageText(
        ctx.from.id,
        ctx.scene.state.menu.message_id,
        undefined,
        message,
        {
          parse_mode: "HTML",
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback("Выгрузить файлом", "download")],
            [Markup.button.callback("Удалить все", "delete-all")],
            [Markup.button.callback("Назад", "exit")],
          ]).reply_markup,
        }
      )
      .catch(() => null);
  } catch (error) {
    console.log(error);
    ctx.scene.enter("manage-card", ctx.scene.state);
  }
};

cardTransactionsScene.action("exit", (ctx) =>
  ctx.scene.enter("manage-card", ctx.scene.state)
);

cardTransactionsScene.action("delete-all", async (ctx) => {
  try {
    await ctx.editMessageText(
      "Вы уверены, что хотите удалить все транзакции карты?",
      {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback("Да", "delete")],
          [Markup.button.callback("Нет", "cancel")],
        ]).reply_markup,
      }
    );
  } catch {
    null;
  }
});

cardTransactionsScene.action("delete", async (ctx) => {
  try {
    await cardTransactions.deleteMany({
      card: ctx.scene.state.card,
    });
  } catch (error) {
    console.log(error);
  } finally {
    ctx.scene.enter("card-transactions", ctx.scene.state);
  }
});

cardTransactionsScene.action("cancel", (ctx) =>
  ctx.scene.enter("card-transactions", ctx.scene.state)
);

cardTransactionsScene.action("download", async (ctx) => {
  try {
    const transactions = ctx.scene.state.transactions;
    const managers = new Map();

    for (const transaction of transactions) {
      if (!managers.has(transaction.issuer)) {
        const manager = await users.findOne(
          {
            telegramID: transaction.issuer,
          },
          {
            username: 1,
          }
        );

        if (manager) managers.set(transaction.issuer, manager.username);
      }
    }

    const writer = stringify({
      columns: [
        "ID",
        "Время",
        "Пользователь",
        "Заказ",
        "Описание",
        "Результат",
        "Сумма транзакции",
        "Баланс карты после",
      ],
      header: true,
    });

    const data = [];
    writer.on("data", (chunk) => {
      data.push(Buffer.from(chunk));
    });
    writer.on("end", () => {
      const result = Buffer.concat(data);
      ctx
        .replyWithDocument(
          {
            filename: `${ctx.scene.state.number}.csv`,
            source: result,
          },
          {
            caption: `Транзакции карты ${ctx.scene.state.number}`,
          }
        )
        .catch(() => null);
    });

    for (const transaction of transactions) {
      writer.write([
        transaction._id.toString(),
        moment(transaction.date).locale("ru").format("DD-MM-YYYY [в] HH:mm:ss"),
        managers.get(transaction.issuer),
        transaction.order ? transaction.order.toString() : "",
        transaction.description,
        transaction.success ? "завершена" : "не завершена",
        `${transaction.amount} ${transaction.currency}`,
        transaction.balanceAfter ? transaction.balanceAfter.toString() : "",
      ]);
    }

    writer.end();
  } catch (error) {
    console.log(error);
    ctx.scene.enter("card-transactions", ctx.scene.state);
  }
});

cardTransactionsScene.on(
  "message",
  (ctx, next) => {
    ctx.deleteMessage().catch(() => null);
    next();
  },
  async (ctx) => {
    try {
      const transactionNumber = Number(ctx.message.text);
      if (
        Number.isNaN(transactionNumber) ||
        transactionNumber <= 0 ||
        transactionNumber > ctx.scene.state.transactions.length
      ) {
        return;
      }

      const transaction = ctx.scene.state.transactions[transactionNumber - 1];
      if (!ctx.scene.state.menuMessage) {
        const menuMessage = await ctx.reply("Заказ");
        ctx.scene.state.menuMessage = menuMessage.message_id;
      }

      const issuer = await users.findOne(
        {
          telegramID: transaction.issuer,
        },
        {
          username: 1,
        }
      );

      ctx.telegram
        .editMessageText(
          ctx.from.id,
          ctx.scene.state.menuMessage,
          undefined,
          `<b>${
            transaction.success ? "Выполненная" : "Неудачная"
          } транзакция ID</b> <code>${transaction._id.toString()}</code>\n\n<i>Дата:</i> <code>${escapeHTML(
            moment(transaction.date)
              .locale("ru")
              .format("DD.MM.YYYY [в] HH:mm:ss")
          )}</code>\n<i>Сумма:</i> <code>${transaction.amount > 0 ? "+" : ""}${
            transaction.amount
          } ${
            transaction.currency
          }</code>\n<i>Баланс после транзакции:</i> <code>${
            transaction.balanceAfter
          } ${
            transaction.currency
          }</code>\n<i>Пользователь:</i> <a href="tg://user?id=${
            transaction.issuer
          }">${escapeHTML(issuer.username)}</a>\n<i>Заказ:</i> <code>${
            transaction.orderId || "-"
          }</code>\n<i>Описание:</i> <code>${escapeHTML(
            transaction.description || "-"
          )}</code>`,
          {
            parse_mode: "HTML",
            reply_markup: Markup.inlineKeyboard([
              [
                Markup.button.callback(
                  "Удалить",
                  `delete-transaction:${transaction._id.toString()}`
                ),
              ],
            ]).reply_markup,
          }
        )
        .catch(() => null);
    } catch (error) {
      console.log(error);
    }
  }
);

cardTransactionsScene.action(/delete-transaction:[a-z0-9]+/, async (ctx) => {
  try {
    const raw = /:([a-z0-9]+)$/.exec(ctx.callbackQuery.data);
    if (!raw) {
      throw new Error("No data found");
    }

    await ctx.editMessageText("Вы точно хотите удалить транзакцию?", {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback("Да", `proceed-delete:${raw[1]}`)],
        [Markup.button.callback("Нет", "cancel")],
      ]).reply_markup,
    });
  } catch (error) {
    console.log(error);
  }
});

cardTransactionsScene.action(/proceed-delete:[a-z0-9]+/, async (ctx) => {
  try {
    const raw = /:([a-z0-9]+)$/.exec(ctx.callbackQuery.data);
    if (!raw) {
      throw new Error("No data found");
    }

    await cardTransactions.deleteOne({
      _id: new Types.ObjectId(raw[1]),
    });
  } catch (error) {
    console.log(error);
  } finally {
    ctx.scene.enter("card-transactions", ctx.scene.state);
  }
});

cardTransactionsScene.leaveHandler = (ctx) => {
  if (ctx.scene.state.menuMessage) {
    ctx.telegram
      .deleteMessage(ctx.from.id, ctx.scene.state.menuMessage)
      .catch(() => null);
  }

  ctx.scene.state.menuMessage = undefined;
  ctx.scene.state.transactions = undefined;
};

module.exports = cardTransactionsScene;
