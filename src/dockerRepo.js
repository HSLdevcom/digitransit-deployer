const debug = require('debug')('digitransit-deployer-repo')
const axios = require('axios')

module.exports = {
  getImageDate: (repoAndRef) => {
    const [ repository, tag ] = repoAndRef.split(':')
    const url = `https://hub.docker.com/v2/repositories/${repository}/tags/${tag || 'latest'}`
    return axios.get(url).then(res => {
      if (res.status === 200) {
        return Date.parse(res.data.last_updated)
      } else {
        debug(`failed to fetch data for ${repoAndRef} from docker hub`)
      }
    })
  }
}
