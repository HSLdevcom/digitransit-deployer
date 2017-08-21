const marathon = require('./marathon');
const debug = require('debug')('digitransit-deployer');
const imageDeployer = require('./image-deployer');
const depServiceRestarter = require('./dep-service-restarter');
const cronServiceRestarter = require('./cron-service-restarter');

const CHECK_INTERVAL = (process.env.CHECK_INTERVAL_MINUTES||5)*60*1000;

const actions = [imageDeployer, depServiceRestarter, cronServiceRestarter];

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
  });
};

checkServices();
setInterval(checkServices, CHECK_INTERVAL);
