const debug = require('debug')('test');
const dockerRepo =  require('./dockerRepo');

dockerRepo.getImageDate("hsldevcom/opentripplanner:prod").then(response => {
  //debug(response.res);
  debug(response);
});
