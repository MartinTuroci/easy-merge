/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode"
import Services from "./services"


export function activate(context: vscode.ExtensionContext) {
  const services = new Services(context)
  services.begin()
  context.subscriptions.push(services)
}

export function deactivate() { }