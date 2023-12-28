const preset = require('./preset');
const axios = require('axios');
const settings = preset();

const token = settings.kupikod_token;
const baseUrl = 'https://steam.kupikod.com/api/v3';

async function checkUsername(login) {
  try {
    const response = await axios.post(
      `${baseUrl}/partner-exists`,
      {
        login
      },
      {
        headers: {
          token
        }
      }
    );

    const { data, status } = response;
    if (status !== 200) {
      throw new Error('Kupikod fetch failed');
    }

    return data.exists ? 'exists' : 'not found';
  } catch (error) {
    console.log(error);
    return 'failed';
  }
}

async function refillSteamViaAPI(login, value, id) {
  try {
    const response = await axios.post(
      `${baseUrl}/partner-order`,
      {
        login,
        value,
        id,
        currency: 'rub'
      },
      {
        headers: {
          token
        }
      }
    );

    const { status, data } = response;
    console.log(status, data);

    if (status === 200) {
      return data.id;
    } else {
      return false;
    }
  } catch (error) {
    console.log(error);
    return null;
  }
}

async function checkOrder(id) {
  try {
    const response = await axios.get(`${baseUrl}/partner-order/${id}`, {
      headers: {
        token
      }
    });

    if (response.status !== 200) {
      throw new Error('Failed response');
    }

    const { data } = response;
    return data.state;
  } catch (error) {
    return error.request.data?.state;
  }
}

module.exports = {
  checkUsername,
  refillSteamViaAPI,
  checkOrder
};
