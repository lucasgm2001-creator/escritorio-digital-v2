import { createClient } from '@/lib/supabase/server'
import { TrafegoClient } from './TrafegoClient'

export default async function TrafegoPage() {
  const supabase = createClient()

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false })

  return <TrafegoClient initialCampaigns={campaigns ?? []} />
}
