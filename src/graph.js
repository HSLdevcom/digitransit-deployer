const Graph = require('graph.js/dist/graph.full.js');
const debug = require('debug')('graph');
const {postSlackMessage} = require('./util');

const addDepEdges = (graph, service, services) => {
  let dependencies = service.labels['restart-after-services'].split(',');
  const delay = (service.labels['restart-delay'] || 5) * 60 * 1000;
  dependencies.forEach(dependencyId => {
    if (services.filter(serviceInstance => (serviceInstance.id === dependencyId)).length > 0) {
      graph.addEdge(service.id, dependencyId, {delay});
    } else {
      debug(`${dependencyId} does not exist but is defined as a dependency for service.id`);
      postSlackMessage(`${dependencyId} does not exist but is defined as a dependency for service.id`);
    }
  });
};

const needsRestart = (graph, from, to, edge) => {
  //needs restart if service time is smaller than dependency time + delay
  const serviceTime = Date.parse(graph.vertexValue(from).version);
  const dependencyTime = Date.parse(graph.vertexValue(to).version);
  const needsStart = dependencyTime + edge.delay > serviceTime;
  return needsStart;
};

const hasPendingDependentRestarts =  (graph, serviceName) => {
  // has pending dependent restart if the serviceName or any vertex that service
  // has Path to has pending restarts
  
  for (let [dependency, , edge ] of graph.verticesFrom(serviceName)) {
    debug("next checking dependency %s %s %s", serviceName, dependency, edge);
    if(needsRestart(graph, serviceName, dependency, edge)) {
      return true;
    }

    if(hasPendingDependentRestarts(graph, dependency)) {
      return true;
    }
  }
  return false;
};

const serviceIsStable = (service) =>
  service.instances > 0 && service.tasksHealthy === service.instances && service.tasksUnhealthy === 0 && service.tasksStaged === 0;

module.exports = {
  build: (services) => {
    var graph = new Graph();
    debug("adding vertexes");
    services.forEach(service => {
      graph.addVertex(service.id, service);
    });
    debug("adding edges");
    services.forEach(service => {
      if(service.labels['restart-after-services']) {
        addDepEdges(graph, service, services);
      }
    });
    return graph;
  },
  isSubGraphStable: (graph, vertexId) => {
    //sub graph is stable if the vertex and all vertexes accessible from the
    //vertex and all vertexes that have path to vertex are stable
    let vertex = graph.vertexValue(vertexId);
    if(!serviceIsStable(vertex)) return false;

    for (let [, vertexValue] of graph.verticesWithPathFrom(vertexId)) {
      if(!serviceIsStable(vertexValue)) return false;
    }
    for (let [, vertexValue] of graph.verticesWithPathTo(vertexId)) {
      if(!serviceIsStable(vertexValue)) return false;
    }
    return true;
  },

  hasPendingDependentRestarts,

  servicesNeedingRestart: (graph) => {
    let services = [];
    for (let [from, to, value] of graph.edges()) {
      if(needsRestart(graph, from, to, value)) {
        services.push({from, to, value});
      }
    }
    return services;
  }
};
