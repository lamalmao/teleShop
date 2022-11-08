const { mongoose } = require('mongoose');

const preset = require('./preset');
const CreateBot = require('./bot');

// Загрузка настроек
const settings = preset();

// Подключение к базе данных
mongoose.connect(settings.base_link);

// Инициализация и запуск бота
const bot = CreateBot(settings.bot_token);
bot.launch();
