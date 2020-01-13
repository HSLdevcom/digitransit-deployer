const Graph = require('graph.js/dist/graph.full.js')
const debug = require('debug')('graph')
const { postSlackMessage } = require('./util')

const addDepEdges = (graph, deployment, deployments) => {
  const deploymentLabels = deployment.metadata.labels
  const dependencies = deploymentLabels['restartAfterDeployments']
    .split('_')
    .filter((unfilteredDeployment) => /\S/.test(unfilteredDeployment)) // remove elements that consists of just whitespace
  const delay = (deploymentLabels['restartDelay'] || 5) * 60 * 1000
  const deploymentName = deploymentLabels.app
  dependencies.forEach(dependency => {
    if (deployments.filter(deploymentInstance => (deploymentInstance.metadata.labels.app === dependency)).length > 0) {
      graph.addEdge(deploymentName, dependency, { delay })
    } else {
      debug(`${dependency} does not exist but is defined as a dependency for a deployment`)
      postSlackMessage(`${dependency} does not exist but is defined as a dependency for a deployment`)
    }
  })
}

const needsRestart = (graph, from, to, edge) => {
  // needs restart if deployment time is smaller than dependency time + delay
  const deploymentTime = graph.vertexValue(from).version
  const dependencyTime = graph.vertexValue(to).version
  const needsStart = dependencyTime + edge.delay > deploymentTime
  return needsStart
}

const hasPendingDependentRestarts = (graph, deploymentId) => {
  // has pending dependent restart if the deploymentId or any vertex that deployment
  // has Path to has pending restarts

  for (let [dependency, , edge] of graph.verticesFrom(deploymentId)) {
    debug('next checking dependency %s %s %s', deploymentId, dependency, edge)
    if (needsRestart(graph, deploymentId, dependency, edge)) {
      return true
    }

    if (hasPendingDependentRestarts(graph, dependency)) {
      return true
    }
  }
  return false
}

const deploymentIsStable = (deployment) =>
  deployment.status.replicas > 0 && deployment.status.readyReplicas === deployment.status.replicas &&
  deployment.status.updatedReplicas === deployment.status.replicas && deployment.status.availableReplicas === deployment.status.replicas

module.exports = {
  build: (deployments) => {
    var graph = new Graph()
    debug('adding vertexes')
    deployments.forEach(deployment => {
      graph.addVertex(deployment.metadata.labels.app, deployment)
    })
    debug('adding edges')
    deployments.forEach(deployment => {
      if (deployment.metadata.labels['restartAfterDeployments']) {
        addDepEdges(graph, deployment, deployments)
      }
    })
    return graph
  },
  isSubGraphStable: (graph, vertexId) => {
    // sub graph is stable if all vertexes accessible from the vertex
    for (let [, vertexValue] of graph.verticesWithPathFrom(vertexId)) {
      if (!deploymentIsStable(vertexValue)) return false
    }
    return true
  },

  hasPendingDependentRestarts,

  deploymentsNeedingRestart: (graph) => {
    let deployments = []
    for (let [from, to, value] of graph.edges()) {
      if (needsRestart(graph, from, to, value)) {
        deployments.push({ from, to, value })
      }
    }
    return deployments
  }
}
