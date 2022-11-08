const { Markup } = require('telegraf');

const cb = Markup.button.callback;

const MenuButtons = {
  shop: 'shop',
  questions: 'questions',
  profile: 'profile',
  guarantees: 'guarantees',
  comments: 'comments',
  support: 'support'
}

const MenuKeyboard = Markup.inlineKeyboard([
  [cb('Магазин', MenuButtons.shop), cb('Профиль', MenuButtons.profile)],
  [cb('FAQ', MenuButtons.questions), cb('Гарантии', MenuButtons.guarantees)],
  [cb('Отзывы', MenuButtons.comments), cb('Поддержка', MenuButtons.support)]
]);

const AdminButtons = {
  categories: 'categories',
  goods: 'goods',
  managers: 'managers',
  sales: 'sales',
  refunds: 'refunds',
  exit: 'exit'
};

const AdminKeyboard = Markup.inlineKeyboard([
  [cb('Категории', AdminButtons.categories), cb('Товары', AdminButtons.goods)],
  [cb('Менеджеры', AdminButtons.managers)],
  [cb('Продажи', AdminButtons.sales), cb('Возвраты', AdminButtons.refunds)],
  [cb('Выйти из панели администратора', AdminButtons.exit)]
]);

const ManagersButtons = {
  managersList: 'managers_list',
  addManager: 'add_manager',
  back: 'back'
};

const ManagersKeyboard = Markup.inlineKeyboard([
  [cb('Менеджеры', ManagersButtons.managersList), cb('Добавить менеджера', ManagersButtons.addManager)],
  [cb('Назад', ManagersButtons.back)]
]);

const BackButton = 'back';
const BackKeyboard = Markup.inlineKeyboard([cb('Назад', BackButton)]);

const YesNoButtons = {
  yes: 'yes',
  no: 'no'
};

const YesNoMenu = Markup.inlineKeyboard([
  [cb('Да', YesNoButtons.yes)],
  [cb('Нет', YesNoButtons.no)]
]); 

const CategoriesManageButtons = {
  create: 'createCategory',
  list: 'showCategories',
  back: 'back'
};

const CategoriesManageKeyboard = Markup.inlineKeyboard([
  [cb('Создать', CategoriesManageButtons.create), cb('Все категории', CategoriesManageButtons.list)],
  [cb('Назад', CategoriesManageButtons.back)]
]);

const GoodsManageButtons = {
  addItem: 'addItem',
  showItems: 'showItems',
  back: 'back'
}

const GoodsManageKeyboard = Markup.inlineKeyboard([
  [cb('Добавить товар', GoodsManageButtons.addItem)],
  [cb('Список товаров', GoodsManageButtons.showItems)],
  [cb('Назад', GoodsManageButtons.back)]
]);

module.exports.Menu = {
  buttons: MenuButtons,
  keyboard: MenuKeyboard
};

module.exports.AdminMenu = {
  buttons: AdminButtons,
  keyboard: AdminKeyboard
};

module.exports.ManagersMenu = {
  buttons: ManagersButtons,
  keyboard: ManagersKeyboard
};

module.exports.BackMenu = {
  buttons: BackButton,
  keyboard: BackKeyboard
};

module.exports.YesNoMenu = {
  buttons: YesNoButtons,
  keyboard: YesNoMenu
};

module.exports.CategoriesManageMenu = {
  buttons: CategoriesManageButtons,
  keyboard: CategoriesManageKeyboard
};

module.exports.GoodsManageMenu = {
  buttons: GoodsManageButtons,
  keyboard: GoodsManageKeyboard
};