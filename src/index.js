import kubernetes from './kubernetes.js'
import dockerRepo from './dockerRepo.js'
import imageDeployer from './image-deployer.js'
import depDeploymentRestarter from './dep-deployment-restarter.js'
import cronDeploymentRestarter from './cron-deployment-restarter.js'

const CHECK_INTERVAL = (process.env.CHECK_INTERVAL_MINUTES || 5) * 60 * 1000

const actions = [imageDeployer, depDeploymentRestarter, cronDeploymentRestarter]

const logError = (name, e) => {
  console.log('%s: Error occurred %s', name, e)
}

const checkDeployments = () => {
  console.log('Retrieving deployment configuration from kubernetes')

  const context = {
    kubernetes,
    dockerRepo
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
    .catch((err) => console.log("Couldn't get deployments: " + err))
}

checkDeployments()
setInterval(checkDeployments, CHECK_INTERVAL)
