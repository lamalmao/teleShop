const { Telegraf, session } = require("telegraf");
const stage = require("./scenes");
const clean = require("../cleanup");
const users = require("../models/users");
const payments = require("../models/payments");
const keys = require("./keyboard");
const messages = require("./messages");
const path = require("path");
const goods = require("../models/goods");
const { delivery } = require("../models/delivery");
const managerKey = require("../models/manager-keys");

const images = path.join(process.cwd(), "files", "images");

function CreateBot(token) {
  const bot = new Telegraf(token);

  global.suspend = false;

  // bot.use((ctx, next) => {
  //   if (ctx.callbackQuery && ctx.callbackQuery.data) {
  //     console.log(ctx.callbackQuery.data);
  //   }

  //   next();
  // });

  bot.use(session());
  bot.use(stage.middleware());

  bot.start((ctx) => ctx.scene.enter("start"));

  bot.command("switch", async (ctx) => {
    try {
      const user = await users.findOne(
        {
          telegramID: ctx.from.id,
        },
        "role"
      );

      if (user && user.role === "admin") {
        global.suspend = !global.suspend;
        await ctx.reply(
          `Продажи ${
            global.suspend ? "приостановлены" : "возобновлены"
          }.\n/switch для того чтобы ${
            global.suspend ? "возобновить" : "приостановить"
          }`
        );
      }
    } catch (e) {
      null;
    }
  });

  bot.command(
    "codes",
    async (ctx, next) => {
      try {
        const user = await users.findOne(
          {
            telegramID: ctx.from.id,
          },
          {
            role: 1,
          }
        );

        if (user && user.role === "admin") {
          next();
        }
      } catch {
        null;
      }
    },
    async (ctx) => {
      try {
        const autoItems = await goods.find(
          {
            itemType: "auto",
          },
          {
            title: 1,
          }
        );

        const manualItems = await goods.find(
          {
            itemType: {
              $ne: "auto",
            },
            managerKeys: true,
          },
          {
            title: 1,
          }
        );

        let msg = "Ключи для клиентов:\n";

        for (const auto of autoItems) {
          const count = await delivery.countDocuments({
            item: auto._id,
            accessable: true,
            delivered: false,
          });

          msg += `${auto.title} - ${count}\n`;
        }

        msg += "\nКлючи для менеджеров:\n";

        for (const manual of manualItems) {
          const count = await managerKey.countDocuments({
            item: manual._id,
            used: false,
          });

          msg += `${manual.title} - ${count}\n`;
        }

        let length = msg.length;
        const partsCount = Math.ceil(length / 4096);

        for (let i = 0; i < partsCount; i++) {
          const start = i * 4096;
          const d = length - start;
          const slice = d >= 4096 ? 4096 : d;

          await ctx.reply(msg.slice(start, start + slice));
        }
      } catch (error) {
        ctx.reply("Что-то пошло не так").catch(() => null);
      }
    }
  );

  bot.on("callback_query", (ctx, next) => {
    // null
    ctx.answerCbQuery().catch((_) => null);
    next();
  });

  bot.action("profile", (ctx) =>
    ctx.scene.enter("profile", { menu: ctx.callbackQuery.message })
  );
  bot.action("shop", (ctx) => ctx.scene.enter("shop"));

  bot.action(
    [
      keys.Menu.buttons.questions,
      keys.Menu.buttons.guarantees,
      keys.Menu.buttons.comments,
      keys.Menu.buttons.support,
    ],
    async (ctx) => {
      try {
        await ctx.telegram.editMessageMedia(
          ctx.from.id,
          ctx.callbackQuery.message.message_id,
          undefined,
          {
            type: "photo",
            media: {
              source: path.join(images, `blank_${ctx.callbackQuery.data}.jpg`),
            },
          }
        );

        await ctx.telegram.editMessageCaption(
          ctx.from.id,
          ctx.callbackQuery.message.message_id,
          undefined,
          messages[ctx.callbackQuery.data],
          {
            parse_mode: "HTML",
            reply_markup: keys.BackMenu.keyboard.reply_markup,
          }
        );
      } catch (e) {
        null;
        ctx.telegram
          .deleteMessage(ctx.from.id, ctx.callbackQuery.message.message_id)
          .catch((_) => null);
      }
    }
  );

  bot.action(/cancelPayment#\d+/, async (ctx) => {
    try {
      const paymentID = Number(/\d+$/.exec(ctx.callbackQuery.data)[0]);

      await payments.updateOne(
        {
          paymentID: paymentID,
          status: "waiting",
        },
        {
          $set: {
            status: "rejected",
          },
        }
      );

      ctx.telegram
        .deleteMessage(ctx.from.id, ctx.callbackQuery.message.message_id)
        .catch((_) => null);
    } catch (e) {
      ctx.answerCbQuery("Что-то пошло не так").catch((_) => null);
    } finally {
      ctx.scene.enter("start");
    }
  });

  bot.action(/lava-check#\d+/, (ctx) => ctx.scene.enter("lava-check"));
  bot.action(/main_section#\w+/, (ctx) => ctx.scene.enter("mainCategory"));
  bot.action(/sub_section#\w+/, (ctx) => ctx.scene.enter("subCategory"));
  bot.action(/item#\w+/, (ctx) => ctx.scene.enter("item"));
  bot.action(/buy#\w+/, (ctx) => ctx.scene.enter("buy"));
  bot.action(/ref#\d+/, (ctx) => {
    const amount = Number(/\d+$/.exec(ctx.callbackQuery.data)[0]);
    ctx.scene.enter("pay", {
      menu: ctx.callbackQuery.message,
      amount: amount,
    });
  });

  bot.action(/genshin_proceed#\w+/, (ctx) =>
    ctx.scene.enter("genshin_proceed")
  );
  bot.action(/supercell_proceed#\w+/, (ctx) =>
    ctx.scene.enter("supercell_proceed")
  );
  bot.action(/proceed#\w+/, (ctx) => ctx.scene.enter("proceed"));
  bot.action(/accept#\d+/, (ctx) => ctx.scene.enter("accept_purchase"));
  bot.action(/order#\d+/, (ctx) => ctx.scene.enter("order_data"));
  bot.action(/refund_data#\d+/, (ctx) => ctx.scene.enter("user_refund"));
  bot.action(/res_contact#\d+#\d+/, (ctx) => ctx.scene.enter("send_contact"));
  bot.action(/send_code#\d+/, (ctx) => ctx.scene.enter("send_auth_code"));

  bot.action(keys.BackMenu.buttons, async (ctx) => {
    try {
      await ctx.editMessageMedia({
        type: "photo",
        media: {
          source: path.join(images, "blank_logo.jpg"),
        },
      });

      await ctx.editMessageCaption("Главное меню", {
        reply_markup: keys.Menu.keyboard.reply_markup,
      });
    } catch (e) {
      null;
    }
  });

  bot.command("admin", (ctx) => ctx.scene.enter("admin"));
  bot.command("manager", (ctx) => ctx.scene.enter("manager_menu"));
  bot.action("online_alert", async (ctx) => {
    try {
      await users.updateOne(
        {
          telegramID: ctx.from.id,
        },
        {
          $set: {
            onlineUntil: new Date(Date.now() + 15 * 60 * 1000),
          },
        }
      );

      const curCtx = ctx;
      ctx
        .reply("Ваш статус обновлен")
        .then((msg) => {
          setTimeout(function () {
            curCtx.telegram
              .deleteMessage(curCtx.from.id, msg.message_id)
              .catch((_) => null);
          }, 3000);
        })
        .catch((_) => null);
    } catch (e) {
      null;
    }
  });
  bot.action("manager_menu", (ctx) => ctx.scene.enter("manager_menu"));
  bot.action("catch_order", (ctx) => ctx.scene.enter("catch_order"));
  bot.action(keys.ManagerWorkMenu.buttons.active, (ctx) =>
    ctx.scene.enter("current_orders")
  );
  bot.action(keys.ManagerWorkMenu.buttons.list, (ctx) =>
    ctx.scene.enter("orders_list")
  );
  bot.action(keys.ManagerWorkMenu.buttons.back, (ctx) =>
    ctx.deleteMessage().catch((_) => null)
  );
  bot.action(/manager_take#\d+/, (ctx) => ctx.scene.enter("take_order"));

  bot.command("clean", async (ctx) => {
    const user = await users.findOne(
      {
        telegramID: ctx.from.id,
        role: "admin",
      },
      "role"
    );

    if (user) clean();
  });

  bot.command("drop", async (ctx) => {
    try {
      const user = await users.findOne(
        {
          telegramID: ctx.from.id,
          role: "admin",
        },
        "role"
      );

      if (user) {
        await users.updateOne(
          {
            telegramID: ctx.from.id,
          },
          {
            $set: {
              stats: [],
            },
          }
        );

        ctx.reply("Статистика сброшена");
      }
    } catch (e) {
      null;
    }
  });

  bot.command("say", async (ctx) => {
    try {
      const user = await users.findOne(
        {
          telegramID: ctx.from.id,
        },
        {
          role: 1,
        }
      );

      if (user.role !== "admin") {
        throw new Error("No access");
      }

      ctx.scene.enter("share-message");
    } catch (error) {
      null;
      ctx.reply("Нет доступа");
    }
  });

  bot.command("stats", async (ctx) => {
    try {
      const user = await users.findOne(
        {
          telegramID: ctx.from.id,
        },
        {
          role: 1,
        }
      );

      if (user.role !== "admin") {
        throw new Error("No access");
      }

      const allCount = await users.count({
        role: "client",
      });

      const todayCount = await users.count({
        role: "client",
        join_date: {
          $gte: new Date(Date.now() - 86400000),
        },
      });

      const weekCount = await users.count({
        role: "client",
        join_date: {
          $gte: new Date(Date.now() - 86400000 * 7),
        },
      });

      const monthCount = await users.count({
        role: "client",
        join_date: {
          $gte: new Date(Date.now() - 86400000 * 30),
        },
      });

      await ctx.reply(
        `Всего пользователей: ${allCount}\n\nПришло за \nсутки: ${todayCount}\nнеделю: ${weekCount}\nмесяц: ${monthCount}`
      );
    } catch (error) {
      null;
    }
  });

  return bot;
}

module.exports = CreateBot;
