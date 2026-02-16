import '../styles/globals.css'
import type { AppProps } from 'next/app'
import dynamic from 'next/dynamic'

const DevAgentation =
  process.env.NODE_ENV === 'development'
    ? dynamic(() => import('agentation').then((mod) => mod.Agentation), {
        ssr: false,
      })
    : () => null

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Component {...pageProps} />
      <DevAgentation />
    </>
  )
}
