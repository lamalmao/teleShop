const { Scenes, Markup } = require("telegraf");
const cards = require("../../models/cards");
const escapeHTML = require("escape-html");

const addCard = new Scenes.WizardScene(
  "add-card",
  async (ctx) => {
    try {
      ctx.wizard.state.menu = ctx.callbackQuery.message;

      const messageData = {
        text: "<b>Введите данные карты в формате</b>\n\n<code>1111222233334444 mm/yy cvc</code>",
        keyboard: Markup.inlineKeyboard([
          [Markup.button.callback("Назад", "exit")],
        ]).reply_markup,
      };

      ctx.wizard.state.messages = new Map([
        [ctx.wizard.cursor.toString(), messageData],
      ]);
      await ctx.editMessageText(messageData.text, {
        parse_mode: "HTML",
        reply_markup: messageData.keyboard,
      });

      ctx.wizard.next();
    } catch (error) {
      console.log(error);
      ctx.reply(error.message).catch(() => null);
    }
  },
  async (ctx) => {
    try {
      if (ctx.updateType !== "message") return;
      ctx.deleteMessage().catch(() => null);

      const data =
        /^(?<number>\d{4}\s{0,}\d{4}\s{0,}\d{4}\s{0,}\d{4})((\s+)|(\s{0,}-\s{0,}))(?<duration>(0[1-9]|1[0-2])\/([2-3][0-9]))((\s+)|(\s{0,}-\s{0,}))(?<cvc>\d{3})$/.exec(
          ctx.message.text
        );
      if (!data) {
        ctx
          .reply(
            "<b>⚠️ Сообщение не соответствует форме</b>\n\n<code>1111222233334444 mm/yy cvc</code>",
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

      const { groups } = data;

      const number = groups.number.replace(/\s+/g, "");
      const check = await cards.exists({
        number: number,
      });

      if (check) {
        ctx
          .reply(`⚠️ Карта <code>${number}</code> уже существует`, {
            parse_mode: "HTML",
          })
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

      ctx.wizard.state.card = {
        ...groups,
        number,
      };

      const banks = await cards.distinct("bank");
      const keys = [];
      if (banks) {
        for (const bank of banks) {
          keys.push([Markup.button.callback(bank, `bank:${bank}`)]);
        }
      }
      keys.push([
        Markup.button.callback("Назад", "back"),
        Markup.button.callback("Отмена", "exit"),
      ]);

      const messageData = {
        text: "<b>Укажите банк</b>",
        keyboard: Markup.inlineKeyboard(keys).reply_markup,
      };

      ctx.wizard.state.messages.set(ctx.wizard.cursor.toString(), messageData);

      await ctx.telegram.editMessageText(
        ctx.from.id,
        ctx.wizard.state.menu.message_id,
        undefined,
        messageData.text,
        {
          parse_mode: "HTML",
          reply_markup: messageData.keyboard,
        }
      );
      ctx.wizard.next();
    } catch (error) {
      console.log(error);
      ctx.reply(error.message).catch(() => null);
    }
  },
  async (ctx) => {
    try {
      let bank;
      if (ctx.updateType === "message") {
        ctx.deleteMessage().catch(() => null);
        bank = ctx.message.text;
      } else if (ctx.updateType === "callback_query") {
        bank = /^bank:(.+)$/.exec(ctx.callbackQuery.data)[1];
      }

      ctx.wizard.state.card.bank = bank;

      const names = await cards.distinct("cardholder");
      const keyboard = [];
      if (names) {
        for (const name of names) {
          keyboard.push([Markup.button.callback(name, `name:${name}`)]);
        }
      }

      keyboard.push([
        Markup.button.callback("Назад", "back"),
        Markup.button.callback("Отмена", "cancel"),
      ]);

      const messageData = {
        text: "<b>Укажите владельца карты в формате</b>\n\n<code>NAME SURNAME</code>",
        keyboard: Markup.inlineKeyboard(keyboard).reply_markup,
      };

      ctx.wizard.state.messages.set(ctx.wizard.cursor.toString(), messageData);

      await ctx.telegram.editMessageText(
        ctx.from.id,
        ctx.wizard.state.menu.message_id,
        undefined,
        messageData.text,
        {
          parse_mode: "HTML",
          reply_markup: messageData.keyboard,
        }
      );

      ctx.wizard.next();
    } catch (error) {
      console.log(error);
      ctx.reply(error.message).catch(() => null);
    }
  },
  async (ctx) => {
    try {
      let name;
      if (
        ctx.updateType === "callback_query" &&
        ctx.callbackQuery.data.startsWith("name")
      ) {
        name = /:([\w\s\.]+)$/i.exec(ctx.callbackQuery.data)[1];
      } else if (ctx.updateType === "message") {
        ctx.deleteMessage().catch(() => null);

        const raw = /^[a-zа-я\.]+ [a-zа-я\.]+$/i.exec(
          ctx.message.text.toLowerCase()
        );

        if (!raw) {
          ctx
            .reply(
              "<b>⚠️ Сообщение не соответствует форме</b>\n\n<code>NAME SURNAME</code>",
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

        name = raw[0].toUpperCase();
      } else {
        return;
      }

      ctx.wizard.state.card.cardholder = name;

      const messageData = {
        text: "<b>Укажите валюту карты</b>",
        keyboard: Markup.inlineKeyboard([
          [
            Markup.button.callback("UAH", "UAH"),
            Markup.button.callback("USD", "USD"),
            Markup.button.callback("EUR", "EUR"),
          ],
          [
            Markup.button.callback("Назад", "back"),
            Markup.button.callback("Отмена", "exit"),
          ],
        ]).reply_markup,
      };

      ctx.wizard.state.messages.set(ctx.wizard.cursor.toString(), messageData);

      await ctx.telegram.editMessageText(
        ctx.from.id,
        ctx.wizard.state.menu.message_id,
        undefined,
        messageData.text,
        {
          parse_mode: "HTML",
          reply_markup: messageData.keyboard,
        }
      );

      ctx.wizard.next();
    } catch (error) {
      console.log(error);
      ctx.reply(error.message).catch(() => null);
    }
  },
  async (ctx) => {
    try {
      if (ctx.updateType !== "callback_query") return;

      const currency = ctx.callbackQuery.data;
      if (!["USD", "EUR", "UAH"].includes(currency)) {
        ctx.answerCbQuery("Укажите валюту").catch(() => null);
        return;
      }

      ctx.wizard.state.card.currency = currency;
      ctx.wizard.state.card.balance = 0;

      const messageData = {
        text: "<b>Укажите баланс карты</b>",
        keyboard: Markup.inlineKeyboard([
          [Markup.button.callback("Нулевой баланс", "next")],
          [
            Markup.button.callback("Назад", "back"),
            Markup.button.callback("Отмена", "exit"),
          ],
        ]).reply_markup,
      };

      ctx.wizard.state.messages.set(ctx.wizard.cursor.toString(), messageData);

      await ctx.telegram.editMessageText(
        ctx.from.id,
        ctx.wizard.state.menu.message_id,
        undefined,
        messageData.text,
        {
          parse_mode: "HTML",
          reply_markup: messageData.keyboard,
        }
      );

      ctx.wizard.next();
    } catch (error) {
      console.log(error);
      ctx.reply(error.message).catch(() => null);
    }
  },
  async (ctx) => {
    try {
      if (ctx.updateType === "message") {
        ctx.deleteMessage().catch(() => null);
        const balance = Number(ctx.message.text);
        if (Number.isNaN(balance) || balance < 0) {
          ctx
            .reply("<b>⚠️ Укажите положительно число или ноль</b>", {
              parse_mode: "HTML",
            })
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

        ctx.wizard.state.card.balance = balance;
      } else if (
        ctx.updateType !== "callback_query" ||
        ctx.callbackQuery.data !== "next"
      ) {
        return;
      }

      // prettier-ignore
      const {card} = ctx.wizard.state;

      await ctx.telegram.editMessageText(
        ctx.from.id,
        ctx.wizard.state.menu.message_id,
        undefined,
        `<b>Сохранение карты</b>\n\n<i>Номер: </i> <code>${
          card.number
        }</code>\n<i>Срок действия: </i> <code>${escapeHTML(
          card.duration
        )}</code>\n<i>CVC: </i> <code>${
          card.cvc
        }</code>\n<i>Держатель карты: </i> <code>${
          card.cardholder
        }</code>\n<i>Начальный баланс: </i> <code>${card.balance} ${
          card.currency
        }</code>`,
        {
          parse_mode: "HTML",
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback("Сохранить", "save-card")],
            [
              Markup.button.callback("Назад", "back"),
              Markup.button.callback("Отмена", "exit"),
            ],
          ]).reply_markup,
        }
      );
    } catch (error) {
      console.log(error);
      ctx.reply(error.message).catch(() => null);
    }
  }
);

addCard.action("back", async (ctx) => {
  try {
    const message = ctx.wizard.state.messages.get(
      (ctx.wizard.cursor - 2).toString()
    );
    if (!message) return;

    await ctx.telegram.editMessageText(
      ctx.from.id,
      ctx.wizard.state.menu.message_id,
      undefined,
      message.text,
      {
        parse_mode: "HTML",
        reply_markup: message.keyboard,
      }
    );

    ctx.wizard.back();
  } catch (error) {
    console.log(error);
    ctx.answerCbQuery("Что-то пошло не так").catch(() => null);
  }
});

addCard.action("exit", (ctx) =>
  ctx.scene.enter("manage-card-category", ctx.scene.state)
);

addCard.action("save-card", async (ctx) => {
  try {
    const card = await cards.create({
      ...ctx.wizard.state.card,
      category: ctx.scene.state.id,
      balance: 0,
    });

    if (!card) {
      throw new Error("Failed card creation");
    }

    if (ctx.wizard.state.card.balance > 0) {
      await card.createTransaction(card._id, {
        amount: ctx.wizard.state.card.balance,
        currency: card.currency,
        issuer: ctx.from.id,
        sendToHold: false,
        description: "Начальный баланс",
        busy: false,
        cardBalance: 0,
      });
    }

    ctx.scene.state.card = card._id;

    ctx.scene.enter("manage-card", ctx.scene.state);
  } catch (error) {
    console.log(error);
    ctx
      .reply("Что-то пошло не так во время сохранения карты")
      .catch(() => null);
    ctx.scene.enter("manage-card-category", ctx.scene.state);
  }
});

module.exports = addCard;
