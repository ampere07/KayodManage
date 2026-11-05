/**
 * Escape text so it matches literally inside a MongoDB $regex / RegExp.
 *
 * Search boxes pass what the admin typed straight into $regex. Unescaped, a
 * phone number as the app displays it ("+639…") or a stray "(" is an invalid
 * pattern and the whole list request fails with a 500.
 */
const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = escapeRegex;
