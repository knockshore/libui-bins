#!/usr/bin/env node

// https://stackoverflow.com/questions/31931614/require-is-not-defined-node-js
// https://nodejs.org/api/modules.html#modules_module_createrequire_filename

// import { createRequire } from 'module';
// const require = createRequire(import.meta.url);

import tar from 'tar';
import download from './index.js';

// var tar = require('tar');
// var download = require('./');

download({version: process.argv[2] || process.env.npm_package_libui})
	.then(function (zipPath) {
		console.log('Downloaded zip:', zipPath);
		return tar.extract({file: zipPath});
	})
	.then(function () {
		console.log('Libui binaries extracted to:', process.cwd());
	})
	.catch(function (err) {
		console.error(err.stack);
		process.exit(1);
	});

