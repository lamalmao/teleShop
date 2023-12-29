const { Scenes, Markup } = require('telegraf');
const { checkUsername, refillSteamViaAPI } = require('../../kupikod');
const escapeHTML = require('escape-html');
const users = require('../../models/users');
const orders = require('../../models/orders');
const crypto = require('crypto');
const sendMenu = require('../menu');
const path = require('path');

const refillSteam = new Scenes.BaseScene('refill-steam');

refillSteam.enterHandler = async ctx => {
  try {
    await ctx.editMessageMedia({
      type: 'photo',
      media: {
        source: path.resolve('files', 'images', 'blank_steam.png')
      }
    });

    await ctx.editMessageCaption(
      `Укажите логин Steam аккаунта, на который хотите пополнить баланс:\n\nАвтоматическое пополнение баланса в Steam на аккаунты России, Украины, Казахстана.\n\n⚠️ Обратите внимание! Логин - это то, что вы указываете при входе в Steam. Указав неверные данные, средства уйдут другому пользователю. Чтобы посмотреть свой нажми <a href="https://store.steampowered.com/account/">тут</a>\n\n<a href="https://telegra.ph/Popolnenie-balansa-Steam-v-FBZ-SHOP-12-28">Прочитай если пополняешь впервые</a>`,
      {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
          Markup.button.callback('Назад', 'exit')
        ]).reply_markup
      }
    );

    ctx.scene.state.target = 'username';
    ctx.scene.state.menu = ctx.callbackQuery.message.message_id;
  } catch (error) {
    console.log(error);
    ctx.scene.leave();
  }
};

refillSteam.on(
  'message',
  (ctx, next) => {
    ctx.deleteMessage().catch(() => null);
    next();
  },
  async (ctx, next) => {
    try {
      const { target, menu } = ctx.scene.state;
      if (target !== 'username') {
        next();
        return;
      }

      const checkMessage = await ctx.reply('Проверяю логин...');
      const username = ctx.message.text.trim();
      const check = await checkUsername(username);
      ctx.deleteMessage(checkMessage.message_id).catch(() => null);

      if (check !== 'exists') {
        const msg =
          check === 'failed'
            ? 'Не удалось проверить ваш логин'
            : `Логина "${username}" не существует`;

        ctx
          .reply(msg)
          .then(msg =>
            setTimeout(
              () => ctx.deleteMessage(msg.message_id).catch(() => null),
              3500
            )
          )
          .catch(() => null);
        return;
      }

      ctx.scene.state.username = username;
      ctx.scene.state.target = 'amount';
      await ctx.telegram.editMessageCaption(
        ctx.from.id,
        menu,
        undefined,
        `Напишите или выберите сумму для пополнения Steam на аккаунт ${username}\n\nИногда сумма зачисления может отличаться до 3% от указанной из-за динамично меняющихся курсов валют.`,
        {
          reply_markup: Markup.inlineKeyboard([
            [
              Markup.button.callback('100', 'set-amount:100'),
              Markup.button.callback('250', 'set-amount:250'),
              Markup.button.callback('500', 'set-amount:500')
            ],
            [
              Markup.button.callback('1.000', 'set-amount:1000'),
              Markup.button.callback('2.500', 'set-amount:2500'),
              Markup.button.callback('5.000', 'set-amount:5000')
            ],
            [Markup.button.callback('Назад', 'back')]
          ]).reply_markup
        }
      );
    } catch (error) {
      console.log(error);
    }
  },
  async ctx => {
    try {
      const { username, menu } = ctx.scene.state;

      const amount = Number(ctx.message.text.trim());
      if (Number.isNaN(amount) || amount < 30 || amount > 10000) {
        ctx
          .reply('Введите сумму более 30 рублей и менее 10.000 рублей')
          .then(msg =>
            setTimeout(
              () => ctx.deleteMessage(msg.message_id).catch(() => null),
              2500
            )
          )
          .catch(() => null);
        return;
      }

      ctx.scene.state.amount = Math.ceil(amount);
      ctx.telegram
        .editMessageCaption(
          ctx.from.id,
          menu,
          undefined,
          `<b>Вы подтверждаете пополнение Steam аккаунта "${escapeHTML(
            username
          )} на ${amount} рублей за <b>${Math.ceil(
            amount * global.steamFee
          )} рублей</b>?"</b>\n\n<i>Если хотите изменить сумму - напишите новую</i>`,
          {
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard([
              [Markup.button.callback('Да', 'refill')],
              [Markup.button.callback('Нет', 'exit')]
            ]).reply_markup
          }
        )
        .catch(() => null);
    } catch (error) {
      console.log(error);
    }
  }
);

refillSteam.action(/set-amount:\d+/, async ctx => {
  try {
    const { menu, username } = ctx.scene.state;

    const raw = /:(?<amount>\d+)$/.exec(ctx.callbackQuery.data);
    if (!raw) {
      throw new Error('No data');
    }

    const { amount } = raw.groups;
    ctx.scene.state.amount = Number(amount);

    ctx.telegram
      .editMessageCaption(
        ctx.from.id,
        menu,
        undefined,
        `<b>Вы подтверждаете пополнение Steam аккаунта "${escapeHTML(
          username
        )} на ${amount} рублей за <b>${Math.ceil(
          amount * global.steamFee
        )} рублей</b>?"</b>\n\n<i>Если хотите изменить сумму - напишите новую</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('Да', 'refill')],
            [Markup.button.callback('Нет', 'exit')]
          ]).reply_markup
        }
      )
      .catch(() => null);
  } catch (error) {
    console.log(error);
  }
});

refillSteam.action('refill', async ctx => {
  try {
    const { amount, username } = ctx.scene.state;

    const user = await users.findOne(
      {
        telegramID: ctx.from.id
      },
      {
        balance: 1
      }
    );

    if (!user) {
      throw new Error('No user found');
    }

    const finalAmount = Math.ceil(amount * global.steamFee);
    if (user.balance < finalAmount) {
      const refillAmount = finalAmount - user.balance;
      ctx.reply(`На вашем счету не хватает ${refillAmount} рублей`);
      ctx.scene.enter('pay', {
        amount: refillAmount,
        menu: ctx.callbackQuery.message
      });
      return;
    }

    const orderID = await genUniqueID();
    const kupikodID = crypto.randomUUID();

    const refillOrder = await refillSteamViaAPI(username, amount, kupikodID);

    if (!refillOrder) {
      await ctx.editMessageCaption(
        'Во время выполнения заказа произошла ошибка, деньги возвращены на ваш баланс'
      );

      ctx.scene.leave();
      await sendMenu(ctx);
      return;
    }

    const order = await orders.create({
      orderID,
      kupikodID,
      client: ctx.from.id,
      status: 'processing',
      paid: true,
      itemTitle: `Пополнение Steam: ${username}`,
      steam: true,
      steamUsername: username,
      amount: finalAmount
    });

    if (order) {
      await users.updateOne(
        {
          telegramID: ctx.from.id
        },
        {
          $inc: {
            balance: -finalAmount
          }
        }
      );

      await ctx.editMessageCaption(
        `Заказ <code>${orderID}</code> оформлен\n\nВаш Steam аккаунт (${escapeHTML(
          username
        )}) будет пополнен на ${amount.toFixed(2)} rub / ${(
          amount * 0.4041
        ).toFixed(2)} uah / ${(amount / 0.2014).toFixed(
          2
        )} kzt\n\nПосле пополнения вы получите уведомление.`,
        {
          parse_mode: 'HTML'
        }
      );

      ctx.scene.leave();
      await sendMenu(ctx);
    }
  } catch (error) {
    console.log(error);
    ctx.scene.enter('shop');
  }
});

refillSteam.action('exit', ctx => ctx.scene.enter('shop'));
refillSteam.action('back', ctx => ctx.scene.enter('refill-steam'));

async function genUniqueID() {
  const id = crypto.randomInt(100000, 999999);
  const check = await orders.findOne(
    {
      orderID: id
    },
    '_id'
  );

  if (check) return await genUniqueID();
  else return id;
}

module.exports = refillSteam;
