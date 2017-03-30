const fs = require('fs')
const path = require('path')

const debounce = require('./debounce')
const getMods = require('./getMods')
const notification = require('./notification')

let allMods
let dataStore = JSON.parse(fs.readFileSync('./app/dataStore.json', 'utf8'))
const reverseLookup = Object.keys(dataStore)
  .reduce((acc, key) => {
    dataStore[key]
      .forEach(id => acc[id] = acc[id] ? [...acc[id], key] : [key])

    return acc;
  }, {})

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
}

function removeModPack(event) {
  const selected = document.forms.manager['packs-list']
    .querySelectorAll(':checked')

  if (selected.length) {
    Array.from(selected)
      .forEach(pack => delete dataStore[pack.value])

    updateDataStore()
    updatePacksListing()
  }
}

function renderUI() {
  allMods = require('./mod-cache.json')

  notification()
  updateModsListing()
  updateOwners()
  updatePacksListing()

  document.forms.manager
    .addEventListener('submit', addPackName)

  document.forms.manager.isInstalled
    .addEventListener('change', updateModsListing)

  document.forms.manager.owner
    .addEventListener('change', updateModsListing)

  document.forms.manager['packs-filter']
    .addEventListener('change', updateModsListing)

  document.forms.manager['packs-list']
    .addEventListener('change', toggleToggleButtons)

  document.forms.manager.title
    .addEventListener('keyup', debounce(updateModsListing))

  document
    .addEventListener('click', event =>
      event.srcElement.dataset.toggleText
        ? modToggle(event)
        : toggleModInfo(event))

  document
    .querySelector('[data-action="remove"]')
    .addEventListener('click', removeModPack)
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
}

function updateDataStore() {
  fs.writeFile('./app/dataStore.json', JSON.stringify(dataStore, null, 4), 'utf8', error => {
    if (error) {
      // TODO: handle write error
    }
  })
}

function updateModsListing() {
  const filters = {
    installed: document.forms.manager.installed.value,
    owner: document.forms.manager.owner.value,
    packs: Array.from(document.forms.manager['packs-filter']
      .querySelectorAll(':checked'))
      .map(x => x.value),
    title: document.forms.manager.title.value.toLowerCase(),
  }

  document.querySelector('.content').innerHTML = allMods
    .reduce((acc, mod) => {
      const isInstalled = installed.indexOf(mod.latest_release.file_name) > -1
      const inPack = reverseLookup[mod.id] && !!reverseLookup[mod.id].length

      const include =
        (filters.installed ? `${isInstalled}` === filters.installed : true) &&
        (filters.owner ? mod.owner === filters.owner : true) &&
        (filters.title ? mod.title.toLowerCase().indexOf(filters.title) > -1 : true) &&
        (filters.packs.length ? filters.packs.some(p => reverseLookup[mod.id] && reverseLookup[mod.id].includes(p)) : true)

      const obj = {
        download_url: mod.latest_release.download_url,
        // downloads: mod.downloads_count,
        factorio_version: mod.latest_release.factorio_version,
        file_name: mod.latest_release.file_name,
        id: mod.id,
        installed: isInstalled ? 'Yup' : 'Nope',
        owner: mod.owner.trim(),
        summary: mod.summary,
        title: mod.title,
        // version: mod.latest_release.version,
      }

      const btnClasses = 'btn--good btn--warn'.split(' ')
      inPack && btnClasses.reverse()

      const btnText = 'Add Remove'.split(' ')
      inPack && btnText.reverse()

      if (include) {
        acc.push(`
          <article class="mod-info">
            <header>
              <span class="btn btn--small btn--toggle ${btnClasses[0]}"
                data-mod-id="${obj.id}"
                data-toggle-class="${btnClasses.join(',')}"
                data-toggle-text="${btnText[1]}">${btnText[0]}</span>
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

  const filterList = document.forms.manager['packs-filter']
  const manageList = document.forms.manager['packs-list']

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
