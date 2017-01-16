const dockerRepo = require('./dockerRepo');
const marathon = require('./marathon');
const debug = require('debug')('digitransit-deployer');

const CHECK_INTERVAL = (process.env.CHECK_INTERVAL_MINUTES||5)*60*1000;

const logError=(e) => {
  debug("Error occurred %s", JSON.stringify(e));
};

const checkServices = () => {
  marathon.getServices().then(services => {
    debug("Retrieving service configuration from marathon");
    services.apps
      .filter((service) => service.labels['update'] === 'auto' && service.container.docker.forcePullImage === true)
      .forEach(service => {
        dockerRepo.getManifest(service.container.docker.image).then(response => {
          const imageDate = Date.parse(JSON.parse(response.manifest.history[0].v1Compatibility).created);
          const serviceDate = Date.parse(service.version);
          const needsUpdate = imageDate > serviceDate;
          debug("%s needs update: %s", service.id, needsUpdate);
          if(needsUpdate) {
            debug("restarting service %s", service.id);
            marathon.restartService(service.id).then((e) => debug("restart called %s", e));
          }
        }).catch(logError);
      });
  }).catch(logError);
};

checkServices();
setInterval(checkServices, CHECK_INTERVAL);
