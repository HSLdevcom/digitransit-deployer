const kubernetes = require('./kubernetes')
const debug = require('debug')('digitransit-deployer')
const imageDeployer = require('./image-deployer')
const depDeploymentRestarter = require('./dep-deployment-restarter')
const cronDeploymentRestarter = require('./cron-deployment-restarter')

const CHECK_INTERVAL = (process.env.CHECK_INTERVAL_MINUTES || 5) * 60 * 1000

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

checkDeployments()
setInterval(checkDeployments, CHECK_INTERVAL)
