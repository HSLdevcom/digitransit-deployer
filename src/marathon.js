const marathonClient = require('marathon-node-library')(process.env.MARATHON_URL||'http://127.0.0.1:8080/service/marathon/');

const getServices =() =>
  marathonClient.apps.getList();

const restartService =(id) =>
  marathonClient.apps.restart(id);

/**
 * Updates services mesos config with a label that has the image id for current deployment
 * this label is then used to check if repository image for that tag has been changed.
 */
const updateImageHash = (id, hash) => {
  var p1 = new Promise(
    function(resolve) {
      marathonClient.apps.getById(id).then(body => {
        const app = body.app;
        app.labels.imageHash = hash;

    //remove unused data
        const removeFields=['tasks','lastTaskFailure','versionInfo','version','deployments',
          'uris','fetch','executor','tasksStaged','tasksRunning','tasksHealthy','tasksRunning',
          'tasksUnhealthy','ipAddress','residency','secrets','requirePorts','user','args',
          'storeUrls','constraints'];

        removeFields.forEach(field => delete app[field]);

        resolve(marathonClient.apps.updateById(id, app));
      });
    });
  return p1;
};

module.exports = {
  getServices,
  restartService,
  updateImageHash
};
