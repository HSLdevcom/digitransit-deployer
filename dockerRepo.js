var drc = require('docker-registry-client');
const debug = require('debug')('digitransit-deployer-repo');

module.exports = {
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
