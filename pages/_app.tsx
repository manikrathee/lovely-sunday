import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { Agentation } from 'agentation'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Component {...pageProps} />
      {process.env.NODE_ENV === 'development' && <Agentation />}
    </>
  )
}
