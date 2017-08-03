const drc = require('docker-registry-client');
const rp = require('request-promise');

module.exports = {
  getImageDate:(repoAndRef) => {
    let rar = drc.parseRepoAndRef(repoAndRef);
    let url = `https://hub.docker.com/v2/repositories/${rar.remoteName}/tags/${rar.tag}`;
    return rp(url).then(res => {
      const data = JSON.parse(res);
      return Date.parse(data.last_updated);
    });
  }
};
