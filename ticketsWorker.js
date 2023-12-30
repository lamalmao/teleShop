const ticketMessage = require('./models/ticket-messages');
const tickets = require('./models/tickets');
const users = require('./models/users');

async function cleanTickets(bot, timeout = 48) {
  try {
    const moment = new Date(Date.now() - timeout * 60 * 60 * 1000);

    const targets = await tickets.find(
      {
        done: false,
        waitingForUser: true
      },
      {
        client: 1,
        manager: 1
      }
    );

    for (const target of targets) {
      const lastMessage = await ticketMessage.findOne(
        {
          ticket: target._id
        },
        {
          answerDate: 1
        },
        {
          sort: {
            creationDate: -1
          }
        }
      );

      if (lastMessage?.answerDate > moment) {
        return;
      }

      await tickets.updateOne(
        {
          _id: target._id
        },
        {
          $set: {
            done: true
          }
        }
      );

      users
        .updateOne(
          {
            telegramID: target.manager
          },
          {
            $inc: {
              ticketsAnswered: 1
            }
          }
        )
        .catch(e => console.log(e));

      bot.telegram
        .sendMessage(
          target.client,
          `Ваш тикет - <code>${target._id
            .toString()
            .toUpperCase()}</code> был автоматически закрыт\n\nТак как мы не получили от вас никакого ответа за последние 48 часов`,
          {
            parse_mode: 'HTML'
          }
        )
        .catch(() => null);

      console.log(`${target._id.toString()} closed`);
    }
  } catch (error) {
    console.log(error);
  }
}

function startTicketsCleanup(bot, period, timeout) {
  try {
    cleanTickets(bot, timeout);
    setInterval(async () => {
      try {
        await cleanTickets(bot, timeout);
      } catch (error) {
        console.log(error);
      }
    }, period);
  } catch (error) {
    console.log(error);
  }
}

module.exports = startTicketsCleanup;
