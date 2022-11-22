const { Markup, Scenes } = require('telegraf');
const orders = require('../../models/orders');

const sendContact = new Scenes.BaseScene('send_contact');

sendContact.enterHandler = async function(ctx) {
  try {
    const data = /res_contact#(\d+)#(\d+)/.exec(ctx.callbackQuery.data);

    const manager = Number(data[1]);
    const orderID = Number(data[2]);

    ctx.scene.state.manager = manager;
    ctx.scene.state.orderID = orderID;

    ctx.telegram.editMessageReplyMarkup(
      ctx.from.id,
      ctx.callbackQuery.message.message_id,
      undefined,
      {
        reply_markup: Markup.removeKeyboard().reply_markup
      }
    ).catch(_ => null);

    await ctx.reply('Отравьте нам пожалуйста свой контакт (при помощи кнопки ниже), чтобы мы могли с вами связаться по поводу заказа\n\nЕсли после отправки вам никто не напишет, пожалуйста обратитесь сюда: @fbzmanager', {
      reply_markup: Markup.keyboard([
        [ Markup.button.contactRequest('Отправить контакт') ]
      ]).resize(true).reply_markup
    });
  } catch (e) {
    console.log(e);
    ctx.scene.leave();
  }
};

sendContact.on('contact', async ctx => {
  try {
    const order = await orders.findOne({
      orderID: Number(ctx.scene.state.orderID)
    }, 'itemTitle');

    const msg = `Заказ ${ctx.scene.state.orderID} - ${order.itemTitle}`;

    ctx.telegram.sendContact(
      ctx.scene.state.manager,
      ctx.message.contact.phone_number,
      msg
    ).catch(_ => null);

    ctx.telegram.sendContact(
      global.managerID,
      ctx.message.contact.phone_number,
      msg
    ).catch(_ => null);
    
    await ctx.reply('Спасибо!\nОжидайте сообщения от менеджера', {
      reply_markup: Markup.removeKeyboard().reply_markup
    });

    ctx.scene.leave();
  } catch (e) {
    console.log(e);
    ctx.scene.leave();
  }
})

module.exports = sendContact;