const crypto = require('crypto');

const getSign = (token, body) => {
  let params = '';

  Object.keys(body)
    .sort()
    .forEach(key => {
      if (key === 'sign') {
        return;
      }

      const value = body[key];
      if (typeof value === 'object') {
        return;
      }

      params = params.concat(`${key}:${value};`);
    });

  const sign = crypto.createHmac('sha1', token).update(params).digest('hex');
  return sign;
};

module.exports = {
  getSign
};
