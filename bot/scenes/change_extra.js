const { Scenes, Markup } = require("telegraf");

const goods = require("../../models/goods");
const keys = require("../keyboard");

const changeExtra = new Scenes.BaseScene("change_extra");

changeExtra.enterHandler = async function (ctx) {
  try {
    let msg = "Вопроса нет";
    if (ctx.scene.state.item.extra.message) {
      msg = ctx.scene.state.item.extra.message + "\n";

      for (let q of ctx.scene.state.item.extra.options) {
        msg += "\n" + q;
      }
    }

    await ctx.telegram.editMessageCaption(
      ctx.from.id,
      ctx.scene.state.menu.message_id,
      undefined,
      msg,
      {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback("Изменить вопрос", "change_message")],
          [
            Markup.button.callback(
              "Изменить варианты ответа",
              "change_answers"
            ),
          ],
          [Markup.button.callback("Назад", keys.BackMenu.buttons)],
        ]).reply_markup,
      }
    );
  } catch (e) {
    console.log(e);
    ctx.reply(`Ошибка: ${e.message}`).catch((_) => null);
    ctx.telegram
      .deleteMessage(ctx.from.id, ctx.scene.state.menu.message_id)
      .catch((_) => null);
    ctx.scene.enter("showGoods", {
      menu: ctx.scene.state.menu,
      category: ctx.scene.state.category,
      item: ctx.scene.state.item,
    });
  }
};

changeExtra.action(keys.BackMenu.buttons, async (ctx) => {
  try {
    if (ctx.scene.state.target) {
      ctx.scene.state.target = undefined;
      ctx.scene.enter("change_extra", {
        menu: ctx.scene.state.menu,
        item: ctx.scene.state.item,
        category: ctx.scene.state.category,
      });
    } else
      ctx.scene.enter("manageItem", {
        menu: ctx.scene.state.menu,
        category: ctx.scene.state.category,
        item: ctx.scene.state.item,
      });
  } catch (e) {
    console.log(e);
    ctx.reply(`Ошибка: ${e.message}`).catch((_) => null);
    ctx.telegram
      .deleteMessage(ctx.from.id, ctx.scene.state.menu.message_id)
      .catch((_) => null);
    ctx.scene.enter("showGoods", {
      menu: ctx.scene.state.menu,
      category: ctx.scene.state.category,
      item: ctx.scene.state.item,
    });
  }
});

changeExtra.action("change_message", async (ctx) => {
  try {
    await ctx.telegram.editMessageCaption(
      ctx.from.id,
      ctx.scene.state.menu.message_id,
      undefined,
      "Введите новый вопрос",
      {
        reply_markup: keys.BackMenu.keyboard.reply_markup,
      }
    );
    ctx.scene.state.target = "message";
  } catch (e) {
    console.log(e);
    ctx.reply(`Ошибка: ${e.message}`).catch((_) => null);
    ctx.telegram
      .deleteMessage(ctx.from.id, ctx.scene.state.menu.message_id)
      .catch((_) => null);
    ctx.scene.enter("showGoods", {
      menu: ctx.scene.state.menu,
      category: ctx.scene.state.category,
      item: ctx.scene.state.item,
    });
  }
});

changeExtra.action("change_answers", async (ctx) => {
  try {
    await ctx.telegram.editMessageCaption(
      ctx.from.id,
      ctx.scene.state.menu.message_id,
      undefined,
      "Введите новые варианты ответа. Например:\n\n<i>Вариант 1\nВариант 2\nВариант 3\nВариант 4\n</i>",
      {
        reply_markup: keys.BackMenu.keyboard.reply_markup,
        parse_mode: "HTML",
      }
    );
    ctx.scene.state.target = "answers";
  } catch (e) {
    console.log(e);
    ctx.reply(`Ошибка: ${e.message}`).catch((_) => null);
    ctx.telegram
      .deleteMessage(ctx.from.id, ctx.scene.state.menu.message_id)
      .catch((_) => null);
    ctx.scene.enter("showGoods", {
      menu: ctx.scene.state.menu,
      category: ctx.scene.state.category,
      item: ctx.scene.state.item,
    });
  }
});

changeExtra.on(
  "message",
  (ctx, next) => {
    ctx.deleteMessage().catch((_) => null);
    if (ctx.scene.state.target) next();
  },
  async (ctx, next) => {
    try {
      switch (ctx.scene.state.target) {
        case "message":
          const msg = ctx.message.text.trim();
          ctx.scene.state.item.extra.message = msg;
          break;
        case "answers":
          const options = ctx.message.text.split("\n");
          ctx.scene.state.item.extra.options = options;
          break;
      }

      await ctx.scene.state.item.save();
      ctx.scene.state.target = undefined;
      ctx.scene.enter("change_extra", {
        menu: ctx.scene.state.menu,
        item: ctx.scene.state.item,
        category: ctx.scene.state.category,
      });
    } catch (e) {
      console.log(e);
      ctx.reply(`Ошибка: ${e.message}`).catch((_) => null);
      ctx.telegram
        .deleteMessage(ctx.from.id, ctx.scene.state.menu.message_id)
        .catch((_) => null);
      ctx.scene.enter("showGoods", {
        menu: ctx.scene.state.menu,
        category: ctx.scene.state.category,
        item: ctx.scene.state.item,
      });
    }
  }
);

module.exports = changeExtra;
