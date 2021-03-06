import {createWriteStream, access} from 'fs';

// https://stackoverflow.com/questions/58384179/syntaxerror-cannot-use-import-statement-outside-a-module


import os from 'os';
import path from 'path';
import _mkdir from 'mkdirp';
import homePath from 'home-path';
import mv from 'mv';
import pify from 'pify';
import _debug from 'debug';
// import _npmrc from 'rc';
import _Promise from 'pinkie-promise';
import request from 'request';
import regeneratorRuntime from 'regenerator-runtime'; // eslint-disable-line no-unused-vars

const Promise = global.Promise || _Promise;
const debug = _debug('libui-download');
// const npmrc = _npmrc('npm');
const mkdir = pify(_mkdir, Promise);

const pathExists = fp => new Promise(resolve => {
	access(fp, err => {
		resolve(!err);
	});
});

function nodePlatformToOS(arch) {
	switch (arch) {
		case 'darwin': return 'osx';
		case 'win32': return 'windows';
		case 'linux': return 'linux';
		default: throw new Error('Unknown platform ' + arch);
	}
}

function cacheDir(opts = {}) {
	var homeDir = homePath();
	return opts.cache || path.join(homeDir, './.libui');
}

async function mkCacheDir(cache) {
	try {
		await mkdir(cache);
		return cache;
	} catch (err) {
		if (err.code !== 'EACCES') {
			debug('mkCacheDir error: ', err.stack);
			throw err;
		}

		// try local folder if homedir is off limits (e.g. some linuxes return '/' as homedir)
		var localCache = path.resolve('./.libui');

		await mkdir(localCache);
		return localCache;
	}
}

function buildUrl(opts, filename) {
	var url = process.env.NPM_CONFIG_LIBUI_MIRROR ||
		process.env.LIBUI_MIRROR ||
		opts.mirror ||
		'https://github.com/parro-it/libui/releases/download/';

	url += process.env.LIBUI_CUSTOM_DIR || opts.customDir || opts.version;
	url += '/';
	url += process.env.LIBUI_CUSTOM_FILENAME || opts.customFilename || filename;
	return url;
}

async function download(opts) {
	var platform = nodePlatformToOS(opts.platform || os.platform());
	var arch = opts.arch || os.arch();
	var version = opts.version;
	var symbols = opts.symbols || false;
	var filename = 'libui-shared-' + platform + '-' + arch + '-' + version + (symbols ? '-symbols' : '') + '.tar.gz';

	if (!version) {
		throw new Error('must specify version');
	}
	const url = buildUrl(opts, filename);
	var cache = cacheDir(opts.cache);

/*
	var strictSSL = true;
	if (opts.strictSSL === false || npmrc['strict-ssl'] === false) {
		strictSSL = false;
	}

	var proxy;

	if (npmrc && npmrc.proxy) {
		proxy = npmrc.proxy;
	}

	if (npmrc && npmrc['https-proxy']) {
		proxy = npmrc['https-proxy'];
	}
*/
	debug('info', {cache: cache, filename: filename, url: url});

	var cachedZip = path.join(cache, filename);
	const exists = await pathExists(cachedZip);

	if (exists) {
		debug('zip exists', cachedZip);
		return cachedZip;
	}

	debug('creating cache/tmp dirs');

	// otherwise download it
	const actualCache = await mkCacheDir(cache);
	cachedZip = path.join(actualCache, filename); // in case cache dir changed

	// download to tmpdir
	var tmpdir = path.join(
		os.tmpdir(),
		'libui-tmp-download-' + process.pid + '-' + Date.now()
	);

	await mkdir(tmpdir);
	debug(tmpdir + 'created');

	debug('downloading zip', url, 'to', tmpdir);

	const target = path.join(tmpdir, filename);

	return await new Promise((resolve, reject) => {
		const res = request(url);

		const finish = () => {
			debug('end stream reached', target, cachedZip);
			mv(target, cachedZip, function (err) {
				if (err) {
					reject(err);
				} else {
					resolve(cachedZip);
				}
			});
		};

		res.on('response', resp => {
			debug(resp.statusCode);
			if (resp.statusCode === 404) {
				return reject(new Error(`Failed to find libui ${version} for ${opts.platform || os.platform()}-${arch} at ${url}`));
			}
			const fileWrite = res.pipe(createWriteStream(target));

			fileWrite.on('finish', finish);
			fileWrite.on('error', reject);
		});
	});
}

download.pathExists = pathExists;
download.cacheDir = cacheDir;
//module.exports = download;
export default download = download;
