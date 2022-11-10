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
const acceptPurchase = require('./accept_purchase')

module.exports = new Scenes.Stage([start, admin, managers, addManager, showManagers, categoriesManage, createCategory, showCategories, editCategory, goodsManage, addItem, showGoods, manageItem, profile, pay, paymentsStory, shop, mainCategory, subCategory, item, buy, acceptPurchase]);