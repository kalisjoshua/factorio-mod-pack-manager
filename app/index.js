const fs = require('fs')
const path = require('path')

const notification = require('./notification')

const getMods = require('./getMods')

const modCache = path.join(__dirname, '/mod-cache.json')

function updateModCache() {
  notification('error', 'Fetching mods list from portal.')

  return getMods()
    .then(all => {
      fs.writeFile(modCache, JSON.stringify(all, null, 4), 'utf8')
    })
}

function updateUI() {
  const content = document.querySelector('.content')

  notification('success', 'Mods cache found.')

  const allMods = require('./mod-cache.json')

  const rows = allMods
    .map(mod => ({
      downloads: mod.downloads_count,
      factorio_version: mod.latest_release.factorio_version,
      owner: mod.owner,
      summary: mod.summary,
      title: mod.title,
      url: mod.latest_release.download_url,
      version: mod.latest_release.version,
    }))
    .map(mod => `<tr><td>${mod.title}</td><td>${mod.version}</td><td>${mod.owner || ''}</td></tr>`)

  content.innerHTML = `<table>${rows.join('')}</table>`
}

fs.stat(modCache, function (err, stat) {
  if (err) {
    updateModCache()
      .then(updateUI)
  } else {
    updateUI()
  }
})
