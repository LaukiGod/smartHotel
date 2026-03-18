const resturentTable = new Set([1, 2, 4, 5, 6, 7, 8, 9, 10]);

const isTableValid = (inputNo) => resturentTable.has(inputNo);

module.exports = { resturentTable, isTableValid };