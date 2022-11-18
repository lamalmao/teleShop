const { google } = require('googleapis');
const orders = require('./models/orders');
const users = require('./models/users');

const statuses = new Map();
statuses.set('untaken', 'ожидает');
statuses.set('processing', 'в работе');
statuses.set('done', 'выполнен');
statuses.set('refund', 'оформлен возврат');

const platforms = new Map();
platforms.set('pc', 'PC / macOS');
platforms.set('ps', 'Playstation 4/5');
platforms.set('android', 'Android');
platforms.set('nintendo', 'Nintendo');
platforms.set('xbox', 'XBox');

const refundStatuses = new Map();
refundStatuses.set('rejected', 'отклонен');
refundStatuses.set('approved', 'выполнен');
refundStatuses.set('waiting', 'в процессе');

const colors = {
  done: {
    red: 0.36,
    green: 0.83,
    blue: 0.42,
    alpha: 1
  },
  untaken: {
    red: 0.59,
    green: 0.79,
    blue: 0.8,
    alpha: 1
  },
  processing: {
    red: 0.92,
    green: 0.86,
    blue: 0.46,
    alpha: 1
  },
  rejected: {
    red: 0.83,
    green: 0.21,
    blue: 0.22,
    alpha: 1
  },
  approved: {
    red: 0.78,
    green: 0.36,
    blue: 0.81,
    alpha: 1
  },
  waiting: {
    red: 0.51,
    green: 0.48,
    blue: 0.52,
    alpha: 1
  },
};

async function writeHeads(sheets, spreadsheetId, range) {
  try {
    const headers = [
      [
        'ID Заказа',
        'Клиент',
        'Менеджер',
        'Статус',
        'Дата',
        'Товар',
        'Стоимость ₽',
        'Платформа',
        'Информация для возврата',
        'Статус возврата средств'
      ]
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: headers
      }
    });
  } catch (e) {
    console.log(e);
  }
}

async function updateSheet(auth, spreadsheetId) {
  let managers = new Map();

  const client = await auth.getClient();

  const sheets = google.sheets({
    version: 'v4',
    auth: client
  });

  const current = await orders.find({
    paid: true
  }, 'orderID client manager status date itemTitle amount platform refundStatus refundData'),
    updates = current.sort((one, two) => Number(one.date) > Number(two.date) ? -1 : 1);

  const length = updates.length;

  let rows = [];
  for (let i = 0; i < length; i++) {
    let values = [],
      format = {
        backgroundColor: null
      };

    if (updates[i].status !== 'refund') {
      format.backgroundColor = colors[updates[i].status];
    } else {
      format.backgroundColor = colors[updates[i].refundStatus];
    }

    for (let j in updates[i]) {
      let value = {
          userEnteredValue: null,
          userEnteredFormat: null
        },
        data;
      
      if (!['orderID', 'client', 'manager', 'status', 'itemTitle', 'amount', 'date', 'platform', 'refundStatus', 'refundData'].includes(j)) continue;

      if (updates[i][j]) {
        if (j === 'date') {
          data = updates[i][j].toLocaleString('ru-RU');
        } else if (j === 'status') {
          data = statuses.get(updates[i][j]);
        } else if (j === 'refundStatus') {
          data = refundStatuses.get(updates[i][j]);
        } else if (j === 'platform') {
          data = platforms.get(updates[i][j]);
        } else if (j === 'manager') {
          if (managers.has(updates[i][j])) {
            data = managers.get(updates[i][j]);
          } else {
            const user = await users.findOne({
              telegramID: updates[i][j]
            }, 'username');
            data = user.username;
            managers.set(updates[i][j], data);
          }
        } else data = updates[i][j];
      } else data = '-';

      switch (typeof data) {
        case 'string':
          value.userEnteredValue = {
            stringValue: data
          }
          break;
        case 'number':
          value.userEnteredValue = {
            numberValue: data
          }
          break;
        default:
          value.userEnteredValue = {
            stringValue: '-'
          };
          break;
      }
      value.userEnteredFormat = format;
      values.push(value)
    }
    rows.push({
      values
    });
  }
  
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    auth,
    resource: {
      requests: [
        {
          updateCells: {
            start: {
              sheetId: 0,
              rowIndex: 1,
              columnIndex: 0
            },
            fields: '*',
            rows
          }
        }
      ]
    }
  });
}

async function runUpdater(spreadsheetId, interval) {
  await writeHeads(google.sheets({
    version: 'v4',
    auth: new google.auth.GoogleAuth({
      keyFile: 'credentials.json',
      scopes: 'https://www.googleapis.com/auth/spreadsheets'
    })
  }), spreadsheetId, 'Orders!A1:J1');
  
  setInterval(async _ => {
    try {
      const auth = new google.auth.GoogleAuth({
        keyFile: 'credentials.json',
        scopes: 'https://www.googleapis.com/auth/spreadsheets'
      });
      
      await updateSheet(auth, spreadsheetId);
    } catch (e) {
      console.log(e.message);
    }
  }, interval * 1000);
}

module.exports = runUpdater;