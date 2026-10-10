import type { SVGProps } from 'react';

// Ícones em traço (estilo Lucide), herdam a cor via currentColor.

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 20, children, ...props }: IconProps) {
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
      {...props}
    >
      {children}
    </svg>
  );
}

export const MailIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2.5" y="4.5" width="19" height="15" rx="2" />
    <path d="m3 6.5 8.1 6.2a1.5 1.5 0 0 0 1.8 0L21 6.5" />
  </Icon>
);

export const LockIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
  </Icon>
);

export const EyeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

export const EyeOffIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9.9 9.9a3 3 0 1 0 4.2 4.2" />
    <path d="M10.7 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a13 13 0 0 1-1.7 2.7" />
    <path d="M6.6 6.6A13.5 13.5 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
    <path d="m2 2 20 20" />
  </Icon>
);

export const ArrowRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </Icon>
);

export const StoreIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 8.5 5 4h14l2 4.5" />
    <path d="M3 8.5h18v1.2a2.6 2.6 0 0 1-4.5 1.8 2.6 2.6 0 0 1-4.5 0 2.6 2.6 0 0 1-4.5 0A2.6 2.6 0 0 1 3 9.7Z" />
    <path d="M4.5 12.5V20h15v-7.5" />
    <path d="M9.5 20v-4.5h5V20" />
  </Icon>
);

export const FileTextIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2.5V8h5.5" />
    <path d="M8.5 12.5h7M8.5 16.5h7" />
  </Icon>
);

export const BarChartIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="12" width="3.5" height="8" rx="1" />
    <rect x="10.25" y="5" width="3.5" height="15" rx="1" />
    <rect x="16.5" y="9" width="3.5" height="11" rx="1" />
  </Icon>
);

export const CheckCircleIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9.5" />
    <path d="m8 12.2 2.7 2.7L16.2 9.4" />
  </Icon>
);

/** Marca do app: barras de onda sonora */
export function LogoMark({ size = 36, color = 'var(--accent)' }: { size?: number; color?: string }) {
  const bars = [
    [3, 14, 22],
    [9, 8, 28],
    [15, 2, 34],
    [21, 8, 28],
    [27, 14, 22],
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 30 36" fill="none" aria-hidden="true">
      {bars.map(([x, y1, y2]) => (
        <line key={x} x1={x} y1={y1} x2={x} y2={y2} stroke={color} strokeWidth={2.6} strokeLinecap="round" />
      ))}
    </svg>
  );
}
