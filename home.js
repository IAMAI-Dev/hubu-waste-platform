(function () {
  'use strict';
  var H = HUBU,
    U = HUBU_UI;
  U.init('home');
  var map = HUBU_MAP.create(document.getElementById('hero-map'), {
    schematicOnly: true,
    hero: true,
    onSelect: function (kind, id) {
      H.saveTime();
      location.href = 'detail.html?' + kind + '=' + encodeURIComponent(id);
    },
  });
  function render(s) {
    document.getElementById('home-time').textContent = H.fmt(s.time);
    U.number(document.getElementById('home-kg'), s.totalKg);
    U.number(document.getElementById('home-alert'), s.alerts);
    U.number(document.getElementById('home-orders'), s.openOrders);
    var t = s.trucks.find(function (t) {
      return t.id === 'T2';
    });
    document.getElementById('hero-event').textContent = t.working
      ? '正在完成点位收运'
      : '下一站，' + t.next.name;
  }
  render(H.getSnapshot());
  U.clock(function (dt, ts) {
    map.paint(ts);
  }, render);
})();
