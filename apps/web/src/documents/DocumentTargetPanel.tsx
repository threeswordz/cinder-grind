import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
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
  DocumentTargetType,
  documentsApi,
} from '../api/documents';

function formatBytes(value: number): string {
  if (value < 1024) return value + ' B';
  if (value < 1024 * 1024) return (value / 1024).toFixed(1) + ' KB';
  return (value / (1024 * 1024)).toFixed(1) + ' MB';
}

export function DocumentTargetPanel({
  projectId,
  canUpload,
  canArchive,
}: {
  projectId: string;
  canUpload: boolean;
  canArchive: boolean;
}) {
  const queryClient = useQueryClient();
  const [entityType, setEntityType] =
    useState<DocumentTargetType>('WBS');
  const [entityId, setEntityId] = useState('');
  const [documentTypeId, setDocumentTypeId] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const options = useQuery({
    queryKey: ['documents', 'target-options', projectId],
    queryFn: () => documentsApi.targetOptions(projectId),
    enabled: Boolean(projectId),
  });
  const targetDocuments = useQuery({
    queryKey: [
      'documents',
      'target',
      projectId,
      entityType,
      entityId,
    ],
    queryFn: () =>
      documentsApi.targetDocuments(projectId, entityType, entityId),
    enabled: Boolean(projectId && entityId),
  });
  const typeOptions = useQuery({
    queryKey: ['documents', 'type-options'],
    queryFn: documentsApi.typeOptions,
    enabled: canUpload,
  });

  const targetChoices = useMemo(() => {
    const data = options.data?.data;
    if (!data) return [];
    if (entityType === 'WBS') {
      return data.wbs.map((row) => ({ id: row.id, label: row.wbsCode + ' · ' + row.wbsName }));
    }
    if (entityType === 'ACTIVITY') {
      return data.activities.map((row) => ({ id: row.id, label: row.activityCode + ' · ' + row.activityName }));
    }
    if (entityType === 'PURCHASE_REQUEST') {
      return data.purchaseRequests.map((row) => ({ id: row.id, label: row.prNumber }));
    }
    if (entityType === 'RFQ') {
      return data.rfqs.map((row) => ({ id: row.id, label: row.rfqNumber }));
    }
    if (entityType === 'SUPPLIER_QUOTATION') {
      return data.supplierQuotations.map((row) => ({
        id: row.id,
        label: row.rfq.rfqNumber + ' · ' + row.supplier.supplierCode + ' · ' + (row.supplierReference ?? 'Quotation'),
      }));
    }
    if (entityType === 'PURCHASE_ORDER') {
      return data.purchaseOrders.map((row) => ({
        id: row.id,
        label: row.poNumber + ' · Rev ' + row.revisionNo + ' · ' + row.supplier.supplierCode,
      }));
    }
    if (entityType === 'GOODS_RECEIPT') {
      return data.goodsReceipts.map((row) => ({ id: row.id, label: row.receiptNumber }));
    }
    if (entityType === 'MATERIAL_RESERVATION') {
      return data.materialReservations.map((row) => ({
        id: row.id,
        label: row.reservationNumber + ' · ' + row.status,
      }));
    }
    if (entityType === 'MATERIAL_ISSUE') {
      return data.materialIssues.map((row) => ({ id: row.id, label: row.issueNumber }));
    }
    if (entityType === 'MATERIAL_RETURN') {
      return data.materialReturns.map((row) => ({ id: row.id, label: row.returnNumber }));
    }
    return data.stockTransfers.map((row) => ({ id: row.id, label: row.transferNumber }));
  }, [entityType, options.data?.data]);

  const upload = useMutation({
    mutationFn: () =>
      documentsApi.uploadTargetDocument(
        projectId,
        entityType,
        entityId,
        documentTypeId,
        file!,
      ),
    onSuccess: async () => {
      setFile(null);
      setDocumentTypeId('');
      const input = document.getElementById(
        'target-document-file',
      ) as HTMLInputElement | null;
      if (input) input.value = '';
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [
            'documents',
            'target',
            projectId,
            entityType,
            entityId,
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: ['documents', projectId],
        }),
      ]);
    },
  });

  const toggle = useMutation({
    mutationFn: (input: { id: string; active: boolean }) =>
      documentsApi.setTargetDocumentActive(
        projectId,
        entityType,
        entityId,
        input.id,
        input.active,
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [
            'documents',
            'target',
            projectId,
            entityType,
            entityId,
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: ['documents', projectId],
        }),
      ]);
    },
  });

  async function download(documentId: string, fallbackName: string) {
    const result = await documentsApi.downloadTargetDocument(
      projectId,
      entityType,
      entityId,
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

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (projectId && entityId && documentTypeId && file) {
      upload.mutate();
    }
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Project / Transaction Documents</Typography>
      <Typography variant="body2" color="text.secondary">
        Documents remain Project-owned for access control while also referencing the selected WBS, Activity, Procurement or Inventory transaction.
      </Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
        <TextField
          select
          label="Target type"
          value={entityType}
          onChange={(event) => {
            setEntityType(event.target.value as DocumentTargetType);
            setEntityId('');
          }}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="WBS">WBS</MenuItem>
          <MenuItem value="ACTIVITY">Activity</MenuItem>
          <MenuItem value="PURCHASE_REQUEST">Purchase Request</MenuItem>
          <MenuItem value="RFQ">RFQ</MenuItem>
          <MenuItem value="SUPPLIER_QUOTATION">Supplier Quotation</MenuItem>
          <MenuItem value="PURCHASE_ORDER">Purchase Order</MenuItem>
          <MenuItem value="GOODS_RECEIPT">Goods Receipt</MenuItem>
          <MenuItem value="MATERIAL_RESERVATION">Material Reservation</MenuItem>
          <MenuItem value="MATERIAL_ISSUE">Material Issue</MenuItem>
          <MenuItem value="MATERIAL_RETURN">Material Return</MenuItem>
          <MenuItem value="STOCK_TRANSFER">Stock Transfer</MenuItem>
        </TextField>
        <TextField
          select
          label={entityType.replaceAll('_', ' ')}
          value={entityId}
          onChange={(event) => setEntityId(event.target.value)}
          sx={{ flexGrow: 1 }}
        >
          <MenuItem value="">Select target</MenuItem>
          {targetChoices.map((target) => (
            <MenuItem key={target.id} value={target.id}>
              {target.label}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {targetDocuments.isError ? (
        <Alert severity="error">
          Unable to load documents for the selected target.
        </Alert>
      ) : null}

      {entityId && (targetDocuments.data?.data ?? []).length === 0 ? (
        <Alert severity="info">
          No documents are linked to this target.
        </Alert>
      ) : null}

      {(targetDocuments.data?.data ?? []).map((row) => (
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
                      toggle.mutate({
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

      {canUpload && entityId ? (
        <Card variant="outlined">
          <CardContent>
            <Stack component="form" spacing={2} onSubmit={submit}>
              <Typography fontWeight={600}>
                Upload to {entityType.replaceAll('_', ' ')}
              </Typography>
              {upload.isError ? (
                <Alert severity="error">
                  Unable to upload document. Check target access, file
                  type/size and Document Type.
                </Alert>
              ) : null}
              <TextField
                select
                label="Document Type"
                value={documentTypeId}
                onChange={(event) =>
                  setDocumentTypeId(event.target.value)
                }
                required
              >
                {(typeOptions.data?.data ?? []).map((type) => (
                  <MenuItem key={type.id} value={type.id}>
                    {type.documentTypeCode} · {type.documentTypeName}
                  </MenuItem>
                ))}
              </TextField>
              <input
                id="target-document-file"
                type="file"
                onChange={chooseFile}
                required
              />
              <Button
                type="submit"
                variant="contained"
                disabled={
                  !file || !documentTypeId || upload.isPending
                }
              >
                Upload
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  );
}
