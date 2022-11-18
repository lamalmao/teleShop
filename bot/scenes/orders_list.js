const { Scenes, Markup } = require('telegraf');

const users = require('../../models/users');
const orders = require('../../models/orders');
const keys = require('../keyboard');

const ordersList = new Scenes.BaseScene('orders_list');

ordersList.enterHandler = async function(ctx) {
  try {
    const user = await users.findOne({
      telegramID: ctx.from.id
    }, '_id role');

    if (user.role === 'admin' || user.role === 'manager') {
      const active = await orders.find({
        status: 'untaken',
        paid: true
      }, 'orderID itemTitle');

      const keyboard = genOrdersKeyboard(active);

      await ctx.telegram.editMessageText(
        ctx.from.id,
        ctx.callbackQuery.message.message_id,
        undefined,
        'Выберите заказ',
        {
          reply_markup: keyboard.reply_markup
        }
      );
    } else {
      ctx.telegram.deleteMessage(ctx.from.id, ctx.callbackQuery.message.message_id)
        .catch(_ => null);
    }
  } catch (e) {
    console.log(e.message);
  } finally {
    ctx.scene.leave();
  }
};

function genOrdersKeyboard(orders) {
  let keyboard = [],
    counter = 0;

  keyboard.push([
    Markup.button.callback('Обновить', keys.ManagerWorkMenu.buttons.list),
    Markup.button.callback('Назад', 'manager_menu')
  ]);

  for (order of orders) {
    keyboard.push(
      [ Markup.button.callback(`${order.orderID}: "${order.itemTitle}"`, `manager_take#${order.orderID}`) ]
    );
    counter++;
    if (counter >= 48) break;
  }
  return Markup.inlineKeyboard(keyboard);
}

module.exports = ordersList;