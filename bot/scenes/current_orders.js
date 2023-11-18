const { Scenes, Markup, Context } = require("telegraf");

const users = require("../../models/users");
const orders = require("../../models/orders");
const keys = require("../keyboard");
const messages = require("../messages");

const currentOrders = new Scenes.BaseScene("current_orders");

currentOrders.enterHandler = async function (ctx) {
  try {
    const user = await users.findOne(
      {
        telegramID: ctx.from.id,
      },
      "_id role"
    );

    if (user.role === "admin" || user.role === "manager") {
      const activeOrders = await orders.find(
        {
          manager: ctx.from.id,
          status: "processing",
        },
        "orderID itemTitle"
      );

      let keyboard = [[Markup.button.callback("Назад", "manager_menu")]];

      for (let order of activeOrders) {
        keyboard.push([
          Markup.button.callback(
            `${order.orderID}: "${order.itemTitle}"`,
            `manager_take#${order.orderID}`
          ),
        ]);
      }

      await ctx.telegram.editMessageText(
        ctx.from.id,
        ctx.callbackQuery.message.message_id,
        undefined,
        "Ваши активные заказы",
        {
          reply_markup: Markup.inlineKeyboard(keyboard).reply_markup,
        }
      );
    } else {
      ctx.deleteMessage().catch((_) => null);
      ctx.answerCbQuery("У вас нет доступа").catch((_) => null);
    }
  } catch (e) {
    null;
  } finally {
    ctx.scene.leave();
  }
};

module.exports = currentOrders;
