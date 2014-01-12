'use strict';

if (process) {
  exports.btoa = require('btoa');
} else {
  exports.btoa = function (str) {
    return btoa(str);
  };
}

function pad(str, padWith, upToLength) {
  var padding = '';
  var targetLength = upToLength - str.length;
  while (padding.length < targetLength) {
    padding += padWith;
  }
  return padding;
}

exports.padLeft = function (str, padWith, upToLength) {
  var padding = pad(str, padWith, upToLength);
  return padding + str;
};

exports.padRight = function (str, padWith, upToLength) {
  var padding = pad(str, padWith, upToLength);
  return str + padding;
};

exports.reverse = function (str) {
  var result = '';
  for (var i = str.length - 1; i >= 0; i--) {
    result += str.charAt(i);
  }
  return result;
};

var base64Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
var mapping = {};
for (var i = 0, len = base64Alphabet.length; i < len; i++) {
  mapping[base64Alphabet[i]] = i;
}
exports.base64Compare = function (a, b) {

  var aLen = a.length;
  var bLen = b.length;

  var i;
  for (i = 0; i < aLen; i++) {
    if (i === bLen) {
      // b is shorter substring of a
      return 1;
    }
    var aIdx = mapping[a.charAt(i)] || -1;
    var bIdx = mapping[b.charAt(i)] || -1;
    if (aIdx !== bIdx) {
      return aIdx < bIdx ? -1 : 1;
    }
  }

  if (aLen < bLen) {
    // a is shorter substring of b
    return -1;
  }

  return 0;
};

exports.intToBase64 = function (int) {

  var result = '';

  while (1) {
    var remainder = int % 64;

    if (remainder === 0 && result) {
      break;
    }

    result = base64Alphabet.charAt(remainder) + result;
    int = Math.floor(int / 64);
  }

  return result;
};


// max value from which we can reliably do
// floating point subtraction
// TODO: be smarter about this
exports.maxInt = 4294967295;