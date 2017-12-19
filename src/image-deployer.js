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
        context.dockerRepo.getImageDate(service.container.docker.image).then(repoImageDate => {
          const serviceDate = Date.parse(service.version);
          if(repoImageDate > serviceDate) {
            if(NOW > serviceDate + COOL_OFF_PERIOD) {
              if(graph.isSubGraphStable(serviceGraph, service.id)) {
                debug("Restarting service %s", service.id);
                context.marathon.restartService(service.id).then((r) => debug("Restart called: %s", JSON.stringify(r)));
              } else {
                debug("Delaying restart for %s (subgraph not stable)", service.id);
              }
            } else {
              debug("Delaying restart for %s (cool off period)", service.id);
            }
          } else {
            debug("No need to update %s", service.id);
          }
        }).catch(logError);
      });
  }
};
