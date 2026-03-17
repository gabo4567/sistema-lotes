const stores = new Map();

const nowMs = () => Date.now();

const cleanupStore = (store, windowMs) => {
  const limitTs = nowMs() - windowMs;
  for (const [key, value] of store.entries()) {
    if (!value || value.firstSeen < limitTs) {
      store.delete(key);
    }
  }
};

const getStore = (name) => {
  if (!stores.has(name)) {
    stores.set(name, new Map());
  }
  return stores.get(name);
};

const toClientIp = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
    return forwardedFor.split(",")[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || "unknown-ip";
};

export const createRateLimiter = ({
  name,
  windowMs = 60 * 1000,
  max = 5,
  keySelector,
  message = "Demasiados intentos. Intente más tarde.",
}) => {
  const store = getStore(name || "default");

  return (req, res, next) => {
    cleanupStore(store, windowMs);

    const keyPart = typeof keySelector === "function" ? keySelector(req) : "";
    const key = `${toClientIp(req)}:${String(keyPart || "")}`;
    const current = store.get(key);

    if (!current) {
      store.set(key, { count: 1, firstSeen: nowMs() });
      return next();
    }

    if (current.count >= max) {
      return res.status(429).json({ error: message });
    }

    current.count += 1;
    store.set(key, current);
    return next();
  };
};
