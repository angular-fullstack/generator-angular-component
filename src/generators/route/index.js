import filter from 'gulp-filter';
import fs from 'fs';
import jscodeshift, { ImportDeclaration } from 'jscodeshift';
import path from 'path';
import tap from 'gulp-tap';
import {BaseGenerator} from '../base';
import {addModule} from './module-transform';

function readFile(path) {
  return new Promise((resolve, reject) => {
    fs.readFile(path, 'utf8', (err, data) => {
      if(err) return reject(err);

      resolve(data);
    });
  });
}

function writeFile(path, source) {
  return new Promise((resolve, reject) => {
    fs.writeFile(path, source, err => {
      if(err) return reject(err);

      resolve();
    });
  });
}

class Generator extends BaseGenerator {
  prompting() {
    var prompts = [{
      name: 'dir',
      message: 'Where would you like to create this route?',
      default: this.config.get('routeDirectory'),
    }, {
      name: 'route',
      message: 'What will the url of your route be?',
      default: `${this.name}`,
    }];

    return this.prompt(prompts).then(props => {
      this.route = props.route;
      this.dir = path.join(props.dir, this.name);
    });
  }

  async writing() {
    this.sourceRoot(path.join(__dirname, '../../templates/route'));
    this.processDirectory('.', this.dir);

    const appModulePath = this.config.get('appModulePath');

    const appModuleFolder = appModulePath.substring(0, appModulePath.lastIndexOf('/'));
    const newModuleFilePath = path.normalize(`${this.dir}/${this.name}.module`);

    const relativeModulePath = `./${path.normalize(path.relative(appModuleFolder, newModuleFilePath))}`
      .replace(/\\/g, '/');

    let source = await readFile(appModulePath);

    source = addModule(source, `${this.classedName}Module`, relativeModulePath);

    // FIXME: Bug in jscodeshift/recast removing `@` from modified `NgModule` decorator
    source = source.replace(/\nNgModule/, '\n@NgModule');

    await writeFile(appModulePath, source);
  }
}

module.exports = Generator;
