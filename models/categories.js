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
		default: 'blank_logo.jpg'
	},
	type: {
		type: String,
		required: true,
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
	},
	hidden: {
		type: Boolean,
		required: true,
		default: false
	}
});

const categories = model('categories', Categories);

async function checkCategoryExistence (categoryID) {
	if (this.type === 'main' && categoryID !== 'core')
		throw new Error('"Родителем" основных категорий может быть только "core"');
	else if (this.type === 'sub') {
		const parent = await categories.findOne({
			_id: categoryID,
			type: 'main'
		}, '_id type title');

		if (!parent)
			throw new Error(`Основной категории ${categoryName} не существует`);
	}

	return true;
}

module.exports = categories;