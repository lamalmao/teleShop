const { Markup } = require('telegraf');

const cb = Markup.button.callback;

const MenuButtons = {
  shop: 'shop',
  questions: 'FAQ',
  profile: 'profile',
  guarantees: 'guarantees',
  comments: 'reviews',
  support: 'support'
};

const MenuKeyboard = Markup.inlineKeyboard([
  [cb('Магазин 🛒', MenuButtons.shop), cb('Профиль 👤', MenuButtons.profile)],
  [
    cb('FAQ ❓', MenuButtons.questions),
    cb('Гарантии 🔰', MenuButtons.guarantees)
  ],
  [
    cb('Отзывы ⭐', MenuButtons.comments),
    cb('Поддержка 🙋', MenuButtons.support)
  ],
  [Markup.button.url('Ваш аккаунт 🎁', 'https://t.me/fbzstatsbot')],
  [Markup.button.url('Бесплатный кейс ⚡️', 'https://bit.ly/fbzdrop-fbzshoptg')]
]);

const AdminButtons = {
  categories: 'categories',
  goods: 'goods',
  managers: 'managers',
  sales: 'sales',
  refunds: 'refunds',
  exit: 'exit',
  cards: 'card-categories',
  tickets: 'tickets'
};

const ManagersButtons = {
  managersList: 'managers_list',
  addManager: 'add_manager',
  back: 'back'
};

const AdminKeyboard = Markup.inlineKeyboard([
  [cb('Категории', AdminButtons.categories), cb('Товары', AdminButtons.goods)],
  [cb('Менеджеры', AdminButtons.managers), cb('Статистика', 'showManagers')],
  [cb('Заказы', AdminButtons.sales), cb('Возвраты', AdminButtons.refunds)],
  [cb('Карты', AdminButtons.cards)],
  [cb('Пользователи', 'get_user_data'), cb('Тикеты', AdminButtons.tickets)],
  [cb('Выйти из панели администратора', AdminButtons.exit)]
]);

const ManagersKeyboard = Markup.inlineKeyboard([
  [
    cb('Менеджеры', ManagersButtons.managersList),
    cb('Добавить менеджера', ManagersButtons.addManager)
  ],
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
  [
    cb('Создать', CategoriesManageButtons.create),
    cb('Все категории', CategoriesManageButtons.list)
  ],
  [cb('Назад', CategoriesManageButtons.back)]
]);

const GoodsManageButtons = {
  addItem: 'addItem',
  showItems: 'showItems',
  back: 'back'
};

const GoodsManageKeyboard = Markup.inlineKeyboard([
  [cb('Добавить товар', GoodsManageButtons.addItem)],
  [cb('Список товаров', GoodsManageButtons.showItems)],
  [cb('Назад', GoodsManageButtons.back)]
]);

const ProfileMenuButtons = {
  refill: 'refill',
  story: 'spendingLog'
};

const ProfileMenuKeyboard = Markup.inlineKeyboard([
  [cb('Пополнить баланс 💰', ProfileMenuButtons.refill)],
  [cb('История баланса 🔎', ProfileMenuButtons.story)],
  [cb('Назад', BackButton)]
]);

const ManagerWorkButton = {
  list: 'active_orders',
  active: 'manager_list',
  back: 'manager_leave',
  income: 'manager-income',
  tickets: 'manager-tickets'
};

const ManagerWorkKeyboard = Markup.inlineKeyboard([
  [cb('Взять заказ в работу', ManagerWorkButton.list)],
  [cb('Мои заказы', ManagerWorkButton.active)],
  [cb('Тикеты', ManagerWorkButton.tickets)],
  [cb('Мой доход', ManagerWorkButton.income)],
  [cb('Выйти', ManagerWorkButton.back)]
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

module.exports.ProfileMenu = {
  buttons: ProfileMenuButtons,
  keyboard: ProfileMenuKeyboard
};

module.exports.ManagerWorkMenu = {
  buttons: ManagerWorkButton,
  keyboard: ManagerWorkKeyboard
};
