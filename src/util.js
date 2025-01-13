import axios from 'axios'

const MONITORING_CHANNEL_ID = process.env.MONITORING_SLACK_CHANNEL_ID
const MONITORING_USERNAME = `Configuration checker ${process.env.ENVIRONMENT_TYPE}`

const ALERT_CHANNEL_ID = process.env.ALERT_SLACK_CHANNEL_ID
const ALERT_USERNAME = `Image freshness monitor ${process.env.ENVIRONMENT_TYPE}`

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
  postSlackMessage(text, MONITORING_USERNAME, MONITORING_CHANNEL_ID)
}

export function postAlertSlackMessage (text) {
  postSlackMessage(text, ALERT_USERNAME, ALERT_CHANNEL_ID)
}
