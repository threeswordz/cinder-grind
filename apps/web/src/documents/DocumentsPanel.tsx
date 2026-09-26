import { ChangeEvent, FormEvent, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardContent,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  DocumentType,
  documentsApi,
} from '../api/documents';
import { DocumentTargetPanel } from './DocumentTargetPanel';

function formatBytes(value: number): string {
  if (value < 1024) return value + ' B';
  if (value < 1024 * 1024) return (value / 1024).toFixed(1) + ' KB';
  return (value / (1024 * 1024)).toFixed(1) + ' MB';
}

export function DocumentsPanel({ permissions }: { permissions: string[] }) {
  const queryClient = useQueryClient();
  const canView = permissions.includes('documents.document.view');
  const canUpload =
    permissions.includes('documents.document.upload') &&
    permissions.includes('documents.document.link');
  const canArchive = permissions.includes('documents.document.archive');
  const canManageTypes = permissions.includes('documents.type.manage');

  const [projectId, setProjectId] = useState('');
  const [documentTypeId, setDocumentTypeId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [editingType, setEditingType] = useState<DocumentType | null>(null);
  const [typeForm, setTypeForm] = useState({
    documentTypeCode: '',
    documentTypeName: '',
  });

  const projects = useQuery({
    queryKey: ['documents', 'projects'],
    queryFn: documentsApi.projects,
    enabled: canView,
  });
  const documents = useQuery({
    queryKey: ['documents', projectId],
    queryFn: () => documentsApi.projectDocuments(projectId),
    enabled: Boolean(canView && projectId),
  });
  const typeOptions = useQuery({
    queryKey: ['documents', 'type-options'],
    queryFn: documentsApi.typeOptions,
    enabled: canUpload,
  });
  const types = useQuery({
    queryKey: ['document-types'],
    queryFn: documentsApi.documentTypes,
    enabled: canManageTypes,
  });

  const upload = useMutation({
    mutationFn: () =>
      documentsApi.uploadProjectDocument(projectId, documentTypeId, file!),
    onSuccess: async () => {
      setFile(null);
      setDocumentTypeId('');
      const input = document.getElementById('document-file') as HTMLInputElement | null;
      if (input) input.value = '';
      await queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
    },
  });

  const toggleDocument = useMutation({
    mutationFn: (input: { id: string; active: boolean }) =>
      documentsApi.setProjectDocumentActive(
        projectId,
        input.id,
        input.active,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
    },
  });

  const saveType = useMutation({
    mutationFn: () =>
      editingType
        ? documentsApi.updateDocumentType(editingType.id, typeForm)
        : documentsApi.createDocumentType(typeForm),
    onSuccess: async () => {
      setEditingType(null);
      setTypeForm({ documentTypeCode: '', documentTypeName: '' });
      await queryClient.invalidateQueries({ queryKey: ['document-types'] });
      await queryClient.invalidateQueries({ queryKey: ['documents', 'type-options'] });
    },
  });

  const toggleType = useMutation({
    mutationFn: (input: { id: string; active: boolean }) =>
      documentsApi.setDocumentTypeActive(input.id, input.active),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['document-types'] });
      await queryClient.invalidateQueries({ queryKey: ['documents', 'type-options'] });
    },
  });

  async function download(documentId: string, fallbackName: string) {
    const result = await documentsApi.downloadProjectDocument(
      projectId,
      documentId,
    );
    const url = URL.createObjectURL(result.blob);
    try {
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = result.fileName ?? fallbackName;
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function submitUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (projectId && documentTypeId && file) upload.mutate();
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
  }

  function editType(row: DocumentType) {
    setEditingType(row);
    setTypeForm({
      documentTypeCode: row.documentTypeCode,
      documentTypeName: row.documentTypeName,
    });
  }

  return (
    <Stack spacing={4}>
      {canView ? (
        <Stack spacing={2}>
          <Typography variant="h6">Project Documents</Typography>
          <TextField
            select
            label="Project"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
          >
            <MenuItem value="">Select Project</MenuItem>
            {(projects.data?.data ?? []).map((project) => (
              <MenuItem key={project.id} value={project.id}>
                {project.projectCode} · {project.projectName}
              </MenuItem>
            ))}
          </TextField>

          {documents.isError ? (
            <Alert severity="error">Unable to load Project documents.</Alert>
          ) : null}

          {(documents.data?.data ?? []).map((row) => (
            <Card key={row.id} variant="outlined">
              <CardContent>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={2}
                  justifyContent="space-between"
                >
                  <div>
                    <Typography fontWeight={600}>{row.fileName}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {row.documentType.documentTypeName} · {row.mimeType} ·{' '}
                      {formatBytes(row.fileSizeBytes)} ·{' '}
                      {row.isActive ? 'Active' : 'Archived'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Uploaded by {row.uploadedBy.displayName} ·{' '}
                      {new Date(row.uploadedAt).toLocaleString()}
                    </Typography>
                  </div>
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      disabled={!row.isActive}
                      onClick={() => void download(row.id, row.fileName)}
                    >
                      Download
                    </Button>
                    {canArchive ? (
                      <Button
                        size="small"
                        onClick={() =>
                          toggleDocument.mutate({
                            id: row.id,
                            active: !row.isActive,
                          })
                        }
                      >
                        {row.isActive ? 'Archive' : 'Reactivate'}
                      </Button>
                    ) : null}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))}

          {projectId ? (
            <DocumentTargetPanel
              projectId={projectId}
              canUpload={canUpload}
              canArchive={canArchive}
            />
          ) : null}

          {canUpload && projectId ? (
            <Card variant="outlined">
              <CardContent>
                <Stack component="form" spacing={2} onSubmit={submitUpload}>
                  <Typography fontWeight={600}>Upload Document</Typography>
                  {upload.isError ? (
                    <Alert severity="error">
                      Unable to upload document. Check the file type, size,
                      Document Type and Project access.
                    </Alert>
                  ) : null}
                  <TextField
                    select
                    label="Document Type"
                    value={documentTypeId}
                    onChange={(event) => setDocumentTypeId(event.target.value)}
                    required
                  >
                    {(typeOptions.data?.data ?? []).map((type) => (
                      <MenuItem key={type.id} value={type.id}>
                        {type.documentTypeCode} · {type.documentTypeName}
                      </MenuItem>
                    ))}
                  </TextField>
                  <input
                    id="document-file"
                    type="file"
                    onChange={chooseFile}
                    required
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={!file || !documentTypeId || upload.isPending}
                  >
                    Upload
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          ) : null}
        </Stack>
      ) : null}

      {canManageTypes ? (
        <Stack spacing={2}>
          <Typography variant="h6">Document Types</Typography>
          {(types.data?.data ?? []).map((row) => (
            <Card key={row.id} variant="outlined">
              <CardContent>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  justifyContent="space-between"
                  alignItems={{ sm: 'center' }}
                >
                  <div>
                    <Typography fontWeight={600}>
                      {row.documentTypeCode} · {row.documentTypeName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {row.isActive ? 'Active' : 'Inactive'}
                    </Typography>
                  </div>
                  <Stack direction="row">
                    <Button onClick={() => editType(row)}>Edit</Button>
                    <Button
                      onClick={() =>
                        toggleType.mutate({
                          id: row.id,
                          active: !row.isActive,
                        })
                      }
                    >
                      {row.isActive ? 'Deactivate' : 'Reactivate'}
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))}

          <Card variant="outlined">
            <CardContent>
              <Stack
                component="form"
                spacing={2}
                onSubmit={(event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  saveType.mutate();
                }}
              >
                <Typography fontWeight={600}>
                  {editingType ? 'Edit Document Type' : 'Add Document Type'}
                </Typography>
                <TextField
                  label="Type Code"
                  value={typeForm.documentTypeCode}
                  onChange={(event) =>
                    setTypeForm({
                      ...typeForm,
                      documentTypeCode: event.target.value,
                    })
                  }
                  required
                />
                <TextField
                  label="Type Name"
                  value={typeForm.documentTypeName}
                  onChange={(event) =>
                    setTypeForm({
                      ...typeForm,
                      documentTypeName: event.target.value,
                    })
                  }
                  required
                />
                <Stack direction="row" spacing={1}>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={saveType.isPending}
                  >
                    Save Type
                  </Button>
                  {editingType ? (
                    <Button
                      onClick={() => {
                        setEditingType(null);
                        setTypeForm({
                          documentTypeCode: '',
                          documentTypeName: '',
                        });
                      }}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      ) : null}
    </Stack>
  );
}
