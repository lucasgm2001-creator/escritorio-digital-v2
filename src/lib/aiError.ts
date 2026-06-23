// Traduz erros comuns da API de IA (Anthropic via AI SDK) em mensagem CLARA p/ a UI,
// em vez de "tente de novo". Usado pelas rotas de briefing/análise.
export function aiErrorMessage(raw: string): string {
  const m = (raw || '').toLowerCase()
  if (m.includes('usage limit') || m.includes('credit balance') || m.includes('quota') || m.includes('billing') || m.includes('regain access'))
    return 'Limite de uso da API de IA atingido (Anthropic). Ajuste o limite/plano da conta ou aguarde a renovação.'
  if (m.includes('rate limit') || m.includes('429') || m.includes('overloaded'))
    return 'IA sobrecarregada ou limite por minuto. Tente novamente em instantes.'
  if (m.includes('authentication') || m.includes('invalid_api_key') || m.includes('api key') || m.includes('x-api-key') || m.includes('401'))
    return 'Chave da API de IA inválida ou ausente (ANTHROPIC_API_KEY).'
  if (m.includes('not_found') || m.includes('model'))
    return 'Modelo de IA indisponível na conta.'
  return raw && raw.length > 220 ? raw.slice(0, 220) + '…' : (raw || 'Falha ao chamar a IA.')
}
