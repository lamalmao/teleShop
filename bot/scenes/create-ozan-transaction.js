const { Scenes, Markup } = require('telegraf');
const users = require('../../models/users');
const escapeHTML = require('escape-html');
const ozanAccounts = require('../../models/ozan-accounts');

const createOzanTransaction = new Scenes.WizardScene(
  'create-ozan-transaction',
  async ctx => {
    try {
      const check = await users.exists({
        telegramID: ctx.from.id,
        role: 'admin'
      });
      if (!check) {
        throw new Error('No access');
      }

      ctx.wizard.state.menu = ctx.callbackQuery.message.message_id;
      ctx.wizard.state.transaction = { issuer: ctx.from.id };
      await ctx.editMessageText('<b>Введите сумму транзакции</b>', {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('Отмена', 'exit')]
        ]).reply_markup
      });
      ctx.wizard.next();
    } catch (error) {
      console.log(error);
      ctx.scene.enter('manager-ozan', ctx.scene.state);
    }
  },
  async ctx => {
    try {
      if (!ctx.message.text) {
        return;
      }

      const amount = Number(ctx.message.text.trim());
      if (Number.isNaN(amount) || amount === 0) {
        ctx
          .reply('<b>Значение должно быть числом и не равно нулю</b>', {
            parse_mode: 'HTML'
          })
          .then(msg =>
            setTimeout(
              () => ctx.deleteMessage(msg.message_id).catch(() => null),
              2500
            )
          )
          .catch(() => null);
        return;
      }

      const choice = amount > 0 ? 'Ручное пополнение' : 'Ручное списание';
      ctx.wizard.state.transaction.amount = amount;
      await ctx.telegram.editMessageText(
        ctx.from.id,
        ctx.wizard.state.menu,
        undefined,
        '<b>Введите или выберите описание транзакции</b>',
        {
          parse_mode: 'HTML',
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback(choice, choice)],
            [Markup.button.callback('Назад', 'back')]
          ]).reply_markup
        }
      );

      ctx.wizard.next();
    } catch (error) {
      console.log(error);
    }
  },
  async ctx => {
    try {
      const description = ctx.message?.text || ctx.callbackQuery.data;
      if (!description) {
        return;
      }

      ctx.wizard.state.transaction.description = description;

      const { transaction } = ctx.wizard.state;
      await ctx.telegram.editMessageText(
        ctx.from.id,
        ctx.wizard.state.menu,
        undefined,
        `<u>Создание транзакции</u>\n\n<b>Сумма:</b> <code>${
          transaction.amount > 0 ? '+' : ''
        }${transaction.amount.toFixed(
          2
        )}</code>\n<b>Описание:</b> <i>${escapeHTML(
          transaction.description
        )}</i>\n\n<b>Сохранить?</b>`,
        {
          parse_mode: 'HTML',
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('Да', 'save')],
            [Markup.button.callback('Нет', 'exit')]
          ]).reply_markup
        }
      );
    } catch (error) {
      console.log(error);
    }
  }
);

createOzanTransaction.action('save', async ctx => {
  try {
    const { accountId, target } = ctx.scene.state;
    const account = await ozanAccounts.findById(accountId);

    await account.createTransaction(ctx.wizard.state.transaction);
    ctx.telegram
      .sendMessage(
        target,
        `Ваш ozan счёт пополнен на ${ctx.wizard.state.transaction.amount.toFixed(
          2
        )} лир`,
        {
          parse_mode: 'HTML'
        }
      )
      .catch(() => null);

    ctx.answerCbQuery('Транзакция сохранена').catch(() => null);
  } catch (error) {
    console.log(error);
  } finally {
    ctx.scene.enter('manager-ozan', ctx.scene.state);
  }
});

createOzanTransaction.on('message', (ctx, next) => {
  ctx.deleteMessage().catch(() => null);
  next();
});

createOzanTransaction.action('exit', ctx =>
  ctx.scene.enter('manager-ozan', ctx.scene.state)
);

createOzanTransaction.action('back', ctx =>
  ctx.scene.enter('create-ozan-transaction', ctx.scene.state)
);

module.exports = createOzanTransaction;
