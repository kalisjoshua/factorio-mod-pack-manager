const fs = require('fs')
const path = require('path')

const debounce = require('./debounce')
const getMods = require('./getMods')
const notification = require('./notification')

let allMods
const store = require('./dataStore.json')

// mods location
// TODO: make this configurable in the UI
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

function renderUI() {
  allMods = require('./mod-cache.json')

  notification()
  updateModsListing()
  updateOwners()
  updatePacksListing()

  document
    .querySelector('form[name="just-the-packs"]')
    .addEventListener('submit', event => {
      event.preventDefault()

      const name = event.target.name

      if (name.value) {
        store[name.value] = []
        name.value = ''

        updatePacksListing()
      }
    })

  document
    .querySelector('.mod-filters [name="fieldset-installed"]')
    .addEventListener('change', updateModsListing)

  document
    .querySelector('.mod-filters [name="owner"]')
    .addEventListener('change', updateModsListing)

  document
    .querySelector('.mod-filters input[name="title"]')
    .addEventListener('keyup', debounce(updateModsListing))

  document
    .addEventListener('click', event => {
      let node = event.target

      while (!/header/i.test(node.nodeName) && node.parentNode) {
        node = node.parentNode
      }

      if (node && node.parentNode) {
        node.parentNode.classList.toggle('open')
      }
    })
}

function updateModsListing() {
  const filters = {
    installed: document.forms['mod-filters'].installed.value,
    owner: document.forms['mod-filters'].owner.value,
    title: document.forms['mod-filters'].title.value.toLowerCase(),
  }

  document.querySelector('.content').innerHTML = allMods
    .reduce((acc, mod) => {
      const isInstalled = installed.indexOf(mod.latest_release.file_name) > -1
        ? 'Yup'
        : 'Nope'

      const include =
        (filters.installed ? isInstalled === filters.installed : true) &&
        (filters.owner ? mod.owner === filters.owner : true) &&
        (filters.title ? mod.title.toLowerCase().indexOf(filters.title) > -1 : true)

      const obj = {
        download_url: mod.latest_release.download_url,
        // downloads: mod.downloads_count,
        factorio_version: mod.latest_release.factorio_version,
        file_name: mod.latest_release.file_name,
        installed: isInstalled,
        owner: mod.owner.trim(),
        summary: mod.summary,
        title: mod.title,
        // version: mod.latest_release.version,
      }

      if (include) {
        acc.push(`
          <article class="mod-info">
            <header>
              <div class="col-title"><h3>${obj.title}</h3></div>
              <div class="col-owner">by: ${obj.owner || ''}</div>
            </header>

            <section class="mod-summary">
              <dl>
                <dt>Summary</dt>
                <dd>${obj.summary}</dd>

                <dt>Factorio version</dt>
                <dd>${obj.factorio_version}</dd>

                <dt>Installed</dt>
                <dd>${obj.installed}</dd>
              </dl>
            </section>
          </article>`)
      }

      return acc;
    }, [])
    .join('')
}

function updateOwners() {
  const ownerFilter = document.forms['mod-filters'].owner

  const owners = new Set()

  allMods
    .forEach(mod => owners.add(mod.owner))

  Array.from(owners)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .forEach(owner => {
      const node = document.createElement('option')

      node.value = owner
      node.innerText = owner

      ownerFilter.insertBefore(node, null)
    })
}

function updatePacksListing() {
  const packs = Object.keys(store)

  const filterList = document.forms['mod-filters']['packs-filter']
  const manageList = document.forms['just-the-packs']['my-packs']

  Array.from(filterList.querySelectorAll('legend ~ *'))
    .forEach(el => filterList.removeChild(el))

  Array.from(manageList.querySelectorAll('legend ~ *'))
    .forEach(el => manageList.removeChild(el))

  function item(name, alt, list) {
    const input = document.createElement('input')
    const label = document.createElement('label')

    label.setAttribute('for', `pick-${name}${alt}`)
    label.innerHTML = name

    input.setAttribute('id', `pick-${name}${alt}`)
    input.setAttribute('name', 'picks')
    input.setAttribute('type', 'checkbox')
    input.setAttribute('value', name)

    list.insertBefore(input, null)
    list.insertBefore(label, null)
  }

  packs
    .forEach(name => {
      item(name, '--filter', filterList)
      item(name, '--manage', manageList)
    })
}

fs.stat(path.join(__dirname, '/mod-cache.json'), function (err, stat) {
  if (err) {
    notification('info', 'Fetching mods list from portal.')

    getMods()
      .then(all => {

        // untested code!
        return new Promise((resolve, reject) => {
          fs.writeFile(modCache, JSON.stringify(all, null, 4), 'utf8', function (error) {
            error
              ? reject('Write error.')
              : resolve('Success.')
          })
        })
      })
      .then(renderUI)
  } else {
    renderUI()
  }
})
