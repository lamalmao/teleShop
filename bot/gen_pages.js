const { Markup } = require('telegraf');
const { BackMenu } = require('./keyboard');

const back = require('./keyboard').BackMenu;

function genItemsListPages(goods) {
  let pages = new Map();
  const pageSize = 10,
    size = goods.length,
    pagesCount = Math.ceil(size / pageSize);

  const next = Markup.button.callback('Вперед →', 'next'),
    back = Markup.button.callback('← Назад', 'prev');

  for (let i = 0; i < pagesCount; i++) {
    let page = [],
      residue = (size - i * pageSize),
      goodsOnPageCount = residue >= pageSize ? pageSize : residue,
      start = i * pageSize;
      first = true,
      line = [];
    
    for (let j = start; j < start + goodsOnPageCount; j++) {
      let pushed = false;
      if (!first) {
        line.push(Markup.button.callback(goods[j].title, `item#${goods[j]._id}`));
        page.push(line);
        pushed = true;
      } else line = [Markup.button.callback(goods[j].title, `item#${goods[j]._id}`)]

      if (j === start + goodsOnPageCount - 1 && !pushed) page.push(line);

      first = !first;
    }
    
    let navigation = [];
    if (pagesCount > 1) {
      if (i === 0) navigation.push(next)
      else if (i + 1 === pagesCount) navigation.push(back);
      else navigation.push(back, next);
    }
    if (navigation.length > 0) page.push(navigation);
    page.push( [Markup.button.callback('Назад', BackMenu.buttons)] );


    pages.set(i, Markup.inlineKeyboard(page));
  }

  return pages;
}

module.exports = genItemsListPages;