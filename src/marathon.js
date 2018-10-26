const opts = {}
const marathonClient = require('marathon-node')(process.env.MARATHON_URL || 'http://127.0.0.1:8080/service/marathon/', opts)

const getServices = () =>
  marathonClient.apps.getList()

const getQueue = () =>
  marathonClient.queue.get()

const restartService = (id) =>
  marathonClient.apps.restart(id, false)

module.exports = {
  getServices,
  getQueue,
  restartService
}
