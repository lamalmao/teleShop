const escapeHTML = require('escape-html');
const { checkOrder } = require('./kupikod');
const orders = require('./models/orders');
const users = require('./models/users');

function createSteamWorker(bot) {
  return async function (interval) {
    try {
      setInterval(async () => {
        try {
          const steamOrders = await orders.find({
            steam: true,
            status: 'processing'
          });

          for (const order of steamOrders) {
            const check = await checkOrder(order.kupikodID);
            if (!check) {
              continue;
            }

            if (check === 'success') {
              await orders.updateOne(
                {
                  _id: order._id
                },
                {
                  $set: {
                    status: 'done'
                  }
                }
              );

              bot.telegram
                .sendMessage(
                  order.client,
                  `Заказ <code>${order.orderID}</code> - "${escapeHTML(
                    order.itemTitle
                  )} за ${order.amount} рублей" выполнен`,
                  {
                    parse_mode: 'HTML'
                  }
                )
                .catch(() => null);
            } else if (
              check === 'false' ||
              check === null ||
              check === 'error'
            ) {
              await orders.findByIdAndUpdate(order._id, {
                $set: {
                  status: 'canceled'
                }
              });

              await users.updateOne(
                {
                  telegramID: order.client
                },
                {
                  $inc: {
                    balance: order.amount
                  }
                }
              );

              bot.telegram
                .sendMessage(
                  order.client,
                  `Заказ <code>${order.orderID}</code> - "${escapeHTML(
                    order.itemTitle
                  )} за ${order.amount} рублей" не удалось выполнить.`,
                  {
                    parse_mode: 'HTML'
                  }
                )
                .catch(() => null);
            }
          }
        } catch (error) {
          console.log(error);
        }
      }, interval);
    } catch (error) {
      console.log(error);
    }
  };
}

module.exports = createSteamWorker;
