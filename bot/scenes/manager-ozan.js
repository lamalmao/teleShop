const { Scenes, Markup } = require('telegraf');
const users = require('../../models/users');
const ozanAccounts = require('../../models/ozan-accounts');
const ozanTransactions = require('../../models/ozan-transactions');

const managerOzan = new Scenes.BaseScene('manager-ozan');

managerOzan.enterHandler = async ctx => {
  try {
    const { target, admin } = ctx.scene.state;
    const id = target || ctx.from.id;
    const filter = admin
      ? 'admin'
      : {
          $ne: 'client'
        };

    const check = await users.exists({
      telegramID: ctx.from.id,
      role: filter
    });
    if (!check) {
      throw new Error('No access');
    }

    const manager = await users.findOne(
      {
        telegramID: id
      },
      {
        username: 1
      }
    );
    ctx.scene.state.managerUsername = manager.username;

    const account = await ozanAccounts.findOne({
      employer: id
    });
    if (!account) {
      throw new Error('No account found');
    }

    const [stats] = await ozanTransactions.aggregate([
      {
        $facet: {
          incomes: [
            {
              $match: {
                account: account._id,
                success: true,
                amount: {
                  $gt: 0
                }
              }
            },
            {
              $group: {
                _id: 'incomes',
                sum: {
                  $sum: '$amount'
                }
              }
            }
          ],
          expenses: [
            {
              $match: {
                account: account._id,
                success: true,
                amount: {
                  $lt: 0
                }
              }
            },
            {
              $group: {
                _id: 'expenses',
                sum: {
                  $sum: '$amount'
                }
              }
            }
          ]
        }
      }
    ]);

    ctx.scene.state.accountId = account._id;
    const incomes = stats.incomes.length !== 0 ? stats.incomes[0].sum : 0;
    const expenses =
      stats.expenses.length !== 0 ? Math.abs(stats.expenses[0].sum) : 0;

    ctx.telegram
      .editMessageText(
        ctx.from.id,
        ctx.scene.state.ozanMenu || ctx.callbackQuery.message.message_id,
        undefined,
        `<u>Счет ozan менеджера ${id}</u>\n\n<b>Начальный баланс:</b> <code>${(
          account.balance -
          incomes +
          expenses
        ).toFixed(2)}</code> лир\n<i>Пополнено:</i> <code>${incomes.toFixed(
          2
        )}</code> лир\n<i>Траты:</i> <code>${expenses.toFixed(
          2
        )}</code> лир\n<b>Ожидаемый баланс:</b> <code>${account.balance.toFixed(
          2
        )}</code> лир`,
        {
          parse_mode: 'HTML',
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('Транзакции', 'transactions')],
            [
              Markup.button.callback(
                'Создать транзакцию',
                'ozan-refill',
                !admin
              ),
              Markup.button.callback('Создал карту', 'ozan-card', !!admin)
            ],
            [Markup.button.callback('Назад', 'exit')]
          ]).reply_markup
        }
      )
      .catch(() => null);
  } catch (error) {
    console.log(error);
    ctx.scene.enter('manager_menu');
  }
};

managerOzan.action('ozan-refill', ctx =>
  ctx.scene.enter('create-ozan-transaction', ctx.scene.state)
);

managerOzan.action('transactions', ctx =>
  ctx.scene.enter('ozan-transactions', {
    menu: ctx.callbackQuery.message.message_id,
    ...ctx.scene.state
  })
);

managerOzan.action('ozan-card', async ctx => {
  try {
    ctx.scene.state.ozanMenu = ctx.callbackQuery.message.message_id;

    await ctx.reply('<b>Подтверждаете создание карты?</b>', {
      parse_mode: 'HTML',
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('Да', 'card-created')],
        [Markup.button.callback('Нет', 'delete')]
      ]).reply_markup
    });
  } catch (error) {
    console.log(error);
  }
});

managerOzan.action('card-created', async ctx => {
  try {
    ctx.deleteMessage().catch(() => null);
    const ozanAccount = await ozanAccounts.findOne({
      employer: ctx.from.id
    });

    if (!ozanAccount) {
      return;
    }

    await ozanAccount.createTransaction({
      description: 'Создание карты',
      amount: -(global.ozanCardCost || 29.99),
      issuer: ctx.from.id
    });

    ctx.answerCbQuery('Транзакция сохранена').catch(() => null);
    ctx.scene.enter('manager-ozan', ctx.scene.state);
  } catch (error) {
    console.log(error);
  }
});

managerOzan.action('delete', ctx => ctx.deleteMessage().catch(() => null));

managerOzan.action('exit', ctx => {
  const { admin } = ctx.scene.state;
  if (admin) {
    ctx.scene.enter('showManagers');
  } else {
    ctx.scene.enter('manager_menu');
  }
});

module.exports = managerOzan;
