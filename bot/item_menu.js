const { Markup } = require("telegraf");

const categories = require("../models/categories");
const keys = require('./keyboard');

const cb = Markup.button.callback;

async function genItemMessage(item, isAdmin) {
  let message = `${item.title}\n\n${item.description}\n\nЦена: ${item.getPrice()} руб.`;

  if (isAdmin) {
    message += `\n\nРеальная цена: ${item.price.toFixed(2)} руб.\nСкидка: ${item.discount}%\nПродаж: ${item.sells}\nСкрыт: ${item.hidden ? 'Да' : 'Нет'}`;

    const category = await categories.findById(item.category, 'title');
    if (category) message += `\n\nНаходится в категории "${category.title}"`;
    else message += '\n\nНе находится в категории, чтобы он отображался в магазине необходимо его поместить в существующую категорию';
  }

  return message;
}

function genItemKeyboard(item, isAdmin) {
  let keyboard = [];

  if (!isAdmin) keyboard.push( [cb('Купить', `buy#${item._id}`)]);
  else keyboard.push(
    [ cb('Переименовать', 'rename'), cb('Изменить описание', 'editDescription') ],
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