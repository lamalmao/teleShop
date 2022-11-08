const fs = require('fs');
const path = require('path');

const categories = require('./models/categories');
const goods = require('./models/goods');

const filesPath = path.join(process.cwd(), 'files', 'images');

async function clean() {
  try {
    let targets, images = [];
    
    targets = await categories.find({}, 'image');
    targets = targets.concat(await goods.find({}, 'bigImage image'));

    for (let item of targets) {
      if (item.image) images.push(item.image);
      if (item.bigImage) images.push(item.bigImage);
    }

    let toRemove = [], c = 0;
    fs.readdir(filesPath, (err, files) => {
      if (err) console.log(err.message);
      else {
        for (let file of files) {
          if (!images.includes(file) && !file.startsWith('blank_')) {
            toRemove.push(fs.unlink(path.join(filesPath, file), _ => null));
            c++;
          }
        }

        if (toRemove.length > 0) {
        Promise.allSettled(toRemove).then(console.log(`Удалено ${c} лишних файлов`));
        } else console.log('Лишнего не нашлось');
      }
    });
  } catch (e) {
    console.log(e);
  }
}

module.exports = clean;