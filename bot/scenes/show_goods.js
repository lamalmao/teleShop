const { Scenes, Markup } = require("telegraf");
const path = require("path");
const { Types } = require("mongoose");

// const goodsModel = require('../../models/goods');
const categories = require("../../models/categories");

const keys = require("../keyboard");
// const genItemsListPages = require('../gen_pages');
const goods = require("../../models/goods");

const showGoods = new Scenes.BaseScene("showGoods");

const image = path.join(process.cwd(), "files", "images", "blank_logo.jpg");

// showGoods.enterHandler = async function(ctx) {
//   try {
//     ctx.telegram.deleteMessage(ctx.from.id, ctx.callbackQuery.message.message_id).catch(_ => null);

//     const goods = await goodsModel.find(undefined, '_id title');
//     if (goods.length > 0) {
//       ctx.scene.state.pages = genItemsListPages(goods);
//       ctx.scene.state.page = ctx.scene.state.page < ctx.scene.state.pages.size ? ctx.scene.state.page : ctx.scene.state.page - 1;

//       const menu = await ctx.replyWithPhoto({
//         source: path.join(process.cwd(), 'files', 'images', 'blank_logo.jpg')
//       }, {
//         caption: 'Все товары',
//         reply_markup: ctx.scene.state.pages.get(ctx.scene.state.page).reply_markup
//       });

//       ctx.scene.state.menu = menu;
//     } else ctx.reply('Нет товаров', keys.BackMenu.keyboard);
//   } catch (e) {
//     null
//     ctx.reply(`Что-то пошло не так`)
//       .then(msg => ctx.scene.enter('goods', { menu: msg }))
//       .catch(_ => null);
//   }
// };

showGoods.enterHandler = async function (ctx) {
  try {
    ctx.telegram
      .deleteMessage(ctx.from.id, ctx.callbackQuery.message.message_id)
      .catch((_) => null);

    let keyboard, msg;

    if (!ctx.scene.state.category) {
      const subCategories = await categories.find(
        {
          type: "sub",
        },
        "_id title"
      );

      keyboard = [];

      for (let category of subCategories) {
        keyboard.push([
          Markup.button.callback(category.title, `category#${category._id}`),
        ]);
      }

      keyboard.push([Markup.button.callback("Назад", keys.BackMenu.buttons)]);

      msg = "Категории";
      keyboard = Markup.inlineKeyboard(keyboard);
    } else {
      ctx.scene.state.itemsCategory = ctx.scene.state.category;
      const data = await drawItemsKeyboard(ctx.scene.state.category);

      msg = data[0];
      keyboard = data[1];
    }

    ctx.scene.state.category = null;
    await ctx.replyWithPhoto(
      {
        source: image,
      },
      {
        caption: "Категории",
        reply_markup: keyboard.reply_markup,
      }
    );
  } catch (e) {
    null;
    ctx
      .reply(`Что-то пошло не так`)
      .then((msg) => ctx.scene.enter("goods", { menu: msg }))
      .catch((_) => null);
  }
};

showGoods.action(/category#\w+/, async (ctx) => {
  try {
    const categoryID = /\w+$/.exec(ctx.callbackQuery.data)[0];
    ctx.scene.state.itemsCategory = categoryID;

    const data = await drawItemsKeyboard(categoryID);

    await ctx.telegram.editMessageCaption(
      ctx.from.id,
      ctx.callbackQuery.message.message_id,
      undefined,
      data[0],
      {
        reply_markup: data[1].reply_markup,
      }
    );
  } catch (e) {
    null;
    ctx.scene.enter("showGoods");
  }
});

showGoods.action(keys.BackMenu.buttons, (ctx) => {
  ctx.telegram
    .deleteMessage(ctx.from.id, ctx.callbackQuery.message.message_id)
    .catch((_) => null);
  ctx
    .reply(`Возвращаемся...`)
    .then((msg) => ctx.scene.enter("goods", { menu: msg }))
    .catch((_) => null);
});

showGoods.action("prev", (ctx) => {
  ctx.scene.reenter({
    menu: ctx.callbackQuery.message,
    category: null,
  });
});

// showGoods.action(['next', 'prev'], async function(ctx) {
//   try {
//     if (ctx.callbackQuery.data === 'next') ctx.scene.state.page++;
//     else ctx.scene.state.page--;

//     await ctx.telegram.editMessageReplyMarkup(ctx.from.id, ctx.scene.state.menu.message_id, undefined, ctx.scene.state.pages.get(ctx.scene.state.page).reply_markup);
//   } catch (e) {
//     ctx.telegram.deleteMessage(ctx.from.id, ctx.callbackQuery.message.message_id).catch(_ => null);
//     ctx.reply('Что-то пошло не так')
//       .then(msg => ctx.scene.enter('goods', { menu: msg }))
//       .catch(_ => null);
//   }
// });

showGoods.action(/item#\w+/i, async (ctx) => {
  try {
    const itemID = /[^#]+$/.exec(ctx.callbackQuery.data)[0];
    const item = await goods.findById(itemID);

    if (item)
      ctx.scene.enter("manageItem", {
        menu: ctx.callbackQuery.message,
        item: item,
        category: ctx.scene.state.itemsCategory,
      });
    else
      ctx
        .answerCbQuery(
          "Не удалось найти товар в базе данных, возможно он был удален"
        )
        .catch((_) => null);
  } catch (e) {
    null;
    ctx.scene.reenter({
      menu: ctx.callbackQuery.message,
    });
  }
});

async function drawItemsKeyboard(categoryID) {
  const items = await goods.find(
    {
      category: Types.ObjectId(categoryID),
    },
    "_id title"
  );

  let keyboard = [],
    length = items.length,
    msg = length > 0 ? "Товары в категории" : "Товаров нет",
    second = false,
    line = [],
    counter = 1;

  for (let item of items) {
    line.push(Markup.button.callback(item.title, `item#${item._id}`));

    if (second || counter === length) {
      keyboard.push(line);
      line = [];
    }

    second = !second;
    counter++;
  }
  keyboard.push([Markup.button.callback("Назад", "prev")]);

  return [msg, Markup.inlineKeyboard(keyboard)];
}

module.exports = showGoods;
