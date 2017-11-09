const marathon = require('./marathon');
const git = require('simple-git/promise');
const fs = require('fs');
const debug = require('debug')('digitransit-deployer');
const imageDeployer = require('./image-deployer');
const depServiceRestarter = require('./dep-service-restarter');
const cronServiceRestarter = require('./cron-service-restarter');
const configurationChecker = require('./configuration-checker');
const queueChecker = require('./queue-checker');

const CHECK_INTERVAL = (process.env.CHECK_INTERVAL_MINUTES||5)*60*1000;
const QUEUE_CHECK_INTERVAL = (process.env.QUEUE_CHECK_INTERVAL_MINUTES||30)*60*1000;
const CONF_CHECK_INTERVAL = (process.env.CONFIGURATION_CHECK_INTERVAL_MINUTES||12*60)*60*1000;

const actions = [imageDeployer, depServiceRestarter, cronServiceRestarter];

const remoteRepository = 'https://github.com/HSLdevcom/digitransit-mesos-deploy.git';
const repository = 'digitransit-mesos-deploy';

const logError=(name, e) => {
  debug("%s: Error occurred %s", name, e);
};

const checkServices = () => {
  debug("Retrieving service configuration from marathon");

  const context = {
    marathon: require('./marathon'),
    dockerRepo: require('./dockerRepo')
  };

  marathon.getServices().then(services => {
    actions.forEach(
      (action) => {
        try{
          action.command(services.apps, context);
        } catch(e) {

          logError(action.name,e);
        }
      });
  })
  .catch((err) => debug("Couldn't get services: " + err));  
};

const checkQueue = () => {
  debug("Retrieving service queue from marathon");

  marathon.getQueue().then(deployments => {
    try{
      queueChecker.command(deployments.queue);
    } catch(e) {

      debug("Checking deployments failed: " + e);
    }
  })
  .catch((err) => debug("Couldn't get queue: " + err));  
};

const checkConfiguration = () => {
  if (!fs.existsSync(repository)) {
    git().silent(true)
      .clone(remoteRepository)
      .then(() => fs.writeFile(repository + "/vault_password", process.env.SECRET, function(err) {
        if(err) {
          throw err;
        }
      }))
      .then(() => marathon.getServices())
      .then(services => {
        try{
          configurationChecker.command(services.apps);
        } catch(e) {

          debug("Checking configuration failed: " + e);
        }
      })
      .catch((err) => debug("Error occurred " + err));
  } else {
    git('./' + repository).silent(true)
      .pull()
      .then(() => marathon.getServices())
      .then(services => {
        try{
          configurationChecker.command(services.apps);
        } catch(e) {

          debug("Checking configuration failed!");
        }
      })
      .catch((err) => debug("Error occurred " + err));
  }
};

checkServices();
checkQueue();
checkConfiguration();
setInterval(checkServices, CHECK_INTERVAL);
setInterval(checkQueue, QUEUE_CHECK_INTERVAL);
setInterval(checkConfiguration, CONF_CHECK_INTERVAL);
