function debounce(fn, delay = 300, global = window) {
  const context = this;
  let pending;

  function debounced(...args) {
    if (pending) {
      global.clearTimeout(pending);
    }

    pending = global.setTimeout(fn.bind(context, ...args), delay);
  }

  return debounced;
}

module.exports = debounce;
