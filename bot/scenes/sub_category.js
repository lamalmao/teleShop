const { Scenes, Markup } = require('telegraf');
const { Types } = require('mongoose');
const path = require('path');

const categories = require('../../models/categories');
const goods = require('../../models/goods');
const messages = require('../messages');

const images = path.join(process.cwd(), 'files', 'images');
const subCategory = new Scenes.BaseScene('subCategory');

subCategory.enterHandler = async function(ctx) {
  try {
    const categoryID = /\w+$/i.exec(ctx.callbackQuery.data)[0];
    const category = await categories.findById(categoryID);
    const categoryGoods = await goods.find({
      category: Types.ObjectId(categoryID),
      hidden: false
    }, '_id title');

    let keyboard = [],
    line = [],
    first = true,
    length = categoryGoods.length;
    for (let i = 0; i < length; i++) {
      line.push(Markup.button.callback(categoryGoods[i].title, `item#${categoryGoods[i]._id}`));

      if (!first || i + 1 === length) {
        keyboard.push(line);
        line = [];
      }

      first = !first;
    }
    keyboard.push([ Markup.button.callback('Назад', `main_section#${category.parent}`) ]);

    await ctx.telegram.editMessageMedia(ctx.from.id, ctx.callbackQuery.message.message_id, undefined, {
      type: 'photo',
      media: {
        source: path.join(images, category.image)
      }
    });

    await ctx.telegram.editMessageCaption(
      ctx.from.id,
      ctx.callbackQuery.message.message_id,
      undefined,
      `Выберите товар\n\n${category.description}`,
      {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard(keyboard).reply_markup
      }
    )

    ctx.scene.leave();
  } catch (e) {
    console.log(e);
    ctx.answerCbQuery('Что-то пошло не так')
      .catch(_ => null);
    ctx.scene.enter('shop');
  }
};

module.exports = subCategory;