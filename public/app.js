/* No external services or runtime dependencies. Open index.html or serve dist/. */
(function () {
  'use strict';
  const D = window.FoodLoopData;
  const C = window.FoodLoopCore;
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const e = C.escapeHTML;
  const STORAGE_KEY = 'suss-foodloop:v1';
  const dialog = $('#app-dialog');
  const intro = $('#intro-dialog');
  let storageAvailable = true;
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; }
  catch (_) { stored = {}; }
  const state = {
    cart: C.sanitizeCart(stored.cart, D.items),
    orders: sanitizeOrders(stored.orders),
    reports: sanitizeReports(stored.reports),
    feedback: Array.isArray(stored.feedback) ? stored.feedback.filter(f => f && Number(f.rating) >= 1 && Number(f.rating) <= 5 && typeof f.message === 'string').slice(-100) : [],
    venue: 'clique', category: 'all', search: '', sort: 'default',
    lastSection: 'home', view: '', activeOrder: '', busy: false,
    checkoutDraft: { fulfilment: 'pickup', payment: 'paynow', block: '', level: '', room: '', notes: '' }
  };
  let illustrationId = 0;
  let toastTimer;
  const music = $('#background-music');
  const introVideo = $('#intro-video');
  const heroVideo = $('#hero-video');
  let introFallback;
  let introLeaving=false;
  let soundOn = false;
  let lastTrackingSignature = '';

  function sanitizeReports(reports) {
    const result = {};
    if (!reports || typeof reports !== 'object') return result;
    D.venues.forEach(v => {
      const r = reports[v.id];
      if (r && Number.isInteger(r.occupancy) && r.occupancy >= 0 && r.occupancy <= 100 && Number.isFinite(r.at)) result[v.id] = { occupancy: r.occupancy, at: r.at };
    });
    return result;
  }
  function sanitizeOrders(orders) {
    if (!Array.isArray(orders)) return [];
    return orders.filter(o => o && typeof o.id === 'string' && /^FL-[A-Z0-9-]+$/.test(o.id) && Number.isFinite(o.createdAt) && Array.isArray(o.items) && o.items.length && ['pickup', 'delivery'].includes(o.fulfilment)).slice(0, 10).map(o => ({
      id: o.id, createdAt: o.createdAt, fulfilment: o.fulfilment,
      location: String(o.location || '').slice(0, 32), payment: ['apple', 'card', 'paynow'].includes(o.payment) ? o.payment : 'paynow', notes: String(o.notes || '').slice(0, 300), collected: !!o.collected, cancelled: !!o.cancelled,
      items: o.items.filter(i => i && typeof i.name === 'string' && Number.isInteger(i.unitPrice) && i.unitPrice >= 0 && Number.isInteger(i.quantity) && i.quantity > 0 && i.quantity <= C.MAX_QUANTITY).map(i => ({ name: i.name.slice(0, 100), size: i.size === 'large' ? 'large' : 'regular', quantity: i.quantity, unitPrice: i.unitPrice })),
      total: 0
    })).filter(o => o.items.length).map(o => ({ ...o, total: o.items.reduce((t, i) => t + i.unitPrice * i.quantity, 0) }));
  }
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ cart: state.cart, orders: state.orders, reports: state.reports, feedback: state.feedback }));
      storageAvailable = true;
    } catch (_) {
      storageAvailable = false;
      toast('Browser storage is unavailable. This session will work, but changes may not survive a reload.');
    }
  }
  function toast(message) {
    clearTimeout(toastTimer);
    $('#toast-region').innerHTML = '<div class="toast">' + e(message) + '</div>';
    toastTimer = setTimeout(() => { $('#toast-region').innerHTML = ''; }, 4000);
  }
  function timeLabel(at) {
    return new Date(at).toLocaleTimeString('en-SG', { timeZone: 'Asia/Singapore', hour: '2-digit', minute: '2-digit' });
  }
  function dateLabel(at) {
    return new Date(at).toLocaleString('en-SG', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  function venueSnapshot(venue) {
    const report = state.reports[venue.id];
    return { ...venue, occupancy: report ? report.occupancy : venue.occupancy, timestamp: report ? timeLabel(report.at) : venue.time, local: !!report };
  }
  function renderVenues() {
    const venues = D.venues.map(venueSnapshot);
    const best = venues.reduce((a, b) => a.occupancy <= b.occupancy ? a : b);
    $('#venue-grid').innerHTML = venues.map(v => {
      const status = C.crowdStatus(v.occupancy);
      return `<article class="venue-card ${e(v.theme)}"><div class="venue-orb ${e(v.theme)}" aria-hidden="true"></div><h3>${e(v.name)}</h3><p>${e(v.description)}</p><span class="venue-number">${v.occupancy}<small>%</small></span><div class="venue-status ${status.tone}-text"><span class="${status.tone}"></span>${e(status.label)}</div><button class="card-link" data-action="crowd" data-id="${e(v.id)}" aria-label="Check crowd at ${e(v.name)}">Check the crowd <span aria-hidden="true">↗</span></button><div class="card-footer"><span class="outline-tag">${v.local ? 'Your local demo report' : 'Demo crowd snapshot'}</span><span class="snapshot-time">${e(v.timestamp)}</span></div></article>`;
    }).join('') + `<article class="recommendation-card"><span class="recommend-flower" aria-hidden="true">✳</span><p class="section-label">A LITTLE ROOM TO BREATHE.</p><div><h3>Less crowd.<br>More you.</h3><p><strong>${e(best.name)}</strong> is the quietest option in this demo, at ${best.occupancy}% crowded. A good place to start your next break.</p><button class="text-button text-link" data-action="crowd" data-id="${e(best.id)}">Explore this cafeteria <span aria-hidden="true">↗</span></button></div><p class="small muted">Based on the demo figures and any local reports you try.</p></article>`;
  }

  // Deterministic vector illustrations: no missing image URLs or remote photo dependencies.
  function dishArt(type) {
    const id = 'plate-' + (++illustrationId);
    const salad = ['salad', 'avocado'].includes(type);
    const noodles = ['udon', 'ramen'].includes(type);
    const chicken = ['chicken', 'sesame'].includes(type);
    const fill = salad ? '#779069' : chicken ? '#bf773d' : type === 'mala' ? '#ac5438' : '#cb8b58';
    let toppings = '';
    if (noodles) {
      toppings = '<g stroke="#e8cda0" stroke-width="6" fill="none"><path d="M57 68c45-35 84 10 23 30s-45-9-9-29 87 17 23 33"/><path d="M70 58c55-17 62 22 12 27S55 69 99 65s56 18 10 31"/><path d="M65 92c36 5 59-9 48-22"/></g><path d="M111 67c8-18 21-12 20 1s-18 16-20-1" fill="#f5e4ba"/><ellipse cx="121" cy="66" rx="5" ry="6" fill="#d99b47"/>';
    } else if (salad) {
      toppings = '<g fill="#719266"><ellipse cx="75" cy="72" rx="21" ry="11" transform="rotate(-35 75 72)"/><ellipse cx="118" cy="70" rx="22" ry="12" transform="rotate(25 118 70)"/><ellipse cx="110" cy="95" rx="25" ry="9" transform="rotate(-25 110 95)"/><ellipse cx="77" cy="98" rx="21" ry="12"/></g><g fill="#b6c998"><ellipse cx="90" cy="65" rx="10" ry="15" transform="rotate(40 90 65)"/><ellipse cx="122" cy="92" rx="10" ry="15" transform="rotate(30 122 92)"/></g><g fill="#c87351"><circle cx="65" cy="87" r="7"/><circle cx="134" cy="76" r="6"/></g>';
      toppings += type === 'avocado' ? '<path d="M83 92c5-29 34-37 38-15-3 13-18 18-38 15" fill="#d5d49a"/><path d="M88 88c3-20 27-29 29-14-4 9-13 13-29 14" fill="#96a863"/>' : '<g fill="#dfbc8d"><path d="m79 76 15-5 5 10-16 5zM107 80l15 1 1 9-17-2zM83 94l13-4 4 10-12 5z"/></g>';
    } else {
      const pieces = [[70,69,-20],[98,64,18],[121,79,25],[77,91,15],[105,95,-10],[92,81,30]];
      toppings = pieces.map(([x,y,r]) => `<rect x="${x-11}" y="${y-7}" width="25" height="17" rx="7" fill="${fill}" transform="rotate(${r} ${x} ${y})"/><path d="m${x-7} ${y-3} 11 1" stroke="#ecc293" stroke-width="1.5" opacity=".7"/>`).join('');
      if (!chicken) toppings += '<g fill="#d8b795"><rect x="65" y="73" width="12" height="10" rx="3"/><rect x="106" y="62" width="14" height="12" rx="3"/></g>';
    }
    const dots = Array.from({length:10}, (_,i)=>`<ellipse cx="${65+i*7}" cy="${68+(i*11)%34}" rx="1.6" ry="1" fill="${type==='sesame'?'#f6dfb0':'#5a7651'}" transform="rotate(${i*13} ${65+i*7} ${68+(i*11)%34})"/>`).join('');
    return `<svg class="dish-illustration" viewBox="0 0 200 160" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#fcf5e6"/><stop offset="1" stop-color="#c9b59c"/></linearGradient></defs><ellipse cx="100" cy="127" rx="58" ry="9" fill="#71563c" opacity=".08"/><path d="M37 82c6 36 21 45 63 45s57-9 63-45" fill="url(#${id})"/><ellipse cx="100" cy="82" rx="66" ry="37" fill="#f4ecdc"/><ellipse cx="100" cy="82" rx="52" ry="28" fill="${salad?'#9cab7e':noodles?'#a98460':'#b79c78'}" opacity=".25"/>${toppings}<g>${dots}</g><path d="M38 83c14 25 109 31 124-1" fill="none" stroke="#fff" stroke-width="3" opacity=".45"/><path d="m139 44 36 70m-29-74 35 67" stroke="#95714d" stroke-width="3" stroke-linecap="round"/></svg>`;
  }
  function renderMenu() {
    $('#menu-available').hidden = state.venue !== 'clique';
    $('#menu-unavailable').hidden = state.venue === 'clique';
    $$('#venue-tabs button').forEach(button => {
      const active = button.dataset.venue === state.venue;
      button.classList.toggle('active', active); button.setAttribute('aria-pressed', active);
    });
    $('#category-tabs').innerHTML = D.categories.map(cat => `<button class="${state.category === cat.id ? 'active' : ''}" data-category="${cat.id}" aria-pressed="${state.category === cat.id}">${e(cat.name)}</button>`).join('');
    const search = state.search.trim().toLowerCase();
    let items = D.items.filter(item => (state.category === 'all' || item.category === state.category) && (!search || [item.name,item.stall,item.description].join(' ').toLowerCase().includes(search)));
    if (state.sort === 'price-low') items.sort((a,b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    else if (state.sort === 'price-high') items.sort((a,b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
    else if (state.sort === 'name') items.sort((a,b) => a.name.localeCompare(b.name));
    $('#menu-result-count').textContent = items.length + (items.length === 1 ? ' dish' : ' dishes') + ' · demo menu';
    $('#dish-grid').innerHTML = items.length ? items.map(item => `<article class="dish-card"><div class="dish-visual y${item.category}"><span class="dish-art-label">FOODLOOP · ILLUSTRATION</span>${dishArt(item.art)}</div><div class="dish-info"><p class="dish-stall">${e(item.stall.toUpperCase())}</p><h3>${e(item.name)}</h3><p class="dish-description">${e(item.description)}</p><div class="dish-actions"><span class="dish-price">${item.price === null ? '<small>Price to be confirmed</small>' : C.money(item.price) + (item.largePrice ? ' <small>/ ' + C.money(item.largePrice) + '</small>' : '')}</span>${item.largePrice ? `<select id="size-${item.id}" aria-label="Portion size for ${e(item.name)}"><option value="regular">Regular · ${C.money(item.price)}</option><option value="large">Large · ${C.money(item.largePrice)}</option></select>` : ''}</div><div class="dish-bottom"><span class="small muted">${e(item.tags[0])}</span><button class="add-button" data-action="add" data-id="${item.id}" aria-label="Add ${e(item.name)} to basket" ${item.price === null ? 'disabled' : ''}>${item.price === null ? 'Coming soon' : 'Add +'} </button></div></div></article>`).join('') : '<div class="no-results"><h3>No favourites found. Yet.</h3><p>Try another search or explore all the dishes.</p><button class="text-button" data-action="reset-menu">Reset filters ↗</button></div>';
  }
  function updateBasket() {
    const quantity = state.cart.reduce((sum, line) => sum + line.quantity, 0);
    $('#basket-count').textContent = quantity;
    $('#floating-quantity').textContent = quantity + (quantity === 1 ? ' item' : ' items');
    $('#floating-total').textContent = C.money(C.cartTotal(state.cart, D.items));
    $('#floating-basket').hidden = quantity === 0 || dialog.open || intro.open;
  }
  function addItem(id) {
    const item = D.items.find(i => i.id === id);
    if (!item || !Number.isInteger(item.price)) return;
    const size = $('#size-' + id)?.value === 'large' ? 'large' : 'regular';
    const line = state.cart.find(i => i.id === id && i.size === size);
    if (line && line.quantity >= C.MAX_QUANTITY) return toast('The demo allows up to ' + C.MAX_QUANTITY + ' of each portion.');
    if (line) line.quantity++; else state.cart.push({id, size, quantity:1});
    save(); updateBasket(); toast(item.name + (item.largePrice ? ' · ' + size : '') + ' added to your basket.');
  }

  function go(route) {
    if (location.hash.slice(1) === route) handleRoute(); else location.hash = route;
  }
  function setPanel(content, view) {
    state.view = view;
    dialog.classList.toggle('drawer', view === 'cart');
    dialog.classList.toggle('account-panel', view === 'account');
    $('#dialog-content').innerHTML = content;
    if (!dialog.open) dialog.showModal();
    document.body.classList.add('panel-open');
    updateBasket();
  }
  function closePanel() {
    state.view = '';
    if (dialog.open) dialog.close();
    document.body.classList.remove('panel-open');
    updateBasket();
    const route = location.hash.slice(1);
    if (/^(cart|checkout|orders|order\/|crowd\/|privacy|clear-data|account|signup|login)/.test(route)) go(state.lastSection || 'home');
  }
  function handleRoute() {
    if (intro.open) return;
    let route;
    try { route = decodeURIComponent(location.hash.slice(1)); }
    catch (_) { route = 'home'; }
    if (['account','signup','login'].includes(route)) return window.FoodLoopAuth?.render(route);
    if (route === 'cart') return renderCart();
    if (route === 'checkout') return renderCheckout();
    if (route === 'orders') return renderOrders();
    if (route.startsWith('order/')) return renderTracking(route.slice(6));
    if (route.startsWith('crowd/')) return renderCrowd(route.slice(6));
    if (route === 'privacy') return renderPrivacy();
    if (route === 'clear-data') return renderClearData();
    if (dialog.open) dialog.close();
    state.view = ''; document.body.classList.remove('panel-open'); updateBasket();
    const target = route || 'home';
    if (document.getElementById(target)) { state.lastSection = target; document.getElementById(target).scrollIntoView({behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'}); }
    $('#main-nav').classList.remove('open'); $('#mobile-menu').setAttribute('aria-expanded', 'false');
  }
  function renderCart() {
    const lines = C.cartDetails(state.cart, D.items);
    const content = `<p class="dialog-eyebrow">GOOD FOOD. ONE LITTLE BASKET.</p><h2 id="dialog-title">Your order.</h2>`;
    if (!lines.length) return setPanel(content + '<div class="empty-basket"><span class="empty-flower" aria-hidden="true">✳</span><h3>A little room for something good.</h3><p>Your basket is empty. Explore the menu and find your next favourite.</p><button class="dark-button" data-action="browse-menu">Explore the menu ↗</button></div><button class="text-button" data-action="orders">View previous demo orders ↗</button>', 'cart');
    setPanel(content + `<p class="dialog-intro">Food Clique · ${state.cart.reduce((s,i)=>s+i.quantity,0)} items</p><div class="cart-lines">${lines.map(line => {
      const item = D.items.find(i => i.id === line.id);
      return `<article class="cart-line"><div class="cart-line-art">${dishArt(item.art)}</div><div class="cart-line-info"><h3>${e(line.name)}</h3><p>${e(line.stall)}${item.largePrice ? ' · ' + e(line.size) : ''} · ${C.money(line.unitPrice)} each</p><div class="line-controls"><div class="quantity-control"><button data-action="quantity" data-key="${e(line.key)}" data-change="-1" aria-label="Decrease ${e(line.name)} ${line.size} quantity">−</button><span aria-label="Quantity">${line.quantity}</span><button data-action="quantity" data-key="${e(line.key)}" data-change="1" aria-label="Increase ${e(line.name)} ${line.size} quantity" ${line.quantity >= C.MAX_QUANTITY ? 'disabled' : ''}>+</button></div><button class="remove-line" data-action="remove" data-key="${e(line.key)}" aria-label="Remove ${e(line.name)} ${line.size}">Remove</button></div></div><span class="cart-line-price">${C.money(line.total)}</span></article>`;
    }).join('')}</div><div class="cart-summary"><span>Subtotal</span><span>${C.money(C.cartTotal(state.cart,D.items))}</span></div><p class="small muted">Pickup or seminar-room delivery · estimated wait: 15 minutes</p><div class="cart-actions"><button class="dark-button" data-action="checkout">Proceed to checkout <span aria-hidden="true">↗</span></button><button class="outline-button" data-action="browse-menu">Keep exploring <span aria-hidden="true">↗</span></button></div><p class="cart-notice">This is a demo. No real order is placed and no payment is taken.</p>`, 'cart');
  }
  function adjustQuantity(key, change, remove) {
    const line = state.cart.find(i => i.id + ':' + i.size === key);
    if (!line) return;
    line.quantity = remove ? 0 : Math.min(C.MAX_QUANTITY, line.quantity + change);
    state.cart = state.cart.filter(i => i.quantity > 0); save();
    renderCart();
    const selector = remove ? '.dark-button' : `[data-action="quantity"][data-key="${key}"][data-change="${change}"]`;
    $(selector, dialog)?.focus();
  }
  function renderCheckout() {
    if (state.busy) return renderProcessing();
    if (!state.cart.length) return renderCart();
    const draft = state.checkoutDraft;
    const lines = C.cartDetails(state.cart, D.items);
    setPanel(`<button class="dialog-back" data-action="cart">← Back to your basket</button><p class="dialog-eyebrow">FROM CAFETERIA TO CLASSROOM.</p><h2 id="dialog-title">Make it yours.</h2><p class="dialog-intro">Choose how you’d like to get your meal. This checkout is a demo; no money is taken.</p><form id="checkout-form"><div class="checkout-grid"><div><fieldset><legend>Pickup or campus delivery?</legend><div class="choice-grid"><label class="choice-label"><input type="radio" name="fulfilment" value="pickup" ${draft.fulfilment==='pickup'?'checked':''}><span>Pickup<small>Collect at Food Clique</small></span></label><label class="choice-label"><input type="radio" name="fulfilment" value="delivery" ${draft.fulfilment==='delivery'?'checked':''}><span>Campus delivery<small>To your seminar room</small></span></label></div><div class="delivery-fields" id="delivery-fields" ${draft.fulfilment!=='delivery'?'hidden':''}><label>Block<input name="block" value="${e(draft.block)}" placeholder="C" maxlength="5" pattern="[A-Za-z0-9]{1,5}" aria-label="Delivery block"></label><label>Level<input name="level" value="${e(draft.level)}" placeholder="7" maxlength="2" pattern="[1-9][0-9]?" inputmode="numeric" aria-label="Delivery level"></label><label>Seminar room<input name="room" value="${e(draft.room)}" placeholder="15" maxlength="12" pattern="[A-Za-z0-9-]{1,12}" aria-label="Seminar room number"></label></div><p class="pickup-note" id="pickup-note" ${draft.fulfilment!=='pickup'?'hidden':''}>Pickup location: Food Clique. Your demo meal will be ready in approximately 15 minutes.</p><p class="small muted" id="delivery-example" ${draft.fulfilment!=='delivery'?'hidden':''}>Room format: block C, level 7, room 15 → C.7.15</p></fieldset><fieldset><legend>Payment preview</legend><div class="payment-options"><label class="choice-label"><input type="radio" name="payment" value="apple" ${draft.payment==='apple'?'checked':''}><span>Apple Pay</span></label><label class="choice-label"><input type="radio" name="payment" value="card" ${draft.payment==='card'?'checked':''}><span>Credit / debit card</span></label><label class="choice-label"><input type="radio" name="payment" value="paynow" ${draft.payment==='paynow'?'checked':''}><span>PayNow</span></label></div></fieldset><label class="field-label" for="order-notes">Order notes <span class="muted">(optional, demo only)</span></label><textarea class="checkout-notes" id="order-notes" name="notes" maxlength="300" rows="2" placeholder="Any requests for your demo meal?">${e(draft.notes)}</textarea></div><aside class="checkout-summary"><h3>Your little basket.</h3>${lines.map(line=>`<div class="checkout-summary-line"><span>${line.quantity} × ${e(line.name)}${D.items.find(i=>i.id===line.id).largePrice?' ('+e(line.size)+')':''}</span><span>${C.money(line.total)}</span></div>`).join('')}<div class="checkout-total"><span>Demo total</span><span>${C.money(C.cartTotal(state.cart,D.items))}</span></div><p class="small muted">Delivery is included in this demo. The total shown covers your food.</p><button class="dark-button checkout-submit" type="submit">Confirm demo order <span aria-hidden="true">↗</span></button><p class="checkout-notice">No payment details are collected. No real transaction or cafeteria order will be made.</p><p class="form-error" id="checkout-error" role="alert"></p></aside></div></form>`, 'checkout');
    updateDeliveryFields();
  }
  function updateDeliveryFields() {
    const form = $('#checkout-form'); if (!form) return;
    const delivery = $('input[name="fulfilment"]:checked', form)?.value === 'delivery';
    $('#delivery-fields').hidden = !delivery; $('#delivery-example').hidden = !delivery; $('#pickup-note').hidden = delivery;
    $$('#delivery-fields input').forEach(input => { input.required = delivery; input.disabled = !delivery; });
  }
  function rememberDraft() {
    const form = $('#checkout-form'); if (!form) return;
    state.checkoutDraft = {
      fulfilment: $('input[name="fulfilment"]:checked', form)?.value || 'pickup',
      payment: $('input[name="payment"]:checked', form)?.value || 'paynow',
      block: $('input[name="block"]',form).value, level: $('input[name="level"]',form).value, room: $('input[name="room"]',form).value,
      notes: $('#order-notes').value
    };
  }
  function submitOrder(form) {
    if (state.busy || !state.cart.length) return;
    if (!form.reportValidity()) return;
    rememberDraft();
    const draft = state.checkoutDraft;
    const locationName = draft.fulfilment === 'delivery' ? C.roomLocation(draft.block,draft.level,draft.room) : 'Food Clique';
    if (!locationName) { $('#checkout-error').textContent='Please enter a valid block, level and seminar room.'; return; }
    const items = C.cartDetails(state.cart,D.items).map(line=>({ name:line.name, size:line.size, quantity:line.quantity, unitPrice:line.unitPrice }));
    if (!items.length) return renderCart();
    const now = Date.now();
    const id = 'FL-' + now.toString(36).toUpperCase() + '-' + Math.floor(1000+Math.random()*9000);
    const order = { id, createdAt:now, fulfilment:draft.fulfilment, payment:draft.payment, location:locationName, notes:draft.notes.trim().slice(0,300), items, total:items.reduce((total,line)=>total+line.quantity*line.unitPrice,0), cancelled:false, collected:false };
    state.orders.unshift(order); state.orders=state.orders.slice(0,10); state.cart=[]; state.activeOrder=id; state.busy=true;
    save(); updateBasket(); renderProcessing();
    setTimeout(()=>{
      state.busy=false;
      if (location.hash === '#checkout') go('order/'+id);
      toast('Demo order confirmed. You can follow it under Order tracking.');
    },1400);
  }
  function renderProcessing() {
    setPanel('<div class="processing-view"><div class="processing-spinner" aria-hidden="true"></div><p class="dialog-eyebrow">CHECKOUT PREVIEW</p><h2 id="dialog-title">A little moment…</h2><p>Confirming your demo order. No payment is being processed.</p></div>','processing');
  }

  function renderCrowd(id) {
    const venue = D.venues.find(v=>v.id===id); if (!venue) return go('cafeterias');
    const v=venueSnapshot(venue), status=C.crowdStatus(v.occupancy);
    const color={quiet:'#73917b',moderate:'#bc9660',busy:'#b77866'}[status.tone];
    setPanel(`<p class="dialog-eyebrow">SEAT MANAGEMENT · CROWD DENSITY CHECKER</p><h2 id="dialog-title">${e(v.name)}</h2><p class="dialog-intro">A little insight before your next campus break.</p><div class="crowd-detail"><div class="crowd-detail-top"><div class="crowd-ring" style="--percent:${v.occupancy};--ring-color:${color}"><span>${v.occupancy}<small>%</small></span></div><div><h3>${e(status.label)}.</h3><p>${100-v.occupancy}% unoccupied in this ${v.local?'local demo report':'sample snapshot'}.<br>${v.local?'Your report at':'Demo snapshot at'} ${e(v.timestamp)}.<br>No live occupancy sensors are connected.</p></div></div><button class="dark-button" data-action="venue-menu" data-id="${e(v.id)}">${v.menuAvailable?'Explore the menu':'View menu information'} <span aria-hidden="true">↗</span></button><div class="crowd-report"><h3>Try a crowd report.</h3><p>Choose a scenario to see how the checker responds. It is saved on this device only.</p><div class="report-buttons"><button data-action="report" data-id="${e(v.id)}" data-value="20">Quiet · 20%</button><button data-action="report" data-id="${e(v.id)}" data-value="55">Moderate · 55%</button><button data-action="report" data-id="${e(v.id)}" data-value="85">Busy · 85%</button></div>${v.local?`<button class="text-button report-reset" data-action="reset-report" data-id="${e(v.id)}">Restore demo crowd figures ↗</button>`:''}</div></div>`, 'crowd');
  }
  function renderTracking(id) {
    const order=state.orders.find(o=>o.id===id);
    if (!order) return renderOrders();
    state.activeOrder=id;
    const stage=C.orderStage(order,Date.now());
    const steps=order.fulfilment==='pickup'?['Confirmed','In the kitchen','Ready for pickup','Collected']:['Confirmed','In the kitchen','Packed','On the way','Delivered'];
    lastTrackingSignature=id+':'+stage.id;
    setPanel(`<button class="dialog-back" data-action="orders">← Your demo orders</button><div class="tracking-header"><p class="dialog-eyebrow">ORDER TRACKING · ${e(order.id)}</p><span class="outline-tag">DEMO ORDER</span></div><h2 class="tracking-status" id="dialog-title">${e(stage.title)}</h2><p class="tracking-description" role="status">${e(stage.description)}</p><div class="order-meta"><div><p>${order.fulfilment==='pickup'?'PICKUP LOCATION':'DROP-OFF LOCATION'}</p><strong>${order.fulfilment==='pickup'?'Food Clique':'Seminar room '+e(order.location)}</strong></div><div><p>ESTIMATED WAIT</p><strong>15 minutes · ${order.fulfilment==='pickup'?'pickup':'campus delivery'}</strong></div></div>${stage.id!=='cancelled'?`<div class="timeline" aria-label="Order progress">${steps.map((step,i)=>`<div class="timeline-step ${i<=stage.index?'done':''} ${i===stage.index?'current':''}" ${i===stage.index?'aria-current="step"':''}>${e(step)}</div>`).join('')}</div>`:''}<p class="small muted">Tracking is simulated. Delivery completes in about 90 seconds for preview; pickup becomes ready after 30 seconds and waits for you to mark it collected. No real notification or delivery is sent.</p><div class="tracking-items"><h3>Your order.</h3>${order.items.map(item=>`<div><span>${item.quantity} × ${e(item.name)}${item.size==='large'?' (large)':''}</span><span>${C.money(item.unitPrice*item.quantity)}</span></div>`).join('')}<div><span>Demo total</span><strong>${C.money(order.total)}</strong></div>${order.notes?'<p class="small muted">Notes: '+e(order.notes)+'</p>':''}<p class="small muted">Placed ${e(dateLabel(order.createdAt))} · ${e({apple:'Apple Pay',card:'Credit / debit card',paynow:'PayNow'}[order.payment])} preview</p></div><div class="tracking-actions">${order.fulfilment==='pickup'&&stage.id==='ready'?'<button class="dark-button" data-action="collect" data-id="'+e(order.id)+'">Mark demo order collected ✓</button>':''}<button class="outline-button" data-action="browse-menu">Explore more food ↗</button>${stage.id==='received'?'<button class="text-button" data-action="cancel-order" data-id="'+e(order.id)+'">Cancel demo order</button>':''}</div>`, 'tracking');
  }
  function renderOrders() {
    setPanel(`<p class="dialog-eyebrow">EVERY LITTLE CAMPUS BREAK.</p><h2 id="dialog-title">Your demo orders.</h2><p class="dialog-intro">Up to 10 recent demo orders are saved in this browser.</p>${state.orders.length?'<div class="order-history">'+state.orders.map(o=>`<button class="history-button" data-action="track" data-id="${e(o.id)}"><span>${e(o.id)}<small>${e(dateLabel(o.createdAt))} · ${e(C.orderStage(o,Date.now()).title)}</small></span><b>${C.money(o.total)} ↗</b></button>`).join('')+'</div>':'<div class="empty-basket"><span class="empty-flower" aria-hidden="true">✳</span><h3>Your next favourite is waiting.</h3><p>Place a demo order to see its journey from kitchen to classroom.</p><button class="dark-button" data-action="browse-menu">Explore the menu ↗</button></div>'}`, 'orders');
  }
  function renderPrivacy() {
    setPanel('<p class="dialog-eyebrow">A LITTLE TRANSPARENCY.</p><h2 id="dialog-title">Privacy & demo notes.</h2><div class="privacy-copy"><h3>Campus dining, at a glance.</h3><p>SUSS FoodLoop lets you explore menus, crowd checking and seminar-room delivery. Ordering and crowd figures are demonstrations; no cafeteria operators, occupancy sensors, payment providers or delivery riders are connected.</p><h3>Your FoodLoop account.</h3><p>You can browse as a guest or create an email/password account. Account names, emails and salted password hashes are stored on the server. Your session uses a secure, HTTP-only cookie. Passwords are never stored in browser storage. Email-only registration does not verify your email address or SUSS student status. Google sign-in, when connected, verifies your Google identity; linking it to an existing email account requires that you first sign in to that account.</p><h3>Your browser. Your demo data.</h3><p>Your basket, up to 10 recent demo orders, crowd scenarios and feedback stay in this browser. These demo records are not synced to your account or shared between devices. Room details and notes are not sent to a cafeteria. The app has no analytics and collects no payment details. Google’s identity library is loaded only when a configured Google sign-in option is opened.</p><h3>What is real, and what is a preview?</h3><p>Email account sessions are real. Menu prices include nominal estimates, and crowd figures are demo data. Confirm current prices, availability and dietary details with the stall. The 15-minute wait is an estimate. Payment options and order tracking are simulations.</p><h3>Keep or clear your feedback.</h3><p>You can export feedback as JSON. Clearing local demo data removes this browser’s basket, reports, orders and feedback; it does not delete your server account.</p><button class="outline-button" data-action="clear-data">Manage local demo data ↗</button></div>', 'privacy');
  }
  function renderClearData() {
    setPanel('<p class="dialog-eyebrow">YOUR DEVICE. YOUR CHOICE.</p><h2 id="dialog-title">Clear the demo?</h2><p class="dialog-intro">This removes FoodLoop’s basket, demo orders, crowd reports and feedback from this browser. Export your feedback first if you’d like to keep it.</p><div class="clear-data-buttons"><button class="dark-button" data-action="confirm-clear">Clear local demo data</button><button class="outline-button" data-action="close">Keep my data</button><button class="text-button" data-action="export-feedback">Export feedback ↓</button></div>', 'clear-data');
  }
  function clearData() {
    state.cart=[];state.orders=[];state.reports={};state.feedback=[];state.activeOrder='';state.busy=false;
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) { storageAvailable=false; }
    renderVenues();updateBasket();$('#feedback-status').textContent='';
    closePanel();toast('FoodLoop’s local demo data has been cleared.');
  }

  function exportFeedback() {
    if (!state.feedback.length) return toast('There is no local feedback to export yet.');
    const payload={project:D.brand,notice:'Local feedback; not submitted to a server.',exportedAt:new Date().toISOString(),feedback:state.feedback};
    const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='SUSS-FoodLoop-Feedback.json';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    toast('Your local feedback export is ready.');
  }
  function submitFeedback(form) {
    if (!form.reportValidity()) return;
    const rating=Number($('input[name="rating"]:checked',form)?.value);
    const message=$('#feedback-text').value.trim();
    if (!message) { $('#feedback-text').setCustomValidity('Please add a thought or an idea.'); $('#feedback-text').reportValidity(); return; }
    $('#feedback-text').setCustomValidity('');
    state.feedback.push({rating,message,createdAt:new Date().toISOString()});state.feedback=state.feedback.slice(-100);save();form.reset();
    $('#feedback-status').textContent=storageAvailable?'Thank you. Your feedback is saved on this device.':'Thank you. Your feedback is available in this session; use Export to keep a copy.';
  }
  async function toggleSound(force) {
    const next=typeof force==='boolean'?force:!soundOn;
    try {
      if (!music) return;
      music.volume=.32;
      if (next) await music.play(); else music.pause();
      soundOn=next;
      $('#sound-toggle').setAttribute('aria-pressed',String(next));$('#sound-toggle').setAttribute('aria-label',next?'Pause background music':'Play background music');$('#sound-toggle span').textContent=next?'Music on':'Music off';
    } catch (_) { toast('Music could not start. Tap the music control to try again.'); }
  }
  function finishIntro() {
    if (!intro.open || introLeaving) return;
    clearTimeout(introFallback);
    introLeaving=true;
    introVideo?.pause();
    const close=()=>{
      intro.close();document.body.classList.remove('intro-open');introLeaving=false;
      try { sessionStorage.setItem('foodloop-entered','1'); } catch (_) { /* private mode can block storage */ }
      updateBasket();handleRoute();
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !intro.classList.contains('watching')) return close();
    // Decode the corresponding hero frame before fading away the intro.
    const duration=Number.isFinite(heroVideo.duration)&&heroVideo.duration>0?heroVideo.duration:12;
    try { heroVideo.currentTime=(introVideo.currentTime||0)%duration; } catch (_) { /* poster remains a fallback */ }
    let fading=false;
    let readyFallback;
    const fade=()=>{
      if (fading || !intro.open) return;
      fading=true;clearTimeout(readyFallback);intro.classList.add('exiting');
      setTimeout(close,700);
    };
    readyFallback=setTimeout(fade,450);
    if (typeof heroVideo.requestVideoFrameCallback==='function') heroVideo.requestVideoFrameCallback(fade);
    heroVideo.play().then(()=>{
      if (typeof heroVideo.requestVideoFrameCallback!=='function') requestAnimationFrame(fade);
    }).catch(fade);
  }
  function enterSite(withSound) {
    if (withSound) toggleSound(true);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return finishIntro();
    $('#intro-entry').hidden=true;$('#intro-stage').hidden=false;intro.classList.add('watching');
    introVideo.currentTime=0;
    introVideo.play().catch(()=>finishIntro());
    introFallback=setTimeout(finishIntro,24000);
  }
  function onAction(button) {
    const action=button.dataset.action,id=button.dataset.id;
    if (action==='account') { rememberDraft(); return go('account'); }
    if (action==='add') return addItem(id);
    if (action==='cart') { rememberDraft(); return go('cart'); }
    if (action==='checkout') return go('checkout');
    if (action==='browse-menu') return go('menu');
    if (action==='crowd') return go('crowd/'+id);
    if (action==='orders') return go('orders');
    if (action==='track') return go('order/'+id);
    if (action==='quantity') return adjustQuantity(button.dataset.key,Number(button.dataset.change),false);
    if (action==='remove') return adjustQuantity(button.dataset.key,0,true);
    if (action==='close') return closePanel();
    if (action==='show-clique') { state.venue='clique';renderMenu();return; }
    if (action==='reset-menu') { state.category='all';state.search='';$('#menu-search').value='';renderMenu();return; }
    if (action==='venue-menu') { state.venue=id;renderMenu();return go('menu'); }
    if (action==='report') {
      if (!D.venues.some(v=>v.id===id)) return;
      state.reports[id]={occupancy:Number(button.dataset.value),at:Date.now()};save();renderVenues();renderCrowd(id);return toast('Local demo report saved. The crowd figures are still a preview.');
    }
    if (action==='reset-report') { delete state.reports[id];save();renderVenues();renderCrowd(id);return toast('Demo crowd figures restored.'); }
    if (action==='collect'||action==='cancel-order') {
      const order=state.orders.find(o=>o.id===id);if (!order) return;
      const stage=C.orderStage(order,Date.now());
      if (action==='collect'&&order.fulfilment==='pickup'&&stage.id==='ready') order.collected=true;
      else if (action==='cancel-order'&&stage.id==='received') order.cancelled=true; else return;
      save();renderTracking(id);return;
    }
    if (action==='privacy') return go('privacy');
    if (action==='clear-data') return go('clear-data');
    if (action==='confirm-clear') return clearData();
    if (action==='export-feedback') return exportFeedback();
  }

  document.addEventListener('click',event=>{
    const action=event.target.closest('[data-action]');if (action) { event.preventDefault();if (!action.disabled) onAction(action);return; }
    const venue=event.target.closest('[data-venue]');if (venue) {state.venue=venue.dataset.venue;renderMenu();return;}
    const category=event.target.closest('[data-category]');if (category) {state.category=category.dataset.category;renderMenu();$(`[data-category="${state.category}"]`)?.focus();}
  });
  document.addEventListener('submit',event=>{if (event.target.id==='checkout-form') {event.preventDefault();submitOrder(event.target);} else if (event.target.id==='feedback-form') {event.preventDefault();submitFeedback(event.target);}});
  document.addEventListener('change',event=>{if (event.target.name==='fulfilment') {updateDeliveryFields();rememberDraft();} else if (event.target.name==='payment') rememberDraft();});
  $('#menu-search').addEventListener('input',event=>{state.search=event.target.value;renderMenu();});
  $('#menu-sort').addEventListener('change',event=>{state.sort=event.target.value;renderMenu();});
  $('#feedback-text').addEventListener('input',()=>$('#feedback-text').setCustomValidity(''));
  $('#export-feedback').addEventListener('click',exportFeedback);
  $('#dialog-close').addEventListener('click',()=>{rememberDraft();closePanel();});
  dialog.addEventListener('cancel',event=>{event.preventDefault();rememberDraft();closePanel();});
  dialog.addEventListener('click',event=>{if (event.target===dialog) {const r=dialog.getBoundingClientRect();if (event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom) {rememberDraft();closePanel();}}});
  $('#sound-toggle').addEventListener('click',()=>toggleSound());
  $('#enter-sound').addEventListener('click',()=>enterSite(true));$('#enter-silent').addEventListener('click',()=>enterSite(false));
  $('#intro-skip').addEventListener('click',finishIntro);
  introVideo.addEventListener('ended',finishIntro);
  introVideo.addEventListener('error',()=>{if(intro.classList.contains('watching'))finishIntro();});
  intro.addEventListener('cancel',event=>{event.preventDefault();finishIntro();});
  $('#mobile-menu').addEventListener('click',()=>{const open=$('#main-nav').classList.toggle('open');$('#mobile-menu').setAttribute('aria-expanded',String(open));$('#mobile-menu').setAttribute('aria-label',open?'Close navigation':'Open navigation');});
  window.addEventListener('hashchange',handleRoute);
  let scrollQueued=false;
  window.addEventListener('scroll',()=>{if (scrollQueued) return;scrollQueued=true;requestAnimationFrame(()=>{$('#site-header').classList.toggle('scrolled',window.scrollY>$('#home').offsetHeight-80);scrollQueued=false;});},{passive:true});
  document.addEventListener('visibilitychange',()=>{if (document.hidden) {music?.pause();heroVideo?.pause();} else {if (soundOn) music?.play().catch(()=>{});if (!intro.open&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches) heroVideo?.play().catch(()=>{});}});
  setInterval(()=>{
    if (state.view==='tracking') {
      const order=state.orders.find(o=>o.id===state.activeOrder);if (!order) return;
      const signature=order.id+':'+C.orderStage(order,Date.now()).id;
      if (signature!==lastTrackingSignature) {renderTracking(order.id);toast(C.orderStage(order,Date.now()).title);}
    }
  },1000);

  $('#year').textContent=new Date().getFullYear();
  $('#faq-list').innerHTML=D.faqs.map(faq=>`<details><summary>${e(faq.question)}</summary><p>${e(faq.answer)}</p></details>`).join('');
  renderVenues();renderMenu();updateBasket();
  window.FoodLoopUI={setPanel,closePanel,go,toast};
  let entered=false;try {entered=sessionStorage.getItem('foodloop-entered')==='1';} catch (_) { /* still show introduction */ }
  if (!entered) {intro.showModal();document.body.classList.add('intro-open');updateBasket();} else {handleRoute();if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) heroVideo?.play().catch(()=>{});}
})();
