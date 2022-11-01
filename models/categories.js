const { Schema, model, Types } = require('mongoose');

const Categories = new Schema({
	title: {
		type: String,
		required: 'Название категории обязательный параметр',
		unique: 'Такая категория уже существует' 
	},
	description: {
		type: String,
		required: 'Описание категории обязательный параметр'
	},
	image: {
		type: String,
		required: true,
		default: 'category_blank.jpg'
	},
	type: {
		type: String,
		required: true,
		// Может быть main или sub
		default: 'main',
		enum: {
			values: ['main', 'sub'],
			message: 'Тип категории может быть "main" или "sub"'
		}
	},
	parent: {
		type: String,
		required: true,
		validate: checkCategoryExistence
	}
});

const categories = model('categories', Categories);

async function checkCategoryExistence (categoryName) {
	if (this.type === 'main' && categoryName !== 'core')
		throw new Error('Тип основных категорий может быть только core');
	else if (this.type === 'sub') {
		const parent = await categories.findOne({
			title: categoryName
		}, 'type title');

		if (!parent)
			throw new Error(`Категории ${categoryName} не существует`);
	}

	return true;
}

module.exports = categories;