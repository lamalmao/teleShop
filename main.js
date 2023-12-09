const { mongoose } = require('mongoose');
const fs = require('fs');
const path = require('path');
const nodeRSA = require('node-rsa');

const preset = require('./preset');
const CreateBot = require('./bot');
const createPaymentProvider = require('./payment_service');
const runUpdater = require('./sheets');

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

// Подключение к базе данных
mongoose.connect(settings.base_link);

// Инициализация бота
const bot = CreateBot(settings.bot_token);

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

// Запуск бота
bot.launch();
console.log('Бот запущен');

// Запуск обработчика платежей
// const paymentWorker = createPaymentProvider(bot);
// paymentWorker.listen({
//     host: settings.host,
//     port: 3000
//   },
//   () => console.log('Обработчик платежей запущен')
// );

// Запуск отрисовки таблиц
// runUpdater(settings.spreadsheet_id, settings.sheets_update_interval);
