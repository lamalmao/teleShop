const { Scenes, Markup } = require("telegraf");

const users = require("../../models/users");
const orders = require("../../models/orders");
const messages = require("../messages");
const goods = require("../../models/goods");
const { delivery } = require("../../models/delivery");
const { Types } = require("mongoose");

const acceptPurchase = new Scenes.BaseScene("accept_purchase");

acceptPurchase.enterHandler = async function (ctx) {
  try {
    const orderID = /\d+/.exec(ctx.callbackQuery.data)[0];
    const order = await orders.findOne({
      orderID: orderID,
      paid: false,
    });

    if (order) {
      const user = await users.findOne({
        telegramID: ctx.from.id,
      });

      if (user.balance < order.amount) {
        ctx.answerCbQuery("Недостаточно денег на балансе").catch((_) => null);
        ctx.scene.enter("shop");
      } else {
        user.balance -= order.amount;
        user.purchases++;
        user.onlineUntil = new Date(Date.now() + 15 * 60 * 1000);
        user.save().catch((_) => null);

        order.paid = true;
        order.save().catch((_) => null);

        ctx.scene.state.menu = ctx.callbackQuery.message;

        const item = await goods.findById(order.item, "itemType");

        if (
          item.itemType === "manual" ||
          item.itemType === "manualSkipProceed"
        ) {
          const msg =
            item.itemType === "manual"
              ? messages.buy_success.format(order.orderID)
              : messages.buy_skip_proceed_process.format(order.orderID);

          await ctx.telegram.editMessageCaption(
            ctx.from.id,
            ctx.callbackQuery.message.message_id,
            undefined,
            msg,
            {
              parse_mode: "HTML",
              reply_markup: Markup.inlineKeyboard([
                [Markup.button.callback("Я в сети", "online_alert")],
              ]).reply_markup,
            }
          );
        } else {
          const key = await delivery.findOneAndUpdate(
            {
              item: Types.ObjectId(order.item),
              delivered: false,
              accessable: true,
            },
            {
              $set: {
                delivered: true,
              },
            }
          );

          if (!key) {
            user.balance += order.amount;
            user.purchases--;
            await user.save();

            order.paid = false;
            await order.save();

            await ctx.telegram.editMessageCaption(
              ctx.from.id,
              ctx.callbackQuery.message.message_id,
              undefined,
              "Товар закончился, приносим наши извинения.\n\nСредства были возвращены на ваш баланс"
            );
          } else {
            order.status = "done";
            await order.save();
            await ctx.telegram.editMessageCaption(
              ctx.from.id,
              ctx.callbackQuery.message.message_id,
              undefined,
              `Заказ <code>${order.orderID}</code> <b>${order.itemTitle}</b>\n\nВаш ключ: <code>${key.value}</code>\nЧтобы активировать ключ перейдите на <a href="https://www.epicgames.com/fortnite/ru/redeem/">сайт Epic Games</a>`,
              {
                parse_mode: "HTML",
                disable_web_page_preview: true,
              }
            );
          }
        }

        const curCtx = ctx;
        const title = order.itemTitle;
        if (item.itemType === "auto") {
          delivery.countDocuments(
            {
              item: order.item,
              delivered: false,
              accessable: true,
            },
            (err, count) => {
              if (err) return;

              if (count === 0) {
                curCtx.telegram
                  .sendMessage(
                    global.ownerID,
                    `Ключи для товара ${title} закончились`
                  )
                  .catch((_) => null);
              }
            }
          );
        }

        ctx.scene.enter("start");
      }
    } else {
      ctx
        .answerCbQuery("Такого заказа нет или он уже был оплачен")
        .catch((_) => null);
      ctx.scene.enter("shop");
    }
  } catch (e) {
    console.log(e);
    ctx.answerCbQuery("Что-то пошло не так").catch((_) => null);
    ctx.scene.enter("start", {
      menu: ctx.callbackQuery.message,
    });
  }
};

module.exports = acceptPurchase;
