const debug = require('debug')('cron-deployment-restarter.js')
const graph = require('./graph.js')

/*
 * Automatically restarts deployments if they have a restartAt label defined.
 * Restart time is defined in the restartAt label with "hh:mm" format.
 * It is possible to define multiple restart points by separating them with commas,
 * for example "13:00, 18:50".
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
    let hasBeenRestarted = false

    deployments.filter((deployment) => deployment.spec.template.metadata.labels['restartAt'])
      .forEach(deployment => {
        const deploymentDate = Date.parse(deployment.version)
        const restartIntervalMins =
          parseInt(deployment.spec.template.metadata.labels['restartLimitInterval']) || 60 * 18

        deployment.spec.template.metadata.labels['restartAt'].split(',').forEach(restartTime => {
          if (!hasBeenRestarted) {
            const trimmedTime = restartTime.replace(/\s/g, '')
            const timeArray = trimmedTime.split(':')
            const nextHour = parseInt(timeArray[0]) + 1

            const cronDate = getDateObject(timeArray)
            // One hour later
            const cronDateUpperLimit = getDateObject([nextHour, timeArray[1]])

            if (NOW - deploymentDate >= restartIntervalMins * 60 * 1000 &&
            NOW >= cronDate.getTime() &&
            NOW <= cronDateUpperLimit.getTime()) {
              if (graph.isSubGraphStable(deploymentGraph, deployment.metadata.labels.app)) {
                debug('Restarting deployment %s', deployment.metadata.labels.app)
                context.kubernetes.restartDeployment(deployment.metadata.labels.app)
                  .then((r) => {
                    debug('Restart called: %s', JSON.stringify(r))
                    hasBeenRestarted = true
                  })
                  .catch((err) => debug(err))
              } else {
                debug('Delaying restart for %s (subgraph not stable)', deployment.metadata.labels.app)
              }
            } else {
              debug('No need to update %s', deployment.metadata.labels.app)
            }
          }
        })
      })
  }
}
