import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { settingsService } from '../services';
import type {
  LegalDocument,
  UpdateLegalDocumentRequest,
} from '../types/configuration.types';

export const LEGAL_DOCUMENTS_KEY = 'legal-documents';

export const useLegalDocuments = () => {
  const { data, isLoading } = useQuery({
    queryKey: [LEGAL_DOCUMENTS_KEY],
    queryFn: () => settingsService.getLegalDocuments(),
  });

  return {
    documents: (data?.documents ?? []) as LegalDocument[],
    /** The version compiled into the shipped app, for "edited away from" checks. */
    sourceVersion: data?.sourceVersion as string | undefined,
    isLoading,
  };
};

export const useUpdateLegalDocument = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      documentId,
      data,
    }: {
      documentId: string;
      data: UpdateLegalDocumentRequest;
    }) => settingsService.updateLegalDocument(documentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LEGAL_DOCUMENTS_KEY] });
      toast.success('Legal document saved');
    },
    onError: (error: any) => {
      // The API rejects malformed blocks with a message naming the offending
      // one ("sections[3].blocks[1].items[0] must be non-empty text"). Surface
      // it verbatim — in a nineteen-section contract, a generic failure leaves
      // an editor with nowhere to look.
      toast.error(
        error?.response?.data?.message || 'Failed to save legal document'
      );
    },
  });
};

export const useResetLegalDocument = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentId: string) =>
      settingsService.resetLegalDocument(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LEGAL_DOCUMENTS_KEY] });
      toast.success('Restored the version that shipped with the app');
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.message || 'Failed to restore the document'
      );
    },
  });
};
