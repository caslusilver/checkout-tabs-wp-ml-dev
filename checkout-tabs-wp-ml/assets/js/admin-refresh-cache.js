jQuery(function ($) {
  var lastScroll = 0;

  $(document).on('click', '.gu-refresh-cache-btn', function (e) {
    e.preventDefault();

    var nonce = $(this).data('nonce');
    var btn = $(this);

    lastScroll = $(window).scrollTop();

    btn.after('<span class="gu-spinner" style="margin-left:6px;">Carregando...</span>');
    btn.prop('disabled', true);

    $.post(GURefreshCache.ajax_url, {
      action: 'gu_refresh_cache',
      _ajax_nonce: nonce,
    })
      .done(function (res) {
        alert((res && res.data) || 'Cache atualizado!');
      })
      .fail(function () {
        alert('Erro ao atualizar cache.');
      })
      .always(function () {
        $('.gu-spinner').remove();
        btn.prop('disabled', false);

        setTimeout(function () {
          $(window).scrollTop(lastScroll);
        }, 50);
      });
  });
});


