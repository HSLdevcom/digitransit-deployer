import kubernetes from './kubernetes.js';
import dockerRepo from './dockerRepo.js';
import imageDeployer from './image-deployer.js';
import depDeploymentRestarter from './dep-deployment-restarter.js';
import cronDeploymentRestarter from './cron-deployment-restarter.js';
import imageFreshnessMonitor from './image-freshness-monitor.js';

const CHECK_INTERVAL = 5 * 60 * 1000;

const actions = [
  imageDeployer,
  depDeploymentRestarter,
  cronDeploymentRestarter,
  imageFreshnessMonitor,
];

const logError = (name, e) => {
  console.log('%s: Error occurred %s', name, e);
};

const checkDeployments = () => {
  console.log('Retrieving deployment configuration from kubernetes');

  const context = {
    kubernetes,
    dockerRepo,
  };

  kubernetes
    .getDeployments()
    .then(deployments => {
      actions.forEach(action => {
        try {
          action.command(deployments, context);
        } catch (e) {
          logError(action.name, e);
        }
      });
    })
    .catch(err => console.log("Couldn't get deployments: " + err));
};

checkDeployments();
setInterval(checkDeployments, CHECK_INTERVAL);
