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
		var infosFetched = 0;
		var done = this.async();

		endpoints.forEach(function(endpoint) {
			var mustSatisfy = dependencies[endpoint];
			bower.commands.info(endpoint)
				.on('end', function(data) {
					data.versions.forEach(function(version) {
						//Skip versions that does not satisfy the bower.json version
						if (!semver.satisfies(version, mustSatisfy)) {
							grunt.verbose.writeln('Ignoring '.cyan + version.yellow + ' does not satisfy '.cyan + mustSatisfy.yellow);
							return;
						}

						grunt.task.run('bower-verify-install:' + endpoint + ':' + version);
						grunt.task.run(gruntTasks);
					});

					//if this is the last endpoint info to be fetched, then do a normal bower install
					infosFetched++;
					if (infosFetched === endpoints.length) {
						endpoints.forEach(function(endpoint) {
							grunt.task.run('bower-verify-install:' + endpoint);
						});
						done();
					}
				}).on('error', function() {
					//TODO:better handling of this
					log('Error occured during fetching of info');
				});

		});
	});
};
