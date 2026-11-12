import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function Icon({ children, ...props }: IconProps): React.JSX.Element {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export const PlayIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path
      d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z"
      fill="currentColor"
    />
  </Icon>
)

export const PauseIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
    <rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
  </Icon>
)

export const ResetIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
  </Icon>
)

export const SkipIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path
      d="M5 5.5v13a.8.8 0 0 0 1.2.7l10-6.5a.8.8 0 0 0 0-1.4l-10-6.5A.8.8 0 0 0 5 5.5Z"
      fill="currentColor"
      stroke="none"
    />
    <path d="M19 5v14" />
  </Icon>
)

export const TimerIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2.5 2.5" />
    <path d="M9.5 2h5" />
  </Icon>
)

export const TasksIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <path d="m3.5 6 1.2 1.2L7 5M3.5 12l1.2 1.2L7 11M3.5 18l1.2 1.2L7 17" />
  </Icon>
)

export const StatsIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Icon>
)

export const SettingsIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </Icon>
)

export const MinimizeIcon = (p: IconProps): React.JSX.Element => (
  <Icon width="14" height="14" strokeWidth="1.5" {...p}>
    <path d="M5 12h14" />
  </Icon>
)

export const MaximizeIcon = (p: IconProps): React.JSX.Element => (
  <Icon width="14" height="14" strokeWidth="1.5" {...p}>
    <rect x="5" y="5" width="14" height="14" rx="2" />
  </Icon>
)

export const RestoreIcon = (p: IconProps): React.JSX.Element => (
  <Icon width="14" height="14" strokeWidth="1.5" {...p}>
    <rect x="5" y="8" width="11" height="11" rx="2" />
    <path d="M8 5h9a2 2 0 0 1 2 2v9" />
  </Icon>
)

export const CloseIcon = (p: IconProps): React.JSX.Element => (
  <Icon width="14" height="14" strokeWidth="1.5" {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
)

export const CheckIcon = (p: IconProps): React.JSX.Element => (
  <Icon width="14" height="14" strokeWidth="3" {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
)

export const MinusIcon = (p: IconProps): React.JSX.Element => (
  <Icon width="16" height="16" {...p}>
    <path d="M6 12h12" />
  </Icon>
)

export const PlusIcon = (p: IconProps): React.JSX.Element => (
  <Icon width="16" height="16" {...p}>
    <path d="M12 6v12M6 12h12" />
  </Icon>
)

export const EyeIcon = (p: IconProps): React.JSX.Element => (
  <Icon width="16" height="16" {...p}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
)

export const EyeOffIcon = (p: IconProps): React.JSX.Element => (
  <Icon width="16" height="16" {...p}>
    <path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-2.6 3.5" />
    <path d="M6.6 6.6C3.7 8.5 2 12 2 12s3.6 7 10 7c1.9 0 3.6-.6 5-1.5" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    <path d="m2 2 20 20" />
  </Icon>
)

export const ArrowLeftIcon = (p: IconProps): React.JSX.Element => (
  <Icon width="16" height="16" {...p}>
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </Icon>
)

export const GripIcon = (p: IconProps): React.JSX.Element => (
  <Icon width="16" height="16" {...p}>
    <circle cx="9" cy="6" r="1" fill="currentColor" />
    <circle cx="15" cy="6" r="1" fill="currentColor" />
    <circle cx="9" cy="12" r="1" fill="currentColor" />
    <circle cx="15" cy="12" r="1" fill="currentColor" />
    <circle cx="9" cy="18" r="1" fill="currentColor" />
    <circle cx="15" cy="18" r="1" fill="currentColor" />
  </Icon>
)

export const PencilIcon = (p: IconProps): React.JSX.Element => (
  <Icon width="15" height="15" {...p}>
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
  </Icon>
)

export const TrashIcon = (p: IconProps): React.JSX.Element => (
  <Icon width="15" height="15" {...p}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
  </Icon>
)

export const SpeakerIcon = (p: IconProps): React.JSX.Element => (
  <Icon width="16" height="16" {...p}>
    <path d="M11 5 6 9H3v6h3l5 4V5Z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
  </Icon>
)
