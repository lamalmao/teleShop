const { Scenes, Markup } = require('telegraf');
const { Types } = require('mongoose');
const path = require('path');

const categories = require('../../models/categories');
const mainCategory = new Scenes.BaseScene('mainCategory');

const images = path.join(process.cwd(), 'files', 'images');

mainCategory.enterHandler = async function(ctx) {
  try {
    const categoryID = /\w+$/i.exec(ctx.callbackQuery.data)[0];
    const category = await categories.findById(categoryID);
    const subCategories = await categories.find({
      parent: Types.ObjectId(categoryID),
      hidden: false
    }, '_id title');

    let keyboard = [],
      line = [],
      first = true,
      length = subCategories.length;
    for (let i = 0; i < length; i++) {
      line.push(Markup.button.callback(subCategories[i].title, `sub_section#${subCategories[i]._id}`));

      if (!first || i + 1 === length) {
        keyboard.push(line);
        line = [];
      }

      first = !first;
    }
    keyboard.push([ Markup.button.callback('Назад', 'shop') ]);

    await ctx.telegram.editMessageMedia(ctx.from.id, ctx.callbackQuery.message.message_id, undefined, {
      type: 'photo',
      media: {
        source: path.join(images, category.image)
      }
    }, {
      caption: `<b>${category.title}</b>\n\n${category.description}`,
      parse_mode: 'HTML',
      reply_markup:Markup.inlineKeyboard(keyboard).reply_markup
    });

    ctx.scene.leave();
  } catch (e) {
    console.log(e);
    ctx.answerCbQuery('Что-то пошло не так').catch(_ => null);
    ctx.scene.enter('shop', { menu: ctx.scene.state.menu });
  }
};

module.exports = mainCategory;