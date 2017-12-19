const debug = require('debug')('configuration-checker.js');
const {postSlackMessage} = require('./util');
const {exec} = require('child-process-promise');
const jsonReader = require('jsonfile').readFileSync;
const fs = require('fs');
const isEqual = require('lodash.isequal');
const includes = require('lodash.includes');

const environment = process.env.ENVIRONMENT_TYPE;
const fileRoot = 'digitransit-mesos-deploy/digitransit-azure-deploy/files';

const removeFields = ['tasks','lastTaskFailure','versionInfo','version','deployments',
  'uris','fetch','executor','tasksStaged','tasksRunning','tasksHealthy','tasksUnhealthy',
  'ipAddress','residency','secrets','requirePorts','user','args','storeUrls','constraints'];

const excludedServices = ['/marathon-slack', '/msoms'];

/*
 * Checks if services that exist in the enviroment also have configurations stored in a repository,
 * checks if services configured in files exist in the environment, and if the configurations
 * match between the repository and the enviroment. If they are not in synch, message will be
 * sent to Slack webhook.
 */
const importConfs = () => {
  const serviceFileConfs = {};
  fs.readdirSync(fileRoot)
    .filter(name =>
      name.endsWith("-" + environment.toLowerCase() +".json")
    ).forEach(fName => {
      try {
        const data = jsonReader(fileRoot + "/" + fName);
        serviceFileConfs[data["id"]] = data;
      } catch (err) {
        debug("Error occurred " + err);
      }
    });
  return serviceFileConfs;
};

module.exports = {
  name:'configuration-checker',
  command: (services) => {
    exec("cd digitransit-mesos-deploy && ansible-playbook digitransit-manage-containers.yml --tags decrypt --extra-vars 'environment_type="+ environment +"' -i hosts")
      .then(() => {
        const fileConfs = importConfs();
        services.forEach(service => {
          if (!includes(excludedServices, service.id)) {
            if (fileConfs.hasOwnProperty(service.id)) {
              removeFields.forEach(field => {
                delete service[field];
              });
              if (!isEqual(service, fileConfs[service.id])) {
                postSlackMessage(service.id + ": configuration mismatch.");
              }
            } else {
              postSlackMessage(service.id + ": configuration missing from config files.");
            }
          }
        });
        const serviceIDs = [];
        services.forEach(service => {serviceIDs.push(service.id);});
        for (var key in fileConfs) {
          if (!includes(serviceIDs,key)) {
            postSlackMessage(key + ": service is not deployed yet.");
          }
        }
      })
      // Using git checkout to undo changes (files will be changed back to encrypted state)
      .then(() => exec("cd digitransit-mesos-deploy && git checkout ."))
      .catch((err) => debug("Error occurred " + err));
  }
};
