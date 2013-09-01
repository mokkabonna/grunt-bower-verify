module.exports = function(grunt) {
	var bower = require('bower');
	var async = require('async');
	var colors = require('colors');
	var semver = require('semver');
	var inquirer = require('inquirer');
	var log = grunt.log.writeln;
	var verboseln = grunt.verbose.writeln;
	var logln = grunt.log.writeln;

	var jlog = function(obj) {
		grunt.log.writeln(JSON.stringify(obj, null, 2));
	};

	grunt.registerTask('bower-verify-install', function(endpoint, version) {
		var done = this.async();
		var name = (endpoint + (version ? '#' + version : '')).yellow;

		grunt.verbose.writeln('Installing\t'.cyan + name);

		var isVerbose = grunt.option('verbose');

		//install package
		bower.commands.install([endpoint + (version ? '#' + version : '')], {
			production: true,
			verbose: isVerbose
		}).on('end', handleInstallEnd).on('error', handleInstallError).on('log', handleLog);

		function handleLog(data) {
			try {
				grunt.verbose.writeln(data.id.cyan + (data.id.length < 7 ? '\t\t' : '\t') + data.message.yellow);
			} catch (e) {
				grunt.log.writeln('log data not as expected');
			}
		}

		function handleInstallEnd(packages) {
			try {
				if (!Object.keys(packages).length) log('Installed\t'.cyan + name);

				grunt.util._.each(packages, function(package) {
					log('Installed\t'.cyan + (package.pkgMeta.name + '#' + package.pkgMeta.version).yellow);
				});
			} catch (e) {
				log('Install data not as expected.');
			}

			done();
		}

		function handleInstallError(err) {
			try {
				if (err.code === 'ECONFLICT') log('Incompatible version '.red + name);

				err.picks.forEach(function(pick) {
					pick.dependants.forEach(function(dependant) {
						grunt.util._.each(dependant.pkgMeta.dependencies, function(dependantVersion, dependency) {
							if (err.name !== dependency) return; //don't print packages that isn't relevant here
							if (semver.satisfies(version, dependantVersion)) return; //don't print for dependants that are satisfied
							log('Package '.cyan + dependant.pkgMeta.name.yellow + ' requires '.green + (dependency + '#' + dependantVersion).yellow);
						});
					});
				});

			} catch (e) {
				log('Error data not as expected.');
			}

			done();
		}
	});


	grunt.registerMultiTask('bower-verify', function(target) {
		var dependencies = grunt.file.readJSON('bower.json').dependencies;
		var endpoints = Object.keys(dependencies); //currently this does not work with other than registered packages, like urls
		var gruntTasks = this.data.tasks;
		var done = this.async();
		var remainingInfos = endpoints.length;
		var options = this.options({
			ignorePatch: false
		});

		//fetch all the infos in parallel
		async.map(endpoints, getVersion, function(err, versionMatrix) {
			if (err) grunt.warn('Could not get info for some dependencies');
			verboseln('Finished fetching all infos');

			var versionedEndpoints = [];

			//clean up
			endpoints.forEach(function(endpoint, index) {
				var cleanVersions = getMatchingVersions(versionMatrix[index], dependencies[endpoint]);
				versionedEndpoints = versionedEndpoints.concat(cleanVersions.map(function(version) {
					return endpoint + '#' + version;
				}));
			});



			async.series(versionedEndpoints.map(install), function(err, results) {
				if (err) grunt.warn('Could not install some dependencies');
				verboseln('finished installing all');
				jlog(results);
			});

			//verboseln('Ignoring '.cyan + (endpoint + '#' + version).yellow + ' does not satisfy '.cyan + mustSatisfy.yellow);
		});

	});

	function install(endpoint) {
		return function(callback){
			bower.commands.install([endpoint], {
				production: true
			}).on('end', function(data) {
				verboseln('Installed ' +  endpoint);
				callback(null, data);
			});
		}
	}

	function getVersion(endpoint, callback) {
		verboseln('Fetching info for ' + endpoint);
		bower.commands.info(endpoint)
			.on('end', function(data) {
				verboseln('Got info for ' + endpoint);
				callback(null, data.versions);
			}).on('error', function(error) {
				//TODO:better handling of this
				verboseln('Error occured during fetching of info');
				callback(error);
			});
	}

	function getMatchingVersions(versions, mustSatisfy) {
		return versions.filter(function(version) {
			//Skip versions that does not satisfy the bower.json version
			if (!semver.satisfies(version, mustSatisfy)) {
				return false;
			}
			return true;
		});
	}



	function cleanPatchVersion(versions) {
		if (options.ignorePatch) {
			versions.forEach(function(version, index, array) {
				//if ignoring patch remove last patch version
				version = semver.clean(version);
				array[index] = version.substr(0, version.length - 1) + '0'; //replace patch with 0
			});

			//make sure we have only unique values
			versions = grunt.util._.uniq(versions);
		}

		return versions;
	}
};
