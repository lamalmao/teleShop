const { Scenes, Markup } = require("telegraf");

const users = require("../../models/users");

const getUserData = new Scenes.BaseScene("get_user_data");

getUserData.enterHandler = async function (ctx) {
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

    await ctx.telegram.editMessageText(
      ctx.from.id,
      ctx.scene.state.menu.message_id,
      undefined,
      "Введите id пользователя",
      {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback("Назад", "back")],
        ]).reply_markup,
      }
    );
  } catch (e) {
    null;
    ctx.scene.enter("admin", {
      menu: ctx.scene.state.menu,
    });
  }
};

getUserData.action("back", (ctx) => {
  ctx.scene.enter("admin", {
    menu: ctx.scene.state.menu,
  });
});

getUserData.on("message", (ctx, next) => {
  ctx.deleteMessage().catch((_) => null);
  next();
});

getUserData.hears(/\d+/, async (ctx) => {
  try {
    const target = await users.findOne({
      telegramID: Number(ctx.message.text),
    });

    if (!target) {
      const curCtx = ctx;
      ctx
        .reply("Пользователь не найден")
        .then((msg) => {
          setTimeout(function () {
            curCtx.telegram
              .deleteMessage(curCtx.from.id, msg.message_id)
              .catch((_) => null);
          }, 2000);
        })
        .catch((_) => null);
      return;
    }

    ctx.scene.enter("manage_user", {
      menu: ctx.scene.state.menu,
      user: target.telegramID,
    });
  } catch (e) {
    null;
    ctx.scene.enter("admin", {
      menu: ctx.scene.state.menu,
    });
  }
});

module.exports = getUserData;
