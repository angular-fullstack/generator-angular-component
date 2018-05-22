import path from 'path';
import {BaseGenerator} from '../base';
import {relativeUrl, copyTemplates} from '../util';

class Generator extends BaseGenerator {
  prompting() {
    var prompts = [{
      name: 'moduleName',
      message: 'What module name would you like to use?',
      default: `${this.scriptAppName}.${this.name}`,
      when: () => this.config.get('modulePrompt')
    }, {
      name: 'dir',
      message: 'Where would you like to create this route?',
      default: this.config.get('routeDirectory')
    }, {
      name: 'route',
      message: 'What will the url of your route be?',
      default: `/${this.name}`
    }];

    return this.prompt(prompts).then(props => {
      this.scriptAppName = props.moduleName || this.scriptAppName;
      this.route = props.route;
      this.dir = path.join(props.dir, this.name);
    });
  }

  writing() {
    var basePath = this.config.get('basePath') || '';
    this.htmlUrl = relativeUrl(basePath, path.join(this.dir, `${this.name}.${this.templateExt}`));
    copyTemplates(this, 'route');
  }

  end() {
    this.log(`
In the parent of this component, you should now import this component and add it as a dependency:
    import ${this.classedName}Component from './${this.name}/${this.name}.component';
    ...
    export angular.module('myParentModule', [${this.classedName}Component]);`);
  }
}

module.exports = Generator;
