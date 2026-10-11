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
      <header className="mb-7 border-b border-border pb-4 pr-8">
        <div className="font-sans text-xs font-semibold text-editorial-red">{eyebrow}</div>
        <h2 className="mt-1 font-sans text-3xl leading-tight font-semibold tracking-tight">
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
      <h3 className="font-sans text-xs font-semibold ">{title}</h3>
      <p className="mt-1 mb-3 max-w-prose text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>
      {children}
    </section>
  )
}
