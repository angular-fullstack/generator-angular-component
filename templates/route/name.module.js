import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { <%= classedName %>Component } from './<%= name %>.component';

export const ROUTES/*: Routes*/ = [
    { path: '<%= route %>', component: <%= classedName %>Component },
];


@NgModule({
    imports: [
        RouterModule.forChild(ROUTES),
    ],
    declarations: [
        <%= classedName %>Component,
    ],
    exports: [
        <%= classedName %>Component,
    ],
})
export class <%= classedName %>Module {}
