const { Markup } = require("telegraf");

const categories = require("../models/categories");
const orders = require('../models/orders');
const keys = require('./keyboard');

const cb = Markup.button.callback;

const dayInMillieSeconds = 24 * 60 * 60 * 1000,
  monthInMillieSeconds = 30 * dayInMillieSeconds,
  weekInMilliSeconds = 7 * dayInMillieSeconds;

async function genItemMessage(item, isAdmin) {
  const price = item.getPrice();
  let message = `${item.title}\n\n${item.bigDescription}\n\nЦена: ${price} руб.`;

  if (isAdmin) {
    message += `\n\nРеальная цена: ${item.price.toFixed(2)} руб.\nСкидка: ${item.discount}%\nПродаж: ${item.sells}\nСкрыт: ${item.hidden ? 'Да' : 'Нет'}`;

    const category = await categories.findById(item.category, 'title');
    if (category) message += `\n\nНаходится в категории "${category.title}"`;
    else message += '\n\nНе находится в категории, чтобы он отображался в магазине необходимо его поместить в существующую категорию';

    let stats = await orders.find({
      date: {
        $gt: new Date(Date.now() - monthInMillieSeconds)
      },
      status: 'done',
      item: item._id
    }, 'date amount');

    const weekAgo = new Date(Date.now() - weekInMilliSeconds),
      dayAgo = new Date(Date.now() - dayInMillieSeconds);

    const month = stats.sort((one, two) => one.date > two.date ? 1 : -1),
      week = month.filter(i => i.date >= weekAgo),
      day = week.filter(i => i.date >= dayAgo);

    const monthSum = month.reduce((sum, elem) => {
        return sum + elem.amount;
      }, 0),
      weekSum = week.reduce((sum, elem) => {
        return sum + elem.amount;
      }, 0),
      daySum = day.reduce((sum, elem) => {
        return sum + elem.amount;
      }, 0);

    message += `\n\nСтатистика\n\nПериод        Продажи   Общая сумма\nЗа месяц    | ${month.length}${createSpaces(17 - month.length.toString().length)}| ${monthSum}${createSpaces(15 - monthSum.toString().length)}руб.\nЗа неделю | ${week.length}${createSpaces(17 - week.length.toString().length)}| ${weekSum}${createSpaces(15 - weekSum.toString().length)}руб.\nЗа день       | ${day.length}${createSpaces(17 - day.length.toString().length)}| ${daySum}${createSpaces(15 - daySum.toString().length)}руб.`;
  }

  return message;
}

function createSpaces(size) {
  let result = '';
  for (let i = 0; i < size; i++) {
    result += ' ';
  }
  return result;
}
function genItemKeyboard(item, isAdmin) {
  let keyboard = [];

  if (!isAdmin) keyboard.push( [cb('Купить', `buy#${item._id}`)]);
  else keyboard.push(
    [ cb('Переименовать', 'rename'), cb('Изменить описание', 'editDescription') ],
    [ cb('Изменить описание в сообщении', 'editBigDescription') ],
    [ cb('Изменить изображение', 'editImage') ],
    [ cb('Изменить видимость', 'hiddenSwitch') ],
    [ cb('Изменить цену', 'changePrice') ],
    [ cb('Изменить скидку', 'changeDiscount') ],
    [ cb('Удалить', 'delete'), cb('Переместить', 'move') ]
  );

  keyboard.push( [cb('Назад', keys.BackMenu.buttons)] );

  return Markup.inlineKeyboard(keyboard);
}

module.exports.genItemMessage = genItemMessage;
module.exports.genItemKeyboard = genItemKeyboard;