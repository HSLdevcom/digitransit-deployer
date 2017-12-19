const drc = require('docker-registry-client');
const debug = require('debug')('digitransit-deployer-repo');
const rp = require('request-promise');

module.exports = {
  getImageDate:(repoAndRef) => {
    let rar = drc.parseRepoAndRef(repoAndRef);
    let url = `https://hub.docker.com/v2/repositories/${rar.remoteName}/tags/${rar.tag}`;
    return rp(url).then(res => {
      const data = JSON.parse(res);
      return Date.parse(data.last_updated);
    });
  },
  getManifest:(repoAndRef) => {
    var rar = drc.parseRepoAndRef(repoAndRef);
    var client = drc.createClientV2({
      repo: rar,
      maxSchemaVersion: (1)
    });
    var tagOrDigest = rar.tag || rar.digest;

    var p1 = new Promise(
      function(resolve, reject) {

        client.getManifest({ref: tagOrDigest}, function (err, manifest, res) {
          client.close();
          if (err) {
            debug(err);
            reject(err);
          }
          resolve({res:res,manifest:manifest});
        });
      }
    );
    return p1;
  }
};
