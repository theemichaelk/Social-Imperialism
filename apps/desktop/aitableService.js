const axios = require('axios');
require('dotenv').config();

const AITABLE_TOKEN = process.env.AITABLE_TOKEN;
const SPACE_ID = process.env.AITABLE_SPACE_ID;

const DATASHEETS = {
  USERS: process.env.AITABLE_USERS_DS,
  SUBSCRIPTIONS: process.env.AITABLE_SUBSCRIPTIONS_DS,
  PAYMENTS: process.env.AITABLE_PAYMENTS_DS,
  COUPONS: process.env.AITABLE_COUPONS_DS,
  ERRORS: process.env.AITABLE_ERRORS_DS,
  SYSTEM_LOGS: process.env.AITABLE_SYSTEM_LOGS_DS,
  AI_USAGE: process.env.AITABLE_AI_USAGE_DS
};

// Base utility function to read records
async function getRecords(datasheetId) {
  try {
    const response = await axios.get(https://aitable.ai/fusion/v1/datasheets/ + datasheetId + /records, {
      headers: {
        'Authorization': Bearer  + AITABLE_TOKEN
      }
    });
    return response.data.data.records;
  } catch (error) {
    console.error(Error fetching records for datasheet  + datasheetId + :, error.message);
    throw error;
  }
}

// Base utility function to add records
async function addRecords(datasheetId, fieldsArray) {
  try {
    const recordsPayload = fieldsArray.map(fields => ({ fields }));
    
    const response = await axios.post(https://aitable.ai/fusion/v1/datasheets/ + datasheetId + /records, {
      records: recordsPayload
    }, {
      headers: {
        'Authorization': Bearer  + AITABLE_TOKEN,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error(Error adding records to datasheet  + datasheetId + :, error.response ? error.response.data : error.message);
    throw error;
  }
}

// Specialized wrapper for User creation
async function createUser(userObj) {
    // Expected fields: firstName, lastName, email, password, company, marketingConsent, credits, stripeCustomerId, etc
    return addRecords(DATASHEETS.USERS, [userObj]);
}

// Specialized wrapper for getting users
async function getUsers() {
    return getRecords(DATASHEETS.USERS);
}

module.exports = {
  getRecords,
  addRecords,
  createUser,
  getUsers,
  DATASHEETS
};
