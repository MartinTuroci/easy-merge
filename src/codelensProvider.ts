/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode"
import * as interfaces from "./interfaces"
import ContentProvider from './contentProvider'
import store from "./store"

export default class MergeConflictCodeLensProvider implements vscode.CodeLensProvider, vscode.Disposable {
  private codeLensRegistrationHandle?: vscode.Disposable | null
  private config?: interfaces.IExtensionConfiguration
  private tracker: interfaces.IDocumentMergeConflictTracker

  constructor(trackerService: interfaces.IDocumentMergeConflictTrackerService) {
    this.tracker = trackerService.createTracker("codelens")
  }

  begin(config: interfaces.IExtensionConfiguration) {
    this.config = config
    if (this.config.enableCodeLens) this.registerCodeLensProvider()
  }

  configurationUpdated(updatedConfig: interfaces.IExtensionConfiguration) {
    if (
      updatedConfig.enableCodeLens === false &&
      this.codeLensRegistrationHandle
    ) {
      this.codeLensRegistrationHandle.dispose()
      this.codeLensRegistrationHandle = null
    } else if (
      updatedConfig.enableCodeLens === true &&
      !this.codeLensRegistrationHandle
    ) {
      this.registerCodeLensProvider()
    }

    this.config = updatedConfig
  }

  dispose() {
    if (this.codeLensRegistrationHandle) {
      this.codeLensRegistrationHandle.dispose()
      this.codeLensRegistrationHandle = null
    }
  }

  async provideCodeLenses(document: vscode.TextDocument, _token: vscode.CancellationToken): Promise<vscode.CodeLens[] | null> {
    if (!this.config || !this.config.enableCodeLens) return null

    const visibleEditors = store.getEditors()
    if (visibleEditors.length === 3 && visibleEditors.every(e => e?.document.fileName === document.fileName)) {
      const [_, mergeEditor] = visibleEditors
      const conflicts = await this.tracker.getConflicts(mergeEditor!.document)
      const isCurrent = document.uri.scheme === ContentProvider.schemeCurrent
      return conflicts.map(conflict => new vscode.CodeLens(
        // TODO: Offset based on breadcrumbs.
        new vscode.Range(conflict.range.start.translate(1, 0), conflict.range.end), {
        command: 'simple-merge.accept',
        title: isCurrent ? '>>' : '<<',
        arguments: [conflict, isCurrent ? interfaces.CommitType.Current : interfaces.CommitType.Incoming],
      }))
    }

    return null
  }

  private registerCodeLensProvider() {
    this.codeLensRegistrationHandle = vscode.languages.registerCodeLensProvider(
      [
        { scheme: ContentProvider.schemeCurrent },
        { scheme: ContentProvider.schemeIncoming },
      ],
      this
    )
  }
}
