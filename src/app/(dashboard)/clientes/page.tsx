import { redirect } from 'next/navigation'

// Clientes virou ABA do Comercial. Mantém a rota antiga redirecionando.
export default function ClientesPage() {
  redirect('/comercial?tab=clientes')
}
