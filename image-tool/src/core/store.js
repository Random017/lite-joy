function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function createStore(initialState) {
  let state = initialState;
  const listeners = new Set();
  let notifying = false;
  let pending = false;

  const emit = () => {
    if (notifying) {
      pending = true;
      return;
    }
    notifying = true;
    try {
      for (const listener of listeners) {
        try {
          listener(state);
        } catch (error) {
          console.error('[lite-photo] store listener failed', error);
        }
      }
    } finally {
      notifying = false;
      if (pending) {
        pending = false;
        emit();
      }
    }
  };

  return {
    getState() {
      return state;
    },
    set(patch) {
      if (!patch) return state;
      state = { ...state, ...patch };
      emit();
      return state;
    },
    setIn(key, patch) {
      if (!isPlainObject(patch)) {
        state = { ...state, [key]: patch };
      } else {
        state = { ...state, [key]: { ...state[key], ...patch } };
      }
      emit();
      return state;
    },
    update(updater) {
      const next = updater(state);
      if (next && next !== state) {
        state = next;
        emit();
      }
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
