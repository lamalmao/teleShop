const { Scenes, Markup } = require("telegraf");
const cards = require("../../models/cards");
const users = require("../../models/users");
const escapeHTML = require("escape-html");
const cardTransactions = require("../../models/cards-transactions");
const moment = require("moment");
const cardsCategories = require("../../models/cards-categories");
const { Types } = require("mongoose");

const manageCard = new Scenes.BaseScene("manage-card");

manageCard.enterHandler = async (ctx) => {
  try {
    const card = await cards.findById(ctx.scene.state.card);
    if (!card) {
      ctx.answerCbQuery("Карта не найдена").catch(() => null);
      throw new Error("Card not found");
    }

    const now = new Date();
    let message = `Карта <code>${
      card.number
    }</code>\n\n<i>Срок действия</i>: <code>${escapeHTML(
      card.duration
    )}</code>\n<i>CVC:</i> <code>${
      card.cvc
    }</code>\n<i>Владелец карты:</i> <code>${escapeHTML(
      card.cardholder
    )}</code>\n<i>Банк:</i> <code>${escapeHTML(
      card.bank || "-"
    )}</code>\n<i>Холд:</i> <code>${
      card.hold > now
        ? "закончится " + escapeHTML(moment(card.hold).locale("ru").fromNow())
        : "нет"
    }</code>\n\n<b>Баланс:</b> <code>${card.balance} ${card.currency}</code>`;

    if (card.busy) {
      message += "\n<b>В работе</b>";
    }

    const transaction = await cardTransactions.findOne(
      {
        card: card._id,
      },
      {
        amount: 1,
        issuer: 1,
        currency: 1,
        description: 1,
        date: 1,
        orderId: 1,
      },
      {
        sort: {
          date: -1,
        },
      }
    );

    if (transaction) {
      const user = await users.findOne(
        {
          telegramID: transaction.issuer,
        },
        {
          username: 1,
        }
      );

      message += `\n\n<u>Последняя транзакция</u>\n<code>${transaction._id.toString()}</code>\n<i>${
        transaction.amount
      } ${transaction.currency} - ${escapeHTML(
        moment(transaction.date).locale("ru").fromNow()
      )}</i>\n\n<i>Описание: </i> <code>${escapeHTML(
        transaction.description || "-"
      )}</code>\n<i>Пользователь</i>: <a href="tg://user?id=${
        transaction.issuer
      }">${escapeHTML(user.username)}</a>\n<i>Заказ: </i><code>${
        transaction.orderId || "нет"
      }</code>`;
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
            [Markup.button.callback("Транзакции", "transactions")],
            [Markup.button.callback("Изменить номер", "change:number")],
            [
              Markup.button.callback(
                "Изменить срок действия",
                "change:duration"
              ),
            ],
            [Markup.button.callback("Изменить CVC", "change:cvc")],
            [Markup.button.callback("Изменить владельца", "change:cardholder")],
            [Markup.button.callback("Изменить банк", "change:bank")],
            [Markup.button.callback("Изменить баланс", "balance")],
            [Markup.button.callback("Переместить", "move")],
            [
              Markup.button.callback("Скрыть", "hide:true", card.hidden),
              Markup.button.callback("Открыть", "hide:false", !card.hidden),
              Markup.button.callback("Убрать в холд", "hold", card.hold > now),
              Markup.button.callback(
                "Убрать из холда",
                "unhold",
                card.hold < now
              ),
            ],
            [Markup.button.callback("Удалить", "delete")],
            [Markup.button.callback("Назад", "exit")],
          ]).reply_markup,
        }
      )
      .catch(() => null);
  } catch (error) {
    ctx.scene.enter("manage-card-category", ctx.scene.state);
  }
};

// manageCard.on("callback_query", (ctx, next) => {
//   console.log(ctx.callbackQuery.data);
//   next();
// });

manageCard.on(
  "message",
  (ctx, next) => {
    ctx.deleteMessage().catch(() => null);
    if (ctx.scene.state.action) {
      next();
    }
  },
  async (ctx) => {
    try {
      let text = ctx.message.text;
      const action = ctx.scene.state.action;
      let regExpCheck;

      switch (action) {
        case "duration":
          regExpCheck = /((0[1-9]|1[0-2])\/([2-3][0-9]))/;
          break;
        case "number":
          regExpCheck = /(\d{16})/;
          break;
        case "cvc":
          regExpCheck = /^(\d{3})$/;
          break;
        case "cardholder":
          regExpCheck = /^[a-zа-я\.]+ [a-zа-я\.]+$/i;
          text = text.toLowerCase();
          break;
        case "bank":
          regExpCheck = /(.+)/;
          break;
        default:
          throw new Error("Unknown action");
      }

      const raw = regExpCheck.exec(text);
      if (!raw) {
        ctx
          .reply("<b>⚠️ Сообщение не соответствует форме</b>", {
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

      let data = raw[0];
      if (action === "cardholder") {
        data = data.toUpperCase();
      }

      ctx.telegram
        .editMessageText(
          ctx.from.id,
          ctx.scene.state.menuMessage,
          undefined,
          `Установить новое значение: "<code>${escapeHTML(data)}</code>"?`,
          {
            parse_mode: "HTML",
            reply_markup: Markup.inlineKeyboard([
              [Markup.button.callback("Да", `set#${action}:${data}`)],
              [Markup.button.callback("❌ Отмена", "cancel")],
            ]).reply_markup,
          }
        )
        .catch(() => null);
    } catch (error) {
      console.log(error);
      ctx.scene.enter("manage-card", ctx.scene.state);
    }
  }
);

manageCard.action("move", async (ctx) => {
  try {
    const card = await cards.findById(ctx.scene.state.card, {
      category: 1,
    });

    if (!card) {
      throw new Error("No card found");
    }

    const categories = await cardsCategories.find(
      {
        _id: {
          $ne: card.category,
        },
      },
      {
        title: 1,
      }
    );

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
      "Выберите категорию для перемещения",
      {
        reply_markup: Markup.inlineKeyboard(keyboard).reply_markup,
      }
    );
  } catch (error) {
    console.log(error);
  }
});

manageCard.action(/^move-to:[a-z0-9]+$/, async (ctx) => {
  try {
    const raw = /:([a-z0-9]+)$/.exec(ctx.callbackQuery.data);
    if (!raw) {
      throw new Error("No category id");
    }

    const id = new Types.ObjectId(raw[1]);
    await cards.updateOne(
      {
        _id: ctx.scene.state.card,
      },
      {
        $set: {
          category: id,
        },
      }
    );

    ctx.scene.state.id = id;
  } catch (error) {
    console.log(error);
  } finally {
    ctx.scene.enter("manage-card", ctx.scene.state);
  }
});

manageCard.action("balance", (ctx) =>
  ctx.scene.enter("refill-card", ctx.scene.state)
);

manageCard.action(/hide:(true|false)/, async (ctx) => {
  try {
    const hide =
      /(true|false)/.exec(ctx.callbackQuery.data)[1] === "true" ? true : false;

    await cards.findByIdAndUpdate(ctx.scene.state.card, {
      $set: {
        hidden: hide,
      },
    });
  } catch (error) {
    console.log(error);
  } finally {
    ctx.scene.enter("manage-card", ctx.scene.state);
  }
});

manageCard.action("delete", async (ctx) => {
  try {
    await ctx.telegram.editMessageReplyMarkup(
      ctx.from.id,
      ctx.scene.state.menu.message_id,
      undefined,
      Markup.removeKeyboard()
    );

    const menuMessage = await ctx.reply(
      "<b>Вы действительно хотите удалить карту?</b>",
      {
        parse_mode: "HTML",
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback("Да", "proceed-delete")],
          [Markup.button.callback("Нет", "cancel")],
        ]).reply_markup,
      }
    );

    ctx.scene.state.menuMessage = menuMessage.message_id;
  } catch (error) {
    console.log(error);
    ctx.scene.enter("manage-card", ctx.scene.state);
  }
});

manageCard.action("transactions", (ctx) =>
  ctx.scene.enter("card-transactions", ctx.scene.state)
);

manageCard.action("proceed-delete", async (ctx) => {
  try {
    await cards.deleteOne({
      _id: ctx.scene.state.card,
    });
  } catch (error) {
    console.log(error);
  } finally {
    ctx.scene.enter("cards-list", ctx.scene.state);
  }
});

manageCard.action(/^(un)?hold/, async (ctx) => {
  try {
    const hold = !ctx.callbackQuery.data.startsWith("un");
    const now = Date.now();

    await cards.updateOne(
      {
        _id: ctx.scene.state.card,
      },
      {
        $set: {
          hold: hold ? new Date(now + 86400000) : new Date(now - 600000),
        },
      }
    );
  } catch (error) {
    console.log(error);
  } finally {
    ctx.scene.enter("manage-card", ctx.scene.state);
  }
});

manageCard.action(
  /change:(number|cvc|cardholder|bank|duration)/,
  async (ctx) => {
    try {
      const raw = /(number|cvc|cardholder|bank|duration)/.exec(
        ctx.callbackQuery.data
      );
      if (!raw) {
        throw new Error("No data provided");
      }

      let message;
      const action = raw[1];
      const keyboard = [];

      switch (action) {
        case "duration":
          message =
            "Введите новый срок действия карты в формате\n<code>mm&#47;yy</code>";
          break;
        case "number":
          message =
            "Введите новый номер карты в формате\n<code>1111222233334444</code>";
          break;
        case "cvc":
          message = "Введите новый трёхзначный <b>CVC&#47;CVV</b> код";
          break;
        case "bank":
          message = "Укажите новый банк";
          const banks = await cards.distinct("bank");
          if (banks) {
            for (const bank of banks) {
              keyboard.push([Markup.button.callback(bank, `set#bank:${bank}`)]);
            }
          }
          break;
        case "cardholder":
          message = "Укажите нового владельца карты";
          const cardholders = await cards.distinct("cardholder");
          if (cardholders) {
            for (const cardholder of cardholders) {
              keyboard.push([
                Markup.button.callback(
                  cardholder,
                  `set#cardholder:${cardholder}`
                ),
              ]);
            }
          }
          break;
      }

      keyboard.push([Markup.button.callback("❌ Отмена", "cancel")]);
      await ctx.telegram.editMessageReplyMarkup(
        ctx.from.id,
        ctx.scene.state.menu.message_id,
        undefined,
        Markup.removeKeyboard()
      );

      const menuMessage = await ctx.reply(message, {
        parse_mode: "HTML",
        reply_markup: Markup.inlineKeyboard(keyboard).reply_markup,
      });

      ctx.scene.state.menuMessage = menuMessage.message_id;
      ctx.scene.state.action = action;
    } catch (error) {
      console.log(error);
      ctx.scene.enter("manage-card", ctx.scene.state);
    }
  }
);

manageCard.action(
  /set#(number|bank|cvc|cardholder|duration):(.+)/,
  async (ctx) => {
    try {
      const data =
        /set#(?<target>number|bank|cvc|cardholder|duration):(?<value>.+)/.exec(
          ctx.callbackQuery.data
        );

      if (!data) {
        throw new Error("No data");
      }
      const { target, value } = data.groups;

      if (target === "number") {
        const check = await cards.exists({
          number: value,
        });

        if (check) {
          ctx
            .reply(`⚠️ Карта <code>${value}</code> уже существует`, {
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
      }

      await cards.updateOne(
        {
          _id: ctx.scene.state.card,
        },
        {
          $set: {
            [target]: value,
          },
        }
      );
    } catch (error) {
      console.log(error);
    } finally {
      ctx.scene.enter("manage-card", ctx.scene.state);
    }
  }
);

manageCard.leaveHandler = (ctx) => {
  try {
    if (ctx.scene.state.menuMessage) {
      ctx.deleteMessage(ctx.scene.state.menuMessage).catch(() => null);
    }

    ctx.scene.state.action = undefined;
    ctx.scene.state.menuMessage = undefined;
  } catch (error) {
    console.log(error);
  }
};

manageCard.action("cancel", (ctx) =>
  ctx.scene.enter("manage-card", ctx.scene.state)
);

manageCard.action("exit", (ctx) =>
  ctx.scene.enter("cards-list", ctx.scene.state)
);

module.exports = manageCard;
