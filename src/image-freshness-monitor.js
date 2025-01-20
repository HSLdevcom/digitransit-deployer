import { build, deploymentsNeedingImageFreshnessCheck } from './graph.js'
import { postAlertSlackMessage } from './util.js'

/*
 * Automatically checks that the image + tag combination used by the deployment
 * has been updated within last 24 hours. If not, a message is sent to slack.
 * Configured with labels as follows:
 *  checkImageFreshnessAt: "hh.mm"
 *  imageFreshnessTitle: "Service_X"
 * where checkImageFreshnessAt defines when the check should be done (roughly,
 * might be delayed by 0-5 mins) and imageFreshnessTitle is the deployment's title used in
 * slack messaging.
 */
export default {
  command: (deployments, context) => {
    console.log('Checking for a need to do image freshness checks')
    const deploymentGraph = build(deployments)
    const now = new Date()
    const deploymentsNeedingCheck = deploymentsNeedingImageFreshnessCheck(deploymentGraph, now)
    if (deploymentsNeedingCheck.length === 0) {
      console.log('Found no deployments that need an image freshness check')
      return
    }
    const promises = []
    deploymentsNeedingCheck.forEach(deployment => {
      const deploymentId = deployment.metadata.labels.app
      const deploymentTitle = deployment.metadata.labels.imageFreshnessTitle || deploymentId
      const image = deployment.spec.template.spec.containers[0].image
      console.log(`Deployment ${deploymentId} needs image freshness check`)
      promises.push(new Promise((resolve) => {
        context.dockerRepo.getImageDate(image).then(repoImageDate => {
          // check that image is older than 12 hours old
          if (repoImageDate && repoImageDate < now.getTime() - 12 * 60 * 60 * 1000) {
            console.log('%s image has not been updated within the last 12 hours', deploymentId)
            resolve(deploymentTitle)
          } else {
            console.log('%s image has been updated within the last 12 hours', deploymentId)
            resolve(null)
          }
        }).catch((err) => {
          console.log(err)
          resolve(null)
        })
      }))
    })
    Promise.all(promises).then((values) => {
      const deploymentsWithOldImages = values.filter(value => value != null)
      if (deploymentsWithOldImages.length > 0) {
        postAlertSlackMessage(`:boom: These services have not been updated within the last 12 hours: ${deploymentsWithOldImages.join(', ')} :boom:`)
      }
    })
  }
}
