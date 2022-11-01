const pug = require('pug');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodeHtmlToImage = require('node-html-to-image');

const categories = require('./models/categories');
const goods = require('./models/goods');
const root = process.cwd();

// Функция рендерещая pug шаблон в html
const render = pug.compileFile(path.join(root, 'render_template', 'catalog.pug'));

// Загрузка товаров и передача их в шаблон с последующим рендером
async function renderShopPage(categoryName) {
	const category = await categories.findOne({
		title: categoryName
	});
	if (!category) throw new Error('Такой категории не существует');

	const categoryGoods = await goods.find({
		category: categoryName
	}, 'title image price discount');
	if (!categoryGoods) throw new Error('В данной категории нет товаров');

	const result = render({
		items: categoryGoods,
		root: root,
		styles: path.join(root, 'render_template', 'catalog.css'),
		fs: fs
	});

	const filename = `${categoryName}_${new Date().toLocaleString('ru-RU').replace(/[\/\, :]/gi, '_')}.html`;
	fs.writeFileSync(path.join(root, 'files', 'blanks', filename), result);
	
	return filename;
}

async function genImageFromHTML(filename){
	const resultName = crypto.randomBytes(6).toString('hex') + '.jpg',
		pathToHTMLFile = path.join(root, 'files', 'blanks', filename);

	const file = fs.readFileSync(pathToHTMLFile).toString();

	const result = await nodeHtmlToImage({
		output: path.join(root, 'files', 'images', resultName),
		html: file
	});

	return true;
}

genImageFromHTML('check.html');

module.exports.renderShopPage = renderShopPage;

// const check = render({
// 	items: [
// 		{
// 			title: 'Товар №1',
// 			image: '1.jpg',
// 			price: 5000,
// 			discount: 0
// 		},
// 		{
// 			title: 'Товар №2',
// 			image: '2.jpg',
// 			price: 1250,
// 			discount: 15
// 		},
// 		{
// 			title: 'Товар №3',
// 			image: '3.png',
// 			price: 1301,
// 			discount: 0
// 		},
// 		{
// 			title: 'Товар №4',
// 			image: '4.jpg',
// 			price: 120,
// 			discount: 50
// 		}
// 	],
// 	root: root,
// 	styles: fs.readFileSync(path.join(root, 'render_template', 'catalog.css')).toString(),
// 	fs: fs
// });

// fs.writeFileSync(path.join(root, 'files', 'blanks', 'check.html'), check);