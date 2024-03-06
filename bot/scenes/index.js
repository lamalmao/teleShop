const { Scenes, Markup } = require('telegraf');
const users = require('../../models/users');
const payments = require('../../models/payments');

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
const createTicket = require('./create-ticket');
const seeTicket = require('./see-ticket');
const clientTickets = require('./client-tickets');
const managerTickets = require('./manager-tickets');
const freeTickets = require('./free-tickets');
const markTicket = require('./mark-ticket');
const problemNotSolved = require('./problem-not-solved');
const ticketsScene = require('./tickets');
const managerOzan = require('./manager-ozan');
const ozanTransactionsScene = require('./ozan-transactions');
const createOzanTransaction = require('./create-ozan-transaction');
const changeOzanCardCost = require('./change-ozan-card-cost');
const ozanPaid = require('./ozan-paid');
const keysStory = require('./keys-story');
const refillSteam = require('./refill-steam');
const steamFee = require('./steam-fee');
const uaCardRefill = require('./ua-card-refill');
const uaCardSettings = require('./ua-card-settings');
const giftAccessProceed = require('./gift-access-proceed');
const promotionsScene = require('./promotions');
const createPromo = require('./create-promo');
const promotionsList = require('./promotions-list');
const managePromotion = require('./manage-promotion');
const activatePromo = require('./activate-promo');
const paymentServices = require('./payment-services');
const createPaymentLink = require('./create-payment-link');

const stage = new Scenes.Stage([
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
  managerIncome,
  createTicket,
  seeTicket,
  clientTickets,
  managerTickets,
  freeTickets,
  markTicket,
  problemNotSolved,
  ticketsScene,
  managerOzan,
  ozanTransactionsScene,
  createOzanTransaction,
  changeOzanCardCost,
  ozanPaid,
  keysStory,
  refillSteam,
  steamFee,
  uaCardRefill,
  uaCardSettings,
  giftAccessProceed,
  promotionsScene,
  createPromo,
  promotionsList,
  managePromotion,
  activatePromo,
  paymentServices,
  createPaymentLink
]);

stage.action(/(approve|decline)-ua-card-payment:\d+/, async ctx => {
  try {
    const check = await users.findOne({
      telegramID: ctx.from.id,
      role: 'admin'
    });

    if (!check) {
      await ctx.deleteMessage();
      return;
    }

    const raw =
      /(?<action>approve|decline)-ua-card-payment:(?<paymentId>\d+)/.exec(
        ctx.callbackQuery.data
      );
    if (!raw) {
      await ctx.deleteMessage();
      return;
    }

    const { action, paymentId } = raw.groups;
    const paymentID = Number(paymentId);

    const payment = await payments.findOneAndUpdate(
      {
        paymentID,
        status: 'waiting'
      },
      {
        $set: {
          status: action === 'approve' ? 'paid' : 'rejected',
          service: 'card'
        }
      }
    );

    if (!payment) {
      ctx
        .reply('Платеж не найден или уже был обработан')
        .then(msg =>
          setTimeout(
            () => ctx.deleteMessage(msg.message_id).catch(() => null),
            2500
          )
        )
        .catch(() => null);
      return;
    }

    if (action === 'approve') {
      await users.updateOne(
        {
          telegramID: payment.user
        },
        {
          $inc: {
            balance: payment.amount
          }
        }
      );

      ctx.telegram
        .sendMessage(
          payment.user,
          `Ваш платеж <code>${paymentId}</code> подтвержден администратором`,
          {
            parse_mode: 'HTML'
          }
        )
        .catch(() => null);

      ctx.deleteMessage().catch(() => null);
    } else {
      ctx.telegram
        .sendMessage(
          payment.user,
          `Ваш платеж <code>${paymentId}</code> не был подтвержден администратором, так как средства не были получены\n\nЕсли вы отправили средства, создайте Тикет во вкладке поддержка`,
          {
            parse_mode: 'HTML'
          }
        )
        .catch(() => null);

      ctx.editMessageReplyMarkup(Markup.removeKeyboard()).catch(() => null);
    }
  } catch (error) {
    console.log(error);
  }
});

stage.start(ctx => ctx.scene.enter('start'));

module.exports = stage;
