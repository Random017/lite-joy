export function debounce(fn, wait = 300) {
  let timer = null;
  let lastArgs = null;
  const wrapped = (...args) => {
    lastArgs = args;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = null;
      fn(...lastArgs);
    }, wait);
  };
  wrapped.cancel = () => {
    window.clearTimeout(timer);
    timer = null;
  };
  wrapped.flush = () => {
    if (timer === null) return;
    window.clearTimeout(timer);
    timer = null;
    fn(...lastArgs);
  };
  return wrapped;
}

export function rafThrottle(fn) {
  let queued = false;
  let lastArgs = null;
  return (...args) => {
    lastArgs = args;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn(...lastArgs);
    });
  };
}
