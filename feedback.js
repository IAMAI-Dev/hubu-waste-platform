(function () {
  'use strict';
  var H = HUBU,
    U = HUBU_UI,
    $ = function (id) {
      return document.getElementById(id);
    },
    rating = null,
    params = new URLSearchParams(location.search),
    contextOrder = params.get('order');
  U.init('feedback');
  $('feedback-target').innerHTML =
    '<option value="platform">平台整体</option><optgroup label="校园投放点">' +
    H.POINTS.map(function (p) {
      return '<option value="' + p.id + '">' + U.esc(p.name) + '</option>';
    }).join('') +
    '</optgroup><optgroup label="清运车辆">' +
    H.TRUCKS.map(function (t) {
      return (
        '<option value="' + t.id + '">' + U.esc(t.code + ' 号车 · ' + t.name) + '</option>'
      );
    }).join('') +
    '</optgroup>';
  if (
    H.POINTS.some(function (p) {
      return p.id === params.get('point');
    })
  )
    $('feedback-target').value = params.get('point');
  function view(v) {
    document.querySelector('.feedback-layout').dataset.view = v;
    document.querySelectorAll('[data-feedback-view]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.feedbackView === v));
    });
  }
  function stars() {
    $('rating-options').innerHTML =
      [1, 2, 3, 4, 5]
        .map(function (n) {
          return (
            '<button type="button" class="rating-star ' +
            (rating >= n ? 'selected' : '') +
            '" data-rating="' +
            n +
            '" aria-label="满意度 ' +
            n +
            ' 分" aria-pressed="' +
            (rating === n) +
            '">' +
            U.icon('star') +
            '</button>'
          );
        })
        .join('') +
      '<button class="text-button rating-reset" type="button" data-rating="0">不评分</button>';
    $('rating-description').textContent = rating
      ? rating + ' / 5 分'
      : '未评分，不计入满意度统计';
  }
  function issue() {
    $('issue-field').hidden = !(
      $('feedback-kind').value === '问题反馈' && /^P/.test($('feedback-target').value)
    );
  }
  function card(f) {
    var pid =
        f.targetId ||
        (
          H.POINTS.find(function (p) {
            return p.name === f.target;
          }) || {}
        ).id,
      id = String(f.id);
    return (
      '<article class="feedback-card ' +
      (f.mine ? 'mine' : '') +
      '" id="feedback-' +
      U.esc(id) +
      '"><div class="feedback-card-head"><div class="avatar">' +
      U.icon(f.type === '表扬' ? 'star' : f.type === '建议' ? 'leaf' : 'message') +
      '</div><div class="feedback-author"><b>' +
      U.esc(f.who || '匿名同学') +
      '</b><div class="feedback-tags"><span>' +
      U.esc(f.role || '校园用户') +
      '</span><span>' +
      U.esc(f.type) +
      '</span><time>' +
      U.esc(f.time) +
      '</time>' +
      (f.mine ? '<span>本机提交</span>' : '<span>系统示例</span>') +
      '</div></div>' +
      U.status(f) +
      '</div><p class="feedback-text">' +
      U.esc(f.text) +
      '</p><div class="feedback-tags"><span>' +
      U.esc(f.target || '平台整体') +
      '</span>' +
      (Number.isFinite(f.rating)
        ? '<span class="feedback-rating">' +
          [1, 2, 3, 4, 5]
            .map(function (n) {
              return U.icon('star', n <= f.rating ? 'filled' : '');
            })
            .join('') +
          '<span class="sr-only">' +
          f.rating +
          ' 分</span></span>'
        : '<span>未评分</span>') +
      '</div><details ' +
      (contextOrder && f.orderId === contextOrder ? 'open' : '') +
      '><summary>查看处理进展 ' +
      U.icon('chevron') +
      '</summary>' +
      U.timeline(H.feedbackTimeline(f)) +
      (f.orderId ? '<p class="record-id">工单 ' + U.esc(f.orderId) + '</p>' : '') +
      (pid
        ? '<a class="text-link" href="detail.html?point=' +
          encodeURIComponent(pid) +
          '">在地图中查看 ' +
          U.icon('arrow') +
          '</a>'
        : '') +
      '</details></article>'
    );
  }
  function render() {
    var stats = H.feedbackStats();
    $('feedback-stats').innerHTML =
      '<div><b>' +
      stats.total +
      '</b><span>反馈记录</span></div><div><b>' +
      stats.open +
      '</b><span>待处理反馈</span></div><div><b>' +
      (stats.avg == null ? '未评分' : stats.avg.toFixed(1)) +
      '</b><span>平均满意度 / 5</span></div><p class="stats-foot">仅 ' +
      stats.rated +
      ' 条实际评分参与统计 · 系统示例与本机提交</p>';
    $('mine-count').textContent = '本机提交 ' + H.myFeedbackCount() + ' 条';
    $('clear-feedback').disabled = !H.myFeedbackCount();
    $('feedback-sim-time').textContent = H.fmt(H.getNow());
    var fs = H.allFeedback().filter(function (f) {
      return (
        (params.get('scope') !== 'point' ||
          f.targetId === params.get('point') ||
          f.target === H.byId(params.get('point'))?.name) &&
        ($('filter-type').value === 'all' || f.type === $('filter-type').value) &&
        ($('filter-status').value === 'all' || f.status === $('filter-status').value) &&
        (!$('filter-mine').checked || f.mine)
      );
    });
    $('feedback-count').textContent = fs.length + ' 条';
    var order = contextOrder && H.getOrder(contextOrder),
      spot = order
        ? '<article class="feedback-card order-spotlight"><span class="eyebrow">所选工单</span><h3>' +
          U.esc(
            H.POINTS.find(function (p) {
              return p.id === order.pid;
            }).name,
          ) +
          ' · ' +
          U.esc(H.ORDERS_TEXT[order.type].label) +
          '</h3>' +
          U.status(order) +
          U.timeline(H.getOrderTimeline(order.id)) +
          '</article>'
        : '';
    $('feedback-list').innerHTML =
      spot + (fs.map(card).join('') || '<p class="empty-state">当前筛选条件下没有反馈</p>');
    HUBU_MOTION.details($('feedback-list'));
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.feedbackView) view(b.dataset.feedbackView);
    if (b.hasAttribute('data-rating')) {
      rating = +b.dataset.rating || null;
      stars();
      var selected = $('rating-options').querySelector('[data-rating="' + (rating || 0) + '"]');
      if (selected) {
        selected.focus();
        HUBU_MOTION.animate(
          selected,
          [
            { transform: 'scale(.85)' },
            { transform: 'scale(1.2)', offset: 0.55 },
            { transform: 'scale(1)' },
          ],
          { duration: 360 },
        );
      }
    }
    if (b.dataset.progress) {
      view('list');
      $('filter-type').value = 'all';
      $('filter-status').value = 'all';
      $('filter-mine').checked = true;
      render();
      var el = document.getElementById('feedback-' + b.dataset.progress);
      if (el) {
        el.querySelector('details').open = true;
        el.scrollIntoView({ behavior: U.reduced() ? 'instant' : 'smooth', block: 'center' });
      }
    }
  });
  $('feedback-text').oninput = function () {
    $('text-count').textContent = this.value.length + ' / 300';
  };
  $('feedback-kind').onchange = $('feedback-target').onchange = issue;
  ['filter-type', 'filter-status', 'filter-mine'].forEach(function (id) {
    $(id).onchange = render;
  });
  $('feedback-form').onsubmit = function (e) {
    e.preventDefault();
    $('form-error').hidden = true;
    $('submit-result').hidden = true;
    var target = $('feedback-target'),
      result = H.addFeedback({
        who: $('feedback-who').value,
        role: $('feedback-role').value,
        type: $('feedback-kind').value,
        target: target.selectedOptions[0].textContent,
        targetId: target.value,
        issueType: $('feedback-issue').value,
        text: $('feedback-text').value,
        rating: rating,
      });
    if (!result.ok) {
      $('form-error').textContent = result.error;
      $('form-error').hidden = false;
      return;
    }
    $('submit-result').innerHTML =
      '<b>' +
      U.icon('check') +
      '反馈已保存</b><p>编号 ' +
      U.esc(result.id) +
      '<br>关联对象：' +
      U.esc(result.item.target) +
      '<br>仅保存在本机浏览器</p><button type="button" class="text-button" data-progress="' +
      U.esc(result.id) +
      '">查看进度 ' +
      U.icon('arrow') +
      '</button>';
    $('submit-result').hidden = false;
    $('feedback-text').value = '';
    $('text-count').textContent = '0 / 300';
    $('filter-type').value = 'all';
    $('filter-status').value = 'all';
    render();
    if (innerWidth < 768) view('list');
    var card = document.getElementById('feedback-' + result.id);
    if (card) {
      card.querySelector('details').open = true;
      card.classList.add('feedback-arrival');
      card.scrollIntoView({ behavior: U.reduced() ? 'instant' : 'smooth', block: 'center' });
      if (innerWidth >= 768) HUBU_MOTION.flight($('submit-result'), card, '已保存');
    }
    HUBU_MOTION.details($('feedback-list'));
    U.announce('反馈已保存到本机浏览器');
  };
  $('clear-feedback').onclick = function () {
    $('clear-dialog').showModal();
  };
  $('cancel-clear').onclick = function () {
    $('clear-dialog').close();
  };
  $('confirm-clear').onclick = function () {
    var result = H.clearMyFeedback();
    if (!result.ok) {
      U.toast(result.error, true);
      return;
    }
    $('clear-dialog').close();
    $('submit-result').hidden = true;
    render();
    U.toast('已清除本机提交，系统示例已保留');
  };
  stars();
  issue();
  render();
  if (contextOrder || params.get('scope') === 'point') view('list');
  HUBU_MOTION.details($('feedback-list'));
  HUBU_MOTION.animate(
    document.querySelector('main'),
    [
      { opacity: 0, transform: 'translateY(20px)' },
      { opacity: 1, transform: 'none' },
    ],
    { duration: 550 },
  );
  H.saveTime();
})();
