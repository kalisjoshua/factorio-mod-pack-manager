const fs = require('fs')
const path = require('path')

const debounce = require('./debounce')
const notification = require('./notification')

const getMods = require('./getMods')

const modCache = path.join(__dirname, '/mod-cache.json')

const filters = {
  installed: '',
  owner: '',
  title: '',
}

// mods location
const location = path
  .join(
    process.env.HOME,
    'Library',
    'Application Support',
    'factorio',
    'mods'
  )

// installed mods
const installed = fs.readdirSync(location)

function updateUI() {
  const content = document.querySelector('.content')

  notification()

  const allMods = require('./mod-cache.json')

  const rowHeadings = 'Title Owner Installed'
    .split(' ')
    .map(str => `<th class="${str.toLowerCase()}">${str}</th>`)
    .join('')

  const owners = new Set()

  const modRows = allMods
    .reduce((acc, mod) => {
      owners.add(mod.owner)

      const isInstalled = installed.indexOf(mod.latest_release.file_name) > -1
        ? 'Yup'
        : 'Nope'

      const include =
        (filters.installed ? isInstalled === filters.installed : true) &&
        (filters.owner ? mod.owner.indexOf(filters.owner) > -1 : true) &&
        (filters.title ? mod.title.toLowerCase().indexOf(filters.title.toLowerCase()) > -1 : true)

      const obj = {
        download_url: mod.latest_release.download_url,
        downloads: mod.downloads_count,
        factorio_version: mod.latest_release.factorio_version,
        file_name: mod.latest_release.file_name,
        installed: isInstalled,
        owner: mod.owner.trim(),
        summary: mod.summary,
        title: mod.title,
        version: mod.latest_release.version,
      }

      if (include) {
        acc.push(`<tr>
            <td>${obj.title}</td>
            <td>${obj.owner || ''}</td>
            <td>${obj.installed}</td>
          </tr>`)
      }

      return acc;
    }, [])
    // .map(mod => )
    .join('')

  const installedList = `<select name="installed">${['', 'Yup', 'Nope']
    .map(opt => `<option value="${opt}"${filters.installed === opt ? 'selected' : ''}>${opt}</option>`)
    .join('')}</select>`

  const ownersList = `<select name="owners">${[''].concat(Array.from(owners))
    .map(owner => `<option value="${owner}"${filters.owner === owner ? 'selected' : ''}>${owner}</option>`)
    .join('')}</select>`

  const filtersRow = `<tr class="filters">${[
    `<td><input name="title" value="${filters.title}" /></td>`,
    `<td>${ownersList}</td>`,
    `<td>${installedList}</td>`,
  ].join('')}</tr>`

  content.innerHTML = `<table>
    <col />
    <col style="width: 10em;" />
    <col style="width: 6em;" />

    <thead>
    ${rowHeadings}
    ${filtersRow}
    </thead>
    <tbody>
    ${modRows}
    </tbody>
  </table>`

  const installedSelector = '.filters select[name="installed"]'
  document
    .querySelector(installedSelector)
    .addEventListener('change', event => {
      filters.installed = event.target.value
      updateUI()

      const newElement = document.querySelector(installedSelector)

      newElement.value = filters.installed
    })

  const ownerSelector = '.filters select[name="owners"]'
  document
    .querySelector(ownerSelector)
    .addEventListener('change', event => {
      filters.owner = event.target.value
      updateUI()

      const newElement = document.querySelector(ownerSelector)

      newElement.value = filters.owner
    })

  const titleSelector = '.filters input[name="title"]'
  document
    .querySelector(titleSelector)
    .addEventListener('keyup', debounce(event => {
      filters.title = event.target.value
      updateUI()

      const newElement = document.querySelector(titleSelector)

      newElement.value = newElement.value
      newElement.focus()
    }))
}

fs.stat(modCache, function (err, stat) {
  if (err) {
    notification('info', 'Fetching mods list from portal.')

    getMods()
      .then(all => {
        fs.writeFile(modCache, JSON.stringify(all, null, 4), 'utf8')
      })
      .then(updateUI)
  } else {
    updateUI()
  }
})
