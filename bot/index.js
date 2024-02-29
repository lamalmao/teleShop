const { Telegraf, session, Markup } = require('telegraf');
const stage = require('./scenes');
const clean = require('../cleanup');
const users = require('../models/users');
const payments = require('../models/payments');
const keys = require('./keyboard');
const messages = require('./messages');
const path = require('path');
const goods = require('../models/goods');
const { delivery } = require('../models/delivery');
const managerKey = require('../models/manager-keys');
const orders = require('../models/orders');
const { Types } = require('mongoose');
const cards = require('../models/cards');
const cardTransactions = require('../models/cards-transactions');
const escapeHTML = require('escape-html');
const tickets = require('../models/tickets');
const { getBalance } = require('../kupikod');

const images = path.join(process.cwd(), 'files', 'images');

function CreateBot(token) {
  const bot = new Telegraf(token);

  global.suspend = false;

  // bot.use((ctx, next) => {
  //   if (ctx.callbackQuery && ctx.callbackQuery.data) {
  //     console.log(ctx.callbackQuery.data);
  //   }

  //   next();
  // });

  bot.use(session());
  bot.use(stage.middleware());

  bot.start(ctx => ctx.scene.enter('start'));

  bot.command('switch', async ctx => {
    try {
      const user = await users.findOne(
        {
          telegramID: ctx.from.id
        },
        'role'
      );

      if (user && user.role === 'admin') {
        global.suspend = !global.suspend;
        await ctx.reply(
          `Продажи ${
            global.suspend ? 'приостановлены' : 'возобновлены'
          }.\n/switch для того чтобы ${
            global.suspend ? 'возобновить' : 'приостановить'
          }`
        );
      }
    } catch (e) {
      null;
    }
  });

  bot.command(
    'deltrans',
    async (ctx, next) => {
      try {
        const user = await users.findOne(
          {
            telegramID: ctx.from.id
          },
          {
            role: 1
          }
        );

        if (!user || user.role !== 'admin') {
          return;
        }

        next();
      } catch {}
    },
    async ctx => {
      try {
        await ctx.reply('Удалить все транзакции всех карт?', {
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('Да', 'sure-delete-transactions')],
            [Markup.button.callback('Нет', 'delete-message')]
          ]).reply_markup
        });
      } catch (error) {
        console.log(error);
      }
    }
  );

  bot.command(
    'ozan',
    async (ctx, next) => {
      try {
        const check = await users.exists({
          telegramID: ctx.from.id,
          role: 'admin'
        });

        if (check) {
          next();
        }
      } catch (error) {
        console.log(error);
      }
    },
    async ctx => {
      try {
        await ctx.reply(
          `<b>Стоимость создания карты: ${global.ozanCardCost} лир</b>`,
          {
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard([
              [Markup.button.callback('Изменить', 'change-ozan-card-cost')]
            ]).reply_markup
          }
        );
      } catch (error) {
        console.log(error);
      }
    }
  );

  bot.action(/ozan-paid:\d+/, async ctx => {
    try {
      const check = await users.findOne({
        telegramID: ctx.from.id,
        role: {
          $in: ['admin', 'manager']
        }
      });

      if (!!check) {
        const raw = /:(?<orderId>\d+)$/.exec(ctx.callbackQuery.data);
        if (!raw) {
          return;
        }

        const { orderId } = raw.groups;
        ctx.scene.enter('ozan-paid', {
          order: Number(orderId)
        });
      }
    } catch (error) {
      console.log(error);
    }
  });

  bot.action(/ozan-cancel:\d+/, async ctx => {
    try {
      const check = await users.exists({
        telegramID: ctx.from.id,
        role: {
          $in: ['admin', 'manager']
        }
      });

      if (!check) {
        ctx.deleteMessage().catch(() => null);
        return;
      }

      const raw = /:(?<orderId>\d+)$/.exec(ctx.callbackQuery.data);
      if (!raw) {
        return;
      }

      const { orderId } = raw.groups;
      const orderID = Number(orderId);
      const result = await orders.updateOne(
        {
          orderID,
          ozan: true,
          ozanPaid: false
        },
        {
          $set: {
            ozan: false
          }
        }
      );

      const text =
        result.modifiedCount === 1 ? 'Платеж отменён' : 'Более не актуально';

      ctx.answerCbQuery(text).catch(() => null);
      if (result.modifiedCount === 1) {
        ctx.scene.enter('take_order', {
          orderID
        });
      }
    } catch (error) {
      console.log(error);
    }
  });

  bot.action(
    'change-ozan-card-cost',
    async (ctx, next) => {
      try {
        const check = await users.exists({
          telegramID: ctx.from.id,
          role: 'admin'
        });

        if (check) {
          next();
        }
      } catch (error) {
        console.log(error);
      }
    },
    ctx => ctx.scene.enter('change-ozan-card-cost')
  );

  bot.action('manager-ozan', ctx => ctx.scene.enter('manager-ozan'));

  bot.action('problem-not-solved', ctx =>
    ctx.scene.enter('problem-not-solved')
  );

  bot.action(
    'sure-delete-transactions',
    async (ctx, next) => {
      try {
        const user = await users.findOne(
          {
            telegramID: ctx.from.id
          },
          {
            role: 1
          }
        );

        if (!user || user.role !== 'admin') {
          ctx.deleteMessage().catch(() => null);
          return;
        }

        next();
      } catch {}
    },
    async ctx => {
      try {
        await cardTransactions.deleteMany({});
        await ctx.editMessageText('Транзакции удалены');
      } catch (error) {
        console.log(e);
      }
    }
  );

  bot.command(
    'orderstats',
    async (ctx, next) => {
      try {
        const user = await users.findOne(
          {
            telegramID: ctx.from.id
          },
          {
            role: 1
          }
        );

        if (user && user.role === 'admin') {
          next();
        }
      } catch {}
    },
    async ctx => {
      try {
        const now = new Date();
        const day = now.getDate();
        const month = now.getMonth();
        const year = now.getFullYear();

        const from = new Date(year, month, day, 0, 0, 0, 0);
        const to = new Date(from.getTime() + 86400000);

        const totalWait = await orders.count({
          paid: true,
          status: 'untaken'
        });

        const orderStats = await orders.aggregate([
          {
            $match: {
              paid: true,
              date: {
                $gte: from,
                $lte: to
              },
              steam: {
                $exists: false
              }
            }
          },
          {
            $group: {
              _id: '$status',
              sum: { $sum: '$amount' },
              count: { $count: {} }
            }
          }
        ]);

        const managerStats = await orders.aggregate([
          {
            $match: {
              paid: true,
              status: 'done',
              date: {
                $gte: from,
                $lte: to
              },
              steam: {
                $exists: false
              }
            }
          },
          {
            $group: {
              _id: '$manager',
              count: { $count: {} }
            }
          }
        ]);

        let total = 0;
        let sum = 0;
        let text = '<u>Статистика заказов за 24 часа</u>\n';

        const data = new Map();

        for (const stat of orderStats) {
          total += stat.count;
          sum += stat._id === 'untaken' ? stat.sum : 0;

          data.set(stat._id, stat.count);
        }

        text = text.concat(
          `\n<b>Заказов за сутки: ${total}</b>\n<i>Отмен за сутки: ${
            data.get('canceled') || 0
          }</i>\n<i>Возвратов за сутки: ${
            data.get('refund') || 0
          }</i>\n<i>Сделано заказов за сутки: ${
            data.get('done') || 0
          }</i>\n<i>Заказов в работе: ${
            data.get('processing') || 0
          }</i>\n<i>Заказов ожидает: ${
            data.get('untaken') || 0
          }</i>\n<b><i>Всего заказов ожидает: ${totalWait}</i></b>\n<b>Сумма заказов: ${sum} рублей</b>\n\n<u>Статистика менеджеров за 24 часа</u>\n`
        );

        for (const managerStat of managerStats) {
          const manager = await users.findOne(
            {
              telegramID: managerStat._id
            },
            {
              username: 1
            }
          );

          text = text.concat(
            `\n<a href="tg://user?id=${managerStat._id}">${escapeHTML(
              manager ? manager.username : 'Ключи'
            )}</a> - ${managerStat.count}`
          );
        }

        await ctx.reply(text, {
          parse_mode: 'HTML'
        });
      } catch (error) {
        console.log(error);
      }
    }
  );

  bot.command('steam', async ctx => {
    try {
      const check = await users.exists({
        telegramID: ctx.from.id,
        role: 'admin'
      });

      if (!check) {
        return;
      }

      global.steamEnabled = !global.steamEnabled;
      await ctx.reply(
        global.steamEnabled
          ? 'Пополнение стима теперь включено'
          : 'Пополнение стима теперь отключено'
      );
    } catch (error) {
      console.log(error);
    }
  });

  bot.command(
    'balance',
    async (ctx, next) => {
      try {
        const user = await users.findOne(
          {
            telegramID: ctx.from.id
          },
          {
            role: 1
          }
        );

        if (user && user.role === 'admin') {
          next();
        }
      } catch {}
    },
    async ctx => {
      try {
        const cardsData = await cards.aggregate([
          {
            $group: {
              _id: '$currency',
              sum: { $sum: '$balance' }
            }
          }
        ]);

        const data = new Map();
        for (const currency of cardsData) {
          data.set(currency._id, currency.sum);
        }

        const total = await cards.countDocuments({});
        const active = await cards.countDocuments({
          busy: false,
          hold: {
            $lt: new Date()
          }
        });

        await ctx.reply(
          `<b>Суммарный баланс карт</b>\n\n<i>UAH - ${
            data.get('UAH')?.toFixed(2) || 0
          }</i>\n<i>USD - ${data.get('USD')?.toFixed(2) || 0}</i>\n<i>EUR - ${
            data.get('EUR')?.toFixed(2) || 0
          }</i>\n\n<b>Всего карт: ${total}</b>\n<i>Активных карт: ${active}</i>\n<i>В холде: ${
            total - active
          }</i>`,
          {
            parse_mode: 'HTML'
          }
        );
      } catch (error) {
        console.log(error);
      }
    }
  );

  bot.command('orders', async (ctx, next) => {
    try {
      const user = await users.findOne(
        {
          telegramID: ctx.from.id
        },
        {
          role: 1
        }
      );

      if (user && user.role !== 'client') {
        await ctx.reply('Никому не передавайте эту ссылку', {
          reply_markup: Markup.inlineKeyboard([
            [
              Markup.button.url(
                'Заказы',
                `http://94.241.175.97/?u=${user._id.toString()}`
              )
            ]
          ]).reply_markup
        });
      }
    } catch {
      null;
    }
  });

  bot.command(
    'codes',
    async (ctx, next) => {
      try {
        const user = await users.findOne(
          {
            telegramID: ctx.from.id
          },
          {
            role: 1
          }
        );

        if (user && user.role === 'admin') {
          next();
        }
      } catch {
        null;
      }
    },
    async ctx => {
      try {
        const autoItems = await goods.find(
          {
            itemType: 'auto'
          },
          {
            title: 1
          }
        );

        const manualItems = await goods.find(
          {
            itemType: {
              $ne: 'auto'
            },
            managerKeys: true
          },
          {
            title: 1
          }
        );

        let msg = 'Ключи для клиентов:\n';

        for (const auto of autoItems) {
          const count = await delivery.countDocuments({
            item: auto._id,
            accessable: true,
            delivered: false
          });

          msg += `${auto.title} - ${count}\n`;
        }

        msg += '\nКлючи для менеджеров:\n';

        for (const manual of manualItems) {
          const count = await managerKey.countDocuments({
            item: manual._id,
            used: false
          });

          msg += `${manual.title} - ${count}\n`;
        }

        let length = msg.length;
        const partsCount = Math.ceil(length / 4096);

        for (let i = 0; i < partsCount; i++) {
          const start = i * 4096;
          const d = length - start;
          const slice = d >= 4096 ? 4096 : d;

          await ctx.reply(msg.slice(start, start + slice));
        }
      } catch (error) {
        ctx.reply('Что-то пошло не так').catch(() => null);
      }
    }
  );

  bot.on('callback_query', (ctx, next) => {
    // null
    ctx.answerCbQuery().catch(_ => null);
    next();
  });

  bot.action(/gift-access-proceed:[a-z0-9]+/, ctx =>
    ctx.scene.enter('gift-access-proceed')
  );

  bot.action(
    /^(card-paid|card-weld-error|card-pay-error|card-return|card-linked):[0-9]+:[a-z0-9]+/,
    async (ctx, next) => {
      try {
        const user = await users.findOne(
          {
            telegramID: ctx.from.id
          },
          {
            role: 1
          }
        );

        if (user && ['admin', 'manager'].includes(user.role)) {
          next();
        }
      } catch (error) {}
    },
    async ctx => {
      try {
        const raw =
          /^(?<type>[a-z\-]+):(?<orderId>\d+):(?<cardId>[a-z0-9]+)$/.exec(
            ctx.callbackQuery.data
          );

        if (!raw) {
          throw new Error('No data');
        }
        const { orderId, cardId, type } = raw.groups;

        console.log(orderId, cardId, type);

        const order = await orders.findOne(
          {
            orderID: Number(orderId)
          },
          {
            card: 1,
            cardPaid: 1,
            manager: 1,
            status: 1
          }
        );

        const cardObjId = new Types.ObjectId(cardId);
        const check = await cards.exists({
          _id: cardObjId
        });

        if (
          order.manager !== ctx.from.id ||
          order.status !== 'processing' ||
          order.card.toString() !== cardId ||
          order.cardPaid ||
          !check
        ) {
          ctx.answerCbQuery('Более не актуально').catch(() => null);
          ctx.deleteMessage(() => null).catch(() => null);
          return;
        }

        let success;
        let text;
        switch (type) {
          case 'card-paid':
            success = 'card-payment';
            text = 'Вы подтверждаете оплату?';
            break;
          case 'card-weld-error':
            success = 'weld-error';
            text = 'Вы подтверждаете ошибку привязки?';
            break;
          case 'card-pay-error':
            success = 'pay-error';
            text = 'Вы подтверждаете ошибку оплаты?';
            break;
          case 'card-return':
            success = 'card-return';
            text = 'Вы подтверждаете возврат карты?';
            break;
          case 'card-linked':
            ctx.scene.enter('find-linked-card', {
              card: cardObjId,
              order: orderId
            });
            return;
          default:
            return;
        }

        await ctx.editMessageText(text, {
          reply_markup: Markup.inlineKeyboard([
            [
              Markup.button.callback(
                'Да',
                `accept-${success}:${orderId}:${cardId}`
              )
            ],
            [Markup.button.callback('Нет', 'delete-message')]
          ]).reply_markup
        });
      } catch (error) {
        console.log(error);
      }
    }
  );

  bot.action(
    /^accept-(card-return|card-payment|weld-error|pay-error):[0-9]+:[a-z0-9]+/,
    async (ctx, next) => {
      try {
        const user = await users.findOne(
          {
            telegramID: ctx.from.id
          },
          {
            role: 1
          }
        );

        if (user && ['admin', 'manager'].includes(user.role)) {
          next();
        }
      } catch (error) {}
    },
    async (ctx, next) => {
      try {
        const raw =
          /accept-(?<target>card-return|card-payment|weld-error|pay-error):(?<orderId>\d+):(?<cardId>[a-z0-9]+)$/.exec(
            ctx.callbackQuery.data
          );

        if (!raw) {
          throw new Error('No data');
        }
        const { orderId, cardId, target } = raw.groups;

        const order = await orders.findOne({
          orderID: Number(orderId)
        });

        const item = await goods.findById(order.item, {
          netCost: 1
        });

        if (!item || !item.netCost) {
          throw new Error('No item found');
        }

        const cardObjId = new Types.ObjectId(cardId);
        const card = await cards.findById(cardObjId);

        if (
          order.manager !== ctx.from.id ||
          order.status !== 'processing' ||
          order.card.toString() !== cardId ||
          order.cardPaid ||
          !card
        ) {
          ctx.answerCbQuery('Более не актуально').catch(() => null);
          ctx.deleteMessage(() => null).catch(() => null);
          return;
        }

        ctx.state.item = item;
        ctx.state.order = order;
        ctx.state.card = card;
        ctx.state.target = target;
        next();
      } catch (error) {
        console.log(error);
      }
    },
    async (ctx, next) => {
      try {
        if (ctx.state.target !== 'card-payment') {
          next();
          return;
        }

        const { card, order, item } = ctx.state;

        const result = await card.createTransaction(card._id, {
          amount: -item.netCost[card.currency],
          currency: card.currency,
          description: `Выполнение заказа ${order.orderID}`,
          issuer: ctx.from.id,
          sendToHold: !order.avoidHold,
          busy: false,
          order: order.orderID,
          cardBalance: card.balance
        });

        if (result === null) {
          ctx
            .answerCbQuery('Не получилось сохранить оплату, попробуйте еще раз')
            .catch(() => null);
          return;
        }

        await orders.updateOne(
          {
            orderID: order.orderID
          },
          {
            $set: {
              cardPaid: true
            }
          }
        );

        ctx.state = {};

        ctx
          .editMessageText(
            `Транзакция сохранена, заказ ${order.orderID} можно завершать`
          )
          .catch(() => null);
      } catch (error) {
        console.log(error);
        ctx.state = {};
      }
    },
    async ctx => {
      try {
        const { card, order, target, item } = ctx.state;
        if (!['weld-error', 'pay-error', 'card-return'].includes(target)) {
          return;
        }

        let description;
        switch (target) {
          case 'weld-error':
            description = 'Ошибка привязки';
            break;
          case 'pay-error':
            description = 'Ошибка оплаты';
            break;
          case 'card-return':
            description = 'Карта возвращена';
            break;
          default:
            return;
        }

        await orders.updateOne(
          {
            orderID: order.orderID
          },
          {
            $unset: {
              card: '',
              cardPaid: '',
              cardNumber: '',
              avoidHold: ''
            }
          }
        );

        await users.updateOne(
          {
            telegramID: ctx.from.id
          },
          {
            $unset: {
              cardOrder: ''
            }
          }
        );

        await card.createTransaction(card._id, {
          amount: -item.netCost[card.currency],
          currency: card.currency,
          issuer: ctx.from.id,
          sendToHold: target !== 'card-return',
          description,
          busy: false,
          order: order.orderID,
          success: false,
          cardBalance: card.balance
        });

        await ctx.editMessageText(
          `Карта отвязана от заказа ${order.orderID}, теперь вы можете взять другую, отменить заказ или отказаться от него`
        );

        ctx.state = {};
      } catch (error) {
        ctx.state = {};
        console.log(error);
      }
    }
  );

  bot.action('manager-income', ctx => ctx.scene.enter('manager-income'));

  bot.action('delete-message', ctx => ctx.deleteMessage().catch(() => null));

  bot.action('profile', ctx =>
    ctx.scene.enter('profile', { menu: ctx.callbackQuery.message })
  );
  bot.action('shop', ctx => ctx.scene.enter('shop'));

  bot.action(
    [
      keys.Menu.buttons.questions,
      keys.Menu.buttons.guarantees,
      keys.Menu.buttons.comments,
      keys.Menu.buttons.support
    ],
    async ctx => {
      try {
        await ctx.telegram.editMessageMedia(
          ctx.from.id,
          ctx.callbackQuery.message.message_id,
          undefined,
          {
            type: 'photo',
            media: {
              source: path.join(images, `blank_${ctx.callbackQuery.data}.jpg`)
            }
          }
        );

        let keyboard = keys.BackMenu.keyboard;
        if (ctx.callbackQuery.data === 'support') {
          keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('Задать вопрос', 'create-ticket')],
            [Markup.button.callback('Мои тикеты', 'client-tickets')],
            [Markup.button.callback('Назад', keys.BackMenu.buttons)]
          ]);
        }

        await ctx.telegram.editMessageCaption(
          ctx.from.id,
          ctx.callbackQuery.message.message_id,
          undefined,
          messages[ctx.callbackQuery.data],
          {
            parse_mode: 'HTML',
            reply_markup: keyboard.reply_markup
          }
        );
      } catch (e) {
        null;
        ctx.telegram
          .deleteMessage(ctx.from.id, ctx.callbackQuery.message.message_id)
          .catch(_ => null);
      }
    }
  );

  bot.action('create-ticket', ctx => ctx.scene.enter('create-ticket'));
  bot.action('client-tickets', ctx => ctx.scene.enter('client-tickets'));
  bot.action('manager-tickets', async ctx => {
    try {
      const user = await users.findOne(
        {
          telegramID: ctx.from.id
        },
        {
          role: 1
        }
      );

      if (user && user.role !== 'client') {
        ctx.scene.enter('manager-tickets');
      }
    } catch (error) {
      console.log(error);
    }
  });

  bot.action(/mark:([a-z0-9]+)/, async ctx => {
    try {
      const raw = /:(?<ticketId>[a-z0-9]+)$/.exec(ctx.callbackQuery.data);
      if (!raw) {
        return;
      }

      ctx.scene.enter('mark-ticket', {
        ticket: new Types.ObjectId(raw.groups.ticket)
      });
    } catch (error) {
      console.log(error);
    }
  });

  bot.action(/cancelPayment#\d+/, async ctx => {
    try {
      const paymentID = Number(/\d+$/.exec(ctx.callbackQuery.data)[0]);

      await payments.updateOne(
        {
          paymentID: paymentID,
          status: 'waiting'
        },
        {
          $set: {
            status: 'rejected'
          }
        }
      );

      ctx.telegram
        .deleteMessage(ctx.from.id, ctx.callbackQuery.message.message_id)
        .catch(_ => null);
    } catch (e) {
      ctx.answerCbQuery('Что-то пошло не так').catch(_ => null);
    } finally {
      ctx.scene.enter('start');
    }
  });

  bot.command('card', async ctx => {
    try {
      const check = await users.exists({
        telegramID: ctx.from.id,
        role: 'admin'
      });

      if (check) {
        ctx.scene.enter('ua-card-settings');
      }
    } catch (error) {
      console.log(error);
    }
  });
  bot.action('refill-steam', ctx => {
    try {
      if (!global.steamEnabled) {
        ctx
          .reply(
            'В данный момент у нашего магазина закончились средства для пополнения Steam\n\nПриносим наши извинения за неудобства, нужно подождать некоторое время и сервис снова станет доступен'
          )
          .then(msg =>
            setTimeout(
              () => ctx.deleteMessage(msg.message_id).catch(() => null),
              10000
            )
          )
          .catch(() => null);
        return;
      }

      ctx.scene.enter('refill-steam');
    } catch (error) {
      console.log(error);
    }
  });
  bot.action(/lava-check#\d+/, ctx => ctx.scene.enter('lava-check'));
  bot.action(/main_section#\w+/, ctx => ctx.scene.enter('mainCategory'));
  bot.action(/sub_section#\w+/, ctx => ctx.scene.enter('subCategory'));
  bot.action(/item#\w+/, ctx => ctx.scene.enter('item'));
  bot.action(/buy#\w+/, ctx => ctx.scene.enter('buy'));
  bot.action(/ref#\d+/, ctx => {
    const amount = Number(/\d+$/.exec(ctx.callbackQuery.data)[0]);
    ctx.scene.enter('pay', {
      menu: ctx.callbackQuery.message,
      amount: amount
    });
  });

  bot.action(/genshin_proceed#\w+/, ctx => ctx.scene.enter('genshin_proceed'));
  bot.action(/supercell_proceed#\w+/, ctx =>
    ctx.scene.enter('supercell_proceed')
  );
  bot.action(/proceed#\w+/, ctx => ctx.scene.enter('proceed'));
  bot.action(/accept#\d+/, ctx => ctx.scene.enter('accept_purchase'));
  bot.action(/order#\d+/, ctx => ctx.scene.enter('order_data'));
  bot.action(/refund_data#\d+/, ctx => ctx.scene.enter('user_refund'));
  bot.action(/res_contact#\d+#\d+/, ctx => ctx.scene.enter('send_contact'));
  bot.action(/send_code#\d+/, ctx => ctx.scene.enter('send_auth_code'));

  bot.action(keys.BackMenu.buttons, async ctx => {
    try {
      await ctx.editMessageMedia({
        type: 'photo',
        media: {
          source: path.join(images, 'blank_logo.jpg')
        }
      });

      await ctx.editMessageCaption('Главное меню', {
        reply_markup: keys.Menu.keyboard.reply_markup
      });
    } catch (e) {
      null;
    }
  });

  bot.command('fee', async ctx => {
    try {
      const check = await users.exists({
        telegramID: ctx.from.id,
        role: 'admin'
      });

      if (!check) {
        return;
      }

      ctx.scene.enter('steam-fee');
    } catch (error) {
      console.log(error);
    }
  });

  bot.command('kupikod', async ctx => {
    try {
      const check = await users.exists({
        telegramID: ctx.from.id,
        role: 'admin'
      });

      if (!check) {
        return;
      }

      const balance = await getBalance();
      if (!balance) {
        await ctx.reply('Не получилось узнать баланс');
      } else {
        await ctx.reply(`Баланс kupikod: ${balance} рублей`);
      }
    } catch (error) {
      console.log(error);
    }
  });
  bot.command('admin', ctx => ctx.scene.enter('admin'));
  bot.command('manager', ctx => ctx.scene.enter('manager_menu'));
  bot.action('online_alert', async ctx => {
    try {
      await users.updateOne(
        {
          telegramID: ctx.from.id
        },
        {
          $set: {
            onlineUntil: new Date(Date.now() + 15 * 60 * 1000)
          }
        }
      );

      const curCtx = ctx;
      ctx
        .reply('Ваш статус обновлен')
        .then(msg => {
          setTimeout(function () {
            curCtx.telegram
              .deleteMessage(curCtx.from.id, msg.message_id)
              .catch(_ => null);
          }, 3000);
        })
        .catch(_ => null);
    } catch (e) {
      null;
    }
  });

  bot.action(/ua-card-refill:\d+/, ctx => {
    ctx.deleteMessage().catch(() => null);
    ctx.scene.enter('ua-card-refill');
  });

  bot.action('manager_menu', ctx => ctx.scene.enter('manager_menu'));
  bot.action('catch_order', ctx => ctx.scene.enter('catch_order'));
  bot.action(keys.ManagerWorkMenu.buttons.active, ctx =>
    ctx.scene.enter('current_orders')
  );
  bot.action(keys.ManagerWorkMenu.buttons.list, ctx =>
    ctx.scene.enter('orders_list')
  );
  bot.action(keys.ManagerWorkMenu.buttons.back, ctx =>
    ctx.deleteMessage().catch(_ => null)
  );
  bot.action(/manager_take#\d+/, ctx => ctx.scene.enter('take_order'));

  bot.command('clean', async ctx => {
    const user = await users.findOne(
      {
        telegramID: ctx.from.id,
        role: 'admin'
      },
      'role'
    );

    if (user) clean();
  });

  bot.command('drop', async ctx => {
    try {
      const user = await users.findOne(
        {
          telegramID: ctx.from.id,
          role: 'admin'
        },
        'role'
      );

      if (user) {
        await users.updateOne(
          {
            telegramID: ctx.from.id
          },
          {
            $set: {
              stats: [],
              incomeFactors: [],
              ticketsAnswered: 0
            }
          }
        );

        ctx.reply('Статистика сброшена');
      }
    } catch (e) {
      null;
    }
  });

  bot.command(
    'cards',
    async (ctx, next) => {
      try {
        const user = await users.findOne(
          {
            telegramID: ctx.from.id
          },
          {
            role: 1
          }
        );

        if (user.role === 'client') {
          return;
        }

        next();
      } catch (error) {
        console.log(error);
      }
    },
    async ctx => {
      try {
        const count = await cards.count({
          busy: false,
          hidden: false,
          hold: {
            $lt: new Date()
          }
        });

        await ctx.reply(`Активных карт: ${count}`);
      } catch (error) {
        console.log(error);
      }
    }
  );

  bot.command('say', async ctx => {
    try {
      const user = await users.findOne(
        {
          telegramID: ctx.from.id
        },
        {
          role: 1
        }
      );

      if (user.role !== 'admin') {
        throw new Error('No access');
      }

      ctx.scene.enter('share-message');
    } catch (error) {
      null;
      ctx.reply('Нет доступа');
    }
  });

  bot.command('stats', async ctx => {
    try {
      const user = await users.findOne(
        {
          telegramID: ctx.from.id
        },
        {
          role: 1
        }
      );

      if (user.role !== 'admin') {
        throw new Error('No access');
      }

      const now = new Date();
      const day = now.getDate();
      const month = now.getMonth();
      const year = now.getFullYear();
      const dayInMs = 24 * 60 * 60 * 1000;

      const to = new Date(
        new Date(year, month, day, 0, 0, 0, 0).getTime() + dayInMs
      );
      const fromDay = new Date(to.getTime() - dayInMs);
      const fromWeek = new Date(to.getTime() - dayInMs * 7);
      const fromMonth = new Date(to.getTime() - dayInMs * 30);

      const allCount = await users.count({
        role: 'client'
      });

      const todayCount = await users.count({
        role: 'client',
        join_date: {
          $gte: fromDay,
          $lte: to
        }
      });

      const weekCount = await users.count({
        role: 'client',
        join_date: {
          $gte: fromWeek,
          $lte: to
        }
      });

      const monthCount = await users.count({
        role: 'client',
        join_date: {
          $gte: fromMonth,
          $lte: to
        }
      });

      await ctx.reply(
        `Всего пользователей: ${allCount}\n\nПришло за \nсутки: ${todayCount}\nнеделю: ${weekCount}\nмесяц: ${monthCount}`
      );
    } catch (error) {
      null;
    }
  });

  return bot;
}

module.exports = CreateBot;
