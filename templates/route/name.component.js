import { Component } from '@angular/core';

@Component({
    selector: '<%= cameledName %>',
    template: require('./<%= name %>.html'),
    // styles: [require('./<%= name %>.css')],
})
export class <%= classedName %>Component {
    message/*: string*/;

    static parameters = [];
    constructor() {
        this.message = 'hello';
    }
}
