const { Scenes, Markup } = require("telegraf");

const keys = require("../keyboard");
const orders = require("../../models/orders");
const users = require("../../models/users");

const catchOrder = new Scenes.BaseScene("catch_order");

catchOrder.enterHandler = async function (ctx) {
  try {
    const user = await users.findOne(
      {
        telegramID: ctx.from.id,
      },
      "role"
    );

    if (user.role === "client") {
      ctx.reply("У вас нет доступа");
      ctx.scene.leave();
      return;
    }

    ctx.scene.state.menu = ctx.callbackQuery.message;

    await ctx.telegram.editMessageText(
      ctx.from.id,
      ctx.callbackQuery.message.message_id,
      undefined,
      "Ввведите номер заказа",
      {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback("Назад", "manager_menu")],
        ]).reply_markup,
      }
    );
  } catch (e) {
    console.log(e);
    ctx.scene.enter("start");
  }
};

catchOrder.on("message", (ctx, next) => {
  ctx.deleteMessage().catch((_) => null);
  next();
});

catchOrder.hears(/\d+/, async (ctx) => {
  try {
    const order = await orders.findOne({
      orderID: Number(ctx.message.text),
    });

    if (order) {
      ctx.scene.state.orderID = order.orderID;
      await ctx.telegram.editMessageText(
        ctx.from.id,
        ctx.scene.state.menu.message_id,
        undefined,
        "Заказ найден",
        {
          reply_markup: Markup.inlineKeyboard([
            [
              Markup.button.callback(
                `${order.orderID}: ${order.itemTitle}`,
                "intercept"
              ),
            ],
            [Markup.button.callback("Назад", "manager_menu")],
          ]).reply_markup,
        }
      );
    } else {
      const curCtx = ctx;
      ctx
        .reply("Заказ не найден")
        .then((msg) => {
          setTimeout(function () {
            curCtx.telegram
              .deleteMessage(curCtx.from.id, msg.message_id)
              .catch((_) => null);
          }, 2000);
        })
        .catch((_) => null);
    }
  } catch (e) {
    console.log(e);
    ctx.scene.enter("start");
  }
});

catchOrder.action("intercept", async (ctx) => {
  try {
    ctx.scene.enter("take_order", {
      orderID: ctx.scene.state.orderID,
      interception: true,
    });
  } catch (e) {
    console.log(e);
    ctx.scene.enter("start");
  }
});

module.exports = catchOrder;
