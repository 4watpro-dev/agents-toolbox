// Icônes au trait, dessinées pour l'app : elles prennent la couleur du texte.

interface IconProps {
  size?: number
}

function Icon({ size = 18, children }: IconProps & { children: React.ReactNode }): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function PaperclipIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M19.5 11.2 12 18.7a5 5 0 0 1-7.1-7.1l7.9-7.9a3.3 3.3 0 0 1 4.7 4.7l-7.8 7.8a1.7 1.7 0 0 1-2.4-2.4l7.1-7.1" />
    </Icon>
  )
}

export function ImageIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="9" cy="9.5" r="1.6" />
      <path d="m20.5 15.5-4.6-4.6a1.2 1.2 0 0 0-1.7 0L6 19.2" />
    </Icon>
  )
}

export function DocumentIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8z" />
      <path d="M14 3.5V8h4.5" />
      <path d="M9 13h6M9 16.5h4" />
    </Icon>
  )
}

export function TextFileIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8z" />
      <path d="M14 3.5V8h4.5" />
      <path d="m10 12-2 2 2 2M14 12l2 2-2 2" />
    </Icon>
  )
}
