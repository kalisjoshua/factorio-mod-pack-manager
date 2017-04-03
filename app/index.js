const fs = require('fs')
const http = require('http')
const path = require('path')

const debounce = require('./debounce')
const getMods = require('./getMods')
const modPortal = require('./modPortal')
const notification = require('./notification')

let allMods
let dataStore
try {
  dataStore = require(__dirname + '/dataStore.json')
} catch (e) {
  fs.writeFileSync(__dirname + '/dataStore.json', '{}', 'utf8')
  dataStore = {}
}
const reverseLookup = Object.keys(dataStore)
  .reduce((acc, key) => {
    dataStore[key]
      .forEach(id => acc[id] = acc[id] ? [...acc[id], key] : [key])

    return acc;
  }, {})

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
let installed = fs.readdirSync(location)
const outdated = (function () {
  const basename = str => str.replace(/_\d+\.\d+\.\d+\.zip$/, '')
  const lookup = installed
    .reduce((acc, file) => (acc[basename(file)] = file, acc), {})

  return file => lookup[basename(file)] && lookup[basename(file)] !== file
}())

function activateMods(event) {
  const button = event.target
  const disabledClass = 'btn--disabled'

  if (!button.classList.contains(disabledClass)) {
    button.classList.add(disabledClass)

    const filepath = `${location}/mod-list.json`

    const { missing, mods } = activeModsList()

    const finalize = () => {
      fs.writeFileSync(filepath, JSON.stringify({ mods }, null, 4), 'utf-8')
      alert('Mods activated.')
      button.classList.remove(disabledClass)
    }

    if (missing.length) {
      console.log('gonna get \'em')
      downloadMods(missing)
        .then(() => {
          console.log('got \'em')
          finalize()
          installed = fs.readdirSync(location)
        })
    } else {
      finalize()
    }
  }
}

function activeModsList() {
  const ids = Array.from(document.forms.manager['packs-list']
    .querySelectorAll(':checked'))
    .map(item => dataStore[item.value])
    .join()
    .split(',')

  const format = (name, enabled) => ({ name, enabled })

  const result = allMods
    .reduce((acc, mod) => {
      const enabled = ids.includes('' + mod.id)
      const isInstalled = installed.includes(mod.latest_release.file_name)
      const name = mod.name

      isInstalled && acc.mods.push(format(name, enabled))

      // check for any uninstalled mods
      if (enabled && !isInstalled) {
        acc.missing.push({
          file: mod.latest_release.file_name,
          name,
          url: mod.latest_release.download_url,
        })
      }

      return acc
    }, { missing: [], mods: [format('base', true)]})

  return result
}

function addPackName(event) {
  event.preventDefault()

  const name = document.forms.manager.name

  if (name.value) {
    dataStore[name.value] = []
    name.value = ''

    updateDataStore()
    updatePacksListing()
  }
}

function afterCacheUpdate(button) {
  notification('info', 'Mods cache updated.')

  // change to "Update Mods"
  button.innerText = 'Update Installed Mods'
  button.classList.remove('btn--disabled')
  button.dataset.refreshed = true

  updateModsListing()

  setTimeout(notification, 4000)
}

function downloadMods(list) {
  document.forms.manager.password
    .parentNode
    .classList
    .toggle('field-error', !document.forms.manager.password.value)

  document.forms.manager.username
    .parentNode
    .classList
    .toggle('field-error', !document.forms.manager.username.value)

  if (!document.forms.manager.username.value) {
    throw new Error('Username is required.')
  }

  if (!document.forms.manager.password.value) {
    throw new Error('Password is required.')
  }

  const client = modPortal({
    password: document.forms.manager.password.value,
    username: document.forms.manager.username.value,
  })

  return client
    .download(list, `${location}/`)
}

function modToggle(event) {
  const mod = event.srcElement
  const [prevText, nextText] = [mod.innerText, mod.dataset.toggleText]
  const [prevClass, nextClass] = mod.dataset.toggleClass.split(',')

  mod.innerText = nextText
  mod.dataset.toggleText = prevText

  mod.classList.remove(prevClass)
  mod.classList.add(nextClass)
  mod.dataset.toggleClass = `${nextClass},${prevClass}`

  const packs = document.forms.manager['packs-list']
    .querySelectorAll(':checked')

  if (packs.length) {
    const listItems = prevText === 'Add'
      ? (list, id) => list.concat(id)
      : (list, id) => list.filter(x => x !== id)

    const membership = prevText === 'Add'
      ? (name, id) => dataStore[name].push(id) && reverseLookup[id].push(name)
      : (name, id) => {
        dataStore[name] = dataStore[name].filter(x => x !== id)
        reverseLookup[id] = reverseLookup[id].filter(x => x !== name)
      }

    Array.from(packs)
      .forEach(pack => {
        const { modId } = mod.dataset
        const name = pack.value

        if (prevText === 'Add') {
          dataStore[name] ? dataStore[name].push(modId) : [modId]
          reverseLookup[modId] = [...(reverseLookup[modId] || []), name]
        } else {
          dataStore[name] = dataStore[name].filter(x => x !== modId)
          reverseLookup[modId] = reverseLookup[modId].filter(x => x !== name)
        }
      })

    updateDataStore()
    updateModsListing()
  }

  toggleAuthenticate()
  updatePacksListing()
}

function removeModPack(event) {
  event.preventDefault()

  if (confirm(`Delete ${event.target.dataset.pack}?`)) {
    delete dataStore[event.target.dataset.pack]

    updateDataStore()
    updatePacksListing()
  }
}

function renderUI() {
  try {
    allMods = require(__dirname + '/mod-cache.json')
  } catch (e) {
    fs.writeFileSync(__dirname + '/mod-cache.json', '{}', 'utf8')
    allMods = {}
  }

  notification()
  updateModsListing()
  updateOwners()
  updatePacksListing()
  updateFactorioVersions()

  document
    .querySelector('[data-action="activate"]')
    .addEventListener('click', activateMods)

  document.forms.manager
    .addEventListener('submit', addPackName)

  document.forms.manager.isInstalled
    .addEventListener('change', updateModsListing)

  document.forms.manager.owner
    .addEventListener('change', updateModsListing)

  document.forms.manager.hasUpdate
    .addEventListener('change', updateModsListing)

  document.forms.manager['packs-filter']
    .addEventListener('change', event => {
      const checked = event.target.checked

      const options = Array.from(document.forms.manager['packs-filter']
        .querySelectorAll('[name="packs"]'))
        .forEach(opt => opt.checked = false)

      if (checked) {
        event.target.checked = true
      }

      updateModsListing()
    })

  document.forms.manager['packs-list']
    .addEventListener('change', toggleToggleButtons)

  document.forms.manager.sortby
    .addEventListener('change', updateModsListing)

  document.forms.manager.title
    .addEventListener('keyup', debounce(updateModsListing))

  document.forms.manager.version
    .addEventListener('change', updateModsListing)

  document
    .addEventListener('click', event =>
      event.srcElement.dataset.toggleText
        ? modToggle(event)
        : toggleModInfo(event))

  document
    .querySelector('[data-action="refresh"]')
    .addEventListener('click', updateModsHandler)
}

function toggleAuthenticate() {
  const { missing } = activeModsList()

  document.body.classList
    .toggle('authenticate', missing.length)
}

function toggleModInfo(event) {
  let node = event.target

  while (!/header/i.test(node.nodeName) && node.parentNode) {
    node = node.parentNode
  }

  if (node && node.parentNode) {
    node.parentNode.classList.toggle('open')
  }
}

function toggleToggleButtons() {
  const editing = document.forms.manager['packs-list']
    .querySelectorAll(':checked')
    .length

  document.body.classList
    .toggle('editing', editing)

  document
    .querySelector('[data-action="activate"]')
    .classList.toggle('btn--disabled', !editing)

  toggleAuthenticate()
  updateModsListing()
}

function updateDataStore() {
  fs.writeFile('./app/dataStore.json', JSON.stringify(dataStore, null, 4), 'utf8', error => {
    if (error) {
      // TODO: handle write error
    }
  })
}

function updateInstalledMods() {
  // TODO: updating installed mods
  alert('Sorry, not implemented yet.')
}

function updateModCache(fn) {
  notification('info', 'Fetching mods list from portal.')

  // remove mods listing
  document.querySelector('.mods-listing').innerText = ''

  getMods()
    .then(writeModsCache)
    .then(fn)
}

function updateModsHandler(event) {
  const button = event.target

  // ignore disabled button clicks
  if (button.classList.contains('btn--disabled')) return;

  // disable button
  button.classList.add('btn--disabled')

  button.dataset.refreshed
    ? updateInstalledMods()
    : updateModCache(afterCacheUpdate.bind(null, button))
}

function updateModsListing() {
  const form = document.forms.manager

  const selectedPacks = Array.from(form['packs-list']
    .querySelectorAll(':checked'))
    .map(opt => opt.value)

  const packsFilter = (function (selected) {

    return {
      any: ({id}) => !!reverseLookup[id],
      selected: ({id}) => reverseLookup[id] && selectedPacks
        .some(name => reverseLookup[id].includes(name)),
      zero: ({id}) => !reverseLookup[id],
      '': () => true,
    }[selected ? selected.value : '']
  }(form['packs-filter'].querySelector(':checked')))

  const filters = {
    installed: form.installed.value,
    owner: form.owner.value,
    packs: packsFilter,
    title: form.title.value.toLowerCase(),
    update: form.update.value,
    version: form.version.value,
  }

  const modIds = Array.from(form['packs-list']
    .querySelectorAll(':checked'))
    .reduce((acc, name) => acc.concat(dataStore[name.value]), [])

  const sortMethod = {
    'downloads_count': (a, b) => a.downloads_count > b.downloads_count ? -1 : 1,
    'released_at': (a, b) => new Date(a.latest_release.released_at) > new Date(b.latest_release.released_at) ? -1 : 1,
    'title': (a, b) => a.title > b.title ? 1 : -1,
  }[form.sortby.value]

  document.querySelector('.mods-listing').innerHTML = allMods
    .sort(sortMethod)
    .reduce((acc, mod) => {
      const isInstalled = installed.indexOf(mod.latest_release.file_name) > -1
      const isOutdated = outdated(mod.latest_release.file_name)
      const inPack = modIds.includes('' + mod.id)

      const include =
        (filters.installed ? `${isInstalled}` === filters.installed : true) &&
        (filters.owner ? mod.owner === filters.owner : true) &&
        (filters.packs(mod)) &&
        (filters.title ? mod.title.toLowerCase().indexOf(filters.title) > -1 : true) &&
        (filters.update ? `${isOutdated}` === filters.update : true) &&
        (filters.version ? `${mod.latest_release.factorio_version}` === filters.version : true)

      const obj = {
        download_url: mod.latest_release.download_url,
        downloads_count: mod.downloads_count,
        factorio_version: mod.latest_release.factorio_version,
        file_name: mod.latest_release.file_name,
        id: mod.id,
        installed: isInstalled ? 'Yup' : 'Nope',
        outdated: isOutdated ? '<small class="badge badge--warn">Outdated</small>' : '',
        owner: mod.owner.trim(),
        released_at: mod.latest_release.released_at,
        summary: mod.summary,
        title: mod.title,
      }

      const btnClasses = 'btn--good btn--warn'.split(' ')
      inPack && btnClasses.reverse()

      const btnText = 'Add Remove'.split(' ')
      inPack && btnText.reverse()

      // title, downloads, released_at

      if (include) {
        acc.push(`
          <article class="mod-info">
            <header>
              <span class="btn btn--small btn--toggle ${btnClasses[0]}"
                data-mod-id="${obj.id}"
                data-toggle-class="${btnClasses.join(',')}"
                data-toggle-text="${btnText[1]}">${btnText[0]}</span>
              <div class="col-title"><h3>${obj.title}${obj.outdated}</h3></div>
              <div class="col-owner">${obj.owner || ''}</div>
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
  const ownerFilter = document.forms.manager.owner

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
  const packs = Object.keys(dataStore)

  const manageList = document.forms.manager['packs-list']

  const selected = Array.from(manageList
    .querySelectorAll(':checked'))
    .map(opt => opt.value)

  Array.from(manageList.querySelectorAll('legend ~ *'))
    .forEach(el => manageList.removeChild(el))

  function item(name, alt, list) {
    const input = document.createElement('input')
    const label = document.createElement('label')
    const span = document.createElement('span')

    input.setAttribute('id', `pick-${name}${alt}`)
    input.setAttribute('name', 'picks')
    input.setAttribute('type', 'checkbox')
    input.setAttribute('value', name)
    selected.includes(name) && input.setAttribute('checked', true)

    label.classList.add('pill__item', 'pack-item')
    label.innerHTML = `${name} (${dataStore[name].length})`
    label.setAttribute('for', `pick-${name}${alt}`)

    span.classList.add('remove-pack')
    span.dataset.pack = name
    span.innerHTML = '&times;'
    span.title = `Remove this mod; ${name}.`
    span.addEventListener('click', removeModPack)
    label.appendChild(span)

    list.insertBefore(input, null)
    list.insertBefore(label, null)
  }

  packs
    .forEach(name => {
      item(name, '--manage', manageList)
    })
}

function updateFactorioVersions() {
  const versionFilter = document.forms.manager.version

  const versions = new Set()

  const semanticOrder = str =>
    str.split('.').map(n => `0${n}`.slice(-2)).join('')

  allMods
    .forEach(mod => versions.add(mod.latest_release.factorio_version))

  Array.from(versions)
    .sort((a, b) => semanticOrder(a).localeCompare(semanticOrder(b)))
    .forEach(ver => {
      const node = document.createElement('option')

      node.value = ver
      node.innerText = ver

      versionFilter.insertBefore(node, null)
    })
}

function writeModsCache(all) {
  allMods = all

  return new Promise((resolve, reject) => {
    const content = JSON.stringify(all, null, 4)
    fs.writeFile('./app/mod-cache.json', content, 'utf8', function (error) {
      error
        ? reject('Write error.')
        : resolve('Success.')
    })
  })
}

document.forms.manager.dir.value = location

fs.stat(path.join(__dirname, '/mod-cache.json'), function (err, stat) {
  err ? updateModCache(renderUI) : renderUI()
})
