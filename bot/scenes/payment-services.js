const { Scenes, Markup } = require('telegraf');
const EnterAdmin = require('../admin');
const fs = require('fs');
const path = require('path');

const paymentServices = new Scenes.BaseScene('payment-services');

paymentServices.enterHandler = async ctx => {
  try {
    const { lava, anypay, freekassa, skinsback, uacard, gm } =
      global.paymentMethods;

    await ctx.editMessageText('Платёжные системы', {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback((lava ? '🟢' : '🔴') + ' Lava', 'switch:lava')],
        [
          Markup.button.callback(
            (anypay ? '🟢' : '🔴') + ' AnyPay',
            'switch:anypay'
          )
        ],
        [
          Markup.button.callback(
            (freekassa ? '🟢' : '🔴') + ' FreeKassa',
            'switch:freekassa'
          )
        ],
        [
          Markup.button.callback(
            (skinsback ? '🟢' : '🔴') + ' Skinsback',
            'switch:skinsback'
          )
        ],
        [
          Markup.button.callback((gm ? '🟢' : '🔴') + ' GameMoney', 'switch:gm')
        ],
        [
          Markup.button.callback(
            (uacard ? '🟢' : '🔴') + ' Оплата украинскими картами',
            'switch:uacard'
          )
        ],
        [Markup.button.callback('Назад', 'exit')]
      ]).reply_markup
    });
  } catch (error) {
    ctx.scene.enter('admin', ctx.scene.state);
    return;
  }
};

paymentServices.action(/switch:.+/, async ctx => {
  try {
    const raw = /:(?<target>[a-z0-9]+)/i.exec(ctx.callbackQuery.data);
    if (!raw) {
      return;
    }

    const { target } = raw.groups;

    global.paymentMethods[target] = !global.paymentMethods[target];
    fs.writeFileSync(
      path.resolve('payments.json'),
      JSON.stringify(global.paymentMethods)
    );

    ctx.scene.enter('payment-services', ctx.scene.state);
  } catch (error) {
    console.log(error);
  }
});

paymentServices.action('exit', ctx => {
  // ctx.deleteMessage().catch(() => null);
  ctx.scene.enter('admin', ctx.scene.state);
});

module.exports = paymentServices;
