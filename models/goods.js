const { Schema, model } = require('mongoose');

const categories = require('./categories');

const Goods = new Schema({
	title: {
		type: String,
		required: true
	},
	itemType: {
		type: String,
		required: true,
		default: 'manual',
		enum: ['manual', 'auto'];
	},
	description: String,
	bigDescription: String,
	image: {
		type: String,
		default: 'blank_item.jpg'
	},
	bigImage: {
		type: String,
		default: 'blank_item.jpg'
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
	},
	hidden: {
		type: Boolean,
		required: true,
		default: false
	}
});

async function checkCategoryExistence(category) {
	const parent = await categories.findById(category, '_id title');

	if (!parent) throw new Error('Указанной категории не существует');
	else return true;
}

Goods.methods.getPrice = function () {
	return Math.floor(this.price * (1 - this.discount / 100));
};

const goods = model('goods', Goods);

module.exports = goods;