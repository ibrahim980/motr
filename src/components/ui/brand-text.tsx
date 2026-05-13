import { Fragment } from 'react';

const BRAND_PATTERN = /(موتر|MOTR|Motr)/g;
const BRAND_TOKENS = new Set(['موتر', 'Motr', 'MOTR']);

interface BrandTextProps {
  children: string;
  /** Inline-image height as a CSS length. Defaults to 1.4em so the
   *  inner wordmark in motr2.svg ends up roughly matching surrounding text. */
  size?: string;
  className?: string;
}

/**
 * Replaces every occurrence of "موتر" / "Motr" / "MOTR" in `children`
 * with an inline <img src="/motr2.svg" /> so the brand mark stays
 * visually consistent everywhere it's mentioned in body copy.
 */
export function BrandText({ children, size = '1.4em', className }: BrandTextProps) {
  if (!children) return null;
  const parts = children.split(BRAND_PATTERN);
  return (
    <>
      {parts.map((part, i) => {
        if (BRAND_TOKENS.has(part)) {
          return (
            <img
              key={i}
              src="/motr2.svg"
              alt="MOTR"
              className={className ?? 'inline-block w-auto align-middle mx-0.5'}
              style={{ height: size }}
            />
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}
