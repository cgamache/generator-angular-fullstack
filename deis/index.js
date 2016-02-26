'use strict';
var util = require('util');
var yeoman = require('yeoman-generator');
var exec = require('child_process').exec;
var chalk = require('chalk');
var path = require('path');
var s = require('underscore.string');

var Generator = module.exports = function Generator() {
  yeoman.generators.Base.apply(this, arguments);
  this.sourceRoot(path.join(__dirname, './templates'));

  try {
    this.appname = require(path.join(process.cwd(), 'bower.json')).name;
  } catch (e) {
    this.appname = path.basename(process.cwd());
  }
  this.appname = s.slugify(this.appname);
  this.filters = this.config.get('filters') || {};
};

util.inherits(Generator, yeoman.generators.NamedBase);

Generator.prototype.askForName = function askForName() {
  var done = this.async();

  var prompts = [{
    name: 'deployedName',
    message: 'Name to deploy as (Leave blank for a random name):'
  }];

  this.prompt(prompts, function (props) {
    this.deployedName = s.slugify(props.deployedName);
    done();
  }.bind(this));
};

Generator.prototype.checkInstallation = function checkInstallation() {
  if(this.abort) return;
  var done = this.async();

  exec('deis --version', function (err) {
    if (err) {
      this.log.error('You don\'t have the Deis cli installed. ' +
                     'Grab it from here http://docs.deis.io/en/latest/using_deis/install-client/ ');
      this.abort = true;
    }
    done();
  }.bind(this));
};

Generator.prototype.gitInit = function gitInit() {
  if(this.abort) return;
  var done = this.async();

  this.log(chalk.bold('\nInitializing deployment repo'));
  this.mkdir('dist');
  var child = exec('git init', { cwd: 'dist' }, function (err, stdout, stderr) {
    done();
  }.bind(this));
  child.stdout.on('data', function(data) {
    console.log(data.toString());
  });
};

Generator.prototype.deisCreate = function deisCreate() {
  if(this.abort) return;
  var done = this.async();

  this.log(chalk.bold('Creating deis app and setting node environment'));
  var child = exec('deis apps:create ' + this.deployedName + ' && deis config:set NODE_ENV=production', { cwd: 'dist' }, function (err, stdout, stderr) {
    if (err) {
      this.abort = true;
      this.log.error(err);
    } else {
      this.log('stdout: ' + stdout);
    }
    done();
  }.bind(this));

  child.stdout.on('data', function(data) {
    var output = data.toString();
    this.log(output);
  }.bind(this));
};

Generator.prototype.copyProcfile = function copyProcfile() {
  if(this.abort) return;
  var done = this.async();
  this.log(chalk.bold('Creating Procfile'));
  this.copy('Procfile', 'dist/Procfile');
  this.conflicter.resolve(function (err) {
    done();
  });
};

Generator.prototype.gruntBuild = function gruntBuild() {
  if(this.abort) return;
  var done = this.async();

  this.log(chalk.bold('\nBuilding dist folder, please wait...'));
  var child = exec('grunt build', function (err, stdout) {
    done();
  }.bind(this));
  child.stdout.on('data', function(data) {
    this.log(data.toString());
  }.bind(this));
};

Generator.prototype.gitCommit = function gitInit() {
  if(this.abort) return;
  var done = this.async();

  this.log(chalk.bold('Adding files for initial commit'));
  var child = exec('git add -A && git commit -m "Initial commit"', { cwd: 'dist' }, function (err, stdout, stderr) {
    if (stdout.search('nothing to commit') >= 0) {
      this.log('Re-pushing the existing "dist" build...');
    } else if (err) {
      this.log.error(err);
    } else {
      this.log(chalk.green('Done, without errors.'));
    }
    done();
  }.bind(this));

  child.stdout.on('data', function(data) {
    this.log(data.toString());
  }.bind(this));
};

Generator.prototype.gitForcePush = function gitForcePush() {
  if(this.abort) return;
  var done = this.async();

  this.log(chalk.bold("\nUploading your initial application code.\n This may take "+chalk.cyan('several minutes')+" depending on your connection speed..."));

  var child = exec('git push -f deis master', { cwd: 'dist' }, function (err, stdout, stderr) {
    if (err) {
      this.log.error(err);
    } else {
      var hasWarning = false;

      if(this.filters.mongoose) {
        this.log(chalk.yellow('\nBecause you\'re using mongoose, you must specify a mongodb URL.\n\t' + 'from `/dist`: ' + chalk.bold('deis config:set MONGOLAB_URI=mongodb://path/to/mongo') + '\n'));
        hasWarning = true;
      }

      if(this.filters.facebookAuth) {
        this.log(chalk.yellow('You will need to set environment variables for facebook auth. From `/dist`:\n\t' +
        chalk.bold('deis config:set FACEBOOK_ID=appId\n\t') +
        chalk.bold('deis config:set FACEBOOK_SECRET=secret\n')));
        hasWarning = true;
      }
      if(this.filters.googleAuth) {
        this.log(chalk.yellow('You will need to set environment variables for google auth. From `/dist`:\n\t' +
        chalk.bold('deis config:set GOOGLE_ID=appId\n\t') +
        chalk.bold('deis config:set GOOGLE_SECRET=secret\n')));
        hasWarning = true;
      }
      if(this.filters.twitterAuth) {
        this.log(chalk.yellow('You will need to set environment variables for twitter auth. From `/dist`:\n\t' +
        chalk.bold('deis config:set TWITTER_ID=appId\n\t') +
        chalk.bold('deis config:set TWITTER_SECRET=secret\n')));
        hasWarning = true;
      }

      this.log(chalk.green('\nYour app should now be live. To view it run\n\t' + chalk.bold('cd dist && deis open')));
      if(hasWarning) {
        this.log(chalk.green('\nYou may need to address the issues mentioned above and restart the server for the app to work correctly.'));
      }

      this.log(chalk.yellow('After app modification run\n\t' + chalk.bold('grunt build') +
      '\nThen deploy with\n\t' + chalk.bold('grunt buildcontrol:deis')));
    }
    done();
  }.bind(this));

  child.stdout.on('data', function(data) {
    this.log(data.toString());
  }.bind(this));
};
