'use strict';

function snowflakeToDate(id) {
  return new Date(Number((BigInt(id) >> 22n) + 1420070400000n)).toLocaleString();
}

module.exports = { snowflakeToDate };
