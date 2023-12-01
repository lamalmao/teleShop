const { Scenes, Markup } = require("telegraf");
const cards = require("../../models/cards");
const escapeHTML = require("escape-html");

const refillCard = new Scenes.BaseScene("refill-card");

refillCard.enterHandler = async (ctx) => {
  try {
    const card = await cards.findById(ctx.scene.state.card, {
      number: 1,
      currency: 1,
    });

    if (!card) {
      throw new Error("Card not found");
    }

    ctx.scene.state.currency = card.currency;
    ctx.scene.state.action = "amount";

    await ctx.telegram.editMessageText(
      ctx.from.id,
      ctx.scene.state.menu.message_id,
      undefined,
      `Карта <code>${card.number}</code>\n\nВведите сумму пополнения (можно отрицательную для списания) в <b>${card.currency}</b>`,
      {
        parse_mode: "HTML",
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback("Назад", "exit")],
        ]).reply_markup,
      }
    );
  } catch (error) {
    console.log(error);
    ctx.scene.enter("manage-card", ctx.scene.state);
  }
};

refillCard.on(
  "message",
  (ctx, next) => {
    ctx.deleteMessage().catch(() => null);
    if (["amount", "description"].includes(ctx.scene.state.action)) {
      next();
    }
  },
  async (ctx, next) => {
    try {
      if (ctx.scene.state.action !== "amount") {
        next();
        return;
      }

      const amount = Number(ctx.message.text);
      if (Number.isNaN(amount) || amount === 0) {
        ctx
          .reply(
            "<b>⚠️ Введенное значение не является числом или равно 0</b>",
            {
              parse_mode: "HTML",
            }
          )
          .catch(() => null)
          .then((msg) =>
            setTimeout(
              () =>
                ctx.telegram
                  .deleteMessage(ctx.from.id, msg.message_id)
                  .catch(() => null),
              2500
            )
          );
        return;
      }

      ctx.scene.state.amount = amount;
      ctx.scene.state.action = "description";

      const autoDescription =
        amount > 0 ? "Ручное пополнение" : "Ручное списание";

      await ctx.telegram.editMessageText(
        ctx.from.id,
        ctx.scene.state.menu.message_id,
        undefined,
        "Выберите описание транзакции или введите свое",
        {
          reply_markup: Markup.inlineKeyboard([
            [
              Markup.button.callback(
                autoDescription,
                `description:${autoDescription}`
              ),
            ],
            [Markup.button.callback("Назад", "cancel")],
          ]).reply_markup,
        }
      );
    } catch (error) {
      console.log(error);
    }
  },
  async (ctx) => {
    try {
      if (ctx.scene.state.action !== "description") {
        return;
      }

      const description = ctx.message.text;
      ctx.scene.state.description = description;

      await ctx.telegram.editMessageText(
        ctx.from.id,
        ctx.scene.state.menu.message_id,
        undefined,
        `<b>Создать транзакцию?</b>\n\n<i>Сумма:</i> <code>${
          ctx.scene.state.amount
        } ${
          ctx.scene.state.currency
        }</code>\n<i>Описание</i> <code>${escapeHTML(description)}</code>`,
        {
          parse_mode: "HTML",
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback("Сохранить", "save")],
            [Markup.button.callback("Отмена", "cancel")],
          ]).reply_markup,
        }
      );
    } catch (error) {
      console.log(error);
    }
  }
);

refillCard.action(/description:.+/, async (ctx) => {
  try {
    if (ctx.scene.state.action !== "description") {
      return;
    }

    const description = /:(.+)$/.exec(ctx.callbackQuery.data)[1];
    ctx.scene.state.description = description;

    await ctx.telegram.editMessageText(
      ctx.from.id,
      ctx.scene.state.menu.message_id,
      undefined,
      `<b>Создать транзакцию?</b>\n\n<i>Сумма:</i> <code>${
        ctx.scene.state.amount
      } ${ctx.scene.state.currency}</code>\n<i>Описание</i> <code>${escapeHTML(
        description
      )}</code>`,
      {
        parse_mode: "HTML",
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback("Сохранить", "save")],
          [Markup.button.callback("Отмена", "cancel")],
        ]).reply_markup,
      }
    );
  } catch (error) {
    console.log(error);
  }
});

refillCard.action("save", async (ctx) => {
  try {
    if (ctx.scene.state.action !== "description") {
      return;
    }

    const card = await cards.findById(ctx.scene.state.card);

    await card.createTransaction(ctx.scene.state.card, {
      amount: ctx.scene.state.amount,
      currency: ctx.scene.state.currency,
      issuer: ctx.from.id,
      description: ctx.scene.state.description,
      sendToHold: false,
      busy: false,
      cardBalance: card.balance,
    });
  } catch (error) {
    console.log(error);
  } finally {
    ctx.scene.enter("manage-card", ctx.scene.state);
  }
});

refillCard.action("cancel", (ctx) =>
  ctx.scene.enter("refill-card", ctx.scene.state)
);

refillCard.action("exit", (ctx) =>
  ctx.scene.enter("manage-card", ctx.scene.state)
);

refillCard.leaveHandler = (ctx) => {
  ctx.scene.state.action = undefined;
  ctx.scene.state.amount = undefined;
  ctx.scene.state.description = undefined;
  ctx.scene.state.currency = undefined;
};

module.exports = refillCard;
