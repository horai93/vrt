"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var chalk = require('chalk');
var _default = exports.default = {
  info(text) {
    console.log(chalk.cyan(text));
  },
  warn(text) {
    console.log(chalk.gray(text));
  },
  success(text) {
    console.log(chalk.green(text));
  },
  fail(text) {
    console.log(chalk.red(text));
  }
};