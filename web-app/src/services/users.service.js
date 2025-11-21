import api from "../api/axios";

export const getUsers = async () => {
  const res = await api.get("/users");
  return res.data;
};

export const getUser = async (uid) => {
  const res = await api.get(`/users/${uid}`);
  return res.data;
};

export const updateUser = async (uid, data) => {
  const res = await api.patch(`/users/${uid}`, data);
  return res.data;
};

export const deactivateUser = async (uid) => {
  const res = await api.post(`/users/${uid}/deactivate`);
  return res.data;
};

export const resetPasswordUser = async (uid) => {
  const res = await api.post(`/users/${uid}/reset-password`);
  return res.data;
};