const debug = require('debug')('cron-deployment-restarter.js')
const graph = require('./graph.js')

/*
 * Automatically restarts deployments if they have a restartAt label defined.
 * Restart time is defined in the restartAt label with "hh.mm" format.
 * It is possible to define multiple restart points by separating them with commas,
 * for example "13.00, 18.50".
 * Deployment will not be restarted if it has not been at least 18 hours (by default)
 * since the last restart of the deployment. Alternatively, you can define in
 * restartLimitInterval label how many minutes should be passed since the last restart before
 * another restart can occur.
 * The last chance for the restart to occur is 60 minutes past the time defined in restartAt label.
 */

const getDateObject = ([hour, minute]) => {
  const dateObject = new Date()
  dateObject.setHours(parseInt(hour))
  dateObject.setMinutes(parseInt(minute))
  return dateObject
}

module.exports = {
  name: 'cron-deployment-restarter',
  command: (deployments, context) => {
    let deploymentGraph = graph.build(deployments)
    const NOW = new Date().getTime()
    let attemptedRestart = false

    deployments.filter((deployment) => deployment.spec.template.metadata.labels['restartAt'])
      .forEach(deployment => {
        const deploymentDate = Date.parse(deployment.version)
        const deploymentId = deployment.metadata.labels.app
        const deploymentLabels = deployment.spec.template.metadata.labels
        const restartIntervalMins =
          parseInt(deploymentLabels['restartLimitInterval']) || 60 * 18

        deploymentLabels['restartAt']
          .split(' ')
          .filter((time) => /\S/.test(time)) // remove elements that consists of just whitespace
          .forEach(restartTime => {
            if (!attemptedRestart) {
              const trimmedTime = restartTime.replace(/\s/g, '')
              const timeArray = trimmedTime.split('.')
              const nextHour = parseInt(timeArray[0]) + 1

              const cronDate = getDateObject(timeArray)
              // One hour later
              const cronDateUpperLimit = getDateObject([nextHour, timeArray[1]])

              if (NOW - deploymentDate >= restartIntervalMins * 60 * 1000 &&
              NOW >= cronDate.getTime() &&
              NOW <= cronDateUpperLimit.getTime()) {
                if (graph.isSubGraphStable(deploymentGraph, deploymentId)) {
                  debug('Restarting deployment %s', deploymentId)
                  context.kubernetes.restartDeployment(deploymentId)
                    .then((r) => {
                      debug('Restart called: %s', JSON.stringify(r))
                    })
                    .catch((err) => debug(err))
                  attemptedRestart = true
                } else {
                  debug('Delaying restart for %s (subgraph not stable)', deploymentId)
                }
              } else {
                debug('No need to update %s', deploymentId)
              }
            }
          })
      })
  }
}
