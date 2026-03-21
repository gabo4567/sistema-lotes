import { auth } from "../services/firebase";

const deriveIptFromUid = (uid) => {
	if (!uid) return null;
	const match = String(uid).match(/^prod_(.+)$/i);
	return match ? match[1] : null;
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

export const authFetch = async (url, options = {}) => {
	const { forceRefresh = false, headers: optionHeaders, ...restOptions } = options;
	const { idToken } = await getCurrentAuthContext({ forceRefresh });
	const headers = {
		...(optionHeaders || {}),
		Authorization: `Bearer ${idToken}`,
	};

	return fetch(url, {
		...restOptions,
		headers,
	});
};
