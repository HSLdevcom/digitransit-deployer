const IncomingWebhook = require('@slack/client').IncomingWebhook;
const url = process.env.SLACK_WEBHOOK_URL || null;
const webhook;
if (process.env.ENVIRONMENT_TYPE === "DEV"){
  webhook = url !==null ? new IncomingWebhook(url, {username:'Configuration checker', channel:'dev-monitoring'}):null;
} else {
  webhook = url !==null ? new IncomingWebhook(url, {username:'Configuration checker', channel:'monitoring'}):null;
}

const postSlackMessage = (message) => {
  if(webhook===null) {
    process.stdout.write(`Not sending to slack: ${message}`);
    return;
  }

  process.stdout.write(`Sending to slack: ${message}`);

  webhook.send(message, function(err) {
    if (err) {
      process.stdout.write(`ERROR sending to slack: ${err}`);
    }
  });
};

module.exports= {
  postSlackMessage
}
