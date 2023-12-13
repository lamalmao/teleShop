const { Scenes } = require('telegraf');

const users = require('../../models/users');
const orders = require('../../models/orders');
const keys = require('../keyboard');
const tickets = require('../../models/tickets');

const managerMenu = new Scenes.BaseScene('manager_menu');

managerMenu.enterHandler = async function (ctx, next) {
  try {
    const user = await users.findOne({
      telegramID: ctx.from.id
    });

    if (user.role === 'manager' || user.role === 'admin') {
      const work = await orders.find(
        {
          manager: ctx.from.id,
          paid: true,
          status: {
            $ne: 'canceled'
          }
        },
        '_id status'
      );

      const marks = await tickets.aggregate([
        {
          $match: {
            manager: ctx.from.id,
            done: true,
            mark: {
              $ne: 0
            }
          }
        },
        {
          $group: {
            _id: null,
            averageMark: {
              $avg: '$mark'
            }
          }
        }
      ]);

      const stats = genStats(work);
      const sum = stats.done + stats.processing + stats.refund;

      const doneP = ((stats.done / sum) * 100).toFixed(2);
      const processingP = ((stats.processing / sum) * 100).toFixed(2);
      const refundP = ((stats.refund / sum) * 100).toFixed(2);

      let msg = `<b>Меню менеджера</b> <code>${
        ctx.from.id
      }</code>\n\n<b>Статистика за все время</b>\nТикетов закрыто: ${
        user.ticketsAnswered || 0
      }\nСредняя оценка тикетов: ${
        marks[0]?.averageMark.toFixed(1) || '-'
      }\nВсего заказов взято: ${sum}\nВыполнено: ${stats.done} = ${
        Number.isNaN(doneP) ? 0 : doneP
      }%\nВ работе: ${stats.processing} = ${
        Number.isNaN(processingP) ? 0 : processingP
      }%\nВозвраты: ${stats.refund} = ${
        Number.isNaN(refundP) ? 0 : refundP
      }%\n\n<b>Статистика по последним заказам</b>\n`;

      if (user.stats.length > 0) {
        let summary = 0;
        for (let stat of user.stats) {
          msg += `<i>${stat.title}</i>: ${stat.count}\n`;
          summary += stat.count;
        }
        msg += `<b>Всего:</b> ${summary}`;
      } else msg += '<i>Заказов нет</i>';

      if (!ctx.callbackQuery) {
        await ctx.reply(msg, {
          reply_markup: keys.ManagerWorkMenu.keyboard.reply_markup,
          parse_mode: 'HTML'
        });
      } else {
        await ctx.telegram.editMessageText(
          ctx.from.id,
          ctx.scene.state.menu || ctx.callbackQuery.message.message_id,
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
};

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
