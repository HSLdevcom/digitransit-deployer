const debug = require('debug')('configuration-checker.js')
const { postSlackMessage } = require('./util')
const { exec } = require('child-process-promise')
const jsonReader = require('jsonfile').readFileSync
const fs = require('fs')
const isEqual = require('lodash.isequal')
const includes = require('lodash.includes')
const transform = require('lodash.transform')
const isObject = require('lodash.isobject')

const environment = process.env.ENVIRONMENT_TYPE
const fileRoot = 'digitransit-mesos-deploy/digitransit-azure-deploy/files'

const removeFields = ['tasks', 'lastTaskFailure', 'versionInfo', 'version', 'deployments',
  'uris', 'fetch', 'executor', 'tasksStaged', 'tasksRunning', 'tasksHealthy', 'tasksUnhealthy',
  'ipAddress', 'residency', 'secrets', 'requirePorts', 'user', 'args', 'storeUrls']

const excludedServices = ['/marathon-slack', '/msoms']

/*
 * Checks if services that exist in the enviroment also have configurations stored in a repository,
 * checks if services configured in files exist in the environment, and if the configurations
 * match between the repository and the enviroment. If they are not in synch, message will be
 * sent to Slack webhook.
 */
const importConfs = () => {
  const serviceFileConfs = {}
  fs.readdirSync(fileRoot)
    .filter(name =>
      name.endsWith('-' + environment.toLowerCase() + '.json')
    ).forEach(fName => {
      try {
        const data = jsonReader(fileRoot + '/' + fName)
        serviceFileConfs[data['id']] = data
      } catch (err) {
        debug('Error occurred ' + err)
      }
    })
  return serviceFileConfs
}

const difference = (object, base) => {
  return transform(object, (result, value, key) => {
    if (!isEqual(value, base[key])) {
      result[key] = isObject(value) && isObject(base[key]) ? difference(value, base[key]) : value
    }
  })
}

module.exports = {
  name: 'configuration-checker',
  command: (services) => {
    exec("rm -r reports || true; mkdir reports; cd digitransit-mesos-deploy && ansible-playbook digitransit-manage-containers.yml --tags decrypt --extra-vars 'environment_type=" + environment + "' -i hosts")
      .then(() => {
        const fileConfs = importConfs()
        services.forEach(service => {
          if (!includes(excludedServices, service.id)) {
            if (fileConfs.hasOwnProperty(service.id)) {
              removeFields.forEach(field => {
                delete service[field]
              })
              if (!isEqual(service, fileConfs[service.id])) {
                postSlackMessage(service.id + ': configuration mismatch.')
                const data = {
                  new_and_added: difference(service, fileConfs[service.id]),
                  old_and_removed: difference(fileConfs[service.id], service)
                }
                const json = JSON.stringify(data)
                fs.writeFile('reports/' + service.id + '.json', json, 'utf8', (err) => {
                  if (err) {
                    debug('Writing json file failed: ' + err)
                  }
                })
              }
            } else {
              postSlackMessage(service.id + ': configuration missing from config files.')
              const json = JSON.stringify(service)
              fs.writeFile('reports/' + service.id + '.json', json, 'utf8', (err) => {
                if (err) {
                  debug('Writing json file failed: ' + err)
                }
              })
            }
          }
        })
        const serviceIDs = []
        services.forEach(service => { serviceIDs.push(service.id) })
        for (var key in fileConfs) {
          if (!includes(serviceIDs, key)) {
            postSlackMessage(key + ': service is not deployed yet.')
          }
        }
      })
      // Using git checkout to undo changes (files will be changed back to encrypted state)
      .then(() => exec('cd digitransit-mesos-deploy && git checkout .'))
      .catch((err) => debug('Error occurred ' + err))
  }
}
