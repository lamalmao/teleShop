const { Scenes } = require('telegraf');
const path = require('path');

const messages = require('../messages');
const users = require('../../models/users');
const keys = require('../keyboard');


const profileImage = path.join(process.cwd(), 'files', 'images', 'blank_profile.jpg');
const refillImage = path.join(process.cwd(), 'files', 'images', 'blank_refill.jpg');

const profile = new Scenes.BaseScene('profile');

profile.enterHandler = async function(ctx) {
  try {
    const user = await users.findOne({
      telegramID: ctx.from.id
    });

    await ctx.telegram.editMessageMedia(
      ctx.from.id,
      ctx.scene.state.menu.message_id,
      undefined,
      {
        type: 'photo',
        media: {
          source: profileImage
        }
      }
    );

    await ctx.telegram.editMessageCaption(ctx.from.id, ctx.scene.state.menu.message_id, undefined, messages.profile.main.format(ctx.from.id, user.balance, user.purchases, user.refills, ctx.botInfo.username), {
      parse_mode: 'HTML'
    });
    await ctx.telegram.editMessageReplyMarkup(ctx.from.id, ctx.scene.state.menu.message_id, undefined, keys.ProfileMenu.keyboard.reply_markup);
  } catch (e) {
    console.log(e);
    ctx.scene.enter('start');
  }
};

profile.command('start', ctx => {
  ctx.scene.enter('start', {
    menu: ctx.scene.state.menu
  });
});

profile.action(keys.BackMenu.buttons, ctx => {
  if (!ctx.scene.state.action) ctx.scene.enter('start', { menu: ctx.scene.state.menu });
  else ctx.scene.enter('profile', { menu: ctx.scene.state.menu });
});

profile.action(keys.ProfileMenu.buttons.refill, async ctx => {
  try {
    await ctx.telegram.editMessageMedia(
      ctx.from.id,
      ctx.scene.state.menu.message_id,
      undefined,
      {
        type: 'photo',
        media: {
          source: refillImage
        }
      }
    )

    await ctx.telegram.editMessageCaption(ctx.from.id, ctx.scene.state.menu.message_id, undefined, messages.payment.create);
    await ctx.telegram.editMessageReplyMarkup(ctx.from.id, ctx.scene.state.menu.message_id, undefined, keys.BackMenu.keyboard.reply_markup);

    ctx.scene.state.action = 'refill';
  } catch (e) {
    console.log(e);
    ctx.answerCbQuery(`Ошибка: ${e.message}`).catch(_ => null);
    ctx.scene.enter('profile', { menu: ctx.scene.state.menu });
  }
});

profile.on('message', async ctx => {
  try {
    ctx.deleteMessage().catch(_ => null);

    if (ctx.scene.state.action === 'refill') {
      let amount = Number(ctx.message.text.trim());

      if (!Number.isNaN(amount) && amount >= 100 && amount <= 10000) {
        amount = amount.toFixed(2);
        ctx.scene.state.action = undefined;
        ctx.scene.enter('pay', { menu: ctx.scene.state.menu, amount: amount });
      } else {
        ctx.reply(messages.payment.error)
          .then(msg => setTimeout(_ => {
            ctx.telegram.deleteMessage(ctx.from.id, msg.message_id)
              .catch(_ => null);
          }, 2000))
          .catch(_ => null);
      }
    }
  } catch (e) {
    console.log(e);
    ctx.reply(`Ошибка: ${e.message}`).catch(_ => null);
    ctx.scene.enter('profile', { menu: ctx.scene.state.menu });
  }
});


profile.action(keys.ProfileMenu.buttons.story, ctx => {
  ctx.scene.enter('paymentsStory', {
    menu: ctx.scene.state.menu,
  });
});

module.exports = profile;