import { PredictionService as Wails } from "@bindings/services";

/** Campos previsíveis. Espelha predict.Field do Go (json tags). */
export type PredictField = "url" | "body" | "header" | "param";

interface SuggestArgs {
  field: PredictField;
  prefix: string;
  collectionId?: string;
  method?: string;
  limit?: number;
}

/**
 * Wrapper fino sobre o motor preditivo do backend (PredictionService.Suggest).
 * O binding aceita um objeto plano com as json tags do predict.Request; o
 * retorno são Suggestions ordenadas por score — aqui devolvemos só os textos
 * canônicos, que é o que o ghost-text do VariableAutocomplete consome.
 */
export const PredictionService = {
  async suggest({ field, prefix, collectionId, method, limit = 8 }: SuggestArgs): Promise<string[]> {
    const res = await Wails.Suggest({
      field,
      prefix,
      url: "",
      collection_id: collectionId ?? "",
      method: method ?? "",
      limit,
    });
    return res.map((s) => s.text);
  },
};
