const { Scenes, Markup } = require("telegraf");
const escape = require("escape-html");

const users = require("../../models/users");
const orders = require("../../models/orders");
const keys = require("../keyboard");

const checkOrders = new Scenes.BaseScene(keys.AdminMenu.buttons.sales);

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

const refundStatuses = new Map();
refundStatuses.set("rejected", "отклонен");
refundStatuses.set("approved", "выполнен");
refundStatuses.set("waiting", "в процессе");

checkOrders.enterHandler = async function (ctx) {
  try {
    ctx.answerCbQuery().catch((_) => null);

    const user = await users.findOne(
      {
        telegramID: ctx.from.id,
      },
      "role"
    );

    if (user.role === "admin") {
      ctx.scene.state.menu = ctx.callbackQuery.message;

      ctx.telegram
        .editMessageText(
          ctx.from.id,
          ctx.callbackQuery.message.message_id,
          undefined,
          "Введите номер заказа, по которому хотите получить информацию",
          {
            reply_markup: keys.BackMenu.keyboard.reply_markup,
          }
        )
        .catch((_) => null);
    } else {
      ctx.telegram
        .deleteMessage(ctx.from.id, ctx.callbackQuery.message.message_id)
        .catch((_) => null);
      ctx.answerCbQuery("У вас нет доступа").catch((_) => null);
      ctx.scene.leave();
    }
  } catch (e) {
    null;
    ctx.scene.enter("admin", {
      menu: ctx.callbackQuery.message,
    });
  }
};

checkOrders.on("message", (ctx, next) => {
  ctx.deleteMessage().catch((_) => null);
  next();
});

checkOrders.hears(/\d+/, async (ctx) => {
  try {
    const order = await orders.findOne({
      orderID: ctx.message.text,
    });

    if (!order) {
      ctx.telegram
        .editMessageText(
          ctx.from.id,
          ctx.scene.state.menu.message_id,
          undefined,
          "Введите номер заказа, по которому хотите получить информацию\n\nЗаказ не найден",
          {
            reply_markup: keys.BackMenu.keyboard.reply_markup,
          }
        )
        .catch((_) => null);
    } else {
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

      //prettier-ignore
      let msg = `<b>Заказ</b> <code>${order.orderID}</code>\n\n<i>Клиент:</i> <a href="tg://user?id=${order.client}">${escape(client.username)}</a>\n<i>Менеджер:</i> ${order.manager !== 0 ? '<a href="tg://user?id=' + order.manager +'">' +manager.username + "</a>" : "<b>заказ не в работе</b>"}\n<i>Статус</i>: <b>${statuses.get(order.status)}</b>\n<i>Дата:</i> <b>${new Date(order.date).toLocaleString("ru-RU")}</b>\n\n<i>Товар:</i> <b>${order.itemTitle}</b>\n<i>Цена:</i> <b>${order.amount}₽</b>\n\n<i>Платформа:</i> <b>${platforms.get(order.platform)}</b>\n<b>Данные для выполнения заказа:</b>\n${data}`;

      if (order.key) {
        msg += `\nКлюч: ${order.key}`;
      }

      if (order.refundStatus) {
        msg += `\n\n<i>Возврат:</i> <b>${refundStatuses.get(
          order.refundStatus
        )}</b>\nДанные для возврата: <b>${
          order.refundData
            ? order.refundData
            : "пользователь еще не предоставил данные"
        }</b>`;
      }

      msg += "\n\n<i>Что выбрать другой заказ введите его <b>id</b></i>";

      ctx.telegram
        .editMessageText(
          ctx.from.id,
          ctx.scene.state.menu.message_id,
          undefined,
          msg,
          {
            reply_markup: keys.BackMenu.keyboard.reply_markup,
            parse_mode: "HTML",
          }
        )
        .catch((_) => null);
    }
  } catch (e) {
    null;
    ctx.scene.enter("admin", {
      menu: ctx.scene.state.menu,
    });
  }
});

checkOrders.action(keys.BackMenu.buttons, (ctx) =>
  ctx.scene.enter("admin", {
    menu: ctx.callbackQuery.message,
  })
);

module.exports = checkOrders;
