const debug = require('debug')('digitransit-image-deployer');
const graph = require('./graph.js');

const logError=(e) => {
  debug("Error occurred %s", JSON.stringify(e));
};

const COOL_OFF_PERIOD = 60*60*1000; //1 hour

/*
 * Automatically deploys new container versions for services that are tagged with udate=auto and have forcepullimage configured as true
 */
module.exports = {
  name:'image-deployer',
  command:(services, context) => {
    let serviceGraph = graph.build(services);

    const NOW = new Date().getTime();

    services.filter((service) => service.labels['update'] === 'auto' && service.container.docker.forcePullImage === true)
    .forEach(service => {
      context.dockerRepo.getManifest(service.container.docker.image).then(response => {
        const repoHash = response.res.headers['docker-content-digest'].split(':')[1];
        const serviceHash = service.labels.imageHash;
        const serviceDate = Date.parse(service.version);

        if(repoHash !== serviceHash) {
          if(NOW > serviceDate + COOL_OFF_PERIOD) {
            if(graph.isSubGraphStable(serviceGraph, service.id)) {
              debug("restarting service %s", service.id);
              context.marathon.updateImageHash(service.id, repoHash).then((r) => debug("restart called: %s", JSON.stringify(r)));
            } else {
              debug("delaying restart for %s (subgraph not stable)", service.id);
            }
          } else {
            debug("delaying restart for %s (cool off period)", service.id);
          }
        } else {
          debug("no need to update %s", service.id);
        }
      }).catch(logError);
    });
  }
};
