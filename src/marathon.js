const marathonClient = require('marathon-node-library')(process.env.MARATHON_URL||'http://127.0.0.1:8080/service/marathon/');

const getServices =() =>
  marathonClient.apps.getList();

const restartService =(id) =>
  marathonClient.apps.restart(id);

module.exports = {
  getServices,
  restartService,
};
