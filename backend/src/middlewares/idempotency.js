import crypto from "crypto";
import { admin, db } from "../utils/firebase.js";

const TS = admin.firestore.Timestamp;

const sha256 = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");

const normalizeKey = (value) => String(value || "").trim();

const toMillis = (ts) => {
  if (!ts) return null;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts._seconds === "number") return ts._seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  return null;
};

const stableStringify = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value !== "object") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const proto = Object.getPrototypeOf(value);
  if (proto && proto !== Object.prototype) return String(value);
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${k}:${stableStringify(value[k])}`).join(",")}}`;
};

const buildRequestHash = (req) => {
  const path = String(req.originalUrl || req.url || "").split("?")[0];
  const method = String(req.method || "GET").toUpperCase();
  const body = stableStringify(req.body);
  return sha256(`${method}|${path}|${body}`);
};

export const idempotency = ({ ttlMs = 10 * 60 * 1000, collection = "idempotencyKeys" } = {}) => {
  return async (req, res, next) => {
    const key = normalizeKey(req.headers["idempotency-key"] || req.headers["x-idempotency-key"]);
    if (!key) return next();

    const uid = String(req.user?.uid || req.user?.id || "anonymous");
    const path = String(req.originalUrl || req.url || "").split("?")[0];
    const method = String(req.method || "GET").toUpperCase();
    const reqHash = buildRequestHash(req);

    const docId = sha256(`${uid}|${method}|${path}|${key}`);
    const ref = db.collection(collection).doc(docId);

    const nowMs = Date.now();
    const expiresAt = TS.fromMillis(nowMs + ttlMs);

    try {
      const decision = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists) {
          const data = snap.data() || {};
          const expMs = toMillis(data.expiresAt);
          if (expMs !== null && expMs <= nowMs) {
            tx.delete(ref);
          } else {
            const prevHash = String(data.requestHash || "");
            if (prevHash && prevHash !== reqHash) {
              return { action: "conflict" };
            }
            const status = String(data.status || "");
            if (status === "completed") {
              return {
                action: "replay",
                statusCode: Number(data.responseStatus || 200),
                body: data.responseBody ?? null,
              };
            }
            if (status === "in_progress") {
              return { action: "in_progress" };
            }
          }
        }

        tx.set(
          ref,
          {
            uid,
            method,
            path,
            idempotencyKey: key.slice(0, 160),
            requestHash: reqHash,
            status: "in_progress",
            createdAt: TS.fromMillis(nowMs),
            expiresAt,
          },
          { merge: false }
        );

        return { action: "proceed" };
      });

      if (decision?.action === "replay") {
        res.setHeader("X-Idempotent-Replay", "1");
        res.setHeader("X-Idempotency-Key", key);
        const statusCode = Number(decision.statusCode || 200);
        const body = decision.body;
        if (body && typeof body === "object") return res.status(statusCode).json(body);
        return res.status(statusCode).send(body);
      }

      if (decision?.action === "in_progress") {
        res.setHeader("X-Idempotency-Key", key);
        return res.status(409).json({ message: "Solicitud duplicada en curso. Reintentá en unos segundos." });
      }

      if (decision?.action === "conflict") {
        res.setHeader("X-Idempotency-Key", key);
        return res.status(409).json({ message: "Idempotency key reutilizada con payload diferente." });
      }

      let finished = false;
      let statusCode = 200;
      const originalStatus = res.status.bind(res);
      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);

      const persist = (payload) => {
        if (finished) return;
        finished = true;
        const responseBody = payload === undefined ? null : payload;
        void ref.set(
          {
            status: "completed",
            responseStatus: statusCode,
            responseBody,
            completedAt: TS.fromMillis(Date.now()),
          },
          { merge: true }
        );
      };

      res.status = (code) => {
        statusCode = Number(code) || statusCode;
        return originalStatus(code);
      };

      res.json = (body) => {
        persist(body);
        return originalJson(body);
      };

      res.send = (body) => {
        persist(body);
        return originalSend(body);
      };

      res.on("finish", () => {
        persist(null);
      });

      return next();
    } catch {
      return next();
    }
  };
};

