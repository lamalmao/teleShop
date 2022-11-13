const { Scenes, Markup } = require('telegraf');

const users = require('../../models/users');
const orders = require('../../models/orders');
const keys = require('../keyboard');

const managerMenu = new Scenes.BaseScene('manager_menu');

managerMenu.enterHandler = async function(ctx, next) {
  try {
    const user = await users.findOne({
      telegramID: ctx.from.id
    });

    if (user.role === 'manager' || user.role === 'admin') {
      const work = await orders.find({
        manager: ctx.from.id
      }, '_id status');

      const stats = genStats(work);
      const sum = stats.done + stats.processing + stats.refund;

      const doneP = ((stats.done / sum) * 100).toFixed(2);
      const processingP = ((stats.processing / sum) * 100).toFixed(2);
      const refundP = ((stats.refund / sum) * 100).toFixed(2);
      
      const msg = `<b>Меню менеджера</b> <code>${ctx.from.id}</code>\n\n<b>Статистика</b>\nВсего заказов взято: ${sum}\nВыполнено: ${stats.done} = ${Number.isNaN(doneP) ? 0 : doneP}%\nВ работе: ${stats.processing} = ${Number.isNaN(processingP) ? 0 : processingP}%\nВозвраты: ${stats.refund} = ${Number.isNaN(refundP) ? 0 : refundP}%`;

      if (!ctx.callbackQuery) {
        await ctx.reply(msg, {
          reply_markup: keys.ManagerWorkMenu.keyboard.reply_markup,
          parse_mode: 'HTML'
        });
      } else {
        await ctx.telegram.editMessageText(
          ctx.from.id,
          ctx.callbackQuery.message.message_id,
          undefined,
          msg,
          {
            reply_markup: keys.ManagerWorkMenu.keyboard.reply_markup,
            parse_mode: 'HTML'
          }
        );
      }
    }
  } catch (e) {
    console.log(e);
  } finally {
    ctx.scene.leave();
  }
}

function genStats(works) {
  let result = {
    processing: 0,
    done: 0,
    refund: 0
  };

  for (let order of works) result[order.status]++;

  return result;
}

module.exports = managerMenu;