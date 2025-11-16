interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export default function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <header className="space-y-2">
      <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-strong)]">{title}</h1>
      {description ? <p className="text-sm text-[var(--text-muted)]">{description}</p> : null}
      {children}
    </header>
  );
}
