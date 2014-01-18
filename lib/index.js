'use strict';

var MIN_MAGNITUDE = -324; // verified by -Number.MIN_VALUE
var MAGNITUDE_DIGITS = 3; // ditto

//empirically seems safe, toExponential() does not seem to give higher precision
// TODO: confirm
var FACTOR_DIGITS = 20;

var utils = require('./utils');

exports.collate = function (a, b) {
  a = exports.normalizeKey(a);
  b = exports.normalizeKey(b);
  var ai = collationIndex(a);
  var bi = collationIndex(b);
  if ((ai - bi) !== 0) {
    return ai - bi;
  }
  if (a === null) {
    return 0;
  }
  if (typeof a === 'number') {
    return a - b;
  }
  if (typeof a === 'boolean') {
    return a === b ? 0 : (a < b ? -1 : 1);
  }
  if (typeof a === 'string') {
    return stringCollate(a, b);
  }
  if (Array.isArray(a)) {
    return arrayCollate(a, b);
  }
  if (typeof a === 'object') {
    return objectCollate(a, b);
  }
};

// couch considers null/NaN/Infinity/-Infinity === undefined,
// for the purposes of mapreduce indexes. also, dates get stringified.
exports.normalizeKey = function (key) {
  if (typeof key === 'undefined') {
    return null;
  } else if (typeof key === 'number') {
    if (key === Infinity || key === -Infinity || isNaN(key)) {
      return null;
    }
  } else if (key instanceof Date) {
    return key.toJSON();
  }
  return key;
};

// convert the given key to a string that would be appropriate
// for lexical sorting, e.g. within a database, where the
// sorting is the same given by the collate() function.
exports.toIndexableString = function (key) {
  key = exports.normalizeKey(key);

  // prefix with _ so sqlite never coerces to int
  var result = '_' + collationIndex(key);

  if (key !== null) {
    if (typeof key === 'boolean') {
      result += (key ? 1 : 0);
    } else if (typeof key === 'number') {
      result += numToIndexableString(key);
    } else if (typeof key === 'string') {
      result += key;
    } else if (Array.isArray(key)) {
      key.forEach(function (element) {
        result += exports.toIndexableString(element) + ',';
      });

    } else if (typeof key === 'object') {
      var keys = Object.keys(key);
      keys.forEach(function (objKey) {
        result += exports.toIndexableString(objKey) + ':' +
            exports.toIndexableString(key[objKey]) + ',';
      });
    }
  }

  return result;
};

function arrayCollate(a, b) {
  var len = Math.min(a.length, b.length);
  for (var i = 0; i < len; i++) {
    var sort = exports.collate(a[i], b[i]);
    if (sort !== 0) {
      return sort;
    }
  }
  return (a.length === b.length) ? 0 :
    (a.length > b.length) ? 1 : -1;
}
function stringCollate(a, b) {
  // See: https://github.com/daleharvey/pouchdb/issues/40
  // This is incompatible with the CouchDB implementation, but its the
  // best we can do for now
  return (a === b) ? 0 : ((a > b) ? 1 : -1);
}
function objectCollate(a, b) {
  var ak = Object.keys(a), bk = Object.keys(b);
  var len = Math.min(ak.length, bk.length);
  for (var i = 0; i < len; i++) {
    // First sort the keys
    var sort = exports.collate(ak[i], bk[i]);
    if (sort !== 0) {
      return sort;
    }
    // if the keys are equal sort the values
    sort = exports.collate(a[ak[i]], b[bk[i]]);
    if (sort !== 0) {
      return sort;
    }

  }
  return (ak.length === bk.length) ? 0 :
    (ak.length > bk.length) ? 1 : -1;
}
// The collation is defined by erlangs ordered terms
// the atoms null, true, false come first, then numbers, strings,
// arrays, then objects
// null/undefined/NaN/Infinity/-Infinity are all considered null
function collationIndex(x) {
  var id = ['boolean', 'number', 'string', 'object'];
  var idx = id.indexOf(typeof x);
  if (idx !== -1) {
    if (x === null) {
      return 1;
    }
    if (Array.isArray(x)) {
      return 5;
    }
    return idx < 3 ? (idx + 2) : (idx + 3);
  }
  if (Array.isArray(x)) {
    return 5;
  }
}

function numToIndexableString(num) {

  // convert number to exponential format for easier and
  // more succinct string sorting
  var expFormat = num.toExponential().split(/e\+?/);
  var magnitude = parseInt(expFormat[1], 10);

  var neg = num < 0;

  // first sort by magnitude
  var result = neg ? '0' : (num === 0 ? '1' : '2');

  // it's easier if all magnitudes are positive
  var magForComparison = ((neg ? -magnitude : magnitude) - MIN_MAGNITUDE);
  var magString = utils.padLeft((magForComparison).toString(), '0', MAGNITUDE_DIGITS);

  result += '_' + magString;

  // then sort by the factor
  var factor = Math.abs(parseFloat(expFormat[0]));
  if (neg) {
    // reverse ordering, use reciprocal
    factor = 1.0 / factor;
  }
  var factorSplit = factor.toString().split('.');
  var factorInt = factorSplit[0];
  var factorDecimal = factorSplit[1] || '0';

  result += '_' + utils.padLeft(factorInt, '0', FACTOR_DIGITS);
  result += '_' + utils.padRight(factorDecimal, '0', FACTOR_DIGITS);

  return result;
}