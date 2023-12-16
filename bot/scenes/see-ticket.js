const { Scenes, Markup } = require('telegraf');
const tickets = require('../../models/tickets');
const users = require('../../models/users');
const ticketMessage = require('../../models/ticket-messages');
const escapeHTML = require('escape-html');
const moment = require('moment');
const path = require('path');
const { Types } = require('mongoose');
const orders = require('../../models/orders');

const seeTicket = new Scenes.BaseScene('see-ticket');

seeTicket.enterHandler = async ctx => {
  try {
    const { menu, ticket, role, view } = ctx.scene.state;
    if (!ticket || !role) {
      throw new Error('No data');
    }

    let { skip } = ctx.scene.state;
    if (!skip) {
      skip = 0;
      ctx.scene.state.skip = skip;
    }

    const messagesCount = await ticketMessage.count({
      ticket
    });

    const ticketObj = await tickets.findById(ticket);
    ctx.scene.state.manager = ticketObj.manager;

    const client = await users.findOne(
      {
        telegramID: ticketObj.client
      },
      {
        username: 1,
        telegramID: 1
      }
    );
    ctx.scene.state.client = client.telegramID;

    const ordersList = [];
    const userOrders = await orders.find(
      {
        client: client.telegramID,
        paid: true,
        status: {
          $in: ['processing', 'untaken']
        }
      },
      {
        orderID: 1
      }
    );

    for (const order of userOrders) {
      ordersList.push(`<code>${order.orderID}</code>`);
    }

    const manager = ticketObj.manager
      ? await users.findOne(
          {
            telegramID: ticketObj.manager
          },
          {
            username: 1,
            telegramID: 1
          }
        )
      : undefined;

    const lastMessage = await ticketMessage.findOne(
      {
        ticket
      },
      null,
      {
        sort: {
          creationDate: -1
        }
      }
    );

    let message = `<u>Тикет <code>${ticket
      .toString()
      .toUpperCase()}</code></u>\n\n<i>Клиент:</i> <a href="tg://user?id=${
      ticketObj.client
    }">${escapeHTML(client.username || 'Anonymous')}</a>\n<i>Менеджер:</i> ${
      role === 'client'
        ? manager?.telegramID || 'нет'
        : '<a href="tg://user?id=' +
          (manager?.telegramID || '0') +
          '">' +
          escapeHTML(manager?.username || 'нет') +
          '</a>'
    }\n\n<b>Тема: "${escapeHTML(
      ticketObj.theme
    )}"</b>\n<i>Заголовок: ${escapeHTML(
      ticketObj.title
    )}</i>\n\n<i>Тикет открыт: ${moment(ticketObj.created)
      .locale('ru')
      .format('DD.MM.YYYY [в] HH:mm:ss')}</i>\n<i>Тикет закрыт: ${
      ticketObj.closed
        ? moment(ticketObj.closed)
            .locale('ru')
            .format('DD.MM.YYYY [в] HH:mm:ss')
        : 'нет'
    }</i>${
      ticketObj.mark > 0
        ? '\n\n<b>Оценка пользователя: ' + ticketObj.mark.toString() + '</b>'
        : ''
    }${
      ordersList.length === 0
        ? ''
        : '\nЗаказы пользователя: ' + ordersList.join(', ')
    }`;

    const firstMessage = await ticketMessage.findOne(
      {
        ticket
      },
      null,
      {
        sort: {
          creationDate: 1
        },
        skip
      }
    );

    message = message.concat(
      `\n\n<b>${
        role === 'client'
          ? 'Ваше последнее сообщение:'
          : 'Последнее сообщение пользователя'
      }</b>:\n<blockquote>${escapeHTML(
        lastMessage.question.text
      )}</blockquote>\n\n<b>Ответ менеджера:</b>\n${
        lastMessage.answer
          ? '<blockquote>' +
            escapeHTML(firstMessage.answer.text) +
            '</blockquote>'
          : '<i>ожидается</i>'
      }`
    );

    ctx.telegram
      .editMessageCaption(ctx.from.id, menu, undefined, message, {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
          [
            Markup.button.callback(
              'Ответить менеджеру',
              'answer-to:manager',
              !(
                role === 'client' &&
                ticketObj.client === ctx.from.id &&
                ticketObj.waitingForUser &&
                !ticketObj.done &&
                !view
              )
            ),
            Markup.button.callback(
              'Ответить пользователю',
              'answer-to:client',
              !(
                role !== 'client' &&
                !ticketObj.done &&
                !lastMessage.answer &&
                !view
              )
            )
          ],
          [
            Markup.button.callback(
              'Закрыть тикет',
              'close-ticket',
              !(
                !ticketObj.done &&
                messagesCount > 1 &&
                role !== 'client' &&
                !view
              )
            )
          ],
          [
            Markup.button.callback(
              'Предыдущее сообщение',
              'previous',
              skip === 0
            ),
            Markup.button.callback(
              'Следующее сообщение',
              'next',
              !(skip < messagesCount - 1 && messagesCount > 1)
            )
          ],
          [Markup.button.callback('Обновить', 'update', ticketObj.done)],
          [Markup.button.callback('Назад', 'exit')]
        ]).reply_markup
      })
      .catch(() => null);

    if (firstMessage.question) {
      const questionText = `<b>${
        role === 'client' ? 'Ваше сообщение:' : 'Сообщение пользователя:'
      }</b>\n<i>Дата: ${moment(firstMessage.creationDate)
        .locale('ru')
        .format('DD.MM.YYYY [в] HH:mm:ss')}</i>\n\n<blockquote>${escapeHTML(
        firstMessage.question.text
      )}</blockquote>`;

      const question = firstMessage.question.image
        ? await ctx.replyWithPhoto(firstMessage.question.image, {
            caption: questionText,
            parse_mode: 'HTML'
          })
        : await ctx.reply(questionText, {
            parse_mode: 'HTML'
          });

      ctx.scene.state.question = question.message_id;
    }

    if (firstMessage.answer) {
      const answerText = `<b>Ответ менеджера <code>${
        firstMessage.manager || 'неизвестно'
      }</code></b>\n<i>Дата: ${moment(firstMessage.answerDate)
        .locale('ru')
        .format('DD.MM.YYYY [в] HH:mm:ss')}</i>\n\n<blockquote>${escapeHTML(
        firstMessage.answer.text
      )}</blockquote>`;

      const answer = firstMessage.answer.image
        ? await ctx.replyWithPhoto(firstMessage.answer.image, {
            caption: answerText,
            parse_mode: 'HTML'
          })
        : await ctx.reply(answerText, {
            parse_mode: 'HTML'
          });

      ctx.scene.state.answerMessage = answer.message_id;
    }
  } catch (error) {
    ctx.answerCbQuery('Что-то пошло не так').catch(() => null);
    ctx.scene.leave();
  }
};

seeTicket.action(/mark:([a-z0-9]+)/, async ctx => {
  try {
    const raw = /:(?<ticketId>[a-z0-9]+)$/.exec(ctx.callbackQuery.data);
    if (!raw) {
      return;
    }

    ctx.deleteMessage(ctx.scene.state.menu).catch(() => null);
    ctx.scene.enter('mark-ticket', {
      ticket: new Types.ObjectId(raw.groups.ticketId)
    });
  } catch (error) {
    console.log(error);
  }
});

seeTicket.action(/answer-to:(client|manager)/, async ctx => {
  try {
    const raw = /:(?<target>client|manager)$/.exec(ctx.callbackQuery.data);
    if (!raw) {
      return;
    }

    const { target } = raw.groups;
    ctx.scene.state.target = target;
    ctx.scene.state.answer = {};

    const messageMenu = await ctx.replyWithPhoto(
      {
        source: path.resolve('files', 'images', 'blank_noimage.jpg')
      },
      {
        caption: `<b>Напишите ваш ответ (до 700 символов), по необходимости можете прикрепить изображение</b>`,
        parse_mode: 'HTML'
      }
    );

    const instructionsMenu = await ctx.reply('<b>Ответ</b>', {
      parse_mode: 'HTML',
      reply_markup: Markup.inlineKeyboard([
        [
          Markup.button.callback(
            'Ответить менеджеру',
            'client-answer',
            target === 'client'
          )
        ],
        [
          Markup.button.callback(
            'Ответить и закрыть тикет',
            'manager-answer:true',
            target !== 'client'
          ),
          Markup.button.callback(
            'Ответить',
            'manager-answer:false',
            target !== 'client'
          )
        ],
        [Markup.button.callback('Назад', 'update')]
      ]).reply_markup
    });

    ctx.scene.state.messageMenu = messageMenu.message_id;
    ctx.scene.state.instructionsMenu = instructionsMenu.message_id;
  } catch (error) {
    console.log(error);
  }
});

seeTicket.on(
  'message',
  (ctx, next) => {
    try {
      ctx.deleteMessage().catch(() => null);
      if (!ctx.scene.state.target) {
        return;
      }

      next();
    } catch (error) {
      console.log(error);
    }
  },
  async ctx => {
    try {
      let message, image;
      if (ctx.message.text || ctx.message.caption) {
        if (ctx.message.text && ctx.message.text.length > 700) {
          ctx
            .reply('<b>Длина сообщения должна быть меньше 700 символов</b>', {
              parse_mode: 'HTML'
            })
            .then(msg =>
              setTimeout(
                () => ctx.deleteMessage(msg.message_id).catch(() => null),
                4000
              )
            )
            .catch(() => null);
        } else {
          message = ctx.message.text || ctx.message.caption;
          ctx.scene.state.answer.text = message;
        }
      }

      if (ctx.message.photo) {
        image = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        ctx.scene.state.answer.image = image;
      }

      if (image) {
        await ctx.telegram.editMessageMedia(
          ctx.from.id,
          ctx.scene.state.messageMenu,
          undefined,
          {
            type: 'photo',
            media: image
          }
        );
      }

      ctx.telegram
        .editMessageCaption(
          ctx.from.id,
          ctx.scene.state.messageMenu,
          undefined,
          `<b>Ваш ответ:</b>\n\n<blockquote>${escapeHTML(
            message || ctx.scene.state.answer.text || '-'
          )}</blockquote>`,
          {
            parse_mode: 'HTML'
          }
        )
        .catch(() => null);
    } catch (error) {
      console.log(error);
    }
  }
);

seeTicket.action('client-answer', async ctx => {
  try {
    const { answer, ticket } = ctx.scene.state;

    if (!answer?.text) {
      ctx.answerCbQuery('Вы ничего не написали');
      return;
    }

    const { text, image } = ctx.scene.state.answer;
    const ticketObj = await tickets.findById(ticket, {
      manager: 1,
      done: 1
    });

    if (ticketObj.done) {
      ctx.answerCbQuery('Тикет закрыт').catch(() => null);
      ctx.scene.enter('see-ticket', ctx.scene.state);
      return;
    }

    await ticketMessage.create({
      ticket,
      question: {
        text,
        image
      }
    });

    await tickets.updateOne(
      {
        _id: ticket
      },
      {
        $set: {
          waitingForUser: false
        }
      }
    );

    ctx.telegram
      .sendMessage(
        ticketObj.manager,
        `<b>Ответ на тикет</b>\n<code>${ticket
          .toString()
          .toUpperCase()}</code>\n\n<blockquote>${escapeHTML(
          text
        )}</blockquote>`,
        {
          parse_mode: 'HTML'
        }
      )
      .catch(() => null);

    ctx.scene.enter('see-ticket', ctx.scene.state);
  } catch (error) {
    console.log(error);
  }
});

seeTicket.action('close-ticket', async ctx => {
  try {
    const { ticket } = ctx.scene.state;
    const ticketObj = await tickets.findByIdAndUpdate(ticket, {
      $set: {
        done: true,
        waitingForUser: false
      }
    });

    users
      .updateOne(
        {
          telegramID: ticketObj.manager
        },
        {
          $inc: {
            ticketsAnswered: 1
          }
        }
      )
      .catch(() => null);

    ctx.telegram
      .sendMessage(
        ticketObj.client,
        `<b>Ваш тикет <code>${ticket
          .toString()
          .toUpperCase()}</code> обработан</b>`,
        {
          parse_mode: 'HTML',
          reply_markup: Markup.inlineKeyboard([
            [
              Markup.button.callback(
                'Проблема решена',
                `mark:${ticket.toString()}`
              )
            ],
            [
              Markup.button.callback(
                'Мой вопрос не решен, что делать?',
                'problem-not-solved'
              )
            ]
          ]).reply_markup
        }
      )
      .catch(() => null);

    ctx.scene.enter('see-ticket', ctx.scene.state);
  } catch (error) {
    console.log(error);
  }
});

seeTicket.action('problem-not-solved', ctx => {
  ctx.deleteMessage(ctx.scene.state.menu).catch(() => null);
  ctx.scene.enter('problem-not-solved');
});

seeTicket.action(/^manager-answer:(true|false)$/, async ctx => {
  try {
    const { answer, ticket, client } = ctx.scene.state;
    const raw = /:(?<closeTicket>true|false)$/.exec(ctx.callbackQuery.data);
    if (!raw) {
      return;
    }

    const ticketObj = await tickets.findById(ticket, {
      done: 1,
      manager: 1
    });

    if (ticketObj.done) {
      ctx.answerCbQuery('Тикет закрыт').catch(() => null);
      ctx.scene.enter('see-ticket', ctx.scene.state);
      return;
    }

  const manager = ticketsObj.manager;

    if (!answer?.text) {
      ctx.answerCbQuery('Вы ничего не написали');
      return;
    }

    const { text, image } = ctx.scene.state.answer;

    const close = raw.groups.closeTicket === 'true';
    const now = new Date();

    await ticketMessage.updateOne(
      {
        ticket,
        answer: {
          $exists: false
        }
      },
      {
        $set: {
          answer: {
            text,
            image
          },
          answerDate: now,
          manager: ctx.from.id
        }
      },
      {
        sort: {
          creationDate: -1
        }
      }
    );

    await tickets.updateOne(
      {
        _id: ticket
      },
      {
        $set: {
          done: close,
          waitingForUser: !close,
          closed: close ? now : undefined
        }
      }
    );

    if (close) {
      users
        .updateOne(
          {
            telegramID: manager
          },
          {
            $inc: {
              ticketsAnswered: 1
            }
          }
        )
        .catch(e => console.log(e));
    }

    ctx.telegram
      .sendMessage(
        client,
        `<b>Ответ на ваш тикет</b>\n<code>${ticket
          .toString()
          .toUpperCase()}</code>\n\n<blockquote>${escapeHTML(
          text
        )}</blockquote>${
          close
            ? '<i>Тикет закрыт</i>'
            : '<i>Менеджер ожидает вашего ответа, ответить можно через: Меню - Поддержка - Мои тикеты</i>'
        }`,
        {
          parse_mode: 'HTML',
          reply_markup: close
            ? Markup.inlineKeyboard([
                [Markup.button.callback('Проблема решена', `mark:${ticket}`)],
                [
                  Markup.button.callback(
                    'Мой вопрос не решен, что делать?',
                    'problem-not-solved'
                  )
                ]
              ]).reply_markup
            : undefined
        }
      )
      .catch(() => null);

    ctx.scene.enter('see-ticket', ctx.scene.state);
  } catch (error) {
    console.log(error);
  }
});

seeTicket.action('update', ctx =>
  ctx.scene.enter('see-ticket', ctx.scene.state)
);

seeTicket.action('exit', async ctx => {
  try {
    if (ctx.scene.state.role === 'client') {
      ctx.scene.enter('client-tickets', {
        menu: ctx.callbackQuery.message.message_id
      });
    } else if (ctx.scene.state.role === 'manager') {
      ctx.scene.enter('free-tickets');
    } else if (ctx.scene.state.role === 'admin') {
      ctx.deleteMessage().catch(() => null);
      ctx.scene.enter('tickets');
    }
  } catch (error) {
    console.log(error);
  }
});

seeTicket.action(['next', 'previous'], async ctx => {
  try {
    const move = ctx.callbackQuery.data === 'next' ? 1 : -1;

    ctx.scene.enter('see-ticket', {
      ...ctx.scene.state,
      skip: ctx.scene.state.skip + move
    });
  } catch (error) {
    console.log(error);
  }
});

seeTicket.leaveHandler = ctx => {
  if (ctx.scene.state.question) {
    ctx.deleteMessage(ctx.scene.state.question).catch(() => null);
    ctx.scene.state.question = undefined;
  }

  if (ctx.scene.state.answerMessage) {
    ctx.deleteMessage(ctx.scene.state.answerMessage).catch(() => null);
    ctx.scene.state.answerMessage = undefined;
  }

  if (ctx.scene.state.answer) {
    ctx.deleteMessage(ctx.scene.state.answer).catch(() => null);
    ctx.scene.state.answer = undefined;
  }

  if (ctx.scene.state.instructionsMenu) {
    ctx.deleteMessage(ctx.scene.state.instructionsMenu).catch(() => null);
    ctx.scene.state.instructionsMenu = undefined;
  }

  if (ctx.scene.state.messageMenu) {
    ctx.deleteMessage(ctx.scene.state.messageMenu).catch(() => null);
    ctx.scene.state.messageMenu = undefined;
  }
};

module.exports = seeTicket;
