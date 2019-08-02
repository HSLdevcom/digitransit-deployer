const kubernetes = require('./kubernetes')
// const git = require('simple-git/promise')
// const fs = require('fs')
// const rp = require('request-promise')
const debug = require('debug')('digitransit-deployer')
const imageDeployer = require('./image-deployer')
const depDeploymentRestarter = require('./dep-deployment-restarter')
const cronDeploymentRestarter = require('./cron-deployment-restarter')
// const configurationChecker = require('./configuration-checker')
// const queueChecker = require('./queue-checker')
// const nodeChecker = require('./node-checker')

const CHECK_INTERVAL = (process.env.CHECK_INTERVAL_MINUTES || 5) * 60 * 1000
// const QUEUE_CHECK_INTERVAL = (process.env.QUEUE_CHECK_INTERVAL_MINUTES || 30) * 60 * 1000
// const CONF_CHECK_INTERVAL = (process.env.CONFIGURATION_CHECK_INTERVAL_MINUTES || 12 * 60) * 60 * 1000
// const NODE_CHECK_INTERVAL = (process.env.NODE_CHECK_INTERVAL_MINUTES || 5) * 60 * 1000

const actions = [imageDeployer, depDeploymentRestarter, cronDeploymentRestarter]

// const remoteRepository = 'https://github.com/HSLdevcom/digitransit-mesos-deploy.git'
// const repository = 'digitransit-mesos-deploy'

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
    .catch((err) => debug("Couldn't get services: " + err))
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

// TODO maybe implement configuration checking in kubernetes
// const checkConfiguration = () => {
//   if (!fs.existsSync(repository)) {
//     git().silent(true)
//       .clone(remoteRepository)
//       .then(() => fs.writeFile(repository + '/vault_password', process.env.SECRET, function (err) {
//         if (err) {
//           throw err
//         }
//       }))
//       .then(() => marathon.getServices())
//       .then(services => {
//         try {
//           configurationChecker.command(services.apps)
//         } catch (e) {
//           debug('Checking configuration failed: ' + e)
//         }
//       })
//       .catch((err) => debug('Error occurred ' + err))
//   } else {
//     git('./' + repository).silent(true)
//       .pull()
//       .then(() => marathon.getServices())
//       .then(services => {
//         try {
//           configurationChecker.command(services.apps)
//         } catch (e) {
//           debug('Checking configuration failed!')
//         }
//       })
//       .catch((err) => debug('Error occurred ' + err))
//   }
// }

checkDeployments()
// checkQueue()
// checkConfiguration()
// checkNodes()
setInterval(checkDeployments, CHECK_INTERVAL)
// setInterval(checkQueue, QUEUE_CHECK_INTERVAL)
// setInterval(checkConfiguration, CONF_CHECK_INTERVAL)
// setInterval(checkNodes, NODE_CHECK_INTERVAL)
