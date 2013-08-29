'use strict';

module.exports = function(grunt) {

	// Project configuration.
	grunt.initConfig({
		mochaTest: {
			test: {
				options: {
					reporter: 'spec'
				},
				src: ['test/**/*.js']
			}
		},
		jshint: {
			tasks: {
				src: ['tasks/**/*.js'],
			},
			tests: {
				src: ['test/**/*.js'],
			}

		},
		"bower-verify": {
			test: {
				tasks: ['jshint:tasks']
			}
		},
		watch: {
			develop: {
				files: ['**/*.js', 'bower.json'],
				tasks: ['bower-verify'],
			}
		}
	});

	grunt.loadTasks('tasks');

	// These plugins provide necessary tasks.
	grunt.loadNpmTasks('grunt-mocha-test');
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-watch');

	// Whenever the "test" task is run, first clean the "tmp" dir, then run this
	// plugin's task(s), then test the result.
	grunt.registerTask('test', ['mochaTest']);
	grunt.registerTask('develop', ['watch:develop']);

};
