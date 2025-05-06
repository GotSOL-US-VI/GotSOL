/**
 * Truncates a string with ellipsis in the middle
 * @param str - The string to truncate
 * @param len - The number of characters to keep at each end
 * @returns The truncated string
 */
export function ellipsify(str = '', len = 4) {
  if (str.length > 30) {
    return str.substring(0, len) + '..' + str.substring(str.length - len)
  }
  return str
} 