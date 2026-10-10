// Feixe de linhas onduladas (ilustração de onda sonora do login), gerado deterministicamente em SVG.

/** [centro (0–1), largura (0–1), altura (positiva = para cima)] */
type Peak = [number, number, number];

const PRESETS: Record<'hero' | 'compact', { peaks: Peak[]; lines: number }> = {
  // Painel azul do desktop: pico alto à esquerda do centro, vale, pico menor à direita
  hero: {
    lines: 28,
    peaks: [
      [0.08, 0.1, 0.12],
      [0.24, 0.08, -0.18],
      [0.42, 0.075, 1],
      [0.57, 0.07, -0.3],
      [0.74, 0.085, 0.55],
      [0.92, 0.08, -0.15],
    ],
  },
  // Topo do mobile: pico central com ondas menores nas laterais
  compact: {
    lines: 24,
    peaks: [
      [0.12, 0.08, 0.25],
      [0.3, 0.07, -0.35],
      [0.5, 0.08, 1],
      [0.68, 0.07, -0.3],
      [0.85, 0.08, 0.4],
    ],
  },
};

const gauss = (x: number, c: number, w: number) => Math.exp(-(((x - c) / w) ** 2));

export function WaveLines({
  variant,
  className,
  width = 700,
  height = 220,
}: {
  variant: 'hero' | 'compact';
  className?: string;
  width?: number;
  height?: number;
}) {
  const { peaks, lines } = PRESETS[variant];
  const steps = 140;
  const paths: { d: string; opacity: number }[] = [];

  for (let i = 0; i < lines; i++) {
    const t = i / (lines - 1); // 0..1 ao longo do feixe
    const spread = t - 0.5;
    let d = '';
    for (let s = 0; s <= steps; s++) {
      const u = s / steps;
      let shape = 0;
      for (const [c, w, h] of peaks) {
        // cada linha desloca levemente o centro e a altura dos picos: dá o efeito de fios entrelaçados
        shape += h * gauss(u, c + spread * 0.09, w * (1 + spread * 0.4)) * (0.5 + 0.5 * Math.cos(spread * Math.PI));
      }
      // o feixe abre nos picos e se estreita nas pontas
      const fan = spread * height * 0.22 * (0.35 + Math.sin(u * Math.PI));
      const y = height * 0.72 - shape * height * 0.62 + fan * Math.sin(u * Math.PI * 2.4 + t * 2.5);
      d += `${s ? 'L' : 'M'}${(u * width).toFixed(1)} ${y.toFixed(1)}`;
    }
    paths.push({ d, opacity: Math.round((0.18 + 0.62 * (1 - Math.abs(spread) * 2)) * 1000) / 1000 });
  }

  return (
    <svg
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      aria-hidden="true"
    >
      {paths.map((p, i) => (
        <path key={i} d={p.d} opacity={p.opacity} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}
