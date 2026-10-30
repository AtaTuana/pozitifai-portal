import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { createAnalysisOrb } from './orb';

export function AnalysisOrb({
  ready,
  completed,
  total,
  onComplete,
}: {
  ready: boolean;
  completed: number;
  total: number;
  onComplete: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const orb = useRef<ReturnType<typeof createAnalysisOrb> | null>(null);
  const callback = useRef(onComplete);
  const [fused, setFused] = useState(false);
  callback.current = onComplete;
  useEffect(() => {
    if (!canvas.current) return;
    orb.current = createAnalysisOrb(canvas.current, () => setFused(true));
    return () => {
      orb.current?.dispose();
      orb.current = null;
    };
  }, []);
  useEffect(() => {
    if (ready) orb.current?.setReady();
  }, [ready]);
  useEffect(() => {
    if (!fused) return;
    const timer = setTimeout(
      () => callback.current(),
      matchMedia('(prefers-reduced-motion: reduce)').matches ? 500 : 1550,
    );
    return () => clearTimeout(timer);
  }, [fused]);
  return (
    <div className={`analysis-orb ${fused ? 'is-fused' : ''}`}>
      <div className="analysis-orb-visual">
        <canvas ref={canvas} aria-hidden="true" />
        <span className="analysis-orb-check" aria-hidden="true">
          <Icon name="check" />
        </span>
      </div>
      <div className="analysis-orb-status" role="status" aria-live="polite">
        <h2>
          {fused
            ? 'Analiz tamamlandı'
            : ready
              ? 'Analiz tamamlanıyor'
              : 'Konuşmalar analiz ediliyor'}
        </h2>
        {!fused && (
          <p>
            {completed} / {total} konuşma
          </p>
        )}
      </div>
    </div>
  );
}
