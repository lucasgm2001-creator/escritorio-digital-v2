import { redirect } from 'next/navigation'

// Tarefas virou ABA do Hall. Mantém a rota antiga redirecionando.
export default function TarefasPage() {
  redirect('/hall?tab=tarefas')
}
