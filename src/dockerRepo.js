const debug = require('debug')('digitransit-deployer-repo')

module.exports = {
  getImageDate: (repoAndRef) => {
    const [repository, tag] = repoAndRef.split(':')
    const url = `https://hub.docker.com/v2/repositories/${repository}/tags/${tag || 'latest'}`
    return fetch(url).then(res => {
      if (res.ok) {
        return res.json()
      } else {
        debug(`failed to fetch data for ${repoAndRef} from docker hub`)
      }
    })
      .then(data => {
        return Date.parse(data.last_updated)
      })
      .catch(err => {
        debug(err)
      })
  }
}
