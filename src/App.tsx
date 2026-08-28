import Placeholder from './Placeholder'
import Site from './Site'

// Set SHOW_PLACEHOLDER=true (Vercel: Production environment only) to serve the
// coming-soon page to every visitor. Unset locally, so `npm run dev` and
// `npm run preview` always show the real site.
const showPlaceholder = import.meta.env.SHOW_PLACEHOLDER === 'true'

function App() {
  return showPlaceholder ? <Placeholder /> : <Site />
}

export default App
