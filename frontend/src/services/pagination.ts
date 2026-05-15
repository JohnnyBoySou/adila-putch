/**
 * Limite usado para "trazer tudo" nas listagens.
 *
 * O backend Go já carrega a coleção inteira em memória e apenas fatia
 * (`paginate`) — pedir um limite alto não tem custo extra de backend e
 * elimina o truncamento silencioso (antes fixo em 10 itens). App desktop
 * local: não há cenário realista que ultrapasse esse valor.
 */
export const ALL_ITEMS = 1_000_000;
