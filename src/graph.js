const Graph = require('graph.js/dist/graph.full.js')
const debug = require('debug')('graph')
const { postSlackMessage } = require('./util')

const addDepEdges = (graph, deployment, deployments) => {
  let dependencies = deployment.spec.template.metadata.labels['restartAfterDeployments'].split(',')
  const delay = (deployment.spec.template.metadata.labels['restartDelay'] || 5) * 60 * 1000
  dependencies.forEach(dependency => {
    const dependencyName = dependency.metadata.labels.app
    if (deployments.filter(deploymentInstance => (deploymentInstance.metadata.labels.app === dependencyName)).length > 0) {
      graph.addEdge(deployment, dependency, { delay })
    } else {
      debug(`${dependencyName} does not exist but is defined as a dependency for a deployment`)
      postSlackMessage(`${dependencyName} does not exist but is defined as a dependency for a deployment`)
    }
  })
}

const needsRestart = (graph, from, to, edge) => {
  // needs restart if deployment time is smaller than dependency time + delay
  const deploymentTime = Date.parse(graph.vertexValue(from).version)
  const dependencyTime = Date.parse(graph.vertexValue(to).version)
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
  deployment.replicas > 0 && deployment.readyReplicas === deployment.replicas &&
  deployment.updatedReplicas === deployment.replicas && deployment.availableReplicas === deployment.replicas

module.exports = {
  build: (deployments) => {
    var graph = new Graph()
    debug('adding vertexes')
    deployments.forEach(deployment => {
      graph.addVertex(deployment.metadata.labels.app, deployment)
    })
    debug('adding edges')
    deployments.forEach(deployment => {
      if (deployment.spec.template.metadata.labels['restartAfterDeployments']) {
        addDepEdges(graph, deployment, deployments)
      }
    })
    return graph
  },
  isSubGraphStable: (graph, vertexId) => {
    // sub graph is stable if the vertex and all vertexes accessible from the
    // vertex and all vertexes that have path to vertex are stable
    let vertex = graph.vertexValue(vertexId)
    if (!deploymentIsStable(vertex)) return false

    for (let [, vertexValue] of graph.verticesWithPathFrom(vertexId)) {
      if (!deploymentIsStable(vertexValue)) return false
    }
    for (let [, vertexValue] of graph.verticesWithPathTo(vertexId)) {
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
