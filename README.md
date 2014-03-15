# grunt-bower-verify

> Prove your bower.json don't lie. Install and test all your dependencies versions.


## Getting Started
This plugin requires Grunt `~0.4.0`

If you haven't used [Grunt](http://gruntjs.com/) before, be sure to check out the [Getting Started](http://gruntjs.com/getting-started) guide, as it explains how to create a [Gruntfile](http://gruntjs.com/sample-gruntfile) as well as install and use Grunt plugins. Once you're familiar with that process, you may install this plugin with this command:

```shell
npm install grunt-bower-verify --save-dev
```

Once the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

```js
grunt.loadNpmTasks('grunt-bower-verify');
```

## Bower verify task
_Run this task with the `grunt bower-verify` command._


### Options

#### ignorePatch
Type: `Boolean`
Default value: `false`

This will only install the latest patch version of the major/minor version.

#### onlyStandardVersions
Type: `Boolean`
Default value: `true`

This will only install versions that match `/^[\d]+\.[\d]+\.[\d]+$/`. So only `x.y.z`. This means pre-release versions and versions containing build info is ignored. These versions do easily cause problems, so this option is on by default.

#### showTasksOutput
Type: `Boolean`
Default value: `true`

If false it will just show one line with OK or ERROR at the end depending on if the tasks failed or not.

#### completeOnError
Type: `Boolean`
Default value: `true`

Completes all versions before failimg if an error.



### Configuring

This is a multitask so you can specify your own targets

```js
bowerVerify: {
	targetname: {
		tasks: ['test'] //some task or tasks of your choice to be run after each bower install
	}
},
```


### Example cases

You can find out if your bower.json config really is valid, by automatically installing all published version that matches the [semver](http://semver.org/) your described.

Say you have the following bower.json file

```js
{
  "name": "my-jquery-plugin",
  "dependencies": {
    "jquery": ">=1.6.0"
  }
}
```

Running ```grunt bower-verify:test``` will first fetch all versions available for jquery.

Then if the version satisfies the [semver](http://semver.org/) you have in your bower config it will try to install that version and then run
the tasks that you have defined in your target. Typically this will be tests, a build process or similar.

This allows you to verify that your bower package actually supports all the versions that it claims that it supports. This could be handy to be run in a CI environment especially.

Say you claim that your support jquery >=1.6.0 like above. But if you run a normal bower install it will install the latest version probably.

Let's further assume you have started
using the [on](http://api.jquery.com/on/) function for events that got introduced in 1.7. Running bower-verify would easily allow you to discover that either you will have to change your supported version of jquery to >=1.7 or stop using the [on](http://api.jquery.com/on/) function.


#### Multiple dependencies

If you have multiple dependencies, say underscore >=1.3 and jquery >=1.6 then it will first install all versions of one of them and then all versions of all the other.

It might be added in the future to do all combinations of the two. However this might result in many many combinations.


#### Colliding sub dependencies

Since bower uses a flat dependency tree it might occur that if you install let's say bootstrap 2.3.2, that requires jquery [>=1.8.0 <2.1.0](https://github.com/twbs/bootstrap/blob/v2.3.2/bower.json#L6)

But if your own bower.json contains >=1.6 it will still try to install 1.6.x and 1.7.x and >=2.1.0. bower-verify will then report that these versions was not installed due to the conflict with bootstrap.

This information could be used by you to update your main bower.json config accordingly.
