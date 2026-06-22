import { JSX } from 'preact';

type IconProps = { size?: number; class?: string };

function svg(children: JSX.Element | JSX.Element[], size = 18, cls?: string): JSX.Element {
  return (
    <svg
      class={cls}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function BullLogo({ size = 28, class: cls }: IconProps): JSX.Element {
  return (
    <svg
      class={cls}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M5 6c3.2 0 5.2 2 5.7 5.2" />
      <path d="M27 6c-3.2 0-5.2 2-5.7 5.2" />
      <path d="M8 11c0 6 3.6 10 8 10s8-4 8-10" />
      <path d="M8.2 11.2c-.4 2 .1 3.8 1 4.9" />
      <path d="M23.8 11.2c.4 2-.1 3.8-1 4.9" />
      <circle cx="12.6" cy="13.6" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="19.4" cy="13.6" r="1.15" fill="currentColor" stroke="none" />
      <path d="M13.4 18.4c1.6 1.1 3.6 1.1 5.2 0" />
    </svg>
  );
}

export const IconRetry = (p: IconProps) =>
  svg(
    [
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />,
      <path d="M21 3v5h-5" />,
    ],
    p.size,
    p.class,
  );

export const IconPromote = (p: IconProps) =>
  svg([<path d="M12 19V5" />, <path d="M6 11l6-6 6 6" />], p.size, p.class);

export const IconTrash = (p: IconProps) =>
  svg(
    [
      <path d="M3 6h18" />,
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />,
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />,
      <path d="M10 11v6M14 11v6" />,
    ],
    p.size,
    p.class,
  );

export const IconPause = (p: IconProps) =>
  svg([<path d="M9 4v16M15 4v16" />], p.size, p.class);

export const IconPlay = (p: IconProps) => svg([<path d="M7 4l13 8-13 8V4z" />], p.size, p.class);

export const IconBroom = (p: IconProps) =>
  svg(
    [
      <path d="M12 3l1.5 4.1L17.6 8.6 13.5 10 12 14.1 10.5 10 6.4 8.6 10.5 7.1z" />,
      <path d="M18 14l.9 2.3L21 17l-2.1.7L18 20l-.9-2.3L15 17l2.1-.7z" />,
    ],
    p.size,
    p.class,
  );

export const IconRefresh = (p: IconProps) =>
  svg(
    [
      <path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-6.36-2.64" />,
      <path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 6.36 2.64" />,
      <path d="M21 3v5h-5" />,
      <path d="M3 21v-5h5" />,
    ],
    p.size,
    p.class,
  );

export const IconSun = (p: IconProps) =>
  svg(
    [
      <circle cx="12" cy="12" r="4" />,
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />,
    ],
    p.size,
    p.class,
  );

export const IconMoon = (p: IconProps) =>
  svg([<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />], p.size, p.class);

export const IconClose = (p: IconProps) =>
  svg([<path d="M18 6L6 18M6 6l12 12" />], p.size, p.class);

export const IconChevron = (p: IconProps) => svg([<path d="M9 6l6 6-6 6" />], p.size, p.class);

export const IconLock = (p: IconProps) =>
  svg(
    [
      <rect x="5" y="11" width="14" height="9" rx="2" />,
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />,
    ],
    p.size,
    p.class,
  );

export const IconCpu = (p: IconProps) =>
  svg(
    [
      <rect x="6" y="6" width="12" height="12" rx="2" />,
      <rect x="9" y="9" width="6" height="6" rx="1" />,
      <path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2" />,
    ],
    p.size,
    p.class,
  );

export const IconBolt = (p: IconProps) =>
  svg([<path d="M13 2L4.5 13.5H11l-1 8.5L18.5 10.5H12z" />], p.size, p.class);

export const IconWarning = (p: IconProps) =>
  svg(
    [
      <path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0z" />,
      <path d="M12 9v4M12 17h.01" />,
    ],
    p.size,
    p.class,
  );

export const IconPlus = (p: IconProps) => svg([<path d="M12 5v14M5 12h14" />], p.size, p.class);

export const IconDownload = (p: IconProps) =>
  svg([<path d="M12 3v12M7 10l5 5 5-5M5 21h14" />], p.size, p.class);

export const IconSearch = (p: IconProps) =>
  svg([<circle cx="11" cy="11" r="7" />, <path d="M21 21l-4.3-4.3" />], p.size, p.class);
