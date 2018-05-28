'use strict';
import path from 'path';
import {exec} from 'child_process';
import _ from 'lodash';
import s from 'underscore.string';
import Promise from 'bluebird';
import semver from 'semver';
import Generator from 'yeoman-generator';
import glob from 'glob';
import fs from 'fs';

// extend lodash with underscore.string
_.mixin(s.exports());

/**
 * Run the given command in a child process
 * @param {string} cmd - command to run
 * @returns {Promise}
 */
function runCmd(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, {}, function(err, stdout) {
      if(err) {
        console.error(stdout);
        return reject(err);
      }

      return resolve(stdout);
    });
  });
}

function appName(suffix) {
  let counter = 0;
  // Have to check this because of generator bug` #386
  process.argv.forEach(val => {
    if(val.indexOf('--app-suffix') > -1) {
      counter++;
    }
  });
  if(counter === 0 || (typeof suffix === 'boolean' && suffix)) {
    suffix = 'App';
  }
  return suffix ? _.upperFirst(_.camelCase(suffix)) : '';
}


function expandFiles(pattern, options) {
  options = options || {};
  var cwd = options.cwd || process.cwd();
  return glob.sync(pattern, options).filter(function (filepath) {
    return fs.statSync(path.join(cwd, filepath)).isFile();
  });
}

export function rewriteFile(args) {
  args.path = args.path || process.cwd();
  var fullPath = path.join(args.path, args.file);

  args.haystack = fs.readFileSync(fullPath, 'utf8');
  var body = rewrite(args);

  fs.writeFileSync(fullPath, body);
}

function escapeRegExp(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
}

export function rewrite(args) {
  // check if splicable is already in the body text
  var re = new RegExp(args.splicable.map(function(line) {
    return '\s*' + escapeRegExp(line);
  }).join('\n'));

  if (re.test(args.haystack)) {
    return args.haystack;
  }

  var lines = args.haystack.split('\n');

  var otherwiseLineIndex = -1;
  lines.forEach(function (line, i) {
    if (line.indexOf(args.needle) !== -1) {
      otherwiseLineIndex = i;
    }
  });
  if(otherwiseLineIndex === -1) return lines.join('\n');

  var spaces = 0;
  while (lines[otherwiseLineIndex].charAt(spaces) === ' ') {
    spaces += 1;
  }

  var spaceStr = '';
  while ((spaces -= 1) >= 0) {
    spaceStr += ' ';
  }

  lines.splice(otherwiseLineIndex + 1, 0, args.splicable.map(function(line) {
    return spaceStr + line;
  }).join('\n'));

  return lines.join('\n');
}

export function appSuffix(self) {
  var suffix = self.options['app-suffix'];
  return (typeof suffix === 'string') ? _.classify(suffix) : '';
}

export function relativeRequire(to, fr) {
  fr = this.destinationPath(fr || this.filePath);
  to = this.destinationPath(to);
  return path.relative(path.dirname(fr), to)
    .replace(/\\/g, '/') // convert win32 separator to posix
    .replace(/^(?!\.\.)(.*)/, './$1') // prefix non parent path with ./
    .replace(/[\/\\]index\.js$/, ''); // strip index.js suffix from path
}

function filterFile(template) {
  // Find matches for parans
  var filterMatches = template.match(/\(([^)]+)\)/g);
  var filters = [];
  if(filterMatches) {
    filterMatches.forEach(function(filter) {
      filters.push(filter.replace('(', '').replace(')', ''));
      template = template.replace(filter, '');
    });
  }

  return { name: template, filters: filters };
}

function templateIsUsable(self, filteredFile) {
  var filters = self.filters || self.config.get('filters');
  var enabledFilters = [];
  for(var key in filters) {
    if(filters[key]) enabledFilters.push(key);
  }
  var matchedFilters = _.intersection(filteredFile.filters, enabledFilters);
  // check that all filters on file are matched
  if(filteredFile.filters.length && matchedFilters.length !== filteredFile.filters.length) {
    return false;
  }
  return true;
}

export class BaseGenerator extends Generator {
  constructor(args, opts) {
    // Calling the super constructor is important so our generator is correctly set up
    super(args, opts);

    this.argument('name', { type: String, required: false });

    this.name = this.options.name;

    // this.lodash = _;

    var yoCheckPromise;

    // CI won't have yo installed
    if(!process.env.CI) {
      yoCheckPromise = runCmd('yo --version').then(stdout => {
        if(!semver.satisfies(semver.clean(stdout), '>= 1.7.1')) {
          throw new Error('ERROR: You need to update yo to at least 1.7.1 (npm i -g yo)');
        }
      });
    } else {
      yoCheckPromise = Promise.resolve();
    }

    this.appname = _.slugify(_.humanize(path.basename(process.cwd())));
    this.scriptAppName = this.config.get('moduleName') || _.camelize(this.appname) + appName(this.options['app-suffix']);

    this.cameledName = _.camelize(this.name);
    this.classedName = _.classify(this.name);
    this.kebabName = _.kebabCase(this.name);

    this.filters = this.config.get('filters');
    this.extensions = this.config.get('extensions');
    this.hasFilter = filter => this.filters.indexOf(filter) !== -1;
    this.hasExtension = ext => this.extensions.indexOf(ext) !== -1;

    this.scriptExt = this.hasExtension('ts') ? 'ts' : 'js';
    this.templateExt = this.hasExtension('pug') ? 'pug' : 'html';
    this.styleExt = this.hasExtension('sass') ? 'scss' :
      this.hasExtension('less') ? 'less' :
      this.hasExtension('stylus') ? 'styl' :
      'css';

    // dynamic assertion statements
    this.expect = () => this.hasFilter('expect') ? 'expect(' : '';
    this.to = () => this.hasFilter('expect') ? ').to' : '.should';

    if(typeof this.env.options.appPath === 'undefined') {
      try {
        this.env.options.appPath = require(path.join(process.cwd(), 'bower.json')).appPath;
      } catch(err) {}
      this.env.options.appPath = this.env.options.appPath || 'app';
    }

    this.sourceRoot(path.join(__dirname, '..', '/templates'));

    // return yoCheckPromise;
  }

  /**
   * Copy templates from `source` to `destination` whily applying name transformations
   */
  processDirectory(source, destination) {
    const root = path.isAbsolute(source) ? source : path.join(this.sourceRoot(), source);
    const files = expandFiles('**', { dot: true, cwd: root });

    for(const file of files) {
      var filteredFile = filterFile(file);

      if(this.basename) {
        filteredFile.name = filteredFile.name.replace('basename', this.basename);
      }

      if(this.name) {
        filteredFile.name = filteredFile.name.replace('name', this.name);
      }

      const name = filteredFile.name;
      let copy = false;
      let stripped;

      let src = path.join(root, file);
      let dest = path.join(destination, name);

      if(this.filters.ts && dest.indexOf('client') > -1 && dest.indexOf('.json') === -1) {
        dest = dest.replace('.js', '.ts');
      }

      if(path.basename(dest).indexOf('_') === 0) {
        stripped = path.basename(dest).replace(/^_/, '');
        dest = path.join(path.dirname(dest), stripped);
      }

      if(path.basename(dest).indexOf('!') === 0) {
        stripped = path.basename(dest).replace(/^!/, '');
        dest = path.join(path.dirname(dest), stripped);
        copy = true;
      }

      if(templateIsUsable(this, filteredFile)) {
        if(copy) {
          this.fs.copy(src, dest);
        } else {
          this.filePath = dest;
          this.fs.copyTpl(src, dest, this);
          delete this.filePath;
        }
      }
    }
  }
}
