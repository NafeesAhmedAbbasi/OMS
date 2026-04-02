export const SOURCES = ['TLH', 'Lajuria', 'UHMLS'];

export const SHOES_TYPES = [
  'Dress Shoes',
  'Loafers',
  'Cowboy Boot',
  'Oxford Shoes',
  'Oxford / Dress Shoes',
  'Leather Shoes',
];

export const SHIPPING_SERVICES = ['FedEx', 'DHL', 'Local-Post', 'Skynet'];

export const PAYMENT_METHODS = ['Stripe', 'PayPal'];

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// US shoe sizes 5 to 16 in 0.5 increments
export const SHOE_SIZES = [];
for (let s = 5; s <= 16; s += 0.5) {
  SHOE_SIZES.push(String(s % 1 === 0 ? `${s}` : `${s}`));
}
