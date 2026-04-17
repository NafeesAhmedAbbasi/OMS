import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';

function formatCardDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

function paymentAbbr(method) {
  if (!method) return '';
  const map = { PayPal: 'PP', Stripe: 'S' };
  return map[method] || method;
}

export default function OrderCard({ order, onClose }) {
  const cardRef = useRef(null);
  const [sharing, setSharing] = useState(false);

  if (!order) return null;

  function handlePrint() {
    window.print();
  }

  async function handleWhatsApp() {
    setSharing(true);
    try {
      const canvas = await html2canvas(cardRef.current, { useCORS: true, scale: 2 });

      // Try Web Share API (works on mobile / supported browsers)
      if (navigator.canShare) {
        const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
        const file = new File([blob], `order-${order.order_number}.png`, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `Order #${order.order_number}`,
            text: `Order #${order.order_number} — ${order.customer}`,
          });
          return;
        }
      }

      // Fallback: download image + open WhatsApp with text
      const link = document.createElement('a');
      link.download = `order-${order.order_number}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      const text = encodeURIComponent(
        `Order #${order.order_number}\nCustomer: ${order.customer}\nSize: ${order.size}\nSource: ${order.source}\nDate: ${formatCardDate(order.date)}`
      );
      window.open(`https://wa.me/?text=${text}`, '_blank');
    } catch (err) {
      if (err.name !== 'AbortError') alert('Could not share: ' + err.message);
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="order-card-wrapper" onClick={e => e.stopPropagation()}>

        {/* action buttons — hidden on print */}
        <div className="order-card-actions no-print">
          <span className="order-card-hint">Take a screenshot or use Print to save</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-ghost" onClick={onClose}>Close</button>
            <button
              className="btn-ghost"
              onClick={handleWhatsApp}
              disabled={sharing}
              style={{ background: '#25D366', color: '#fff', border: 'none' }}
            >
              {sharing ? 'Preparing…' : 'Share via WhatsApp'}
            </button>
            <button className="btn-primary" onClick={handlePrint}>Print / Save</button>
          </div>
        </div>

        {/* THE CARD — this is what gets printed/captured */}
        <div className="order-card print-target" ref={cardRef}>

          {/* Top row: Order # | Payment | Date */}
          <div className="oc-top-row">
            <div className="oc-cell oc-order-num">
              Order # {order.order_number}
            </div>
            <div className="oc-cell oc-payment">
              {paymentAbbr(order.payment_method)}
            </div>
            <div className="oc-cell oc-date">
              Date: {formatCardDate(order.date)}
            </div>
          </div>

          {/* Image row */}
          <div className="oc-image-row">
            {order.image_path ? (
              order.image_path.split(',').filter(Boolean).map((url, i, arr) => (
                <img
                  key={i}
                  src={url}
                  alt={`Product ${i + 1}`}
                  className="oc-image"
                  crossOrigin="anonymous"
                  style={arr.length > 1 ? { borderLeft: i > 0 ? '2px solid #000' : undefined } : {}}
                />
              ))
            ) : (
              <div className="oc-image-placeholder">
                <span>No Image</span>
              </div>
            )}
          </div>

          {/* Bottom row: Source/StoreRef | Customer+Address | Size */}
          <div className="oc-bottom-row">
            <div className="oc-cell oc-source">
              <span>@ {order.source}</span>
              {order.store_ref && <span>#{order.store_ref}</span>}
            </div>
            <div className="oc-cell oc-address">
              <strong>{order.customer}</strong>
              {order.shipping_address && (
                <span className="oc-addr-text">{order.shipping_address}</span>
              )}
            </div>
            <div className="oc-cell oc-size">
              US-Size:{order.size}
              {order.comments && (
                <span style={{ display: 'block', fontSize: 12, fontWeight: 400, color: '#333', marginTop: 6, textAlign: 'right', lineHeight: 1.4 }}>
                  {order.comments}
                </span>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

