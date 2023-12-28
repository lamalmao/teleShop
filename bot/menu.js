const path = require('path');

const keys = require('./keyboard');
const root = process.cwd();
const logoRoot = path.join(root, 'files', 'images', 'blank_logo.jpg');
// const images = path.join(process.cwd(), 'files', 'images');

async function sendMenu(ctx, menu) {
  try {
    if (!menu)
      await ctx.replyWithPhoto(
        { source: logoRoot },
        {
          caption: 'Главное меню',
          reply_markup: keys.Menu.keyboard.reply_markup
        }
      );
    else {
      await ctx.telegram.editMessageMedia(
        ctx.from.id,
        menu.message_id,
        null,
        {
          media: {
            source: logoRoot
          },
          type: 'photo'
        },
        {
          caption: 'Главное меню',
          reply_markup: keys.Menu.keyboard.reply_markup
        }
      );
    }
  } catch {
    null;
  }
}

module.exports = sendMenu;
