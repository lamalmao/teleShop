const { Scenes, Markup } = require("telegraf");
const { Types } = require("mongoose");
const crypto = require("crypto");

const goods = require("../../models/goods");
const users = require("../../models/users");
const orders = require("../../models/orders");

const buy = new Scenes.BaseScene("buy");

buy.enterHandler = async function (ctx) {
  try {
    if (global.suspend) {
      ctx
        .reply("Продажи временно приостановлены, попробуйте позже")
        .then((msg) => {
          setTimeout(() => {
            ctx.telegram
              .deleteMessage(ctx.from.id, msg.message_id)
              .catch((_) => null);
          }, 1500);
        })
        .catch((_) => null);
      ctx.scene.leave();
      return;
    }

    const itemID = /\w+$/.exec(ctx.callbackQuery.data)[0];

    const item = await goods.findOne({
      _id: Types.ObjectId(itemID),
    });

    if (item.hidden || item.suspended) {
      ctx.reply("На данный момент товар недоступен").catch((_) => null);
      ctx.scene.enter(`shop`);
      return;
    } else {
      const user = await users.findOne(
        {
          telegramID: ctx.from.id,
        },
        "_id balance"
      );

      const dif = (user.balance - item.getPrice()).toFixed(2);
      if (dif < 0) {
        await ctx.telegram.editMessageCaption(
          ctx.from.id,
          ctx.callbackQuery.message.message_id,
          undefined,
          `На вашем счету не хватает <b>${Math.abs(dif)} ₽</b> для покупки "${
            item.title
          }"`,
          {
            reply_markup: Markup.inlineKeyboard([
              [
                Markup.button.callback(
                  "Пополнить баланс",
                  `ref#${Math.abs(dif)}`
                ),
              ],
              [Markup.button.callback("Назад", `item#${itemID}`)],
            ]).reply_markup,
            parse_mode: "HTML",
          }
        );
      } else {
        let button;
        if (item.itemType === "manual") {
          if (item.game === "fortnite") {
            button = "proceed#";
          } else if (item.game === "brawlstars") {
            button = "supercell_proceed#";
          } else if (item.game === "genshin") {
            button = "genshin_proceed#";
          } else {
            button = "proceed#";
          }
          // button = (item.game === 'fortnite' ? 'proceed#' : 'supercell_proceed#') + item._id;

          button += item._id;
        } else {
          const orderID = await genUniqueID();
          await orders.create({
            orderID,
            client: ctx.from.id,
            item: item._id,
            itemTitle: item.title,
            amount: item.getPrice(),
            game: item.game,
          });

          button = "accept#" + orderID;
        }

        await ctx.telegram.editMessageCaption(
          ctx.from.id,
          ctx.callbackQuery.message.message_id,
          undefined,
          `Вы хотите приобрести <b>${
            item.title
          }</b> за <b>${item.getPrice()}</b> ₽, верно?`,
          {
            parse_mode: "HTML",
            reply_markup: Markup.inlineKeyboard([
              [Markup.button.callback("Да", button)],
              [Markup.button.callback("Нет", `item#${itemID}`)],
            ]).reply_markup,
          }
        );
      }
      ctx.scene.leave();
    }
  } catch (e) {
    null;
    ctx.answerCbQuery("Что-то пошло не так").catch((_) => null);
    ctx.scene.enter("shop");
  }
};

async function genUniqueID() {
  const id = crypto.randomInt(100000, 999999);
  const check = await orders.findOne(
    {
      orderID: id,
    },
    "_id"
  );

  if (check) return await genUniqueID();
  else return id;
}

module.exports = buy;
