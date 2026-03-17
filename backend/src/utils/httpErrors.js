export const logServerError = (context, error) => {
  console.error(`[${context}]`, error);
};

export const sendInternalError = (res, message = "Error interno del servidor") => {
  return res.status(500).json({
    message,
    error: message,
  });
};

export const sendValidationOrInternalError = (
  res,
  error,
  { validationMatchers = [], validationMessage, internalMessage = "Error interno del servidor" } = {}
) => {
  const rawMessage = String(error?.message || "").trim();
  const normalizedMessage = rawMessage.toLowerCase();
  const isValidationError = validationMatchers.some((matcher) => normalizedMessage.includes(String(matcher).toLowerCase()));

  if (isValidationError) {
    const safeMessage = validationMessage || rawMessage || "Solicitud inválida";
    return res.status(400).json({
      message: safeMessage,
      error: safeMessage,
    });
  }

  logServerError(internalMessage, error);
  return sendInternalError(res, internalMessage);
};