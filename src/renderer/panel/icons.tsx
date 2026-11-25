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

export function PinIcon({ filled = false, ...props }: IconProps & { filled?: boolean }): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M9 4.5h6l-1 5.2 3 3.3H7l3-3.3z" fill={filled ? 'currentColor' : 'none'} />
      <path d="M12 13v6.5" />
    </Icon>
  )
}

export function ExportIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M12 4v10.5M7.5 10 12 14.5 16.5 10" />
      <path d="M5 16.5v1.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1.5" />
    </Icon>
  )
}

export function TrashIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M5 7h14M10 7V5h4v2M7 7l.8 11.2a1.5 1.5 0 0 0 1.5 1.3h5.4a1.5 1.5 0 0 0 1.5-1.3L17 7" />
    </Icon>
  )
}

export function FolderIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
    </Icon>
  )
}

export function TeamIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M15.5 5.8a3 3 0 0 1 0 5.4M17.5 14.2A5.5 5.5 0 0 1 20.5 19" />
    </Icon>
  )
}

export function PlusIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  )
}

export function GridIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </Icon>
  )
}

export function ListIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M9 6.5h11M9 12h11M9 17.5h11" />
      <circle cx="4.75" cy="6.5" r="0.9" fill="currentColor" />
      <circle cx="4.75" cy="12" r="0.9" fill="currentColor" />
      <circle cx="4.75" cy="17.5" r="0.9" fill="currentColor" />
    </Icon>
  )
}

/** Cœur des favoris : au trait, ou plein quand l'agent est en favori. */
export function HeartIcon({ filled = false, ...props }: IconProps & { filled?: boolean }): React.JSX.Element {
  return (
    <Icon {...props}>
      <path
        d="M12 19.5s-7-4.35-7-9.4A3.9 3.9 0 0 1 12 7.6a3.9 3.9 0 0 1 7 2.5c0 5.05-7 9.4-7 9.4z"
        fill={filled ? 'currentColor' : 'none'}
      />
    </Icon>
  )
}
