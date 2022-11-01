const { Schema, model } = require('mongoose');

const categories = require('./categories');

const Goods = new Schema({
	title: {
		type: String,
		required: true
	},
	description: String,
	image: {
		type: String,
		default: 'item_blank.jpg'
	},
	price: {
		type: Number,
		required: true,
		min: [0.1, 'Цена не может быть равной нулю или ниже']
	},
	sells: {
		type: Number,
		required: true,
		default: 0
	},
	category: {
		type: String,
		required: 'Необходимо указать категорию',
		validate: checkCategoryExistence
	},
	discount: {
		type: Number,
		min: [0, 'Значение не может быть ниже 0'],
		max: [100, 'Значение не может быть больше 100%'],
		default: 0
	}
});

async function checkCategoryExistence(category) {
	const parent = await categories.findOne({
		title: category
	}, 'title');

	if (!parent) throw new Error('Указанной категории не существует');
	else return true;
}

const goods = model('goods', Goods);

module.exports = goods;