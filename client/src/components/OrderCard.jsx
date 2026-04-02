import { useRef } from 'react';

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

  if (!order) return null;

  function handlePrint() {
    window.print();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="order-card-wrapper" onClick={e => e.stopPropagation()}>

        {/* action buttons — hidden on print */}
        <div className="order-card-actions no-print">
          <span className="order-card-hint">Take a screenshot or use Print to save</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-ghost" onClick={onClose}>Close</button>
            <button className="btn-primary" onClick={handlePrint}>Print / Save</button>
          </div>
        </div>

        {/* THE CARD — this is what gets printed */}
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
              <img
                src={order.image_path}
                alt="Product"
                className="oc-image"
              />
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
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
