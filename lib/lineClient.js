const { Client } = require('@line/bot-sdk');

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

let client;
function getLineClient() {
  if (!client) {
    client = new Client(config);
  }
  return client;
}

module.exports = { getLineClient, lineConfig: config };
