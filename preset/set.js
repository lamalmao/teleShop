module.exports = {
  // Токен для управления ботом, получить можно у https://t.me/BotFather
  bot_token: {
    type: 'string',
    default: 'BOT TOKEN',
    required: true
  },
  // Ссылка для подключения к mongodb базе
  base_link: {
    type: 'string',
    default: 'mongodb://user:pwd@hostname/basename',
    required: true
  },
  anypay_token: {
    type: 'string',
    default: 'ANYPAY_TOKEN',
    required: true
  },
  anypay_project_id: {
    type: 'number',
    default: 0,
    required: true
  },
  freekassa_shop_id: {
    type: 'number',
    default: 0,
    required: true
  },
  freekassa_payment_token: {
    type: 'string',
    default: '',
    required: true
  },
  freekassa_notifications_token: {
    type: 'string',
    default: '',
    required: true
  },
  host: {
    type: 'string',
    default: 'localhost',
    required: true
  },
  spreadsheet_id: {
    type: 'string',
    default: '0000000000000000000000000000',
    required: true
  },
  sheets_update_interval: {
    type: 'number',
    default: 60,
    required: true
  },
  manager_id: {
    type: 'number',
    default: 0,
    required: true
  },
  owner_id: {
    type: 'number',
    default: 0,
    required: true
  },
  lava_token: {
    type: 'string',
    default: '',
    required: true
  },
  lava_project_id: {
    type: 'string',
    default: '',
    required: true
  },
  kupikod_token: {
    type: 'string',
    default: '',
    required: true
  },
  card_worker_id: {
    type: 'number',
    default: 0,
    required: true
  }
};
