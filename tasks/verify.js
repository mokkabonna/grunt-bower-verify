module.exports = function(grunt) {
	var bower = require('bower');
	var async = require('async');
	var colors = require('colors');
	var semver = require('semver');
	var inquirer = require('inquirer');
	var log = grunt.log.writeln;
	var verboseln = grunt.verbose.writeln;
	var logln = grunt.log.writeln;
	var _ = grunt.util._;
	var jlog = function(obj) {
		grunt.log.writeln(JSON.stringify(obj, null, 2));
	};

	grunt.registerMultiTask('bowerVerify', function(target) {
		var dependencies = grunt.file.readJSON('bower.json').dependencies;
		var endpoints = Object.keys(dependencies); //currently this does not work with other than registered packages, like urls
		var gruntTasks = this.data.tasks;
		var done = this.async();
		var remainingInfos = endpoints.length;
		var isForced = grunt.option('force');
		var isVerbose = grunt.option('verbose');
		var options = this.options({
			ignorePatch: false,
			showTasksOutput: true,
			completeOnError: true,
			onlyStandardVersions: true,
		});

		//fetch all the infos in parallel
		async.map(endpoints, getVersion, function(err, versionMatrix) {
			if (err) grunt.warn('Could not get info for some dependencies');
			verboseln('Finished fetching all infos');

			var versionedEndpoints = cleanUp(endpoints, versionMatrix, dependencies);

			var installAndRunTasks = versionedEndpoints.map(function(endpoint) {
				return function(callback) {
					install(endpoint, function(installError, data) {

						if (!installError) {
							runTasks(gruntTasks, function(verifyError, result, code) {
								var returnError = options.completeOnError ? null : verifyError;
								callback(returnError, {
									ok: code === 0,
									endpoint: endpoint,
									output: result.stdout
								});
							});
						} else {
							logln('Verifying with\t'.cyan + gruntTasks + '...' + 'CANCELLED'.red);
							var returnError = options.completeOnError ? null : installError;
							callback(returnError, {
								ok: false,
								endpoint: endpoint,
								output: data.join(grunt.util.linefeed)
							});
						}
					});
				};
			});

			async.series(installAndRunTasks, function(err, results) {
				if (err) grunt.warn('Some tasks failed');
				verboseln('Finished all bower verify iterations');

				//print summary if show task output, might be a lot
				if (options.showTasksOutput) {
					printSummary(results);
				}

				if (options.completeOnError) {
					var errors = results.filter(function(result) {
						return !result.ok;
					});

					if (errors.length) {
						//print output only if not already outputted
						if(!options.showTasksOutput) printErrors(errors);

						//fail while task
						grunt.warn('Some tasks failed');
					}
				}

			});

		});

		function printErrors(results) {
			logln();
			logln('Below are output from the failures');
			results.forEach(function(result) {
				logln();
				logln(('=== Output for ' + result.endpoint + ' ==========').cyan);
				logln(result.output);
				logln(('=== End of output for ' + result.endpoint + ' ===').cyan);
			});
		}

		function printSummary(results) {
			var passed = results.filter(function(result) {
				return result.ok;
			});

			var failed = _.difference(results, passed);

			logln('Summary'.green);

			logln(passed.length + ' passed');
			passed.forEach(function(item) {
				logln(' - ' + item.endpoint);
			});

			logln(failed.length + ' failed');
			failed.forEach(function(item) {
				logln(' - ' + item.endpoint);
			});
		}

		function runTasks(tasks, callback) {
			var opts = {};
			if (options.showTasksOutput) {
				opts.stdio = 'inherit';
				logln();
			} else {
				grunt.log.write('Verifying with \t'.cyan + tasks + '...');
			}

			grunt.util.spawn({
				grunt: true,
				args: tasks,
				opts: opts,
			}, function(err, result, code) {
				if (!options.showTasksOutput) {
					if (err) grunt.log.error();
					else grunt.log.ok();
				} else {
					logln();
				}

				callback(err, result, code);
			});
		}

		function handleInstallError(err, callback) {
			grunt.log.error();

			var code = err.code || undefined;

			var installErrors = [];
			try {
				switch (code) {
					case "ECONFLICT":
						installErrors.push('Incompatible version'.red);
						var version = err.picks[0].pkgMeta.version;
						err.picks.forEach(function(pick) {
							pick.dependants.forEach(function(dependant) {
								grunt.util._.each(dependant.pkgMeta.dependencies, function(dependantVersion, dependency) {
									if (err.name !== dependency) return; //don't print packages that isn't relevant here
									if (semver.satisfies(version, dependantVersion)) return; //don't print for dependants that are satisfied
									installErrors.push('Package ' + dependant.pkgMeta.name + ' requires ' + dependency + '#' + dependantVersion);
								});
							});
						});

						break;
					case "ENORESTARGET":
						installErrors.push('Version not available ' + err.data.endpoint.name + '#' + err.data.endpoint.target);
						break;
					default:
						installErrors.push('Unhandled error, printing error:');
						jlog(err);
				}
			} catch (e) {
				grunt.log.error(e);
			}

			callback(err, installErrors);
		}

		function handleLog(data) {
			try {
				grunt.verbose.writeln(data.id + (data.id.length < 8 ? '\t\t' : '\t') + data.message);
			} catch (e) {
				grunt.log.writeln('log data not as expected');
			}
		}


		function install(endpoint, callback) {
			grunt.log.write('Installing\t'.cyan + endpoint + '...');
			if (isVerbose) logln();

			bower.commands.install([endpoint], {
				production: true
			}).on('end', function(data) {
				grunt.log.ok();
				callback(null, data);
			}).on('error', function(err) {
				handleInstallError(err, callback);
			}).on('log', handleLog);
		}

		function cleanUp(endpoints, versionMatrix, dependencies) {
			var versionedEndpoints = [];
			endpoints.forEach(function(endpoint, index) {
				var allVersions = versionMatrix[index];
				var mustSatisfy = dependencies[endpoint];
				var cleanVersions = getMatchingVersions(allVersions, mustSatisfy);

				//ignore patch
				if (options.ignorePatch) cleanVersions = cleanPatchVersion(cleanVersions);

				_.without(allVersions, cleanVersions).forEach(function(version) {
					verboseln('Ignoring ' + endpoint + '#' + version + ' does not satisfy ' + mustSatisfy);
				});

				versionedEndpoints = versionedEndpoints.concat(cleanVersions.map(function(version) {
					var prefix = options.ignorePatch ? '~' : '';
					return endpoint + '#' + prefix + version;
				}));
			});

			return versionedEndpoints;
		}

		function getVersion(endpoint, callback) {
			verboseln('Fetching info for ' + endpoint);
			bower.commands.info(endpoint)
				.on('end', function(data) {
					verboseln('Got info for ' + endpoint);

					if(options.onlyStandardVersions){
						//remove any per releases, wish bower did this already, or at least had an option for it
						data.versions = data.versions.filter(function(version) {
							//allow only normal versions
							return version.match(/^[\d]+\.[\d]+\.[\d]+$/) !== null;
						});
					}

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
			versions.forEach(function(version, index, array) {
				//if ignoring patch remove last patch version
				version = semver.clean(version);
				array[index] = version.substr(0, version.length - 1) + '0'; //replace patch with 0
			});

			//make sure we have only unique values
			return _.uniq(versions);
		}
	});
};
