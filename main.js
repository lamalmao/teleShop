const { mongoose } = require('mongoose');

const preset = require('./preset');
const CreateBot = require('./bot');
const createPaymentProvider = require('./payment_service');
const runUpdater = require('./sheets');

// Форматирование строк
String.prototype.format = String.prototype.f = function(){
	var args = arguments;
	return this.replace(/\{(\d+)\}/g, (m, n) => {
		return args[n].toString() ? args[n] : m;
	});
};

// Загрузка настроек
const settings = preset();

global.paymentToken = settings.anypay_token;
global.projectID = settings.anypay_project_id;


// Подключение к базе данных
mongoose.connect(settings.base_link);

// Инициализация и запуск бота
const bot = CreateBot(settings.bot_token);
bot.launch();

// Запуск обработчика платежей
const paymentWorker = createPaymentProvider(bot);
paymentWorker.listen({
  host: settings.host,
  port: 3000
}, _ => console.log('Обработчик платежей запущен'));

runUpdater(settings.spreadsheet_id, settings.sheets_update_interval);