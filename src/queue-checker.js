const debug = require('debug')('queue-checker.js');
const {postSlackMessage} = require('./util');

const COOL_OFF_PERIOD = 45*60*1000; //45 minutes

module.exports = {
  name:'queue-checker',
  command: (deployments) => {
    const NOW = new Date().getTime();

    deployments.forEach(deployment => {
      const serviceDate = Date.parse(deployment.app.version);
      if ((NOW > serviceDate + COOL_OFF_PERIOD) && deployment.delay.overdue) {
        postSlackMessage(deployment.app.id + ": deployment stuck on waiting state.");
      }
    })
  }
}
