const fs = require('fs');
const path = require('path');

const preset = require('./set');

const settingsPath = path.join(process.cwd(), 'settings.json');

function initSettings() {
	if (fs.existsSync(settingsPath)) {
		let config = JSON.parse(fs.readFileSync(settingsPath)),
			rewrite, failedFlag = false, failed = [];
			
		for (item in preset) {
			if (preset[item].required && !(item in config)) {
				console.error(`Не указан обязательный параметр ${item} в settings.json`);
				process.exit(9);
			}
		}

		for (item in config) {
			if (item in preset) {
				if (typeof config[item] !== preset[item].type) {
					failedFlag = true;
					failed.push(item);
				}
			}
		}
		if (failedFlag) {
			console.error(`Неверно указаны параметры: ${failed.join(',')}`);
			process.exit(9);
		} else return config;
	} else {
		fs.writeFileSync(settingsPath, genTemplate());
		console.log('Сгенерирован файл настроек - заполните его и перезапустите программу.');
		process.exit(0);
	}
}

function genTemplate() {
	let settings = {};
	for (item in preset)
		settings[item] = preset[item].default;
	return JSON.stringify(settings, null, '\t');
}

module.exports = initSettings;