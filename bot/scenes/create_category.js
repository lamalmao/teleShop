const { Scenes, Markup } = require('telegraf');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const keys = require('../keyboard');
const categories = require('../../models/categories');

const typeChoice = Markup.inlineKeyboard([
  [Markup.button.callback('Основная', 'main'), Markup.button.callback('Вложенная', 'sub')],
  [Markup.button.callback('Назад', keys.BackMenu.buttons)]
]);

const createCategory = new Scenes.WizardScene('createCategory', 
  async ctx => {
    try {
      const message = ctx.scene.state.menu.message_id;

      await ctx.editMessageText('Введите название новой категории', message);
      await ctx.editMessageReplyMarkup(keys.BackMenu.keyboard.reply_markup, message);

      await ctx.wizard.next();
    } catch (e) {
      console.log(e);
      ctx.scene.enter('categories', ctx.scene.state);
    }
  },
  async ctx => {
    try {
      const cb = ctx.callbackQuery;

      if (cb) ctx.scene.enter('categories', ctx.scene.state);
      else {
        ctx.deleteMessage().catch(_ => null);

        const name = ctx.message.text.trim(),
          message = ctx.scene.state.menu.message_id;

        const check = await categories.findOne({
          title: name
        });

        if (!check) {
          ctx.scene.state.newCategory = {
            title: name
          };
          
          await ctx.telegram.editMessageText(ctx.from.id, message, undefined, 'Введите описание категории');
          await ctx.telegram.editMessageReplyMarkup(ctx.from.id, message, undefined, keys.BackMenu.keyboard.reply_markup);

          await ctx.wizard.next();
        } else {
          await ctx.telegram.editMessageText(ctx.from.id, message, undefined, 'Введите название новой категории\n\nТакая категория уже существует');
          await ctx.telegram.editMessageReplyMarkup(ctx.from.id, message, undefined, keys.BackMenu.keyboard.reply_markup);
        }
      }
    } catch (e) {
      console.log(e);
      ctx.scene.enter('categories', ctx.scene.state);
    }
  },
  async ctx => {
    try {
      if (ctx.updateType === 'message') {
        ctx.deleteMessage().catch(_ => null);
        const message = ctx.scene.state.menu.message_id;
        const description = ctx.message.text.trim();

        if (description === '') {
          await ctx.telegram.editMessageText(ctx.from.id, message, undefined, 'Введите описание категории\n\nОписание не может быть пустым');
          await ctx.telegram.editMessageReplyMarkup(ctx.from.id, message, undefined, keys.BackMenu.keyboard.reply_markup);
        } else {
          ctx.scene.state.newCategory.description = description;
          await ctx.telegram.editMessageText(ctx.from.id, message, undefined, 'Укажите тип категории');
          await ctx.telegram.editMessageReplyMarkup(ctx.from.id, message, undefined, typeChoice.reply_markup);

          ctx.wizard.next();
        }
      } else ctx.scene.enter('categories', { menu: ctx.scene.state.menu });
    } catch (e) {
      console.log(e);
      ctx.scene.enter('categories', { menu: ctx.scene.state.menu });
    }
  },
  async ctx => {
    try {
      const cb = ctx.callbackQuery,
        message = ctx.scene.state.menu.message_id;

      if (cb) {
        if (cb.data === keys.BackMenu.buttons) ctx.scene.enter('categories', ctx.scene.state);
        else {
          ctx.scene.state.newCategory.type = cb.data;

          ctx.scene.state.cb = cb.id;

          if (cb.data === 'sub') {
            const cores = await categories.find({
              type: 'main'
            }, '_id title');

            if (cores.length === 0) {
              await ctx.telegram.editMessageText(ctx.from.id, message, undefined, 'Укажите тип категории\n\nНевозможно создать вложенную категорию, так как нет ни одной основной');
              await ctx.telegram.editMessageReplyMarkup(ctx.from.id, message, undefined, typeChoice.reply_markup);
            } else {
              let mainCategoriesListKeyboard = [];

              for (let category of cores) {
                mainCategoriesListKeyboard.push([ Markup.button.callback(category.title, category._id) ]);
              }

              mainCategoriesListKeyboard.push([ Markup.button.callback('Отмена', keys.BackMenu.buttons) ]);

              await ctx.telegram.editMessageText(ctx.from.id, message, undefined, 'Выберите куда вложить новую подкатегорию');
              await ctx.telegram.editMessageReplyMarkup(ctx.from.id, message, undefined, Markup.inlineKeyboard(mainCategoriesListKeyboard).reply_markup);

              await ctx.wizard.next();
            }
          } else {
            ctx.scene.state.newCategory.parent = 'core';

            await ctx.telegram.editMessageText(ctx.from.id, message, undefined, 'Загрузите обложку категории (в случае пропуска будет использоваться изображение с главного меню)')
            await ctx.telegram.editMessageReplyMarkup(ctx.from.id, message, undefined, Markup.inlineKeyboard([
              [Markup.button.callback('Пропустить', 'skip')],
              [Markup.button.callback('Отмена', keys.BackMenu.buttons)]
            ]).reply_markup);

            await ctx.wizard.selectStep(ctx.wizard.cursor + 2);
          }
        }
      }
    } catch (e) {
      console.log(e);
      ctx.scene.enter('categories', { menu: ctx.scene.state.menu });
    }
  },
  async ctx => {
    try {
      if (ctx.updateType === 'callback_query') {
        const cb = ctx.callbackQuery.data;

        if (cb === keys.BackMenu.buttons) await ctx.scene.enter('categories', { menu: ctx.scene.state.menu });
        else {
          await categories.create({
            ...ctx.scene.state.newCategory,
            parent: cb
          });

          ctx.telegram.answerCbQuery(ctx.scene.state.cb, `Вложенная категория ${ctx.scene.state.newCategory.title} успешно создана`)
            .catch(_ => null);
          ctx.scene.enter('categories', { menu: ctx.scene.state.menu });
        }
      }
    } catch (e) {
      console.log(e);
      ctx.telegram.answerCbQuery(ctx.scene.state.cb, `Ошибка во время создания подкатегории: ${e.message}`).catch(_ => null);
      ctx.scene.enter('categories', { menu: ctx.scene.state.menu });
    }
  }, 
  async ctx => {
    try {
      if (ctx.updateType === 'message') {
        let photo = ctx.message.photo;
        
        if (!photo) ctx.deleteMessage().catch(_ => null);
        else {
          const link = await ctx.telegram.getFileLink(photo[photo.length - 1].file_id);
          const filename = crypto.randomBytes(8).toString('hex') + '.jpg';

          axios({
            method: 'get',
            url: link.href,
            responseType: 'stream'
          }).then(res => {
            const writer = fs.createWriteStream(path.join(process.cwd(), 'files', 'images', filename));

            res.data.pipe(writer);
            let problem;

            writer.on('error', async err => {
              problem = err;
              console.log(err.message);
              writer.close();
              ctx.answerCbQuery(`Ошибка во время загрузки файла: ${err.message}`).catch(_ => null);
              await ctx.scene.enter('categories', { menu: ctx.scene.state.menu });
            });

            writer.on('close', async () => {
              if (!problem) {
                ctx.deleteMessage().catch(_ => null);
                await categories.create({
                  ...ctx.scene.state.newCategory,
                  image: filename
                });
                ctx.telegram.answerCbQuery(ctx.scene.state.cb, `Категория ${ctx.scene.state.newCategory.title} успешно создана`).catch(_ => null);
                ctx.scene.enter('categories', { menu: ctx.scene.state.menu });
              }
            });
          }).catch(async err => {
            console.log(err.message);
            ctx.telegram.answerCbQuery(ctx.scene.state.cb, 'Что-то пошло не так при загрузке изображения').catch(_ => null);
            ctx.deleteMessage().catch(_ => null);
            ctx.scene.enter('categories', { menu: ctx.scene.state.menu });
          });
        }
      } else if (ctx.updateType === 'callback_query') {
        if (ctx.callbackQuery.data === 'skip') {
          await categories.create(ctx.scene.state.newCategory);
          ctx.telegram.answerCbQuery(ctx.scene.state.cb, `Категория ${ctx.scene.state.newCategory.title} успешно создана`).catch(_ => null);
          ctx.scene.enter('categories', { menu: ctx.scene.state.menu });
        }
      }
    } catch (e) {
      console.log(e);
      ctx.telegram.answerCbQuery(ctx.scene.state.cb, `Ошибка во время создания категории: ${e.message}`).catch(_ => null);
      ctx.scene.enter('categories', { menu: ctx.scene.state.menu });
    }
  }
);

module.exports = createCategory;