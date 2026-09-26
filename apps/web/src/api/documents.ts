import { apiDownload, apiRequest } from './client';

type Data<T> = { data: T };

export type DocumentProject = {
  id: string;
  projectCode: string;
  projectName: string;
};

export type DocumentType = {
  id: string;
  documentTypeCode: string;
  documentTypeName: string;
  isActive: boolean;
};

export type DocumentTargetType = 'WBS' | 'ACTIVITY';

export type DocumentTargetOptions = {
  wbs: Array<{
    id: string;
    wbsCode: string;
    wbsName: string;
    parentId: string | null;
  }>;
  activities: Array<{
    id: string;
    activityCode: string;
    activityName: string;
    wbsId: string;
  }>;
};

export type ProjectDocument = {
  id: string;
  documentTypeId: string;
  fileName: string;
  storageProvider: string;
  mimeType: string;
  fileSizeBytes: number;
  checksum: string | null;
  uploadedAt: string;
  isActive: boolean;
  documentType: {
    id: string;
    documentTypeCode: string;
    documentTypeName: string;
  };
  uploadedBy: {
    id: string;
    displayName: string;
  };
};

export const documentsApi = {
  projects: () =>
    apiRequest<Data<DocumentProject[]>>('/documents/projects'),
  typeOptions: () =>
    apiRequest<Data<Array<Pick<DocumentType, 'id' | 'documentTypeCode' | 'documentTypeName'>>>>(
      '/documents/type-options',
    ),
  projectDocuments: (projectId: string) =>
    apiRequest<Data<ProjectDocument[]>>('/documents/projects/' + projectId),
  uploadProjectDocument: (
    projectId: string,
    documentTypeId: string,
    file: File,
  ) => {
    const form = new FormData();
    form.append('documentTypeId', documentTypeId);
    form.append('file', file);
    return apiRequest<Data<ProjectDocument>>('/documents/projects/' + projectId, {
      method: 'POST',
      body: form,
    });
  },
  downloadProjectDocument: (projectId: string, documentId: string) =>
    apiDownload(
      '/documents/projects/' + projectId + '/' + documentId + '/download',
    ),
  setProjectDocumentActive: (
    projectId: string,
    documentId: string,
    active: boolean,
  ) =>
    apiRequest<Data<ProjectDocument>>(
      '/documents/projects/' +
        projectId +
        '/' +
        documentId +
        (active ? '/reactivate' : '/archive'),
      { method: 'POST' },
    ),
  targetOptions: (projectId: string) =>
    apiRequest<Data<DocumentTargetOptions>>(
      '/documents/projects/' + projectId + '/targets/options',
    ),
  targetDocuments: (
    projectId: string,
    entityType: DocumentTargetType,
    entityId: string,
  ) =>
    apiRequest<Data<ProjectDocument[]>>(
      '/documents/projects/' +
        projectId +
        '/targets/' +
        entityType +
        '/' +
        entityId,
    ),
  uploadTargetDocument: (
    projectId: string,
    entityType: DocumentTargetType,
    entityId: string,
    documentTypeId: string,
    file: File,
  ) => {
    const form = new FormData();
    form.append('documentTypeId', documentTypeId);
    form.append('file', file);
    return apiRequest<Data<ProjectDocument>>(
      '/documents/projects/' +
        projectId +
        '/targets/' +
        entityType +
        '/' +
        entityId,
      { method: 'POST', body: form },
    );
  },
  downloadTargetDocument: (
    projectId: string,
    entityType: DocumentTargetType,
    entityId: string,
    documentId: string,
  ) =>
    apiDownload(
      '/documents/projects/' +
        projectId +
        '/targets/' +
        entityType +
        '/' +
        entityId +
        '/' +
        documentId +
        '/download',
    ),
  setTargetDocumentActive: (
    projectId: string,
    entityType: DocumentTargetType,
    entityId: string,
    documentId: string,
    active: boolean,
  ) =>
    apiRequest<Data<ProjectDocument>>(
      '/documents/projects/' +
        projectId +
        '/targets/' +
        entityType +
        '/' +
        entityId +
        '/' +
        documentId +
        (active ? '/reactivate' : '/archive'),
      { method: 'POST' },
    ),

  documentTypes: () =>
    apiRequest<Data<DocumentType[]>>('/document-types'),
  createDocumentType: (body: {
    documentTypeCode: string;
    documentTypeName: string;
  }) =>
    apiRequest<Data<DocumentType>>('/document-types', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateDocumentType: (
    id: string,
    body: Partial<Pick<DocumentType, 'documentTypeCode' | 'documentTypeName'>>,
  ) =>
    apiRequest<Data<DocumentType>>('/document-types/' + id, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  setDocumentTypeActive: (id: string, active: boolean) =>
    apiRequest<Data<DocumentType>>(
      '/document-types/' + id + (active ? '/reactivate' : '/archive'),
      { method: 'POST' },
    ),
};
