// helpers.js
const RESTAURANT_TABLES = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

const isTableValid = (tableNo) => {
  const num = Number(tableNo);
  return Number.isInteger(num) && RESTAURANT_TABLES.has(num);
};

module.exports = { isTableValid };