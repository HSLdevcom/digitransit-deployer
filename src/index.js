const kubernetes = require('./kubernetes')
// const rp = require('request-promise')
const debug = require('debug')('digitransit-deployer')
const imageDeployer = require('./image-deployer')
const depDeploymentRestarter = require('./dep-deployment-restarter')
const cronDeploymentRestarter = require('./cron-deployment-restarter')
// const queueChecker = require('./queue-checker')
// const nodeChecker = require('./node-checker')

const CHECK_INTERVAL = (process.env.CHECK_INTERVAL_MINUTES || 5) * 60 * 1000
// const QUEUE_CHECK_INTERVAL = (process.env.QUEUE_CHECK_INTERVAL_MINUTES || 30) * 60 * 1000
// const NODE_CHECK_INTERVAL = (process.env.NODE_CHECK_INTERVAL_MINUTES || 5) * 60 * 1000

const actions = [imageDeployer, depDeploymentRestarter, cronDeploymentRestarter]

const logError = (name, e) => {
  debug('%s: Error occurred %s', name, e)
}

const checkDeployments = () => {
  debug('Retrieving deployment configuration from kubernetes')

  const context = {
    kubernetes: require('./kubernetes'),
    dockerRepo: require('./dockerRepo')
  }

  kubernetes.getDeployments().then(deployments => {
    actions.forEach(
      (action) => {
        try {
          action.command(deployments, context)
        } catch (e) {
          logError(action.name, e)
        }
      })
  })
    .catch((err) => debug("Couldn't get deployments: " + err))
}

// TODO maybe implement this for kubernetes
// const checkQueue = () => {
//   debug('Retrieving service queue from marathon')

//   marathon.getQueue().then(deployments => {
//     try {
//       queueChecker.command(deployments.queue)
//     } catch (e) {
//       debug('Checking deployments failed: ' + e)
//     }
//   })
//     .catch((err) => debug("Couldn't get queue: " + err))
// }

// TODO maybe implement this for kubernetes
// const checkNodes = () => {
//   debug('Retrieving nodes from dc/os')

//   rp('http://leader.mesos:1050/system/health/v1/nodes')
//     .then(res => {
//       const data = JSON.parse(res)
//       if ('nodes' in data && data.nodes) {
//         nodeChecker.command(data.nodes)
//       }
//     })
// }

checkDeployments()
// checkQueue()
// checkNodes()
setInterval(checkDeployments, CHECK_INTERVAL)
// setInterval(checkQueue, QUEUE_CHECK_INTERVAL)
// setInterval(checkNodes, NODE_CHECK_INTERVAL)
