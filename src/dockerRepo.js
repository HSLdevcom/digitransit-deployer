const drc = require('docker-registry-client')
const debug = require('debug')('digitransit-deployer-repo')
const axios = require('axios')

module.exports = {
  getImageDate: (repoAndRef) => {
    let rar = drc.parseRepoAndRef(repoAndRef)
    let url = `https://hub.docker.com/v2/repositories/${rar.remoteName}/tags/${rar.tag}`
    return axios.get(url).then(res => {
      if (res.status === 200) {
        return Date.parse(res.data.last_updated)
      } else {
        debug(`failed to fetch data for ${repoAndRef} from docker hub`)
      }
    })
  }
}
