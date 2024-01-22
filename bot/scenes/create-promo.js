const { Scenes, Markup } = require('telegraf');
const escapeHTML = require('escape-html');
const promotions = require('../../models/promotions');

const createPromo = new Scenes.WizardScene(
  'create-promo',
  async ctx => {
    try {
      ctx.wizard.state.menu = ctx.callbackQuery.message;

      const messageData = {
        text: 'Введите новый промокод',
        keyboard: Markup.inlineKeyboard([
          [Markup.button.callback('Назад', 'exit')]
        ]).reply_markup
      };

      ctx.wizard.state.messages = new Map([
        [ctx.wizard.cursor.toString(), messageData]
      ]);
      await ctx.editMessageText(messageData.text, {
        parse_mode: 'HTML',
        reply_markup: messageData.keyboard
      });

      ctx.wizard.next();
    } catch (error) {
      console.log(error);
      ctx.reply(error.message).catch(() => null);
    }
  },
  async ctx => {
    try {
      if (ctx.updateType !== 'message') return;
      ctx.deleteMessage().catch(() => null);

      const value = ctx.message.text.trim();
      const check = await promotions.exists({
        value
      });

      if (check) {
        ctx
          .reply(`⚠️ Промокод <code>${value}</code> уже существует`, {
            parse_mode: 'HTML'
          })
          .catch(() => null)
          .then(msg =>
            setTimeout(
              () =>
                ctx.telegram
                  .deleteMessage(ctx.from.id, msg.message_id)
                  .catch(() => null),
              2500
            )
          );
        return;
      }

      ctx.wizard.state.promo = {
        value
      };

      const uses = ['1', '10', '50', '100', '500', '1000'];
      const keys = [];
      if (uses) {
        for (const count of uses) {
          keys.push([Markup.button.callback(count, `uses:${count}`)]);
        }
      }
      keys.push([
        Markup.button.callback('Назад', 'back'),
        Markup.button.callback('Отмена', 'exit')
      ]);

      const messageData = {
        text: '<b>Введите или выберите число использований</b>',
        keyboard: Markup.inlineKeyboard(keys).reply_markup
      };

      ctx.wizard.state.messages.set(ctx.wizard.cursor.toString(), messageData);

      await ctx.telegram.editMessageText(
        ctx.from.id,
        ctx.wizard.state.menu.message_id,
        undefined,
        messageData.text,
        {
          parse_mode: 'HTML',
          reply_markup: messageData.keyboard
        }
      );
      ctx.wizard.next();
    } catch (error) {
      console.log(error);
      ctx.reply(error.message).catch(() => null);
    }
  },
  async ctx => {
    try {
      let uses;
      if (ctx.updateType === 'message') {
        ctx.deleteMessage().catch(() => null);
        uses = Number(ctx.message.text);
      } else if (ctx.updateType === 'callback_query') {
        uses = Number(/^uses:(.+)$/.exec(ctx.callbackQuery.data)[1]);
      }

      if (Number.isNaN(uses) || uses <= 0) {
        ctx
          .reply('Число использований должно быть числом больше 0')
          .then(msg =>
            setTimeout(
              () => ctx.deleteMessage(msg.message_id).catch(() => null),
              200
            )
          )
          .catch(() => null);
        return;
      }

      ctx.wizard.state.promo.uses = uses;

      const amounts = ['20', '50', '100', '200', '500', '1000'];
      const keyboard = [];
      if (amounts) {
        for (const amount of amounts) {
          keyboard.push([Markup.button.callback(amount, `amount:${amount}`)]);
        }
      }

      keyboard.push([
        Markup.button.callback('Назад', 'back'),
        Markup.button.callback('Отмена', 'cancel')
      ]);

      const messageData = {
        text: 'Укажите сумму пополнения',
        keyboard: Markup.inlineKeyboard(keyboard).reply_markup
      };

      ctx.wizard.state.messages.set(ctx.wizard.cursor.toString(), messageData);

      await ctx.telegram.editMessageText(
        ctx.from.id,
        ctx.wizard.state.menu.message_id,
        undefined,
        messageData.text,
        {
          parse_mode: 'HTML',
          reply_markup: messageData.keyboard
        }
      );

      ctx.wizard.next();
    } catch (error) {
      console.log(error);
      ctx.reply(error.message).catch(() => null);
    }
  },
  async ctx => {
    try {
      let amount;
      if (
        ctx.updateType === 'callback_query' &&
        ctx.callbackQuery.data.startsWith('amount')
      ) {
        amount = Number(/:(\d+)$/i.exec(ctx.callbackQuery.data)[1]);
      } else if (ctx.updateType === 'message') {
        ctx.deleteMessage().catch(() => null);
        amount = Number(ctx.message.text.trim());
      } else {
        return;
      }

      if (Number.isNaN(amount) || amount <= 0) {
        ctx
          .reply('Число использований должно быть числом больше 0')
          .then(msg =>
            setTimeout(
              () => ctx.deleteMessage(msg.message_id).catch(() => null),
              200
            )
          )
          .catch(() => null);
        return;
      }

      ctx.wizard.state.promo.amount = amount;

      const { promo } = ctx.wizard.state;

      await ctx.telegram.editMessageText(
        ctx.from.id,
        ctx.wizard.state.menu.message_id,
        undefined,
        `<b>Промокод ${promo.value}</b>\n\nЧисло использований: ${promo.uses}\nСумма пополнения: ${promo.amount}`,
        {
          parse_mode: 'HTML',
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('Сохранить', 'save-promo')],
            [Markup.button.callback('Назад', 'back')]
          ]).reply_markup
        }
      );
    } catch (error) {
      console.log(error);
      ctx.reply(error.message).catch(() => null);
    }
  }
);

createPromo.action('back', async ctx => {
  try {
    const message = ctx.wizard.state.messages.get(
      (ctx.wizard.cursor - 2).toString()
    );
    if (!message) return;

    await ctx.telegram.editMessageText(
      ctx.from.id,
      ctx.wizard.state.menu.message_id,
      undefined,
      message.text,
      {
        parse_mode: 'HTML',
        reply_markup: message.keyboard
      }
    );

    ctx.wizard.back();
  } catch (error) {
    console.log(error);
    ctx.answerCbQuery('Что-то пошло не так').catch(() => null);
  }
});

createPromo.action('exit', ctx =>
  ctx.scene.enter('promotions', ctx.scene.state)
);

createPromo.action('save-promo', async ctx => {
  try {
    const { promo: rawPromo } = ctx.wizard.state;

    const promo = await promotions.create({
      ...rawPromo,
      durability: rawPromo.uses,
      uses: 0
    });

    if (!promo) {
      throw new Error('Failed promo creation');
    }

    await ctx.reply(
      `Промокод <code>${escapeHTML(
        promo.value
      )}</code> создан\n\nИспользований: ${promo.durability}\nСумма: ${
        promo.amount
      }`,
      {
        parse_mode: 'HTML'
      }
    );
  } catch (error) {
    console.log(error);
    ctx
      .reply('Что-то пошло не так во время сохранения карты')
      .catch(() => null);
  } finally {
    ctx.scene.enter('promotions', ctx.scene.state);
  }
});

module.exports = createPromo;
