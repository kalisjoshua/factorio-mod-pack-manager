const notificationClose = event =>
  event.target.dataset.close === 'notification' && notification()

function notification(type, msg) {
  const el = document.querySelector('.notification')
  const icon = el.querySelector('.icon')
  const message = el.querySelector('.message')

  el.classList
    .remove(...Array.from(el.classList))

  document.removeEventListener('click', notificationClose)

  el.classList
    .add('notification')

  if (type && msg) {
    el.classList
      .add('notification--show', `notification--${type}`)

    icon.title = type
    icon.innerHTML = { error: '!', info: '&', success: '$' }[type] || '?'
    message.innerHTML = msg
    document.addEventListener('click', notificationClose)
  }
}

module.exports = notification
