module.exports = function(grunt) {
	var bower = require('bower');
	var colors = require('colors');
	var semver = require('semver');
	var inquirer = require('inquirer');
	var log = grunt.log.writeln;

	grunt.registerTask('bower-verify-install', function(endpoint, version) {
		var done = this.async();
		var name = (endpoint + (version ? '#' + version : '')).yellow;

		grunt.verbose.writeln('Installing\t'.cyan + name);

		//install package
		bower.commands.install([endpoint + (version ? '#' + version : '')], {
			production: true
		}).on('end', handleInstallEnd).on('error', handleInstallError);

		function handleInstallEnd(packages) {
			if (!Object.keys(packages).length) log('Installed\t'.cyan + name);

			grunt.util._.each(packages, function(package) {
				log('Installed\t'.cyan + (package.pkgMeta.name + '#' + package.pkgMeta.version).yellow);
			});

			done();
		}

		function handleInstallError(err) {
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



		endpoints.forEach(function(endpoint) {
			var mustSatisfy = dependencies[endpoint];
			bower.commands.info(endpoint)
				.on('end', function(data) {

					var versions = data.versions.filter(function(version) {
						//Skip versions that does not satisfy the bower.json version
						if (!semver.satisfies(version, mustSatisfy)) {
							grunt.verbose.writeln('Ignoring '.cyan + version.yellow + ' does not satisfy '.cyan + mustSatisfy.yellow);
							return false;
						}
						return true;
					});

					versions = cleanPatchVersion(versions);

					versions.forEach(function(version) {

						//prefix it with ~ after we have done the semver check
						if (options.ignorePatch) version = '~' + version;

						grunt.task.run('bower-verify-install:' + endpoint + ':' + version);
						grunt.task.run(gruntTasks);
					});

					remainingInfos--;
					if (!remainingInfos) done();
				}).on('error', function() {
					//TODO:better handling of this
					grunt.warn('Error occured during fetching of info');
				});

		});
	});
};
