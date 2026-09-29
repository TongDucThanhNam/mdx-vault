export function SettingsPage({
  eyebrow,
  title,
  description,
  children
}: {
  eyebrow: string
  title: string
  description: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="p-5 sm:p-7">
      <header className="mb-7 border-b-2 border-foreground pb-4 pr-8">
        <div className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-editorial-red">
          {eyebrow}
        </div>
        <h2 className="mt-1 font-display text-3xl leading-tight font-black tracking-tight">
          {title}
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{description}</p>
      </header>
      <div className="space-y-7">{children}</div>
    </section>
  )
}

export function SettingGroup({
  title,
  description,
  children
}: {
  title: string
  description: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section>
      <h3 className="font-mono text-xs font-bold uppercase tracking-[0.14em]">{title}</h3>
      <p className="mt-1 mb-3 max-w-prose text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>
      {children}
    </section>
  )
}
