const { Scenes, Markup } = require("telegraf");

const keys = require("../keyboard");
const users = require("../../models/users");

const addManager = new Scenes.WizardScene(
  "addManager",
  async (ctx) => {
    try {
      await ctx.editMessageText(
        "Введите id пользователя, которого хотите сделать менеджером",
        ctx.scene.state.menu.message_id
      );
      await ctx.editMessageReplyMarkup(keys.BackMenu.keyboard.reply_markup);
      ctx.wizard.next();
    } catch (e) {
      await ctx.scene.enter("managers", ctx.scene.state);
      null;
    }
  },
  async (ctx) => {
    try {
      const cb = ctx.callbackQuery,
        message = ctx.scene.state.menu.message_id;

      null;

      if (cb) await ctx.scene.enter("managers", ctx.scene.state);
      else {
        await ctx.deleteMessage();
        const id = ctx.message.text.trim();

        if (!/^\d+$/i.test(id)) {
          await ctx.telegram.editMessageText(
            ctx.from.id,
            message,
            undefined,
            "Введите id пользователя, которого хотите сделать менеджером\n\nID пользователя должен быть числом"
          );
          await ctx.telegram.editMessageReplyMarkup(
            ctx.from.id,
            message,
            undefined,
            keys.BackMenu.keyboard.reply_markup
          );
        } else {
          let targetUser = await users.findOne(
            {
              telegramID: Number(id),
            },
            "username role game telegramID"
          );

          if (!targetUser) {
            await ctx.telegram.editMessageText(
              ctx.from.id,
              message,
              undefined,
              "Введите id пользователя, которого хотите сделать менеджером\n\nДанного пользователя нет в базе данных"
            );
            await ctx.telegram.editMessageReplyMarkup(
              ctx.from.id,
              message,
              undefined,
              keys.BackMenu.keyboard.reply_markup
            );
          } else if (targetUser.role === "manager") {
            await ctx.telegram.editMessageText(
              ctx.from.id,
              message,
              undefined,
              "Введите id пользователя, которого хотите сделать менеджером\n\nДанный пользователь уже является менеджером"
            );
            await ctx.telegram.editMessageReplyMarkup(
              ctx.from.id,
              message,
              undefined,
              keys.BackMenu.keyboard.reply_markup
            );
          } else {
            ctx.scene.state.target = targetUser;

            let gamesKeys = [];
            for (let game of global.games) {
              gamesKeys.push([Markup.button.callback(game, game)]);
            }
            gamesKeys.push([
              Markup.button.callback("Назад", keys.BackMenu.buttons),
            ]);

            await ctx.telegram.editMessageText(
              ctx.from.id,
              message,
              undefined,
              "Заказы по какой игре менеджер будет выполнять?",
              {
                reply_markup: Markup.inlineKeyboard(gamesKeys).reply_markup,
              }
            );
            await ctx.wizard.next();
          }
        }
      }
    } catch (e) {
      await ctx.scene.enter("managers", ctx.scene.state);
      null;
    }
  },
  async (ctx) => {
    try {
      if (ctx.updateType === "callback_query") {
        ctx.scene.state.target.game = ctx.callbackQuery.data;

        await ctx.telegram.editMessageText(
          ctx.from.id,
          ctx.scene.state.menu.message_id,
          undefined,
          `Вы точно хотите сделать пользователя ${ctx.scene.state.target.username}:${ctx.scene.state.target.telegramID} менеджером?`,
          {
            reply_markup: keys.YesNoMenu.keyboard.reply_markup,
          }
        );

        ctx.wizard.next();
      }
    } catch (e) {
      await ctx.scene.enter("managers", ctx.scene.state);
      null;
    }
  },
  async (ctx) => {
    try {
      const cb = ctx.callbackQuery;

      if (cb) {
        switch (cb.data) {
          case "yes":
            let target = ctx.scene.state.target;

            target.role = "manager";
            target.save(async (err, _) => {
              let result = err
                ? `Ошибка: ${err.message}`
                : `Пользователь ${target.username}:${target.telegramID} теперь менеджер`;
              ctx.answerCbQuery(result).catch((_) => null);
              await ctx.scene.enter("managers", {
                menu: ctx.scene.state.menu,
              });
            });
            break;
          case "no":
            ctx.scene.reenter();
            break;
        }
      }
    } catch (e) {
      null;
      ctx.scene.enter("managers", ctx.scene.state);
    }
  }
);

module.exports = addManager;
