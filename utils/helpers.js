// helpers.js

/**
 * A table number is valid for a restaurant when that restaurant actually has
 * that table. Tables are provisioned per tenant, so this can no longer be a
 * hardcoded global range.
 *
 * @param {import("./tenantScope").TenantScopedModel} Table scoped Table model
 * @param {number|string} tableNo
 */
const isTableValid = async (Table, tableNo) => {
  const num = Number(tableNo);
  if (!Number.isInteger(num) || num <= 0) return false;
  const table = await Table.findOne({ tableNo: num }, { _id: 1 });
  return Boolean(table);
};

/** Shape-only check, for callers that will create the table if it is missing. */
const isTableNoWellFormed = (tableNo) => {
  const num = Number(tableNo);
  return Number.isInteger(num) && num > 0;
};

module.exports = { isTableValid, isTableNoWellFormed };
