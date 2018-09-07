const debug = require('debug')('digitransit-image-deployer');
const graph = require('./graph.js');

const logError=(e) => {
  debug("Error occurred %s", JSON.stringify(e));
};

const COOL_OFF_PERIOD = 60*60*1000; //1 hour

/*
 * Automatically deploys new container versions for services that are tagged with update=auto and have forcepullimage configured as true.
 * Also restarts service if one of the dependency images/tags defined in label restart-after-image-updates are updated.
 */
module.exports = {
  name:'image-deployer',
  command: function(services, context) {
    let serviceGraph = graph.build(services);

    const NOW = new Date().getTime();

    services.filter((service) => service.labels.hasOwnProperty('restart-after-image-updates') ||
      (service.labels['update'] === 'auto' && service.container.docker.forcePullImage === true))
      .forEach(service => {
        let dependencies = [];
        if (service.labels.hasOwnProperty('restart-after-image-updates')) {
          dependencies = dependencies.concat(service.labels['restart-after-image-updates'].replace(/\s/g,'').split(','));
        }
        if (service.labels['update'] === 'auto' && service.container.docker.forcePullImage === true) {
          dependencies.push(service.container.docker.image);
        }
        const promises = [];
        for (let i = 0; i < dependencies.length; i++) {
          const dependency = dependencies[i];
          promises.push(new Promise((resolve) => {
            context.dockerRepo.getImageDate(dependency).then(repoImageDate => {
              const serviceDate = Date.parse(service.version);
              if(repoImageDate > serviceDate) {
                if(NOW > serviceDate + COOL_OFF_PERIOD) {
                  if(graph.isSubGraphStable(serviceGraph, service.id)) {
                    resolve('restart');
                  } else {
                    debug("Delaying restart for %s (subgraph not stable)", service.id);
                    resolve(null);
                  }
                } else {
                  debug("Delaying restart for %s (cool off period)", service.id);
                  resolve(null);
                }
              } else {
                debug("No need to update %s", service.id);
                resolve(null);
              }
            }).catch((err) => {
              logError(err);
              resolve(null);
            });
          }));
        }
        Promise.all(promises).then((values) => {
          if (values.indexOf('restart') >= 0) {
            debug("Restarting service %s", service.id);
            context.marathon.restartService(service.id)
              .then((r) => debug("Restart called: %s", JSON.stringify(r)))
              .catch((err) => debug(err));
          }
        });
      });
  }
};
