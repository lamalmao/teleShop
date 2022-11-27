const { Scenes, Markup } = require('telegraf');
const crypto = require('crypto');

const goods = require('../../models/goods.js');
const orders = require('../../models/orders.js');
const escape = require('escape-html');

const back = require('../keyboard').BackMenu;
const messages = require('../messages');

const platforms = Markup.inlineKeyboard([
  [Markup.button.callback('PC Windows / macOS', 'pc'), Markup.button.callback('Playstation 4/5', 'ps')],
  [Markup.button.callback('Xbox', 'xbox'), Markup.button.callback('Nintendo', 'nintendo')],
  [Markup.button.callback('Android', 'android')],
  [Markup.button.callback('Назад', back.buttons)]
]);

const proceed = new Scenes.BaseScene('proceed');

proceed.enterHandler = async function(ctx) {
  try {
    const itemID = /\w+$/.exec(ctx.callbackQuery.data)[0];
    const targetItem = await goods.findById(itemID);

    if (!targetItem || targetItem.hidden) throw new Error('Товар на данный момент недоступен');
    else ctx.scene.state.item = new orders({
      orderID: await genUniqueID(),
      client: ctx.from.id,
      item: targetItem._id,
      itemTitle: targetItem.title,
      amount: targetItem.getPrice(),
      data: {
        login: '',
        password: ''
      }
    });

    await ctx.telegram.editMessageCaption(ctx.from.id, ctx.callbackQuery.message.message_id, undefined, messages.purchase_proceed.platform_choise, {
      reply_markup: platforms.reply_markup,
      parse_mode: 'HTML'
    });
  } catch (e) {
    ctx.answerCbQuery(e.message).catch(_ => null);
    console.log(e);
    ctx.scene.enter('start', { menu: ctx.callbackQuery.message });
  }
};

proceed.action(back.buttons, ctx => {
  ctx.scene.enter('shop');
});

proceed.action(['pc', 'xbox', 'android', 'ps', 'nintendo', 'shift1'], async ctx => {
  try {
    if (ctx.callbackQuery.data !== 'shift1')
      ctx.scene.state.item.platform = ctx.callbackQuery.data;
    
    let msg,
      keyboard;
    
    if (ctx.callbackQuery.data === 'nintendo' && !ctx.scene.state.nintendo_proceed) {
      msg = messages.purchase_proceed.nintendo_alert;
      keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('Я ознакомлен', 'nintendo')],
        [Markup.button.callback('Назад', `proceed#${ctx.scene.state.item.item}`)]
      ]);
      ctx.scene.state.nintendo_proceed = true;
    } else {
      msg = messages.purchase_proceed.instructions[0][ctx.callbackQuery.data !== 'shift1' ? ctx.callbackQuery.data : ctx.scene.state.item.platform];
      keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('Далее', 'next1')],
        [Markup.button.callback('Назад', `proceed#${ctx.scene.state.item.item}`)]
      ]);
    }

    await ctx.telegram.editMessageCaption(
      ctx.from.id,
      ctx.callbackQuery.message.message_id,
      undefined,
      msg,
      {
        reply_markup: keyboard.reply_markup,
        parse_mode: 'HTML'
      }
    );
  } catch (e) {
    console.log(e);
    ctx.scene.enter('start', { menu: ctx.callbackQuery.message });
  }
});

proceed.action('help', async ctx => {
  try {
    await ctx.telegram.editMessageCaption(
      ctx.from.id,
      ctx.callbackQuery.message.message_id,
      undefined,
      messages.purchase_proceed.help,
      {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('Назад', `next1`)]
        ]).reply_markup,
        parse_mode: 'HTML'
      }
    );
  } catch (e) {
    console.log(e);
    ctx.scene.enter('start', { menu: ctx.callbackQuery.message });
  }
});

proceed.action('next1', async ctx => {
  try {
    const xboxExtra = ctx.scene.state.item.platform === 'xbox' ? `\n\n${messages.purchase_proceed.xbox_extra}` : '';

    await ctx.telegram.editMessageCaption(
      ctx.from.id,
      ctx.callbackQuery.message.message_id,
      undefined,
      messages.purchase_proceed.instructions[1] + xboxExtra,
      {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('Привязал, что дальше?', 'next2')],
          [Markup.button.callback('У меня возникли сложности', 'help')],
          [Markup.button.callback('Назад', `shift1`)]
        ]).reply_markup,
        parse_mode: 'HTML'
      }
    );
  } catch (e) {
    console.log(e);
    ctx.scene.enter('start', { menu: ctx.callbackQuery.message });
  }
});

proceed.action('next2', async ctx => {
  try {
    // const xboxExtra = ctx.scene.state.item.platform === 'xbox' ? `\n\n${messages.purchase_proceed.xbox_extra}` : '';
    const caption = messages.purchase_proceed.instructions[2];

    await ctx.telegram.editMessageCaption(
      ctx.from.id,
      ctx.callbackQuery.message.message_id,
      undefined,
      caption,
      {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('Зачем почта / пароль', 'next3')],
          [Markup.button.callback('Назад', `next1`)]
        ]).reply_markup,
        parse_mode: 'HTML'
      }
    );
  } catch (e) {
    console.log(e);
    ctx.scene.enter('start', { menu: ctx.callbackQuery.message });
  }
});

proceed.action('next3', async ctx => {
  try {
    ctx.scene.state.action = undefined;
    ctx.scene.state.message = ctx.callbackQuery.message;
    await ctx.telegram.editMessageCaption(
      ctx.from.id,
      ctx.callbackQuery.message.message_id,
      undefined,
      messages.purchase_proceed.instructions[3],
      {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('Завершить оформение заказа', 'setmail')],
          [Markup.button.callback('Назад', `next3`)]
        ]).reply_markup,
        parse_mode: 'HTML'
      }
    );
  } catch (e) {
    console.log(e);
    ctx.scene.enter('start', { menu: ctx.callbackQuery.message });
  }
});

proceed.action('setmail', async ctx => {
  try {
    ctx.scene.state.target = 'login';
    const xboxExtra = ctx.scene.state.item.platform === 'xbox' ? `\n\n${messages.purchase_proceed.xbox_extra}` : '';

    await ctx.telegram.editMessageCaption(
      ctx.from.id,
      ctx.callbackQuery.message.message_id,
      undefined,
      messages.purchase_proceed.login + xboxExtra,
      {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('Назад', `next3`)]
        ]).reply_markup,
        parse_mode: 'HTML'
      }
    );
  } catch (e) {
    console.log(e);
    ctx.scene.enter('start', { menu: ctx.callbackQuery.message });
  }
});

proceed.on('message',
  async (ctx, next) => {
    if (ctx.message.text) {
      ctx.deleteMessage()
        .catch(_ => null);
      
      if (ctx.scene.state.target) next();
    }
  },
  async (ctx, next) => {
    try {
      if (ctx.scene.state.target === 'login') {
        const mail = /^(([^<>()[\]\.,;:\s@\"]+(\.[^<>()[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i.exec(ctx.message.text);
        const number = /\d{7,}/.exec(ctx.message.text.replace(/\ \-\+\(\)/g), '');

        const data = mail ? mail : number;

        const xboxExtra = ctx.scene.state.item.platform === 'xbox' ? `\n\n${messages.purchase_proceed.xbox_extra}` : '';

        if (data) {
          ctx.scene.state.item.data.login = data[0];
          ctx.scene.state.target = 'password';

          await ctx.telegram.editMessageCaption(
            ctx.from.id,
            ctx.scene.state.message.message_id,
            undefined,
            messages.purchase_proceed.password + xboxExtra,
            {
              reply_markup: Markup.inlineKeyboard([
                [Markup.button.callback('Назад', `next3`)]
              ]).reply_markup,
              parse_mode: 'HTML'
            }
          );
        }
      } else next();
    } catch (e) {
      console.log(e);
      ctx.scene.enter('start', { menu: ctx.scene.state.message });
    }
  },
  async ctx => {
    try {
      const data = ctx.message.text.trim();

      if (data) {
        ctx.scene.state.item.data.password = data;
        console.log(ctx.scene.state.item.data);     
        await ctx.scene.state.item.save();

        await ctx.telegram.editMessageCaption(
          ctx.from.id,
          ctx.scene.state.message.message_id,
          undefined,
          messages.purchase_proceed.checkout.format(
            ctx.scene.state.item.itemTitle,
            escape(ctx.scene.state.item.data.login),
            escape(ctx.scene.state.item.data.password),
            ctx.scene.state.item.amount
          ),
          {
            reply_markup: Markup.inlineKeyboard([
              [Markup.button.callback('Верно', `accept#${ctx.scene.state.item.orderID}`)],
              [Markup.button.callback('Назад', `proceed#${ctx.scene.state.item.item}`)]
            ]).reply_markup,
            parse_mode: 'HTML'
          }
        );
        ctx.scene.leave();
      }

    } catch (e) {
      console.log(e);
      ctx.scene.enter('start', { menu: ctx.scene.state.message });
    }
  }
);

module.exports = proceed;

async function genUniqueID() {
  const id = crypto.randomInt(100000, 999999);
  const check = await orders.findOne({
    orderID: id
  }, '_id');

  if (check) return await genUniqueID();
  else return id;
}