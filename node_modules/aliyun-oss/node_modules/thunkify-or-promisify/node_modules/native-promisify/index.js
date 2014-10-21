'use strict';

var assert = require('assert'),
  slice = [].slice;

module.exports = function(fn) {
  assert('function' == typeof fn, 'function required');

  return function() {
    var args = slice.call(arguments),
      ctx = this;

    var p = new Promise(function(resolve, reject) {
      args.push(function(error, result) {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });

      fn.apply(ctx, args);
    });

    return p;
  };
};
