/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { MergeConflictParser } from './mergeConflictParser';
import * as interfaces from './interfaces';
import { Delayer } from './delayer';

class ScanTask {
  public origins: Set<string> = new Set<string>();
  public delayTask: Delayer<interfaces.IDocumentMergeConflict[]>;

  constructor(delayTime: number, initialOrigin: string) {
    this.origins.add(initialOrigin);
    this.delayTask = new Delayer<interfaces.IDocumentMergeConflict[]>(delayTime);
  }

  public addOrigin(name: string): boolean {
    if (this.origins.has(name)) {
      return false;
    }

    return false;
  }

  public hasOrigin(name: string): boolean {
    return this.origins.has(name);
  }
}

class OriginDocumentMergeConflictTracker implements interfaces.IDocumentMergeConflictTracker {
  constructor(private parent: DocumentMergeConflictTracker, private origin: string) {
  }

  getConflicts(document: vscode.TextDocument): PromiseLike<interfaces.IDocumentMergeConflict[]> {
    return this.parent.getConflicts(document, this.origin);
  }

  isPending(document: vscode.TextDocument): boolean {
    return this.parent.isPending(document, this.origin);
  }

  forget(document: vscode.TextDocument) {
    this.parent.forget(document);
  }
}

export default class DocumentMergeConflictTracker implements vscode.Disposable, interfaces.IDocumentMergeConflictTrackerService {
  private cache: Map<string, ScanTask> = new Map();
  private delayExpireTime: number = 0;

  getConflicts(document: vscode.TextDocument, origin: string): PromiseLike<interfaces.IDocumentMergeConflict[]> {
    // Attempt from cache

    let key = this.getCacheKey(document);

    if (!key) {
      // Document doesn't have a uri, can't cache it, so return
      return Promise.resolve(this.getConflictsOrEmpty(document, [origin]));
    }

    let cacheItem = this.cache.get(key);
    if (!cacheItem) {
      cacheItem = new ScanTask(this.delayExpireTime, origin);
      this.cache.set(key, cacheItem);
    }
    else {
      cacheItem.addOrigin(origin);
    }

    return cacheItem.delayTask.trigger(() => {
      let conflicts = this.getConflictsOrEmpty(document, Array.from(cacheItem!.origins));

      if (this.cache) {
        this.cache.delete(key!);
      }

      return conflicts;
    });
  }

  isPending(document: vscode.TextDocument, origin: string) {
    if (!document) return false

    const key = this.getCacheKey(document);
    if (!key) return false

    return !!this.cache.get(key)?.hasOrigin(origin)
  }

  createTracker(origin: string) {
    return new OriginDocumentMergeConflictTracker(this, origin);
  }

  forget(document: vscode.TextDocument) {
    const key = this.getCacheKey(document);
    if (key) this.cache.delete(key)
  }

  dispose() {
    this.cache.clear()
  }

  private getConflictsOrEmpty(document: vscode.TextDocument, _origins: string[]): interfaces.IDocumentMergeConflict[] {
    return MergeConflictParser.containsConflict(document) ? MergeConflictParser.scanDocument(document) : []
  }

  private getCacheKey(document: vscode.TextDocument) {
    return document.uri ? document.uri.toString() : null
  }
}

