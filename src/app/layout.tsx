import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { Space_Grotesk, JetBrains_Mono, Inter } from 'next/font/google'
import './globals.css'
import { ServiceWorkerRegister } from '@/components/system/ServiceWorkerRegister'

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
})
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
})

// ── Design System "Bento Compacto" ──────────────────────────────────────────
// Space Grotesk → títulos e números de métrica.  JetBrains Mono → valores
// técnicos / labels uppercase / timestamps.  Inter → corpo de leitura.
// Expostas como CSS vars; usadas via font-display/font-tech/font-body. NÃO
// trocam a font-sans global (rollout escopado ao Hall por ora).
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-display', display: 'swap' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-tech', display: 'swap' })
const inter = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' })

export const metadata: Metadata = {
  title: 'Escritório Digital — DR Growth',
  description: 'Sistema interno DR Growth',
  applicationName: 'Escritório Digital',
  // PWA / iOS: abre em tela cheia (standalone) ao adicionar à tela inicial.
  appleWebApp: { capable: true, title: 'Escritório Digital', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icon-192.png', apple: '/apple-touch-icon.png' },
}

export const viewport: Viewport = {
  themeColor: '#0D140F',   // combina com o fundo escuro do tema
  viewportFit: 'cover',    // expõe env(safe-area-inset-*) no iOS (respiro da barra inferior no mobile)
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: o script de tema abaixo injeta classes em <html> antes do React
    // hidratar (no-flash) — sem isso o React reclamaria da diferença de className.
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Aplica o tema salvo antes do React hidratar — evita flash de tema errado */}
        <script dangerouslySetInnerHTML={{ __html: `
(function(){try{
  var el=document.documentElement;
  var t=localStorage.getItem('theme');
  var s=parseInt(localStorage.getItem('theme_dark_start'),10); if(isNaN(s)||s<0||s>23)s=18;
  var e=parseInt(localStorage.getItem('theme_dark_end'),10); if(isNaN(e)||e<0||e>23)e=6;
  var h=new Date().getHours();
  var inDark = s<=e ? (h>=s&&h<e) : (h>=s||h<e);
  var dark=t==='dark'||((!t||t==='auto')&&inDark);
  if(dark){el.classList.add('dark');el.classList.remove('light');}
  else{el.classList.add('light');el.classList.remove('dark');}
  var a=localStorage.getItem('a11y'); if(a){var o=JSON.parse(a);
    if(o.font==='grande')el.classList.add('a11y-font-grande');
    if(o.font==='maior')el.classList.add('a11y-font-maior');
    if(o.contrast)el.classList.add('a11y-contrast');
    if(o.spacing)el.classList.add('a11y-spacing');
    if(o.reduceMotion)el.classList.add('a11y-reduce-motion');
  }
  if(localStorage.getItem('ui_density')==='compact')el.classList.add('ui-compact');
}catch(e){}}())
        `}} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} ${inter.variable} font-sans antialiased`}>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
