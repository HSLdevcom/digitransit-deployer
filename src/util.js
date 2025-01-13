import axios from 'axios'

const MONITORING_CHANNEL = process.env.MONITORING_SLACK_CHANNEL
const MONITORING_USERNAME = 'Configuration checker'

const ALERT_CHANNEL = process.env.ALERT_SLACK_CHANNEL
const ALERT_USERNAME = 'Image freshness monitor'

const headers = {
  Authorization: `Bearer ${process.env.SLACK_ACCESS_TOKEN}`,
  'Content-Type': 'application/json',
  Accept: '*/*'
}

function postSlackMessage (text, username, channel) {
  if (!process.env.SLACK_ACCESS_TOKEN) {
    console.log('Not sending to slack: ' + text)
  }

  axios.post('https://slack.com/api/chat.postMessage', {
    channel,
    text,
    username
  }, { headers })
    .then(response => {
      if (response.status !== 200) {
        console.log(`Slack message was not sent successfully. Response: ${response}`)
      } else {
        console.log(`Sent to slack: ${text}`)
      }
    })
    .catch(error => {
      console.log(`Something went wrong when trying to send message to Slack:\n${error}`)
    })
}

export function postMonitoringSlackMessage (text) {
  postSlackMessage(text, MONITORING_USERNAME, MONITORING_CHANNEL)
}

export function postAlertSlackMessage (text) {
  postSlackMessage(text, ALERT_USERNAME, ALERT_CHANNEL)
}
