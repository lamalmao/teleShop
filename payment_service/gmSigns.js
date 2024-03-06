const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const querystring = require('querystring');

const publicCert = fs.readFileSync(path.resolve('gm.crt')).toString();

const generateString = obj => {
  let s = '';
  Object.keys(obj)
    .sort()
    .forEach(key => {
      const value = obj[key];
      if (Array.isArray(value)) {
        s = s.concat(key, ':', generateArrayString(value), ';');
      } else if (typeof value === 'object') {
        s = s.concat(key, ':', generateString(value), ';');
      } else {
        s = s.concat(key, ':', value.toString(), ';');
      }
    });

  return s;
};

const generateArrayString = arr => {
  let s = '';
  arr.forEach(
    (value, index) =>
      (s += `${index}:${
        Array.isArray(value)
          ? generateArrayString(value)
          : typeof value === 'object'
            ? generateString(value)
            : value.toString()
      };`)
  );

  return s;
};

const hmacSign = (data, key) => {
  const signString = generateString(data);
  return crypto.createHmac('sha256', key).update(signString).digest('hex');
};

const checkRSASign = (data, signature) => {
  return crypto
    .createVerify('RSA-SHA256')
    .update(generateString(data), 'utf8')
    .verify(publicCert, signature, 'base64');
};

const testObj = {
  project: '1',
  project_invoice: '1541586969',
  user: '1',
  amount: '100',
  terminal_allow_methods: ['wmz'],
  terminal_disable_methods: ['bitcoin', 'card']
};

const getGmExchangeRate = async () => {
  const params = {
    project: global.gmId,
    from: 'RUB',
    to: 'USD',
    rand: crypto.randomBytes(16).toString('hex')
  };

  const sign = hmacSign(params, global.gmToken);
  params.signature = sign;

  const body = querystring.stringify(params);
  const response = await axios.post(
    'https://paygate.gamemoney.com/exchange/rate',
    body,
    {
      headers: {
        Accept: 'application/json'
      }
    }
  );

  return response.data.buy;
};

module.exports = {
  hmacSign,
  checkRSASign,
  getGmExchangeRate
};
