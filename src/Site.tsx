const projects = [
  {
    title: 'Project One',
    description: 'A short description of what this project does and why it matters.',
    href: '#',
  },
  {
    title: 'Project Two',
    description: 'A short description of what this project does and why it matters.',
    href: '#',
  },
  {
    title: 'Project Three',
    description: 'A short description of what this project does and why it matters.',
    href: '#',
  },
]

function Site() {
  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-8">
        <span className="text-lg font-semibold">Jairo inder Beeck</span>
        <nav className="flex gap-6 text-sm text-slate-600 dark:text-slate-400">
          <a className="hover:text-slate-900 dark:hover:text-white" href="#work">
            Work
          </a>
          <a className="hover:text-slate-900 dark:hover:text-white" href="#contact">
            Contact
          </a>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-6">
        <section className="py-16 sm:py-24">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Building thoughtful software.
          </h1>
          <p className="mt-6 text-lg text-slate-600 dark:text-slate-400">
            I&apos;m a developer focused on clean, maintainable products. This is my
            portfolio &mdash; a work in progress.
          </p>
        </section>

        <section
          id="work"
          className="border-t border-slate-200 py-16 dark:border-slate-800"
        >
          <h2 className="text-sm font-medium uppercase tracking-widest text-slate-500">
            Selected work
          </h2>
          <ul className="mt-8 space-y-6">
            {projects.map((project) => (
              <li key={project.title}>
                <a
                  href={project.href}
                  className="block rounded-xl border border-slate-200 p-6 transition hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600"
                >
                  <h3 className="font-semibold">{project.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    {project.description}
                  </p>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section
          id="contact"
          className="border-t border-slate-200 py-16 dark:border-slate-800"
        >
          <h2 className="text-sm font-medium uppercase tracking-widest text-slate-500">
            Contact
          </h2>
          <p className="mt-8 text-lg">
            <a
              className="underline underline-offset-4 hover:no-underline"
              href="mailto:jairo@inderbeeck.com"
            >
              jairo@inderbeeck.com
            </a>
          </p>
        </section>
      </main>

      <footer className="mx-auto max-w-3xl px-6 py-10 text-sm text-slate-500">
        &copy; {new Date().getFullYear()} Jairo inder Beeck
      </footer>
    </div>
  )
}

export default Site
