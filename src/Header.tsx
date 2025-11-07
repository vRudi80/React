type HeaderProps = {
  title: string;
  subtitle?: string; // opcionális
};

export default function Header({ title, subtitle }: HeaderProps) {
  return (
    <header
      style={{
        background: '#222',
        color: 'white',
        padding: '16px 24px',
      }}
    >
      <h1>{title}</h1>
      {subtitle && (
        <p style={{ marginTop: '4px', opacity: 0.8 }}>{subtitle}</p>
      )}
    </header>
  );
}

