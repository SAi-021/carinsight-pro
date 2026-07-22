/* ============================================================
   CarInsight Pro — Skeleton Loaders
   File: src/components/Skeleton.jsx
   ============================================================ */

/** Single shimmering line */
export const SkelLine = ({ width = '100%', height = 14, style = {} }) => (
  <div className="skel skel-line" style={{ width, height, ...style }} />
);

/** Big block (for chart placeholders) */
export const SkelBlock = ({ height = 200 }) => (
  <div className="skel" style={{ width: '100%', height, borderRadius: 10 }} />
);

/** Circular shimmer (avatars, icons) */
export const SkelCircle = ({ size = 40 }) => (
  <div className="skel skel-circle" style={{ width: size, height: size }} />
);

/**
 * The hero "price loading" skeleton — mimics the exact shape of
 * the final mega-price card so the layout doesn't jump on resolve.
 */
export const SkelPriceCard = () => (
  <div className="mega-price-card" style={{ borderColor: 'var(--border2)', boxShadow: 'var(--shadow-card)' }}>
    <SkelLine width={160} height={11} style={{ marginBottom: 14 }} />
    <div className="skel skel-line-xl" style={{ width: '60%', height: 72, marginBottom: 22 }} />
    <div style={{ display: 'flex', gap: 24, paddingTop: 18, borderTop: '1px dashed var(--border2)' }}>
      <div style={{ flex: 1 }}>
        <SkelLine width={70} height={10} />
        <SkelLine width={110} height={18} />
      </div>
      <div style={{ flex: 1 }}>
        <SkelLine width={70} height={10} />
        <SkelLine width={110} height={18} />
      </div>
      <div style={{ flex: 1 }}>
        <SkelLine width={70} height={10} />
        <SkelLine width={110} height={18} />
      </div>
    </div>
  </div>
);
