import { MONTHS } from '../constants';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${parseInt(d)} ${MONTHS[parseInt(m) - 1]}, ${y}`;
}

function DetailRow({ label, value, highlight }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className={`detail-value${highlight ? ' detail-value-highlight' : ''}`}>
        {value || <span className="text-muted">—</span>}
      </span>
    </div>
  );
}

export default function OrderDetailPanel({ order, onClose, onEdit }) {
  if (!order) return null;

  return (
    <>
      <div className="panel-overlay" onClick={onClose} />
      <div className="edit-panel">
        <div className="edit-panel-header">
          <div>
            <div className="edit-panel-title">Order Details</div>
            <div className="edit-panel-order-num">Order # {order.order_number}</div>
          </div>
          <button className="btn-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="edit-panel-body detail-panel-body">

          <div className="detail-section">
            <div className="detail-section-title">Order Info</div>
            <DetailRow label="Date"         value={formatDate(order.date)} />
            <DetailRow label="Order #"      value={order.order_number} highlight />
            <DetailRow label="Customer"     value={order.customer} />
            <DetailRow label="Store-Ref #"  value={order.store_ref} />
            <DetailRow label="Source"       value={order.source} />
            <DetailRow label="Quantity"     value={order.quantity} />
          </div>

          <div className="detail-section">
            <div className="detail-section-title">Product</div>
            <DetailRow label="Shoes Type"  value={order.shoes_type} />
            <DetailRow label="Size"        value={order.size ? `US ${order.size}` : null} />
            <DetailRow label="Color"       value={order.color} />
            <DetailRow label="Country"     value={order.country} />
          </div>

          <div className="detail-section">
            <div className="detail-section-title">Financials</div>
            <DetailRow label="Order Amount" value={order.order_amount != null ? `$${Number(order.order_amount).toFixed(2)}` : null} highlight />
            <DetailRow label="Payment"      value={order.payment_method} />
            <DetailRow label="MC (PKR)"     value={order.mc_pkr != null ? order.mc_pkr.toLocaleString() : null} />
            <DetailRow label="SC (PKR)"     value={order.sc_pkr != null ? order.sc_pkr.toLocaleString() : null} />
          </div>

          <div className="detail-section">
            <div className="detail-section-title">Shipping</div>
            <DetailRow label="Service"   value={order.shipping_service} />
            <DetailRow label="Tracking"  value={order.tracking} />
          </div>

          {order.comments && (
            <div className="detail-section">
              <div className="detail-section-title">Comments</div>
              <p className="detail-comments">{order.comments}</p>
            </div>
          )}

          {order.image_path && (
            <div className="detail-section">
              <div className="detail-section-title">Image</div>
              <a href={order.image_path} target="_blank" rel="noreferrer" className="detail-image-link">
                <img src={order.image_path} alt="Order" className="detail-image" />
              </a>
            </div>
          )}

        </div>

        <div className="edit-panel-footer">
          <button className="btn-ghost" onClick={onClose}>Close</button>
          <button className="btn-primary" onClick={() => onEdit(order)}>Edit Order</button>
        </div>
      </div>
    </>
  );
}
