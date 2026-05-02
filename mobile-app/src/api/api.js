import { auth } from "../services/firebase";
import NetInfo from "@react-native-community/netinfo";

const deriveIptFromUid = (uid) => {
	if (!uid) return null;
	const match = String(uid).match(/^prod_(.+)$/i);
	return match ? match[1] : null;
};

let backendWarmedUp = false;
const inFlight = new Map();

const generateIdempotencyKey = () => {
	try {
		if (typeof globalThis !== "undefined" && typeof globalThis.crypto?.randomUUID === "function") {
			return globalThis.crypto.randomUUID();
		}
	} catch {}
	const rand = Math.random().toString(16).slice(2);
	return `k_${Date.now().toString(16)}_${rand}`;
};

const normalizeHeaders = (headers) => {
	if (!headers) return {};
	if (typeof headers?.forEach === "function") {
		const out = {};
		headers.forEach((v, k) => {
			out[String(k)] = String(v);
		});
		return out;
	}
	if (typeof headers === "object") return { ...headers };
	return {};
};

const isMutatingMethod = (method) => {
	const m = String(method || "GET").toUpperCase();
	return m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE";
};

export const getCurrentAuthContext = async ({ forceRefresh = false } = {}) => {
	const currentUser = auth.currentUser;
	if (!currentUser) {
		throw new Error("No estás autenticado");
	}

	const idToken = await currentUser.getIdToken(forceRefresh);
	const tokenResult = await currentUser.getIdTokenResult(forceRefresh);
	const claims = tokenResult?.claims || {};
	const ipt = claims.ipt || deriveIptFromUid(currentUser.uid);

	return {
		currentUser,
		idToken,
		tokenResult,
		claims,
		ipt: ipt ? String(ipt) : null,
	};
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const isRetryableStatus = (status) => status === 502 || status === 503 || status === 504;

const fetchWithTimeout = async (url, options, timeoutMs) => {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const resp = await fetch(url, { ...options, signal: controller.signal });
		return resp;
	} finally {
		clearTimeout(timeoutId);
	}
};

const normalizeBodyForKey = (body) => {
	if (body === undefined || body === null) return "";
	if (typeof body === "string") return body;
	try {
		return JSON.stringify(body);
	} catch {
		return String(body);
	}
};

const buildLockKey = (url, options = {}) => {
	const method = String(options?.method || "GET").toUpperCase();
	const body = normalizeBodyForKey(options?.body);
	return `${method} ${String(url)} ${body}`;
};

const fetchWithRetry = async (url, options = {}) => {
	if (options?._dedupe !== false) {
		const lockKey = options?._lockKey ? String(options._lockKey) : buildLockKey(url, options);
		const existing = inFlight.get(lockKey);
		if (existing) {
			return existing.then((r) => r.clone());
		}
		const headers = normalizeHeaders(options?.headers);
		if (isMutatingMethod(options?.method) && !headers["Idempotency-Key"] && !headers["idempotency-key"]) {
			headers["Idempotency-Key"] = generateIdempotencyKey();
		}
		const p = (async () =>
			fetchWithRetry(url, { ...options, headers, _dedupe: false })
		)().finally(() => {
			inFlight.delete(lockKey);
		});
		inFlight.set(lockKey, p);
		return p.then((r) => r.clone());
	}

	const method = String(options?.method || "GET").toUpperCase();
	const canRetry = method === "GET";
	const maxRetries = canRetry ? 2 : 0;
	const baseDelayMs = 900;
	const timeoutMs = backendWarmedUp ? 15000 : 25000;

	let lastError = null;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			const attemptTimeoutMs = attempt === 0 ? timeoutMs : 15000;
			const resp = await fetchWithTimeout(url, options, attemptTimeoutMs);
			if (!resp.ok && isRetryableStatus(resp.status) && attempt < maxRetries) {
				await sleep(baseDelayMs * (attempt + 1));
				continue;
			}
			if (resp.ok) backendWarmedUp = true;
			if (!resp.ok && isRetryableStatus(resp.status)) {
				const err = new Error("Conectando al servidor… puede demorar al iniciar. Reintentá en unos segundos.");
				err.code = "SERVER_WAKING";
				throw err;
			}
			return resp;
		} catch (e) {
			lastError = e;
			const isAbort = e?.name === "AbortError";
			if (!canRetry || attempt >= maxRetries) break;
			if (!isAbort && String(e?.message || "").toLowerCase().includes("network request failed") === false) {
				break;
			}
			await sleep(baseDelayMs * (attempt + 1));
		}
	}

	const net = await NetInfo.fetch().catch(() => null);
	const isConnected = net?.isConnected ?? true;
	if (!isConnected) {
		const err = new Error("Sin conexión a internet.");
		err.code = "OFFLINE";
		throw err;
	}

	if (lastError?.code === "SERVER_WAKING") throw lastError;
	const err = new Error("El servidor está iniciando o demorando en responder. Reintentá en unos segundos.");
	err.code = "SERVER_WAKING";
	throw err;
};

export const apiFetch = async (url, options = {}) => {
	return fetchWithRetry(url, options);
};

export const authFetch = async (url, options = {}) => {
	const { forceRefresh = false, headers: optionHeaders, ...restOptions } = options;
	const { idToken } = await getCurrentAuthContext({ forceRefresh });
	const headers = {
		...normalizeHeaders(optionHeaders),
		Authorization: `Bearer ${idToken}`,
	};

	return fetchWithRetry(url, { ...restOptions, headers });
};
