const { mongoose } = require('mongoose');
const fs = require('fs');
const path = require('path');
const nodeRSA = require('node-rsa');

const preset = require('./preset');
const CreateBot = require('./bot');
const createPaymentProvider = require('./payment_service');
const runUpdater = require('./sheets');
const users = require('./models/users');
const ozanAccounts = require('./models/ozan-accounts');
const createSteamWorker = require('./steam-worker');
const cleanTickets = require('./ticketsWorker');
const startTicketsCleanup = require('./ticketsWorker');

// Форматирование строк
String.prototype.format = String.prototype.f = function () {
  var args = arguments;
  return this.replace(/\{(\d+)\}/g, (m, n) => {
    return args[n].toString() ? args[n] : m;
  });
};

// Загрузка настроек
const settings = preset();

global.paymentToken = settings.anypay_token;
global.projectID = settings.anypay_project_id;
global.managerID = settings.manager_id;
global.cardWorkerID = settings.card_worker_id;
global.ownerID = settings.owner_id;
global.games = ['fortnite', 'brawlstars', 'genshin', 'all'];
global.lavaToken = settings.lava_token;
global.lavaProjectId = settings.lava_project_id;

const keyFileDirectory = path.join(process.cwd(), 'key');
const keyFileLocation = path.join(keyFileDirectory, 'key.pem');
var keyGenerated = false;

if (!fs.existsSync(keyFileLocation)) {
  if (!fs.existsSync(keyFileDirectory)) fs.mkdirSync(keyFileDirectory);

  const key = new nodeRSA();
  const keys = key.generateKeyPair(4096);

  fs.writeFileSync(path.join(keyFileLocation), keys.exportKey('pkcs8-pem'));

  console.log('Ключи шифрования были сгенерированы');
  keyGenerated = true;
} else console.log('Ключи шифрования найдены');

const keysDirectoryLocation = path.join(process.cwd(), 'key', 'key.pem');
global.key = new nodeRSA(
  fs.readFileSync(keysDirectoryLocation).toString('utf-8')
);

global.ticketThemes = JSON.parse(
  fs.readFileSync(path.resolve('ticketThemes.json').toString('utf-8'))
);

const ozanCardCost = Number(
  fs.readFileSync(path.resolve('ozan-card-cost.txt')).toString().trim()
);
global.ozanCardCost = Number.isNaN(ozanCardCost) ? 29.99 : ozanCardCost;

global.helpMessage = fs
  .readFileSync(path.resolve('help.txt'))
  .toString('utf-8');

global.steamFee = Number(
  (
    1.1 +
    Number(fs.readFileSync(path.resolve('steam.txt').toString())) / 100
  ).toFixed(2)
);

if (Number.isNaN(global.steamFee)) {
  console.log('Комиссия должна быть числом');
  process.exit(0);
}

global.rubToUah = Number(
  fs.readFileSync(path.resolve('rub-to-uah.txt')).toString()
);

global.uaRefillCard = fs.readFileSync('ua-card.txt').toString();

if (Number.isNaN(global.rubToUah)) {
  console.log('Курс должен быть числом');
  process.exit(0);
}

global.steamEnabled = true;

// Генерация ключей шифрования
if (keyGenerated) {
  bot.telegram.sendDocument(
    settings.owner_id,
    {
      source: path.join(keyFileLocation)
    },
    {
      caption: `${new Date().toLocaleString(
        'ru-RU'
      )}\nСгенерированы новые ключи шифрования для доставляемых товаров`
    }
  );
}

(async () => {
  // Инициализация бота
  const bot = CreateBot(settings.bot_token);

  // Подключение к базе данных
  await mongoose.connect(settings.base_link);
  console.log('База данных подключена');

  const employers = await users.find(
    {
      role: {
        $ne: 'client'
      }
    },
    {
      telegramID: 1
    }
  );

  for (const employer of employers) {
    const check = await ozanAccounts.exists({
      employer: employer.telegramID
    });

    if (!check) {
      await ozanAccounts.create({
        employer: employer.telegramID
      });

      bot.telegram
        .sendMessage(
          employer.telegramID,
          '<b>Ваш ozan счёт инициализирован, вы можете найти его в меню менеджера /manager</b>',
          {
            parse_mode: 'HTML'
          }
        )
        .catch(() => null);
    }
  }

  // Запуск бота
  bot.launch();
  console.log('Бот запущен');

  const steamWorker = createSteamWorker(bot);

  steamWorker(30 * 1000);
  console.log('Steam обработчик запущен');

  startTicketsCleanup(bot, 30 * 60 * 1000, 48);
  console.log('Очистка тикетов запущена');

  // Запуск обработчика платежей
  const paymentWorker = createPaymentProvider(bot);
  paymentWorker.listen(
    {
      host: settings.host,
      port: 3000
    },
    () => console.log('Обработчик платежей запущен')
  );

  // Запуск отрисовки таблиц
  runUpdater(settings.spreadsheet_id, settings.sheets_update_interval);
})();
