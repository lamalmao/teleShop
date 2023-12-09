const { Scenes } = require('telegraf');

const start = require('./start');
const admin = require('./admin');
const managers = require('./managers');
const addManager = require('./add_manager');
const showManagers = require('./show_managers');
const categoriesManage = require('./categories');
const createCategory = require('./create_category');
const showCategories = require('./show_categories');
const editCategory = require('./edit_category');
const goodsManage = require('./goods');
const addItem = require('./add_item');
const showGoods = require('./show_goods');
const manageItem = require('./manage_item');
const profile = require('./profile');
const pay = require('./pay');
const paymentsStory = require('./payments_story');
const shop = require('./shop');
const mainCategory = require('./main_category');
const subCategory = require('./sub_category');
const item = require('./item');
const buy = require('./buy');
const acceptPurchase = require('./accept_purchase');
const proceed = require('./proceed');
const managerMenu = require('./manager_menu');
const ordersList = require('./orders_list');
const takeOrder = require('./take_order');
const userRefund = require('./user_refund');
const currentOrders = require('./current_orders');
const orderData = require('./order_data');
const refunds = require('./refunds');
const checkOrders = require('./check_order');
const managersInfo = require('./managers_info');
const sendContact = require('./send_contact');
const supercellProceed = require('./supercell_proceed');
const sendAuthCode = require('./send_auth_code');
const changeExtra = require('./change_extra');
const catchOrder = require('./catch_order');
const getUserData = require('./get_user_data');
const manageUser = require('./manage_user');
const genshinProceed = require('./genshin_proceed');
const lavaCheck = require('./lava-check');
const shareMessage = require('./share');
const changeDeliveryType = require('./change-delivery-type');
const cardsCategories = require('./card-categories');
const createCardCategory = require('./create-card-category');
const manageCardCategory = require('./manage-card-category');
const addCard = require('./add-card');
const manageCard = require('./manage-card');
const cardsList = require('./cards-list');
const refillCard = require('./refill-card');
const cardTransactionsScene = require('./card-transactions');
const loadCards = require('./load-cards');
const setItemNetCost = require('./set-item-net-cost');
const findLinkedCard = require('./find-linked-card');
const managerIncome = require('./manager-income');

module.exports = new Scenes.Stage([
  start,
  admin,
  managers,
  addManager,
  showManagers,
  categoriesManage,
  createCategory,
  showCategories,
  editCategory,
  goodsManage,
  addItem,
  showGoods,
  manageItem,
  profile,
  pay,
  paymentsStory,
  shop,
  mainCategory,
  subCategory,
  item,
  buy,
  acceptPurchase,
  proceed,
  managerMenu,
  ordersList,
  takeOrder,
  userRefund,
  currentOrders,
  orderData,
  refunds,
  checkOrders,
  managersInfo,
  sendContact,
  supercellProceed,
  sendAuthCode,
  changeExtra,
  catchOrder,
  getUserData,
  manageUser,
  genshinProceed,
  lavaCheck,
  shareMessage,
  changeDeliveryType,
  cardsCategories,
  createCardCategory,
  manageCardCategory,
  addCard,
  manageCard,
  cardsList,
  refillCard,
  cardTransactionsScene,
  loadCards,
  setItemNetCost,
  findLinkedCard,
  managerIncome
]);
