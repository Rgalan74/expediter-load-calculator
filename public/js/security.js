// security.js - Funciones de seguridad
// Versión global (sin export para compatibilidad)

/**
 * Sanitiza HTML para prevenir ataques XSS
 */
window.sanitizeHTML = function (str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
};

/**
 * Sanitiza y valida números con límites
 */
window.sanitizeNumber = function (value, min = 0, max = Infinity) {
  const num = parseFloat(value);
  if (isNaN(num)) return min;
  return Math.max(min, Math.min(max, num));
};

/**
 * Valida email format
 */
window.isValidEmail = function (email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Valida contraseña
 */
window.validatePassword = function (password) {
  const minLength = 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);

  if (password.length < minLength) {
    return 'La contraseña debe tener al menos 8 caracteres';
  }
  if (!hasUpper || !hasLower || !hasNumber) {
    return 'Debe contener mayúsculas, minúsculas y números';
  }
  return null;
};

/**
 * Sanitiza texto
 */
window.sanitizeText = function (text, maxLength = 500) {
  if (!text) return '';
  let clean = text.replace(/[<>]/g, '');
  return clean.substring(0, maxLength).trim();
};

/**
 * Valida y sanitiza URL
 */
window.sanitizeURL = function (url) {
  try {
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return '';
    }
    return urlObj.href;
  } catch {
    return '';
  }
};

console.log('✅ Security functions loaded globally');
