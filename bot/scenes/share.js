const { Scenes, Markup } = require('telegraf');
const categories = require('../../models/categories');
const path = require('path');
const users = require('../../models/users');
const EventEmitter = require('node:events');

class StopEmitter extends EventEmitter {}

const shareMessage = new Scenes.BaseScene('share-message');

const menu = Markup.inlineKeyboard([
  [Markup.button.callback('Добавить линию', 'add-line')],
  [Markup.button.callback('Изменить текст', 'edit-text')],
  [
    Markup.button.callback('Предпросмотр', 'preview'),
    Markup.button.callback('Отправить', 'send')
  ],
  [Markup.button.callback('Отмена', 'exit')]
]);

const generateEditingMenu = ctx => {
  if (!ctx.session.lines) {
    return null;
  }

  const keyboard = [];
  const { lines } = ctx.session;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    keyboard[i] = [];
    for (let j = 0; j < line.length; j++) {
      const value = line[j];
      keyboard[i][j] = Markup.button.callback(
        value.text,
        `edit-item:${i}-${j}`
      );
    }
    keyboard[i].push(
      Markup.button.callback('-', `delete-line:${i}`),
      Markup.button.callback('+', `push-to:${i}`)
    );
  }

  return keyboard;
};

const sendMessage = async (ctx, keys, user) => {
  if (ctx.session.photo) {
    await ctx.telegram.sendPhoto(user, ctx.session.photo, {
      caption: ctx.session.message.caption,
      caption_entities: ctx.session.message.caption_entities,
      reply_markup: keys
    });
  } else {
    await ctx.telegram.sendMessage(
      user,
      ctx.session.message.caption || ctx.session.message.text,
      {
        entities:
          ctx.session.message.caption_entities || ctx.session.message.entities,
        reply_markup: keys,
        disable_web_page_preview: true
      }
    );
  }
};

const generateMenu = ctx => {
  if (!ctx.session.lines) {
    return null;
  }

  const keyboard = [];
  const { lines } = ctx.session;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length === 0) continue;

    keyboard[i] = [];
    for (let j = 0; j < line.length; j++) {
      const value = line[j];
      keyboard[i][j] = value.link
        ? Markup.button.url(value.text, value.value)
        : Markup.button.callback(value.text, value.value);
    }
  }

  return keyboard;
};

shareMessage.enterHandler = async ctx => {
  try {
    await ctx.reply(
      'Введите сообщение (форматирование можно использовать)\nЕсли нужно добавить изображение - отправьте его отдельно после текста сообщения, для изменения - просто отправьте новое'
    );

    ctx.session.lines = [];
    ctx.session.action = 'message-edit';
  } catch (error) {
    null;
  }
};

shareMessage.on('photo', async ctx => {
  try {
    ctx.deleteMessage().catch(() => null);

    const photo = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    const keys = generateEditingMenu(ctx);

    ctx.deleteMessage(ctx.session.messageId).catch(() => null);

    const msg = await ctx.replyWithPhoto(photo, {
      caption: ctx.session.message.text,
      caption_entities: ctx.session.message.entities,
      reply_markup: keys ? Markup.inlineKeyboard(keys).reply_markup : null
    });

    ctx.session.message = msg;
    ctx.session.messageId = msg.message_id;

    ctx.session.photo = photo;
  } catch (error) {
    null;
  }
});

shareMessage.on(
  'message',
  (ctx, next) => {
    ctx.deleteMessage().catch(() => null);
    if (ctx.session.action) {
      next();
    }
  },
  async (ctx, next) => {
    try {
      if (ctx.session.action !== 'message-edit') {
        next();
        return;
      }

      const msg = ctx.message;
      const keys = generateEditingMenu(ctx);

      ctx.session.message = msg;

      const editing = await ctx.replyWithPhoto(
        {
          source: path.resolve('files', 'images', 'blank_noimage.jpg')
        },
        {
          caption: msg.text,
          caption_entities: msg.entities,
          reply_markup: keys
            ? Markup.inlineKeyboard(keys).reply_markup
            : undefined
        }
      );

      ctx.session.messageId = editing.message_id;

      await ctx.reply('Управление сообщением', {
        reply_markup: menu.reply_markup
      });

      if (ctx.session.textMenu) {
        ctx.telegram
          .deleteMessage(ctx.from.id, ctx.session.textMenu)
          .catch(() => null);
        ctx.session.textMenu = undefined;
      }

      ctx.session.action = undefined;
    } catch (error) {
      null;
    }
  },
  async (ctx, next) => {
    try {
      if (ctx.session.action !== 'button') {
        next();
        return;
      }

      const data = ctx.message.text.split('\n');
      if (!data || data.length !== 2) {
        throw new Error('Wrong message format');
      }

      let value;

      if (ctx.session.buttonTarget === 'link') {
        const url = new URL(data[1]);
        value = url.href;
      } else if (ctx.session.buttonTarget === 'category') {
        const category = await categories.findById(data[1], {
          type: 1
        });

        value = `${category.type === 'main' ? 'main_section' : 'sub_section'}#${
          data[1]
        }`;
      } else if (ctx.session.buttonTarget === 'item') {
        value = `item#${data[1]}`;
      } else {
        value = data[1].trim();
      }

      ctx.session.lines[ctx.session.line].push({
        link: ctx.session.buttonTarget === 'link',
        text: data[0],
        value
      });

      const keys = generateEditingMenu(ctx);
      await ctx.telegram.editMessageReplyMarkup(
        ctx.from.id,
        ctx.session.messageId,
        undefined,
        Markup.inlineKeyboard(keys).reply_markup
      );

      ctx.session.action = undefined;
      ctx.session.buttonTarget = undefined;
      ctx.session.line = undefined;

      ctx.telegram
        .deleteMessage(ctx.from.id, ctx.session.buttonMenu)
        .catch(() => null);
      ctx.session.buttonMenu = undefined;
      ctx.telegram
        .deleteMessage(ctx.from.id, ctx.session.buttonMainMenu)
        .catch(() => null);
      ctx.session.buttonMainMenu = undefined;
    } catch (error) {
      ctx.reply('Неверный формат сообщения или неверно указана ссылка');
      null;
    }
  },
  async (ctx, next) => {
    try {
      if (ctx.session.action !== 'text-edit') {
        next();
        return;
      }

      const keys = generateEditingMenu(ctx);

      await ctx.telegram.editMessageCaption(
        ctx.from.id,
        ctx.session.messageId,
        undefined,
        ctx.message.text,
        {
          caption_entities: ctx.message.entities,
          reply_markup: keys ? Markup.inlineKeyboard(keys).reply_markup : null
        }
      );

      ctx.session.message = ctx.message;

      ctx.deleteMessage(ctx.session.textMenu).catch(() => null);
      ctx.session.textMenu = undefined;
      ctx.session.action = undefined;
    } catch (error) {
      null;
    }
  }
);

shareMessage.action('add-line', async ctx => {
  try {
    ctx.session.lines.push([]);

    await ctx.telegram.editMessageReplyMarkup(
      ctx.from.id,
      ctx.session.messageId,
      undefined,
      Markup.inlineKeyboard(generateEditingMenu(ctx)).reply_markup
    );
  } catch (error) {
    null;
  } finally {
    ctx.answerCbQuery().catch(() => null);
  }
});

shareMessage.action(/delete-line:\d+/, async ctx => {
  try {
    const data = /(d+)/.exec(ctx.callbackQuery.data);
    if (!data) {
      return;
    }

    const position = Number(data[1]);

    const pre = ctx.session.lines;
    ctx.session.lines.splice(position, 1);

    const keys = generateEditingMenu(ctx);

    await ctx.telegram.editMessageReplyMarkup(
      ctx.from.id,
      ctx.session.messageId,
      undefined,
      keys ? Markup.inlineKeyboard(keys).reply_markup : null
    );
  } catch (error) {
    null;
  }
});

shareMessage.action(/push-to:/, async ctx => {
  try {
    const data = /(\d+)/.exec(ctx.callbackQuery.data);
    if (!data) {
      return;
    }

    const line = Number(data[1]);
    ctx.session.line = line;

    const buttonMainMenu = await ctx.reply('Тип кнопки', {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('Категория', 'push-category')],
        [Markup.button.callback('Товар', 'push-item')],
        [Markup.button.callback('Ссылка', 'push-link')],
        [Markup.button.callback('Другое', 'push-custom')],
        [Markup.button.callback('Отмена', 'cancel')]
      ]).reply_markup
    });

    ctx.session.buttonMainMenu = buttonMainMenu.message_id;
  } catch (error) {
    null;
  }
});

shareMessage.action(/push-(category|item|link|custom)/, async ctx => {
  try {
    const target = ctx.callbackQuery.data.split('-')[1];

    let footer;
    switch (target) {
      case 'category':
        footer = 'id категории';
        break;
      case 'item':
        footer = 'id товара';
        break;
      case 'link':
        footer = 'ссылка';
        break;
      case 'custom':
        footer = 'query строка';
        break;
    }

    if (!footer) {
      return;
    }

    const msg = await ctx.reply(
      `Укажите текст кнопки и значение в таком виде:\n\n<i>текст\n${footer}</i>`,
      {
        parse_mode: 'HTML'
      }
    );

    ctx.session.buttonMenu = msg.message_id;
    ctx.session.buttonTarget = target;

    ctx.session.action = 'button';
  } catch (error) {
    null;
  }
});

shareMessage.action('edit-text', async ctx => {
  try {
    const textMenu = await ctx.reply('Введите новый текст', {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('Отмена', 'cancel')]
      ]).reply_markup
    });

    ctx.session.action = 'text-edit';
    ctx.session.textMenu = textMenu.message_id;

    ctx.answerCbQuery().catch(() => null);
  } catch (error) {
    null;
  }
});

shareMessage.action('cancel', ctx => {
  ctx.deleteMessage().catch(() => null);
  ctx.session.action = 'undefiend';
});

shareMessage.action('exit', ctx => {
  ctx.scene.leave();
  ctx.reply('Вышел').catch(() => null);
});

shareMessage.action('preview', async ctx => {
  try {
    const keys = generateMenu(ctx);

    await sendMessage(
      ctx,
      Markup.inlineKeyboard(keys).reply_markup,
      ctx.from.id
    );
  } catch (error) {
    null;
  }
});

shareMessage.action('send', ctx => {
  ctx
    .reply('Вы уверены?', {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('Да', 'yes')],
        [Markup.button.callback('Нет', 'cancel')]
      ]).reply_markup
    })
    .catch(() => null);

  ctx.answerCbQuery().catch(() => null);
});

shareMessage.action('yes', async ctx => {
  try {
    const em = new StopEmitter();

    const targets = await users.find(
      {},
      {
        telegramID: 1
      }
    );
    const usersCount = targets.length;

    let stop = false;
    let i = 0;

    const keys = generateMenu(ctx);
    const keyboard = keys
      ? Markup.inlineKeyboard(keys).reply_markup
      : undefined;

    const context = ctx;
    const failed = new Uint16Array(new SharedArrayBuffer(32));
    failed[0] = 0;

    const timer = setInterval(() => {
      const start = i * 20;
      let end = (i + 1) * 20;

      if (end >= usersCount) {
        end = usersCount;
        stop = true;
      }

      for (let j = start; j < end; j++) {
        sendMessage(context, keyboard, targets[j].telegramID).catch(() =>
          Atomics.add(failed, 0, 1)
        );
      }

      if (stop) {
        em.emit('hush');
      }

      i++;
    }, 1000);

    em.on('hush', () => {
      clearTimeout(timer);
      context.reply(
        `Рассылка завершена\n\nУспешно: ${
          usersCount - Number(failed[0])
        }\nНе удалось: ${Number(failed[0])}`
      );
    });

    await ctx.reply('Рассылка началась, по окончании вы получите уведомление');
    await ctx.reply('Редактор закрыт');
    ctx.scene.leave();
  } catch (error) {
    null;
  }
});

module.exports = shareMessage;
