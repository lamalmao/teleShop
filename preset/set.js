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
		default: 'APNYPAY_TOKEN',
		required: true
	},
	anypay_project_id: {
		type: 'number',
		default: 0000,
		required: true
	},
	host: {
		type: 'string',
		default: 'localhost',
		required: true
	}
}