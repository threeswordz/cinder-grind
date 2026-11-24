import type { CloseoutPreparation, ProjectCloseout } from '../api/projects';

export type CloseoutDraft = CloseoutPreparation & { revisionReason: string };
export type CloseoutEditor = {
  projectId: string;
  fingerprint: string | null;
  version: number;
  baseline: CloseoutDraft;
  draft: CloseoutDraft;
};

// Compare every editable value, independent of response object property order.
// Revision reason describes the NEXT revision, not the persisted prior reason.
const identity = (draft: CloseoutDraft) => JSON.stringify([
  draft.checklist.map(row => [row.category,row.state,row.evidenceNote,row.evidenceReference]),
  draft.outstandingItems.map(row => [row.category,row.description,row.reason,row.ownerUserId,
    row.dueDate,row.remainingAmount,row.remainingQuantity,row.quantityUom,row.notQuantifiableReason]),
  draft.overallNote,draft.revisionReason,
]);

export function openCloseoutEditor(source: ProjectCloseout, empty: CloseoutDraft): CloseoutEditor {
  const baseline: CloseoutDraft = source.current
    ? {...source.current.preparation,revisionReason:''}
    : empty;
  return {projectId:source.project.id,fingerprint:source.current?.fingerprint??null,
    version:source.current?.version??0,baseline,draft:baseline};
}

export function closeoutEditorDirty(editor: CloseoutEditor): boolean {
  return identity(editor.draft)!==identity(editor.baseline);
}

export function closeoutEditorMatches(editor: CloseoutEditor|null, source: ProjectCloseout): boolean {
  return editor!==null && editor.projectId===source.project.id &&
    editor.fingerprint===(source.current?.fingerprint??null) &&
    editor.version===(source.current?.version??0);
}

// A transient fetch has no authority to replace local inputs. A different
// Project starts a separate editor; a newer source cannot silently erase edits.
export function syncCloseoutEditor(editor: CloseoutEditor|null, source: ProjectCloseout|null,
  empty: CloseoutDraft): CloseoutEditor|null {
  if(!source)return editor;
  if(!editor||editor.projectId!==source.project.id)return openCloseoutEditor(source,empty);
  if(closeoutEditorMatches(editor,source)||editor.version>(source.current?.version??0)||
     closeoutEditorDirty(editor))return editor;
  return openCloseoutEditor(source,empty);
}

export function canSignDisplayedCloseout(editor: CloseoutEditor|null,
  source: ProjectCloseout|null, fresh: boolean): boolean {
  return Boolean(fresh&&source?.current&&editor&&closeoutEditorMatches(editor,source)&&
    !closeoutEditorDirty(editor)&&
    ((source.canSignBen&&!source.current.signatures.BEN)||
      (source.canSignNancy&&!source.current.signatures.NANCY)));
}
