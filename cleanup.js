const fs = require('fs');
const path = require('path');

const categories = require('./models/categories');
const goods = require('./models/goods');

const filesPath = path.join(process.cwd(), 'files');

async function clean() {
  try {
    let targets,
      images = [];

    targets = await categories.find({}, 'image');
    targets = targets.concat(await goods.find({}, 'bigImage image'));

    for (let item of targets) {
      if (item.image) images.push(item.image);
      if (item.bigImage) images.push(item.bigImage);
    }

    fs.readdir(path.join(filesPath, 'images'), (err, files) => {
      if (err) console.log(err.message);
      else {
        let toRemove = [],
          c = 0;
        for (let file of files) {
          if (!images.includes(file) && !file.startsWith('blank_')) {
            toRemove.push(
              fs.unlink(path.join(filesPath, 'images', file), _ => null)
            );
            c++;
          }
        }

        if (c > 0) {
          Promise.allSettled(toRemove).then(
            console.log(`Удалено ${c} лишних изображений`)
          );
        } else console.log('Лишнего не нашлось');
      }
    });

    fs.readdir(path.join(filesPath, 'blanks'), (err, files) => {
      if (err) console.log(err.message);
      else {
        let toRemove = [],
          c = 0;
        for (let file of files) {
          toRemove.push(
            fs.unlink(path.join(filesPath, 'blanks', file), _ => null)
          );
          c++;
        }

        if (c > 0) {
          Promise.allSettled(toRemove).then(
            console.log(`Удалено ${c} макетов`)
          );
        } else console.log('Макетов не было');
      }
    });
  } catch (e) {
    console.log(e);
  }
}

module.exports = clean;
