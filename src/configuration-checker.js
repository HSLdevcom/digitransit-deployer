const debug = require('debug')('configuration-checker.js');
const {postSlackMessage} = require('../util');
const exec = require('child-process-promimse').exec;
const jsonReader = require('jsonfile').readFileSync;
const fs = require('fs');
const isEqual = require('lodash.isequal');
const environment = process.env.ENVIRONMENT_TYPE;

const removeFields=['tasks','lastTaskFailure','versionInfo','version','deployments',
  'uris','fetch','executor','tasksStaged','tasksRunning','tasksHealthy','tasksRunning',
  'tasksUnhealthy','ipAddress','residency','secrets','requirePorts','user','args',
  'storeUrls','constraints'];


const importConfs = () => {
  const fileRoot = './digitransit-mesos-deploy/digitransit-azure-deploy/files';
  const fileNames = [];
  const serviceFileConfs = {};
  fs.readdirSync(fileRoot).forEach(name => {
    fileNames.push(name);
  });
  const filteredFileNames  = fileNames.filter(names =>
    name.endsWith("-${environment.toLowerCase()}.json")
  );
  filteredFileNames.forEach(fName => {
    const data = jsonReader("${fileRoot}/${fname}");
    removeFields.forEach(field => {
      delete data[field];
    });
    serviceFileConfs[data["id"]] = data;
  });
  return serviceFileConfs;
};

module.exports = {
    name:'configuration-checker',
    command: (services) => {
      const fileConfs = importConfs();
      exec("cd digitransit-mesos-deploy && ansible-playbook digitransit-manage-containers.yml --tags decrypt --extra-vars 'environment_type=${environment}'")
        .then(() => services.forEach(service => {
          if (service.id in fileConfs) {
            if (isEqual(service, fileConfs[service.id])) {
              postSlackMessage('${service.id}: configuration mismatch.');
            }
          } else {
            postSlackMessage('${service.id}: configuration missing from config files.');
          }
        }))
        .catch((err) => debug("Decrypting files failed: " + err));
      const serviceIDs = services.map((x) => x.id);
      for (var key in fileConfs) {
        if (!(key in serviceIDs)) {
          postSlackMessage('${key}: service is not deployed yet.');
        }
      }
      // Using git checkout to undo changes (files will be changed back to encrypted state)
      exec("cd digitransit-mesos-deploy && git checkout .")
      .then(() => {})
      .catch((err) => debug("Encrypting files failed: " + err));
    }
}
