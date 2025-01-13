import graphlib from '@dagrejs/graphlib'
import { build, isSubGraphStable, deploymentsNeedingRestart } from './graph.js'
import { postMonitoringSlackMessage } from './util.js'

/*
 * Automatically restarts dependand deployments in controlled manner. This is
 * useful because we have data as container and we want to restart containers
 * that depend on that data.
 * Configured with labels as follows:
 *  restartAfterDeployments: "deployment-name"
 *  restartDelay: "5"
 *
 *  or multiple:
 *  restartAfterDeployments: "deployment-name_another-deployment"
 *  restartDelay: "5"
 *
 * deployment-name is the dependent kubernetes deployment name.
 * restartDelay is in minutes, specifying this to 1 means that restart is not
 * triggered before 1 minutes have elapsed from restarting of the dependent
 * deployment. This also means that if deployment has restarted during delay period
 * it will be restarted after dependency restart time + delay has passed.
 *
 * Additionally the subgraph of dependencies including the deployment at hand must
 * all be in stable condition before restart is attempted.
 *
 * Additionally the dependent kubernetes deployment (or any of it's parents) must not
 * have any pending restarts waiting.
 *
 */
export default {
  command: (deployments, context) => {
    const NOW = new Date().getTime()

    const deploymentGraph = build(deployments)
    if (graphlib.alg.findCycles(deploymentGraph).length > 0) {
      console.log('Bummer! Graph has cycle, %s', deploymentGraph.toJSON())
      postMonitoringSlackMessage('Deployments are configured to restart each other in a cycle.')
    } else {
      deploymentsNeedingRestart(deploymentGraph).filter(({ from, value }) => {
        console.log('deployment %s needs restart', from)
        // check that enough time has passed after all depedency restarts
        for (const deploymentId of deploymentGraph.successors(from)) {
          const deployment = deploymentGraph.node(deploymentId)
          console.log('checking %s %s', NOW, deployment.version)
          if (NOW <= deployment.version + value.delay) {
            return false
          }
        }
        return true
      }).filter(({ from }) => {
        if (!isSubGraphStable(deploymentGraph, from)) {
          console.log('Sub Graph for %s is not stable, delaying restart', from)
          return false
        }
        return true
      }).forEach(({ from }) => {
        console.log('Restarting deployment %s', from)
        context.kubernetes.restartDeployment(from)
          .then((e) => console.log('Restarted: %s', JSON.stringify(e)))
          .catch((err) => console.log(err))
      })
    }
  }
}
