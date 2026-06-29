import type { Lead } from './types'
import type { Client } from '../clientes/ClientesClient'

// Tipos enxutos consumidos pelo mapa (Hall → LeadMap) e pelas métricas de Configurações.
// Antes viviam em tabs/MapaTab.tsx (mapa antigo, removido) — movidos pra cá p/ não depender daquele componente.
export type MapLead = Pick<Lead, 'id' | 'name' | 'status' | 'state' | 'area_code' | 'created_at' | 'origem'>
export type MapClient = Pick<Client, 'id' | 'name' | 'status' | 'state' | 'area_code'>
