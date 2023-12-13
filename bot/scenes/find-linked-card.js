const { Scenes, Markup } = require('telegraf');
const cards = require('../../models/cards');
const { Types } = require('mongoose');
const orders = require('../../models/orders');
const users = require('../../models/users');
const escapeHTML = require('escape-html');
const goods = require('../../models/goods');

const findLinkedCard = new Scenes.BaseScene('find-linked-card');

findLinkedCard.enterHandler = async ctx => {
  try {
    ctx.scene.state.cardSearchMenu = ctx.callbackQuery.message.message_id;
    await ctx.editMessageText('Введите последние 4 цифры карты', {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('Отмена', 'exit')]
      ]).reply_markup
    });
  } catch (error) {
    console.log(error);
    ctx.scene.leave();
  }
};

findLinkedCard.on(
  'message',
  (ctx, next) => {
    ctx.deleteMessage().catch(() => null);
    next();
  },
  async ctx => {
    try {
      const data = /(?<number>\d{4})/.exec(ctx.message.text);
      if (!data) {
        ctx
          .reply('Введите последние 4 цифры карты')
          .then(msg =>
            setTimeout(
              () => ctx.deleteMessage(msg.message_id).catch(() => null),
              3000
            )
          )
          .catch(() => null);
        return;
      }

      const { number } = data.groups;
      const filter = new RegExp('\\d{12}' + number);
      const result = await cards.find(
        {
          number: {
            $regex: filter
          }
        },
        {
          number: 1
        }
      );

      if (result.length === 0) {
        await ctx.telegram.editMessageText(
          ctx.from.id,
          ctx.scene.state.cardSearchMenu,
          undefined,
          'Ничего не найдено, если хотите повторить поиск - просто введите другое значение',
          {
            reply_markup: Markup.inlineKeyboard([
              [Markup.button.callback('Отмена', 'exit')]
            ]).reply_markup
          }
        );
        return;
      }

      const keyboard = [];
      for (const card of result) {
        keyboard.push([
          Markup.button.callback(
            `${card.number}`,
            `select:${card._id.toString()}`
          )
        ]);
      }
      keyboard.push([Markup.button.callback('Отмена', 'exit')]);

      ctx.telegram
        .editMessageText(
          ctx.from.id,
          ctx.scene.state.cardSearchMenu,
          undefined,
          `<b>Найдено ${result.length} карт(ы)</b>\n\n<i>Если ошиблись с номером - просто введите другой</i>`,
          {
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard(keyboard).reply_markup
          }
        )
        .catch(() => null);
    } catch (error) {
      console.log(error);
    }
  }
);

findLinkedCard.action(/select:[a-z0-9]+/, async ctx => {
  try {
    const raw = /:(?<cardId>[a-z0-9]+)$/.exec(ctx.callbackQuery.data);
    if (!raw) {
      throw new Error('No data');
    }

    const { cardId } = raw.groups;
    const { order, card } = ctx.scene.state;

    const orderData = await orders.findOne(
      {
        orderID: order
      },
      {
        item: 1
      }
    );

    const item = await goods.findById(orderData.item, {
      netCost: 1
    });

    if (item.netCost) {
      const cardData = await cards.findById(cardId, {
        currency: 1,
        balance: 1
      });

      if (item.netCost[cardData.currency] > cardData.balance) {
        ctx.answerCbQuery('На карте недостаточно баланса').catch(() => null);
        return;
      }
    }

    if (card) {
      await cards.updateOne(
        {
          _id: card
        },
        {
          $set: {
            busy: false
          }
        }
      );
    }

    const newCard = await cards.findByIdAndUpdate(new Types.ObjectId(cardId), {
      $set: {
        busy: true
      }
    });

    if (!newCard) {
      ctx.editMessageText('Карта не найдена').catch(() => null);
      ctx.scene.leave();
      return;
    }

    await orders.updateOne(
      {
        orderID: order
      },
      {
        $set: {
          cardNumber: newCard.number,
          card: newCard._id,
          avoidHold: true
        }
      }
    );

    ctx
      .editMessageText(
        `<b>Карта для заказа <code>${order}</code></b>\n\n<i>Номер:</i> <code>${newCard.number.slice(
          0,
          4
        )} ${newCard.number.slice(4, 8)} ${newCard.number.slice(
          8,
          12
        )} ${newCard.number.slice(12, 16)}
      </code>\n<i>Срок действия:</i> <code>${escapeHTML(
        newCard.duration
      )}</code>\n<i>CVC:</i> <code>${
        newCard.cvc
      }</code>\n\n<i>Владелец:</i> <code>${escapeHTML(
        newCard.cardholder
      )}</code>\n<i>Банк:</i> <code>${escapeHTML(newCard.bank)}</code>`,
        {
          parse_mode: 'HTML',
          reply_markup: Markup.inlineKeyboard([
            [
              Markup.button.callback(
                'Оплатил',
                `card-paid:${order}:${newCard._id.toString()}`
              )
            ],
            [
              Markup.button.callback(
                'Не привязалась',
                `card-weld-error:${order}:${newCard._id.toString()}`
              )
            ],
            [
              Markup.button.callback(
                'Ошибка при оплате',
                `card-pay-error:${order}:${newCard._id.toString()}`
              )
            ],
            [
              Markup.button.callback(
                'Вернуть карту',
                `card-return:${order}:${newCard._id.toString()}`
              )
            ]
          ]).reply_markup
        }
      )
      .catch(() => null);

    ctx
      .reply('Menu...')
      .then(msg =>
        ctx.scene.enter('take_order', {
          orderID: order,
          menu: msg.message_id
        })
      )
      .catch(() => null);
  } catch (error) {
    console.log(error);
  }
});

findLinkedCard.action('exit', ctx => {
  ctx.scene.state = undefined;
  ctx.deleteMessage().catch(() => null);
  ctx.scene.leave();
});

module.exports = findLinkedCard;
