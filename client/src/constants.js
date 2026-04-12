export const SHOES_TYPES = [
  'Dress Shoes',
  'Loafers',
  'Cowboy Boot',
  'Oxford Shoes',
  'Oxford / Dress Shoes',
  'Leather Shoes',
];

export const SHIPPING_SERVICES = ['FedEx', 'DHL', 'Local-Post', 'Skynet'];

export const PAYMENT_METHODS = ['Stripe', 'PayPal', 'Store Envy'];

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const BILLING_ACCOUNT_TYPES = ['PayPal', 'Stripe'];
export const TRANSFER_SERVICES = ['Bank Transfer', 'Wire', 'Interac', 'Other'];
export const CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL', '5XL'];
export const CLOTHING_KEYWORDS = ['jacket', 'coat', 'shirt', 'hoodie', 'sweater', 'pants', 'trouser', 'suit', 'blazer', 'vest', 'top', 'tee'];
export const SHOE_SIZES = [];
for (let s = 5; s <= 16; s += 0.5) SHOE_SIZES.push(String(s));
