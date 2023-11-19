const { Scenes, Markup } = require("telegraf");
const goods = require("../../models/goods");

const changeDeliveryType = new Scenes.BaseScene("change-delivery-type");

changeDeliveryType.enterHandler = async (ctx) => {
  try {
    const item = await goods.findById(ctx.scene.state.item._id);
    if (!item) {
      throw new Error("Item not found");
    }
    ctx.scene.state.item = item;

    const msg = await ctx.editMessageCaption("Выберите тип доставки", {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback("Ключ", "set:auto", item.itemType === "auto")],
        [
          Markup.button.callback(
            "Менеджером",
            "set:manual",
            item.itemType === "manual"
          ),
        ],
        [
          Markup.button.callback(
            "Менеджером без ввода данных",
            "set:manualSkipProceed",
            item.itemType === "manualSkipProceed"
          ),
        ],
        [Markup.button.callback("Отмена", "exit")],
      ]).reply_markup,
    });

    ctx.scene.state.menu = msg;
  } catch (error) {
    ctx.reply("Что-то пошло не так").catch(() => null);
    ctx.scene.enter("manageItem", {
      menu: ctx.scene.state.menu,
      item: ctx.scene.state.item,
    });
  }
};

changeDeliveryType.action("exit", (ctx) => {
  ctx.scene.enter("manageItem", {
    item: ctx.scene.state.item,
    menu: ctx.scene.state.menu,
  });
});

changeDeliveryType.action(
  /set:(auto|manual|manualSkipProceed)/,
  async (ctx) => {
    try {
      const raw = /set:(auto|manual|manualSkipProceed)$/.exec(
        ctx.callbackQuery.data
      );

      if (!raw) {
        throw new Error("No data");
      }

      const itemType = raw[1];
      await goods.updateOne(
        {
          _id: ctx.scene.state.item._id,
        },
        {
          $set: {
            itemType,
          },
        }
      );

      const item = await goods.findById(ctx.scene.state.item._id);

      ctx.scene.enter("manageItem", {
        item,
        menu: ctx.scene.state.menu,
      });
    } catch {
      ctx.scene.enter("manageItem", {
        item: ctx.scene.state.item,
        menu: ctx.scene.state.menu,
      });
    }
  }
);

module.exports = changeDeliveryType;
