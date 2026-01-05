jQuery(function ($) {
  'use strict';

  var lastScroll = 0;

  function ctwpmlNotice(message, type) {
    type = type || 'success';

    var noticeClass = type === 'success' ? 'notice-success' : 'notice-error';
    var notice = $(
      '<div class="notice ' +
        noticeClass +
        ' is-dismissible ctwpml-refresh-notice" style="margin: 5px 0 2px; padding: 1px 12px;"><p>' +
        message +
        '</p><button type="button" class="notice-dismiss"><span class="screen-reader-text">Dispensar este aviso.</span></button></div>'
    );

    $('.ctwpml-refresh-notice').remove();

    var $target = $('.wp-header-end').length ? $('.wp-header-end') : $('.wrap h1').first();
    if ($target.length) $target.after(notice);
    else $('.wrap').first().prepend(notice);

    var dismissTime = type === 'success' ? 5000 : 10000;
    setTimeout(function () {
      notice.fadeOut(300, function () {
        $(this).remove();
      });
    }, dismissTime);

    notice.on('click', '.notice-dismiss', function () {
      notice.fadeOut(300, function () {
        $(this).remove();
      });
    });
  }

  $(document).on('click', '.gu-refresh-cache-btn', function (e) {
    e.preventDefault();

    var btn = $(this);
    var nonce = btn.data('nonce');
    var spinner = btn.find('.spinner');
    var refreshText = btn.find('.gu-refresh-text');

    lastScroll = $(window).scrollTop();

    btn.prop('disabled', true).addClass('disabled');
    spinner.css('visibility', 'visible').addClass('is-active');
    refreshText.text('Atualizando...');

    $.ajax({
      url: GURefreshCache.ajax_url,
      type: 'POST',
      data: {
        action: 'gu_refresh_cache',
        _ajax_nonce: nonce,
      },
      success: function (response) {
        if (response && response.success) {
          var $icon = btn.find('.dashicons');
          var originalClass = $icon.attr('class');

          $icon.removeClass('dashicons-update').addClass('dashicons-yes').css('color', '#46b450');

          setTimeout(function () {
            $icon.attr('class', originalClass).css('color', '');
          }, 3000);

          ctwpmlNotice((response && response.data) || 'Cache atualizado com sucesso!', 'success');
        } else {
          ctwpmlNotice((response && response.data) || 'Erro ao atualizar cache.', 'error');
        }
      },
      error: function (xhr) {
        var errorMessage = 'Erro ao atualizar cache.';

        if (xhr && xhr.responseJSON && xhr.responseJSON.data) {
          errorMessage = xhr.responseJSON.data;
        } else if (xhr && xhr.status === 0) {
          errorMessage = 'Erro de conexão. Verifique sua internet.';
        } else if (xhr && xhr.status === 403) {
          errorMessage = 'Sem permissão para executar esta ação.';
        }

        ctwpmlNotice(errorMessage, 'error');
      },
      complete: function () {
        btn.prop('disabled', false).removeClass('disabled');
        spinner.css('visibility', 'hidden').removeClass('is-active');
        refreshText.text('Atualizar Cache');

        setTimeout(function () {
          $(window).scrollTop(lastScroll);
        }, 100);
      },
    });
  });
});