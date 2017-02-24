const debug = require('debug')('digitransit-image-deployer');
const graph = require('./graph.js');

const logError=(e) => {
  debug("Error occurred %s", JSON.stringify(e));
};

/*
 * Automatically deploys new container versions for services that are tagged with udate=auto and have forcepullimage configured as true
 */
module.exports = {
  name:'image-deployer',
  command:(services, context) => {
    let serviceGraph = graph.build(services);

    services.filter((service) => service.labels['update'] === 'auto' && service.container.docker.forcePullImage === true)
    .forEach(service => {
      context.dockerRepo.getManifest(service.container.docker.image).then(response => {
        const imageDate = Date.parse(JSON.parse(response.manifest.history[0].v1Compatibility).created);
        const serviceDate = Date.parse(service.version);
        const needsUpdate = imageDate > serviceDate;
        debug("%s needs update: %s, %s > %s", service.id, needsUpdate, imageDate, serviceDate);
        if(needsUpdate) {
          if(graph.isSubGraphStable(serviceGraph, service.id)) {
            debug("restarting service %s", service.id);
            context. marathon.restartService(service.id).then((e) => debug("restart called: %s", e));
          } else {
            debug("delaying restart for %s (subgraph not stable)", service.id);
          }
        }
      }).catch(logError);
    });
  }
};
