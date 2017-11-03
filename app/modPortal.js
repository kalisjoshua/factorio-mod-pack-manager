const fs = require('fs')
const http = require('http')
const https = require('https')
const { parse } = require('url')

function auth({ username, password }) {
  const credentials = `username=${username}&password=${password}`
  const url = 'https://auth.factorio.com/api-login'

  return modPortal('POST', `${url}?${credentials}`)
    .then(response => JSON.parse(response.body.toString())[0])
}

function download(user, list, dest) {
  list = list.every ? list : [list]

  return auth(user)
    .then(token => {
      const all = list
        .map(item => zip(user.username, token, item.url, dest + item.file))

      return Promise.all(all)
    })
}

function factory(user) {
  const client = {
    download: (list, dest) => download(user, list, dest),
  }

  return client
}

function modPortal(method, url, dest) {
  const parsed = parse(url)

  const options = {
    host: parsed.host,
    method: method.toUpperCase(),
    path: parsed.path,
  }

  function handler(accept, reject) {
    const requestor = parsed.protocol === 'http:'
      ? http
      : https

    const req = requestor.request(options, dest ? write : success)

    function success(response) {
      const buffer = []

      response.on('data', data => buffer.push(data))
      response.on('end', () => accept({
        body: Buffer.concat(buffer),
        headers: response.headers,
        status: response.statusCode,
      }))
    }

    function write(response) {
      const stream = fs.createWriteStream(dest)

      response.pipe(stream)
      stream.on('finish', () => stream.close(accept({
        headers: response.headers,
        status: response.statusCode,
        zip: dest,
      })))
    }

    req.on('error', error => reject(error))

    req.end()
  }

  return new Promise(handler)
}

function zip(username, token, path, dest) {
  const credentials = `username=${username}&token=${token}`
  const url = `http://mods.factorio.com${path}?${credentials}`

  return modPortal('GET', url)
    .then(response => /302/.test(response.status) && response.headers.location
      ? modPortal('GET', response.headers.location, dest)
      : new Error('Unexpected response.'))
}


// const mod = '/api/downloads/data/mods/451/add-loader_0.0.8.zip'
// const user = { username: 'kalisjoshua', password: 'trolling' }
// const dest = __dirname + '/add-loader.zip'
//
// download(user, mod, dest)
//   .then(() => console.log('done'))

module.exports = factory;
