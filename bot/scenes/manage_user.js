const { Scenes, Markup } = require("telegraf");
const orders = require("../../models/orders");
const payments = require("../../models/payments");

const users = require("../../models/users");
const escape = require("escape-html");

const statuses = new Map();
statuses.set("untaken", "ожидает");
statuses.set("processing", "в работе");
statuses.set("done", "выполнен");
statuses.set("refund", "оформлен возврат");
statuses.set("canceled", "отменен");

const platforms = new Map();
platforms.set("pc", "PC / macOS");
platforms.set("ps", "Playstation 4/5");
platforms.set("android", "Android");
platforms.set("nintendo", "Nintendo");
platforms.set("xbox", "XBox");

const manageUser = new Scenes.BaseScene("manage_user");

manageUser.enterHandler = async function (ctx) {
  try {
    const user = await users.findOne(
      {
        telegramID: ctx.from.id,
      },
      "role"
    );

    if (!user) {
      ctx.scene.enter("start", {
        menu: ctx.scene.state.menu,
      });
      return;
    }

    if (user.role !== "admin") {
      ctx.answerCbQuery("У вас нет доступа").catch((_) => null);
      ctx.scene.enter("start", {
        menu: ctx.scene.state.menu,
      });
      return;
    }

    const target = await users.findOne({
      telegramID: ctx.scene.state.user,
    });

    const msg = `Пользователь ${target.telegramID}:${target.username}\n\nБаланс: ${target.balance} р.`;
    let keyboard = [
      [Markup.button.callback("Изменить баланс", "change_balance")],
    ];

    const refills = await payments.find({
      user: target.telegramID,
      status: "paid",
    });

    const ordersList = await orders.find({
      client: target.telegramID,
      paid: true,
    });

    const story = refills.concat(ordersList);

    for (let payment of story.sort((a, b) => (a.date > b.date ? 1 : -1))) {
      const date = new Date(payment.date).toLocaleDateString("ru-RU", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });

      if (payment.itemTitle) {
        keyboard.push([
          Markup.button.callback(
            `-${payment.amount}₽ - ${payment.itemTitle}`,
            `user_order#${payment.orderID}`
          ),
        ]);
      } else {
        keyboard.push([
          Markup.button.callback(
            `+${payment.amount}₽ от ${date}`,
            `user_payment#${payment.paymentID}`
          ),
        ]);
      }
    }
    keyboard.push([Markup.button.callback("Назад", "back")]);

    await ctx.telegram.editMessageText(
      ctx.from.id,
      ctx.scene.state.menu.message_id,
      undefined,
      msg,
      {
        reply_markup: Markup.inlineKeyboard(keyboard).reply_markup,
      }
    );
  } catch (e) {
    null;
    ctx.scene.enter("admin", {
      menu: ctx.scene.state.menu,
    });
  }
};

manageUser.action(/user_payment#\d+/, async (ctx) => {
  try {
    const paymentID = Number(/\d+$/.exec(ctx.callbackQuery.data)[0]);
    const payment = await payments.findOne({
      paymentID,
    });

    if (!payment) throw new Error("Платеж не найден");

    await ctx.telegram.editMessageText(
      ctx.from.id,
      ctx.scene.state.menu.message_id,
      undefined,
      `Платеж <code>${payment.transactionID}</code>\n\nДата: <b>${new Date(
        payment.date
      ).toLocaleString()} по МСК</b>\nСумма: <b>${payment.amount} руб.</b>`,
      {
        parse_mode: "HTML",
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback("Назад", "prev")],
        ]).reply_markup,
      }
    );
  } catch (e) {
    null;
    ctx.scene.enter("admin", {
      menu: ctx.scene.state.menu,
    });
  }
});

manageUser.action(/user_order#\d+/, async (ctx) => {
  try {
    const orderID = Number(/\d+$/.exec(ctx.callbackQuery.data)[0]);
    const order = await orders.findOne({
      orderID,
    });

    if (!order) throw new Error("Заказ не найден");

    const data = order.data.login
      ? `<i>Логин:</i> <code>${escape(
          order.data.login
        )}</code>\n<i>Пароль:</i> <code>${escape(order.data.password)}</code>`
      : "[ДАННЫЕ УДАЛЕНЫ]";

    const client = await users.findOne(
        {
          telegramID: order.client,
        },
        "username"
      ),
      manager = await users.findOne(
        {
          telegramID: order.manager,
        },
        "username"
      );

    let msg = `<b>Заказ</b> <code>${
      order.orderID
    }</code>\n\n<i>Клиент:</i> <a href="tg://user?id=${order.client}">${escape(
      client.username
    )}</a>\n<i>Менеджер:</i> ${
      order.manager !== 0
        ? '<a href="tg://user?id=' +
          order.manager +
          '">' +
          manager.username +
          "</a>"
        : "<b>заказ не в работе</b>"
    }\n<i>Статус</i>: <b>${statuses.get(
      order.status
    )}</b>\n<i>Дата:</i> <b>${new Date(order.date).toLocaleString(
      "ru-RU"
    )}</b>\n\n<i>Товар:</i> <b>${order.itemTitle}</b>\n<i>Цена:</i> <b>${
      order.amount
    }₽</b>\n\n<i>Платформа:</i> <b>${platforms.get(
      order.platform
    )}</b>\n<b>Данные для выполнения заказа:</b>\n${data}`;

    if (order.refundStatus) {
      msg += `\n\n<i>Возврат:</i> <b>${refundStatuses.get(
        order.refundStatus
      )}</b>\nДанные для возврата: <b>${
        order.refundData
          ? order.refundData
          : "пользователь еще не предоставил данные"
      }</b>`;
    }

    await ctx.telegram.editMessageText(
      ctx.from.id,
      ctx.scene.state.menu.message_id,
      undefined,
      msg,
      {
        parse_mode: "HTML",
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback("Назад", "prev")],
        ]).reply_markup,
      }
    );
  } catch (e) {
    null;
    ctx.scene.enter("admin", {
      menu: ctx.scene.state.menu,
    });
  }
});

manageUser.action("back", (ctx) => {
  ctx.scene.enter("get_user_data", {
    menu: ctx.scene.state.menu,
  });
});

manageUser.action("prev", (ctx) => {
  ctx.scene.enter("manage_user", {
    menu: ctx.scene.state.menu,
    user: ctx.scene.state.user,
  });
});

manageUser.action("change_balance", async (ctx) => {
  try {
    await ctx.telegram.editMessageText(
      ctx.from.id,
      ctx.scene.state.menu.message_id,
      undefined,
      "Как изменить баланс? +/-[сумма]\nНапример: +100",
      {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback("Назад", "prev")],
        ]).reply_markup,
      }
    );

    ctx.scene.state.action = "balance";
  } catch (e) {
    null;
    ctx.scene.enter("admin", {
      menu: ctx.scene.state.menu,
    });
  }
});

manageUser.on(
  "message",
  (ctx, next) => {
    ctx.deleteMessage().catch((_) => null);
    if (ctx.scene.state.action) next();
  },
  async (ctx, next) => {
    try {
    } catch (error) {}
  },
  async (ctx) => {
    try {
      const data = /([+-])\s{0,}(\d+)/.exec(ctx.message.text);

      if (!data) return;

      await users.updateOne(
        {
          telegramID: ctx.scene.state.user,
        },
        {
          $inc: {
            balance: Number(data[1] + data[2]),
          },
        }
      );

      ctx.scene.enter("manage_user", {
        menu: ctx.scene.state.menu,
        user: ctx.scene.state.user,
      });
    } catch (e) {
      null;
      ctx.scene.enter("admin", {
        menu: ctx.scene.state.menu,
      });
    }
  }
);

module.exports = manageUser;
