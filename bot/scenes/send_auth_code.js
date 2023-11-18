const { Scenes, Markup } = require("telegraf");

const orders = require("../../models/orders");

const sendCode = new Scenes.BaseScene("send_auth_code");

sendCode.enterHandler = async function (ctx) {
  try {
    const orderID = Number(/\d+/.exec(ctx.callbackQuery.data)[0]);
    const order = await orders.findOne({
      orderID,
      paid: true,
      status: {
        $ne: "done",
      },
    });

    if (!order) {
      ctx.telegram
        .editMessageText(
          ctx.from.id,
          ctx.callbackQuery.message.message_id,
          undefined,
          "Более не актуально"
        )
        .catch((_) => null);
      ctx.scene.leave();
      return;
    }

    await ctx.telegram.editMessageText(
      ctx.from.id,
      ctx.callbackQuery.message.message_id,
      undefined,
      "Введите полученный код"
    );
    ctx.scene.state.waitingForCode = true;
    ctx.scene.state.order = order;
    ctx.scene.state.menu = ctx.callbackQuery.message;
  } catch (e) {
    null;
    ctx.telegram
      .deleteMessage(ctx.from.id, ctx.callbackQuery.message.message_id)
      .catch((_) => null);
    ctx
      .reply(ctx.callbackQuery.message.text, {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback("Далее", ctx.callbackQuery.data)],
        ]).reply_markup,
      })
      .catch((_) => null);
    ctx.scene.leave();
  }
};

sendCode.on("message", (ctx, next) => {
  ctx.deleteMessage().catch((_) => null);
  next();
});

sendCode.hears(
  /\w+/,
  (ctx, next) => {
    if (ctx.scene.state.waitingForCode) next();
  },
  async (ctx) => {
    try {
      await ctx.telegram.sendMessage(
        ctx.scene.state.order.manager,
        `Заказ <b>${ctx.scene.state.order.orderID} ${ctx.scene.state.order.itemTitle}</b>\nПользователь отправил код: <code>${ctx.message.text}</code>`,
        {
          parse_mode: "HTML",
        }
      );

      await ctx.telegram.editMessageText(
        ctx.from.id,
        ctx.scene.state.menu.message_id,
        undefined,
        "Спасибо! Код был отправлен менеджеру, ожидайте оповещение о выполенение заказа."
      );
      ctx.scene.leave();
    } catch (e) {
      null;
      ctx.scene.leave();
    }
  }
);

module.exports = sendCode;
