(function (root) {
  'use strict';
  const MAX_QUANTITY = 20;
  function escapeHTML(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function money(cents) { return 'S$' + (Math.round(cents) / 100).toFixed(2); }
  function crowdStatus(value) {
    const percent = Math.max(0, Math.min(100, Number(value) || 0));
    return percent <= 30 ? { label: 'Good to go', tone: 'quiet' } : percent <= 60 ? { label: 'A bit crowded', tone: 'moderate' } : { label: 'Very crowded', tone: 'busy' };
  }
  function sanitizeCart(cart, catalog) {
    if (!Array.isArray(cart)) return [];
    const merged = new Map();
    cart.slice(0, 100).forEach(line => {
      if (!line || typeof line !== 'object') return;
      const item = catalog.find(i => i.id === line.id && Number.isInteger(i.price));
      const quantity = Number(line.quantity);
      if (!item || !Number.isFinite(quantity) || quantity < 1) return;
      const size = line.size === 'large' && Number.isInteger(item.largePrice) ? 'large' : 'regular';
      const key = item.id + ':' + size;
      merged.set(key, { id: item.id, size, quantity: Math.min(MAX_QUANTITY, Math.floor(quantity) + (merged.get(key)?.quantity || 0)) });
    });
    return [...merged.values()];
  }
  function cartDetails(cart, catalog) {
    return sanitizeCart(cart, catalog).map(line => {
      const item = catalog.find(i => i.id === line.id);
      const price = line.size === 'large' ? item.largePrice : item.price;
      return { ...line, key: line.id + ':' + line.size, name: item.name, stall: item.stall, unitPrice: price, total: price * line.quantity };
    });
  }
  function cartTotal(cart, catalog) { return cartDetails(cart, catalog).reduce((n, line) => n + line.total, 0); }
  function roomLocation(block, level, room) {
    const b = String(block || '').trim().toUpperCase();
    const l = String(level || '').trim();
    const r = String(room || '').trim();
    if (!/^[A-Z0-9]{1,5}$/.test(b) || !/^[1-9][0-9]?$/.test(l) || !/^[A-Za-z0-9-]{1,12}$/.test(r)) return null;
    return b + '.' + l + '.' + r;
  }
  function orderStage(order, now) {
    if (order.cancelled) return { id: 'cancelled', index: -1, title: 'Order cancelled', description: 'Your demo order has been cancelled.' };
    if (order.collected) return { id: 'complete', index: 3, title: 'Collected. Enjoy!', description: 'Your demo pickup is complete.' };
    const elapsed = Math.max(0, now - order.createdAt);
    const pickup = order.fulfilment === 'pickup';
    if (elapsed < 5000) return { id: 'received', index: 0, title: 'Your order is confirmed.', description: 'The kitchen has received your demo order.' };
    if (elapsed < 30000) return { id: 'kitchen', index: 1, title: 'Your order is in the kitchen.', description: 'A little patience. Something good is coming.' };
    if (pickup) return { id: 'ready', index: 2, title: 'Ready for pickup.', description: 'Your demo order is ready at Food Clique.' };
    if (elapsed < 50000) return { id: 'ready', index: 2, title: 'Packed and ready.', description: 'Your demo meal is ready to leave the kitchen.' };
    if (elapsed < 90000) return { id: 'delivery', index: 3, title: 'On the way to you.', description: 'Your demo delivery is heading to seminar room ' + order.location + '.' };
    return { id: 'complete', index: 4, title: 'Your food has arrived. Enjoy!', description: 'Demo delivery completed at seminar room ' + order.location + '.' };
  }
  const api = { MAX_QUANTITY, escapeHTML, money, crowdStatus, sanitizeCart, cartDetails, cartTotal, roomLocation, orderStage };
  root.FoodLoopCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
