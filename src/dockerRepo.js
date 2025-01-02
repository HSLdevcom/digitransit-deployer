const loginRequest = `{
  "username": "${process.env.DOCKER_USER}",
  "password": "${process.env.DOCKER_AUTH}"
}`

export default {
  getImageDate: function (repoAndRef) {
    const [image, tag] = repoAndRef.split(':')
    const [namespace, repository] = image.split('/')
    const url = `https://hub.docker.com/v2/namespaces/${namespace}/repositories/${repository}/tags/${tag || 'latest'}`
    const tokenUrl = 'https://hub.docker.com/v2/users/login/'

    return fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: loginRequest
    }).then(res => {
      if (res.ok) {
        return res.json()
      } else {
        console.log('failed to get access token from docker hub')
      }
    }).then(body => {
      const token = body?.token
      return fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `JWT ${token}`
        }
      })
    }).then(res => {
      if (res.ok) {
        return res.json()
      } else {
        console.log(`failed to fetch data for ${repoAndRef} from docker hub`)
      }
    }).then(data => {
      return data && Date.parse(data.last_updated)
    }).catch(err => {
      console.log(err)
    })
  }
}
