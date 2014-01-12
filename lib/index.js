'use strict';

var MAX_LENGTH_INDEXABLE_STRING = 64;

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

  var idx = collationIndex(key);
  var result = idx.toString();

  function intToIndexableString(int) {

    var maxLen = (MAX_LENGTH_INDEXABLE_STRING / 2) - 2;

    var neg = key < 0;
    var numAsString = neg ? utils.intToBase64(utils.maxInt + key) : utils.intToBase64(key);
    numAsString = utils.padLeft(numAsString, '=', maxLen);
    return numAsString;
  }

  if (key === null) {
    return result;
  } else if (typeof key === 'boolean') {
    return result + (key ? 1 : 0);
  } else if (typeof key === 'number') {
    var floor = key < 0 ? Math.ceil(key) : Math.floor(key);

    // TODO: this is dumb
    var keyAsString = key.toString();
    var decimalIdx = keyAsString.indexOf('.');
    var decimalAsString = keyAsString.substring(decimalIdx + 1);
    var decimal = (decimalIdx !== -1) ? parseInt(utils.reverse(decimalAsString), 10) : 0;

    result += key < 0 ? '00' : '01';
    return result + intToIndexableString(floor) + intToIndexableString(decimal);
  } else if (typeof key === 'string') {
    var base64 = utils.btoa(key);
    base64 = utils.padRight(base64, '=', MAX_LENGTH_INDEXABLE_STRING);
    result += base64;
  } else if (Array.isArray(key)) {
    key.forEach(function (element) {
      result += exports.toIndexableString(element);
    });
    return result;
  } else if (typeof key === 'object') {
    // TODO
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