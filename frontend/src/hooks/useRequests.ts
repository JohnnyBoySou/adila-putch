import { RequestService, type RequestConfig, type ResponseData } from "@/services/request.service";
import { useRequestsStore } from "@/stores/requests.store";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";

/**
 * Lê o estado compartilhado de requests via selectors.
 * O carregamento por collectionId acontece no `loader` da rota, não em useEffect.
 */
export function useRequests() {
  return useRequestsStore(
    useShallow((s) => ({
      requests: s.requests,
      collectionName: s.collectionName,
      loading: s.loading,
      error: s.error,
      loadRequests: s.load,
      createRequest: s.create,
      deleteRequest: s.remove,
      updateRequest: s.update,
    })),
  );
}

/**
 * Estado efêmero do envio de uma request (resposta de um único editor).
 * Permanece local de propósito — não há fetch no mount nem estado compartilhado.
 */
export function useRequestSender() {
  const [response, setResponse] = useState<ResponseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendRequest = async (config: RequestConfig) => {
    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      const data = await RequestService.send(config);
      setResponse(data);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to send request";
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    response,
    loading,
    error,
    sendRequest,
  };
}
