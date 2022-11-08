const pug = require('pug');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodeHtmlToImage = require('node-html-to-image');

const categories = require('./models/categories');
const goods = require('./models/goods');
const root = process.cwd();

const { mongoose } = require('mongoose');

mongoose.connect('mongodb://localhost/site');

// Функция рендера pug шаблона в html
const render = pug.compileFile(path.join(root, 'render_template', 'catalog.pug'));
const itemRender = pug.compileFile(path.join(root, 'render_template', 'item.pug'));

// Загрузка товаров и передача их в шаблон с последующим рендером
async function renderShopPage(categoryId) {
	const category = await categories.findById(categoryId);
	if (!category) throw new Error('Такой категории не существует');

	const categoryGoods = await goods.find({
		category: categoryId,
		hidden: false
	}, 'title image price discount');
	if (!categoryGoods) throw new Error('В данной категории нет товаров');

	const result = render({
		items: categoryGoods,
		root: root,
		styles: fs.readFileSync(path.join(root, 'render_template', 'catalog.css')).toString(),
		fs: fs
	});

	const filename = `${category.title}_${new Date().toLocaleString('ru-RU').replace(/[\/\, :]/gi, '_')}.html`;
	fs.writeFileSync(path.join(root, 'files', 'blanks', filename), result);
	
	return filename;
}

async function genImageFromHTML(filename){
	const resultFilename = crypto.randomBytes(6).toString('hex') + '.jpg',
		pathToHTMLFile = path.join(root, 'files', 'blanks', filename);

	const file = fs.readFileSync(pathToHTMLFile).toString();

	await nodeHtmlToImage({
		output: path.join(root, 'files', 'images', resultFilename),
		html: file
	});

	fs.unlinkSync(pathToHTMLFile);
	return resultFilename;
}

async function renderItemPage(itemID) {
	const item = await goods.findById(itemID);

	if (!item) throw new Error('Товара не существует');

	const result = itemRender({
		item: item,
		styles: fs.readFileSync(path.join(root, 'render_template', 'item.css')).toString(),
		fs: fs,
		root: root
	});

	const filename = `${item.title}_${new Date().toLocaleString('ru-RU').replace(/[\/\, :]/gi, '_')}.html`;
	fs.writeFileSync(path.join(root, 'files', 'blanks', filename), result);

	return filename;
}

module.exports.renderShopPage = renderShopPage;
module.exports.genImageFromHTML = genImageFromHTML;
module.exports.renderItemPage = renderItemPage;