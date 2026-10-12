/* Editable campus menu and demonstration crowd figures. Prices are in cents. */
(function (root) {
  'use strict';
  const data = {
    brand: 'SUSS FoodLoop',
    currency: 'SGD',
    estimateMinutes: 15,
    venues: [
      { id: 'clique', name: 'Food Clique', occupancy: 94, time: '11:34 AM', description: 'For crispy chicken, comforting bowls and something fresh.', theme: 'peach', menuAvailable: true },
      { id: 'gallery', name: 'Food Gallery', occupancy: 55, time: '11:34 AM', description: 'Check the crowd before you head over for your next break.', theme: 'rose', menuAvailable: false },
      { id: 'fest', name: 'Food Fest / Subway', occupancy: 23, time: '11:34 AM', description: 'A little more room for your next campus break.', theme: 'sand', menuAvailable: false }
    ],
    categories: [
      { id: 'all', name: 'All food' },
      { id: 'taiwanese', name: 'Taiwanese' },
      { id: 'yongtaufoo', name: 'Yong Tau Foo' },
      { id: 'japanese', name: 'Japanese' },
      { id: 'salad', name: 'Salad bar' }
    ],
    items: [
      { id: 'salted-chicken', name: 'Salted Crispy Chicken', category: 'taiwanese', stall: 'Taiwanese', price: 400, largePrice: 500, description: 'Golden, crispy bites. Choose a regular or large portion.', art: 'chicken', tags: ['Regular / large'] },
      { id: 'sesame-chicken', name: 'Sesame Crispy Chicken', category: 'taiwanese', stall: 'Taiwanese', price: 400, largePrice: 500, description: 'A sesame twist on a crispy chicken favourite.', art: 'sesame', tags: ['Regular / large'] },
      { id: 'mala-yongtaufoo', name: 'Mala Dry Yong Tau Foo', category: 'yongtaufoo', stall: 'Yong Tau Foo', price: 680, description: 'A warming mala bowl for your midday break.', art: 'mala', tags: ['Mala'] },
      { id: 'tomyum-yongtaufoo', name: 'Tom Yum Yong Tau Foo', category: 'yongtaufoo', stall: 'Yong Tau Foo', price: 680, description: 'A bright, warming Tom Yum bowl for your midday break.', art: 'tomyum', tags: ['Tom Yum'] },
      { id: 'udon', name: 'Udon', category: 'japanese', stall: 'Japanese', price: 700, description: 'A comforting bowl of thick Japanese noodles.', art: 'udon', tags: ['Noodles'] },
      { id: 'dry-ramen', name: 'Dry Ramen', category: 'japanese', stall: 'Japanese', price: 800, description: 'Japanese noodles, without the soup.', art: 'ramen', tags: ['Noodles'] },
      { id: 'chicken-caesar', name: 'Chicken Caesar Salad', category: 'salad', stall: 'Salad Bar', price: 900, description: 'A fresh option when you want something lighter.', art: 'salad', tags: ['Salad'] },
      { id: 'avocado-salad', name: 'Avocado Salad', category: 'salad', stall: 'Salad Bar', price: 900, description: 'A little green goodness between classes.', art: 'avocado', tags: ['Salad'] }
    ],
    faqs: [
      { question: 'What is SUSS FoodLoop?', answer: 'FoodLoop brings cafeteria crowd checking, campus menus and seminar-room delivery together for a better campus break. You can explore the full ordering experience here as a demo.' },
      { question: 'Are the crowd percentages live?', answer: 'The crowd checker currently shows demo figures. Try a local crowd report to explore quieter and busier scenarios. No live occupancy sensors are connected.' },
      { question: 'Can I order to my seminar room?', answer: 'Yes, in the demo. Add food to your basket, choose campus delivery, and enter your block, level and seminar room, such as C.7.15. You can also choose pickup.' },
      { question: 'Will checkout charge me?', answer: 'No. Apple Pay, credit / debit card and PayNow are checkout previews. No money is taken, no card details are collected, and no order is sent to a cafeteria.' },
      { question: 'How long does an order take?', answer: 'Allow around 15 minutes as an estimate. Demo tracking moves faster so you can explore each stage. Actual waiting times depend on the stall and how busy it is.' },
      { question: 'What food can I find?', answer: 'Explore Taiwanese crispy chicken, Yong Tau Foo, Japanese noodles and salads. For allergens, halal status or other dietary requirements, confirm directly with the stall before ordering.' },
      { question: 'Can I order from every cafeteria?', answer: 'You can explore Food Clique’s menu and place a demo order. Food Gallery and Food Fest / Subway currently offer crowd previews, with their menus coming soon.' },
      { question: 'Where is my feedback saved?', answer: 'Feedback, your basket and your demo order history are saved on this browser only. You can export your feedback or clear the local data in the footer.' },
      { question: 'Can I browse without an account?', answer: 'Yes. Explore the cafeterias as a guest, or create a FoodLoop email/password account. Gmail addresses work too. Google sign-in is also supported once the site owner connects it.' },
      { question: 'How do I control the music and video?', answer: 'Choose Enter with sound to play the original music, or Enter without sound for a silent intro. Skip the video at any time, then use the music control in the header to play or pause the soundtrack. Reduced-motion preferences are respected.' }
    ]
  };
  root.FoodLoopData = data;
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
})(typeof globalThis !== 'undefined' ? globalThis : window);
