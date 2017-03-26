const pageSize = 1000
const URL = `https://mods.factorio.com/api/mods?page_size=${pageSize}`

function fetchJSON(url, options) {

  return fetch(url, options)
    .then(r => r.json())
}

function followNext(url, options) {

  return fetchJSON(url, options)
    .then(({pagination, results}) => {
      const {next} = pagination.links

      return next
        ? followNext(next, options)
          .then(mods => results.concat(mods))
        : results
    })
}

function getMods() {

  return followNext(URL)
}

module.exports = getMods;
