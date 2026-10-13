(function () {
  'use strict';
  window.HUBU_TOUR = {
    create: function (api) {
      var H = HUBU,
        U = HUBU_UI,
        panel = document.getElementById('tour-panel'),
        active = false,
        act = 0,
        auto = false,
        elapsed = 0,
        m = null,
        arrived = false;
      var titles = ['发现异常', '查看安排', '到站收运', '处置结果'];
      var descriptions = [
        '桃李园食堂的模拟饱和度达到预警阈值，系统记录一条满溢工单。',
        '南线车辆沿已有路线前往桃李园，安排与工单使用同一条事件记录。',
        '观察车辆沿预设路线靠近点位。实际到站收运后，重量、饱和度与工单同步更新。',
        '本次满溢已解除。收运事件与工单时间线保留了发现、安排和办结的过程。',
      ];
      function draw() {
        var focused = panel.contains(document.activeElement)
          ? document.activeElement.dataset.tour
          : null;
        panel.innerHTML =
          '<div class="tour-top"><span class="eyebrow">校园清运纪事 / 独立模拟演示</span><button class="icon-btn" data-tour="exit" aria-label="退出故事导览">' +
          U.icon('close') +
          '</button></div><div class="tour-progress">' +
          titles
            .map(function (t, i) {
              return '<span class="' + (i <= act ? 'active' : '') + '"></span>';
            })
            .join('') +
          '</div><h2>' +
          titles[act] +
          ' · 桃李园的一次满溢处置</h2><p>' +
          descriptions[act] +
          '</p>' +
          (act === 3
            ? '<div class="tour-result">' + U.timeline(H.getOrderTimeline(m.orderId)) + '</div>'
            : '') +
          '<div class="tour-actions"><button class="button secondary" data-tour="prev" ' +
          (act === 0 ? 'disabled' : '') +
          '>' +
          U.icon('back') +
          '上一幕</button><span class="tour-count">' +
          (act + 1) +
          ' / 4</span><button class="button secondary" data-tour="auto">' +
          U.icon(auto ? 'pause' : 'play') +
          (auto ? '暂停自动' : '自动播放') +
          '</button><button class="button primary" data-tour="' +
          (act === 3 ? 'exit' : 'next') +
          '">' +
          (act === 3 ? '返回自由操作' : '下一幕') +
          U.icon('arrow') +
          '</button><button class="text-button" data-tour="restart">重新开始</button>' +
          (act === 3 ? '<a class="text-link" href="feedback.html?point=P4">体验点位反馈</a>' : '') +
          '</div>';
        if (focused) {
          var focusTarget =
            panel.querySelector('[data-tour="' + focused + '"]:not(:disabled)') ||
            panel.querySelector('.tour-actions [data-tour=exit]') ||
            panel.querySelector('[data-tour=next]');
          if (focusTarget) focusTarget.focus({ preventScroll: true });
        }
      }
      function stage(n) {
        act = Math.max(0, Math.min(3, n));
        elapsed = 0;
        arrived = false;
        H.stepTo(
          act === 0
            ? m.before
            : act === 1
              ? m.assigned
              : act === 2
                ? Math.max(m.assigned, m.done - 9)
                : m.done,
        );
        api.select({
          kind: act === 1 || act === 2 ? 'truck' : 'point',
          id: act === 1 || act === 2 ? 'T2' : 'P4',
        });
        H.setPlayback({ follow: act === 2 ? 'T2' : null });
        api.render();
        draw();
        U.announce('第' + (act + 1) + '幕，' + titles[act]);
      }
      function start() {
        if (active) return;
        H.beginTour();
        m = H.tourMilestones();
        active = true;
        panel.hidden = false;
        document.body.classList.add('tour-active');
        document.querySelector('.playback').inert = true;
        stage(0);
        panel.querySelector('[data-tour=next]').focus();
      }
      function exit() {
        if (!active) return;
        active = false;
        auto = false;
        H.endTour();
        panel.hidden = true;
        document.body.classList.remove('tour-active');
        document.querySelector('.playback').inert = false;
        api.select(H.getSnapshot().playback.selected, false);
        api.render();
        document.getElementById('start-tour').focus();
      }
      panel.addEventListener('click', function (e) {
        var b = e.target.closest('[data-tour]');
        if (!b) return;
        var a = b.dataset.tour;
        if (a === 'exit') exit();
        if (a === 'prev') {
          auto = false;
          stage(act - 1);
        }
        if (a === 'next') {
          auto = false;
          stage(act + 1);
        }
        if (a === 'restart') {
          auto = false;
          stage(0);
        }
        if (a === 'auto') {
          auto = !auto;
          elapsed = 0;
          draw();
        }
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && active) exit();
      });
      function frame(dt) {
        if (!active || document.hidden) return;
        elapsed += dt;
        if (act === 0 && !arrived && elapsed >= 1.2) {
          H.stepTo(m.alert);
          arrived = true;
          api.render();
          U.announce('桃李园由临满进入满溢，已生成预警工单');
        }
        if (act === 2 && !arrived) {
          H.stepTo(
            Math.min(
              m.done,
              Math.max(m.assigned, m.done - 9) +
                (elapsed / 7) * (m.done - Math.max(m.assigned, m.done - 9)),
            ),
          );
          if (H.getNow() >= m.done) {
            arrived = true;
            api.render();
            U.announce('车辆已到站收运，工单已办结');
          }
        }
        if (auto && elapsed >= (act === 2 ? 8 : 5)) {
          if (act < 3) stage(act + 1);
          else {
            auto = false;
            draw();
          }
        }
      }
      return { start: start, exit: exit, frame: frame };
    },
  };
})();
