const { Scenes, Markup } = require('telegraf');
const users = require('../../models/users');
const ozanAccounts = require('../../models/ozan-accounts');
const ozanTransactions = require('../../models/ozan-transactions');
const moment = require('moment');
const escapeHTML = require('escape-html');
const { Types } = require('mongoose');
const orders = require('../../models/orders');

const ozanTransactionsScene = new Scenes.BaseScene('ozan-transactions');

ozanTransactionsScene.enterHandler = async ctx => {
  try {
    const {
      target,
      accountId: account,
      managerUsername,
      admin,
      menu
    } = ctx.scene.state;

    if (admin) {
      const check = await users.findOne({
        telegramID: ctx.from.id,
        role: 'admin'
      });
      if (!check) {
        throw new Error('No access');
      }
    }

    const transactions = await ozanTransactions.find(
      {
        account
      },
      null,
      {
        sort: {
          date: 1
        }
      }
    );
    ctx.scene.state.transactions = transactions;
    ctx.scene.state.page = 0;
    ctx.scene.state.pageSize = 30;

    const pagedTransactions = transactions.slice(0, ctx.scene.state.pageSize);

    let text = `<b>Список транзакций менеджера <a href="tg://user?id=${target}">${
      escapeHTML(managerUsername) || 'Неизвестно'
    }</a></b>\n<i>Для выбора транзакции - укажите ее номер из списка ниже</i>\n`;

    for (let i = 0; i < pagedTransactions.length; i++) {
      const { date, amount, success } = pagedTransactions[i];
      text = text.concat(
        `\n<b>${i + 1}.</b><i>${moment(date)
          .locale('ru')
          .format('DD.MM.YYYY [в] HH:mm:ss')}</i> | <code>${
          amount > 0 ? '+' : ''
        }${amount.toFixed(2)}</code> лир | ${success ? '✔️' : '❌'}`
      );
    }

    ctx.scene.state.menu = ctx.callbackQuery.message.message_id;
    ctx.telegram
      .editMessageText(
        ctx.from.id,
        menu || ctx.callbackQuery.message.message_id,
        undefined,
        text,
        {
          parse_mode: 'HTML',
          reply_markup: Markup.inlineKeyboard([
            [
              Markup.button.callback(
                '>>',
                'page-forward',
                transactions.length < ctx.scene.state.pageSize
              )
            ],
            [
              Markup.button.callback(
                'Удалить все транзакции',
                'delete-all',
                !(admin && transactions.length > 0)
              )
            ],
            [Markup.button.callback('Назад', 'exit')]
          ]).reply_markup
        }
      )
      .catch(() => null);
  } catch (error) {
    ctx.scene.leave();
    console.log(error);
  }
};

ozanTransactionsScene.action(/page-(back|forward)/, async ctx => {
  try {
    const raw = /(?<direction>back|forward)/.exec(ctx.callbackQuery.data);
    if (!raw) {
      throw new Error('No data');
    }

    const { direction } = raw.groups;
    ctx.scene.state.page += direction === 'forward' ? 1 : -1;

    const {
      transactions,
      page,
      pageSize,
      managerUsername,
      target,
      menu,
      admin
    } = ctx.scene.state;
    const pagedTransactions = transactions.slice(
      page * pageSize,
      (page + 1) * pageSize
    );

    let text = `<b>Список транзакций менеджера <a href="tg://user?id=${target}">${
      escapeHTML(managerUsername) || 'Неизвестно'
    }</a></b>\n<i>Для выбора транзакции - укажите ее номер из списка ниже</i>\n`;

    let realIndex = page * pageSize;
    for (let i = 0; i < pagedTransactions.length; i++) {
      const { date, amount, success } = pagedTransactions[i];
      text = text.concat(
        `\n<b>${realIndex + 1}.</b><i>${moment(date)
          .locale('ru')
          .format('DD.MM.YYYY [в] HH:mm:ss')}</i> | <code>${
          amount > 0 ? '+' : ''
        }${amount.toFixed(2)}</code> лир | ${success ? '✔️' : '❌'}`
      );

      realIndex++;
    }

    ctx.telegram
      .editMessageText(ctx.from.id, menu, undefined, text, {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
          [
            Markup.button.callback('<<', 'page-back', page === 0),
            Markup.button.callback(
              '>>',
              'page-forward',
              !(page < Math.ceil(transactions.length / pageSize))
            )
          ],
          [
            Markup.button.callback(
              'Удалить все транзакции',
              'delete-all',
              !(admin && transactions.length > 0)
            )
          ],
          [Markup.button.callback('Назад', 'exit')]
        ]).reply_markup
      })
      .catch(e => console.log(e));
  } catch (error) {
    console.log(error);
  }
});

ozanTransactionsScene.action('delete-all', async ctx => {
  try {
    const check = await users.findOne({
      telegramID: ctx.from.id,
      role: 'admin'
    });
    if (!check) {
      throw new Error('No access');
    }

    ctx.editMessageText('<b>Вы уверен что хотите удалить все транзакции?</b>', {
      parse_mode: 'HTML',
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('Да', 'delete-all-success')],
        [Markup.button.callback('Нет', 'back')]
      ]).reply_markup
    });
  } catch (error) {
    console.log(error);
  }
});

ozanTransactionsScene.on(
  'message',
  (ctx, next) => {
    ctx.deleteMessage().catch(() => null);

    const { transactions } = ctx.scene.state;
    const number = Number(ctx.message.text) - 1;
    if (!Number.isNaN(number) && number > -1 && number < transactions.length) {
      ctx.scene.state.number = number;
      next();
    } else {
      ctx
        .reply('Значение не число или не соответствует транзакции')
        .then(msg =>
          setTimeout(
            () => ctx.deleteMessage(msg.message_id).catch(() => null),
            2500
          )
        )
        .catch(() => null);
    }
  },
  async ctx => {
    try {
      const { number, admin, transactions, transactionsMenu } = ctx.scene.state;
      const transaction = transactions[number];
      const { username: issuer } = await users.findOne(
        {
          telegramID: transaction.issuer
        },
        {
          username: 1
        }
      );

      const order = transaction.order
        ? await orders.findOne(
            {
              orderID: transaction.order
            },
            { itemTitle: 1 }
          )
        : null;

      const text = `<b>Транзакция <code>${
        transaction._id
      }</code></b>\n\n<i>Дата:</i> <code>${moment(transaction.date)
        .locale('ru')
        .format('DD.MM.YYYY [в] HH:mm:ss')}</code>\n<i>Сумма:</i> <code>${
        transaction.amount > 0 ? '+' : ''
      }${transaction.amount.toFixed(
        2
      )}</code> лир\n<i>Пользователь: </i> <a href="tg://user?id=${
        transaction.issuer
      }">${issuer || 'неизвестно'}</a>\n<i>Заказ:</i> <code>${
        transaction.order || '-'
      }</code>\n<i>Товар: ${escapeHTML(
        order?.itemTitle || '-'
      )}</i>\n<i>Описание: </i> <code>${escapeHTML(
        transaction.description
      )}</code>`;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            'Удалить транзакцию',
            `delete-transaction:${transaction._id.toString()}`,
            !admin
          )
        ]
      ]).reply_markup;

      if (!transactionsMenu) {
        const menu = await ctx.reply(text, {
          parse_mode: 'HTML',
          reply_markup: keyboard
        });
        ctx.scene.state.transactionsMenu = menu.message_id;
      } else {
        ctx.telegram
          .editMessageText(ctx.from.id, transactionsMenu, undefined, text, {
            parse_mode: 'HTML',
            reply_markup: keyboard
          })
          .catch(() => null);
      }
    } catch (error) {
      console.log(error);
    }
  }
);

ozanTransactionsScene.action('delete-all-success', async ctx => {
  try {
    const { accountId: account } = ctx.scene.state;
    const check = await users.findOne({
      telegramID: ctx.from.id,
      role: 'admin'
    });
    if (!check) {
      throw new Error('No access');
    }

    await ozanTransactions.deleteMany({
      account
    });

    ctx.answerCbQuery('Транзакции удалены').catch(() => null);
    ctx.scene.enter('ozan-transactions', ctx.scene.state);
  } catch (error) {
    console.log(error);
  }
});

ozanTransactionsScene.action(/delete-transaction:[a-z0-9]+/, async ctx => {
  try {
    const raw = /:(?<transactionRawId>[a-z0-9]+)$/.exec(ctx.callbackQuery.data);
    if (!raw) {
      throw new Error('No data');
    }

    const { transactionRawId } = raw.groups;
    const transactionId = new Types.ObjectId(transactionRawId);
    ctx.scene.state.deleteTarget = transactionId;

    await ctx.editMessageText(
      `<b>Вы действительно хотите удалить транзакцию?</b>`,
      {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('Да', 'transaction-delete-accept')],
          [Markup.button.callback('Нет', 'back')]
        ]).reply_markup
      }
    );
  } catch (error) {
    console.log(error);
  }
});

ozanTransactionsScene.action('transaction-delete-accept', async ctx => {
  try {
    const { deleteTarget } = ctx.scene.state;
    await ozanTransactions.deleteOne({ _id: deleteTarget });

    ctx.answerCbQuery('Удалено').catch(() => null);
    ctx.scene.enter('ozan-transactions', ctx.scene.state);
  } catch (error) {
    console.log(error);
  }
});

ozanTransactionsScene.action('exit', ctx =>
  ctx.scene.enter('manager-ozan', ctx.scene.state)
);

ozanTransactionsScene.action('back', ctx =>
  ctx.scene.enter('ozan-transactions', ctx.scene.state)
);

ozanTransactionsScene.leaveHandler = ctx => {
  if (ctx.scene.state.transactionsMenu) {
    ctx.deleteMessage(ctx.scene.state.transactionsMenu).catch(() => null);
  }

  ctx.scene.state.deleteTarget = undefined;
  ctx.scene.state.transactionsMenu = undefined;
  ctx.scene.state.transactions = undefined;
};

module.exports = ozanTransactionsScene;
