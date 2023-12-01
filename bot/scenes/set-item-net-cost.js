const { Scenes, Markup } = require("telegraf");
const goods = require("../../models/goods");
const escapeHTML = require("escape-html");

const setItemNetCost = new Scenes.BaseScene("set-item-net-cost");

setItemNetCost.enterHandler = async (ctx) => {
  try {
    const item = await goods.findById(ctx.scene.state.itemId);
    if (!item) {
      throw new Error("Item not found");
    }

    await ctx.telegram.editMessageCaption(
      ctx.from.id,
      ctx.scene.state.menu.message_id,
      undefined,
      `<b>Установка себестоимости для <code>"${escapeHTML(
        item.title
      )}"</code></b>\n\nПеречислите через пробел себестоимость товара в таком порядке:\n<i>UAH USD EUR</i>\n\nДля разделителя в дробных числах используйте точку`,
      {
        parse_mode: "HTML",
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback("Назад", "exit")],
        ]).reply_markup,
      }
    );
  } catch (error) {
    console.log(error);
    ctx.scene.enter("manageItem", ctx.scene.state);
  }
};

setItemNetCost.on(
  "message",
  (ctx, next) => {
    ctx.deleteMessage().catch();
    next();
  },
  async (ctx) => {
    try {
      const raw =
        /(?<UAH>\d+(.\d+)?)\s+(?<USD>\d+(.\d+)?)\s+(?<EUR>\d+(.\d+)?)/.exec(
          ctx.message.text
        );
      if (!raw) {
        ctx
          .reply("Неверный формат строки")
          .then((msg) =>
            setTimeout(
              () => ctx.deleteMessage(msg.message_id).catch(() => null),
              2500
            )
          )
          .catch(() => null);
        return;
      }

      const { UAH, USD, EUR } = raw.groups;
      ctx.scene.state.netWorth = {
        UAH: Number(UAH),
        USD: Number(USD),
        EUR: Number(EUR),
      };

      const message = `<b>Сохранить данные значения?</b>\n\n<i>UAH:</i> <code>${UAH}</code>\n<i>USD:</i> <code>${USD}</code>\n<i>EUR:</i> <code>${EUR}</code>\n\nЕсли вы хотите их изменить - просто введите новые в том же формате`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("Сохранить", "save")],
      ]).reply_markup;
      if (!ctx.scene.state.netMenu) {
        const netMenu = await ctx.reply(message, {
          parse_mode: "HTML",
          reply_markup: keyboard,
        });

        ctx.scene.state.netMenu = netMenu.message_id;
      } else {
        ctx.telegram
          .editMessageText(
            ctx.from.id,
            ctx.scene.state.netMenu,
            undefined,
            message,
            {
              parse_mode: "HTML",
              reply_markup: keyboard,
            }
          )
          .catch(() => null);
      }
    } catch (error) {
      console.log(error);
    }
  }
);

setItemNetCost.action("save", async (ctx) => {
  try {
    const { netWorth, itemId } = ctx.scene.state;
    if (!netWorth) {
      return;
    }

    await goods.updateOne(
      {
        _id: itemId,
      },
      {
        $set: {
          netCost: netWorth,
        },
      }
    );

    ctx.scene.enter("manageItem", ctx.scene.state);
  } catch (error) {
    ctx.scene.enter("manageItem", ctx.scene.state);
    console.log(error);
  }
});

setItemNetCost.action("exit", (ctx) =>
  ctx.scene.enter("manageItem", ctx.scene.state)
);

setItemNetCost.leaveHandler = async (ctx) => {
  try {
    if (ctx.scene.state.netMenu) {
      ctx.telegram
        .deleteMessage(ctx.from.id, ctx.scene.state.netMenu)
        .catch(() => null);
    }

    const item = await goods.findById(ctx.scene.state.itemId);
    ctx.scene.state.item = item;
    ctx.scene.state.netMenu = undefined;
  } catch (error) {
    console.log(error);
    ctx.scene.enter("admin");
  }
};

module.exports = setItemNetCost;
