let inMemoryToken = null;

export const tokenStore = {
  get() {
    if (inMemoryToken) {
      return inMemoryToken;
    }

    const persisted = sessionStorage.getItem("token");
    if (persisted) {
      inMemoryToken = persisted;
      return persisted;
    }

    return null;
  },

  set(token) {
    const normalized = String(token || "").trim();
    if (!normalized) {
      this.clear();
      return;
    }

    inMemoryToken = normalized;
    sessionStorage.setItem("token", normalized);
  },

  clear() {
    inMemoryToken = null;
    sessionStorage.removeItem("token");
  },
};
