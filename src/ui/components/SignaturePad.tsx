import { useEffect, useRef, type PointerEvent } from 'react';
import { strings } from '../../domain/strings';

type SignaturePadProps = {
  /** Called with true after the first stroke and false after "Limpar". */
  onChange: (signed: boolean) => void;
  /** Gives the parent a way to read the drawing (a PNG data URL) and to clear it. */
  controls: { current: { toDataUrl: () => string; clear: () => void } | null };
};

/**
 * The signature box: the student draws with a finger or the Apple Pencil. The ink and the paper
 * take the colors of the theme, so the saved image reads the same on any background.
 */
export function SignaturePad({ onChange, controls }: SignaturePadProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const signed = useRef(false);

  function paper(): CanvasRenderingContext2D | null {
    const el = canvas.current;
    const context = el?.getContext('2d') ?? null;
    if (!el || !context) return null;
    context.fillStyle = getComputedStyle(el).backgroundColor;
    context.fillRect(0, 0, el.width, el.height);
    return context;
  }

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ratio = window.devicePixelRatio || 1;
    el.width = Math.round(el.clientWidth * ratio);
    el.height = Math.round(el.clientHeight * ratio);
    paper();
    controls.current = {
      toDataUrl: () => el.toDataURL('image/png'),
      clear: () => {
        paper();
        signed.current = false;
        onChange(false);
      },
    };
    return () => {
      controls.current = null;
    };
    // The canvas is sized once, when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const el = canvas.current!;
    const box = el.getBoundingClientRect();
    return { x: ((event.clientX - box.left) / box.width) * el.width, y: ((event.clientY - box.top) / box.height) * el.height };
  }

  function down(event: PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    last.current = point(event);
  }

  function move(event: PointerEvent<HTMLCanvasElement>) {
    const from = last.current;
    const el = canvas.current;
    const context = el?.getContext('2d');
    if (!from || !el || !context) return;
    const to = point(event);
    context.strokeStyle = getComputedStyle(el).color;
    context.lineWidth = 2.5 * (window.devicePixelRatio || 1);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
    last.current = to;
    if (!signed.current) {
      signed.current = true;
      onChange(true);
    }
  }

  function up() {
    last.current = null;
  }

  return <canvas ref={canvas} className="signature-pad" aria-label={strings.health.consent.signHere} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />;
}
