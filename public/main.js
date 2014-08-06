(function($) {
  var setTextareaSize = function() {
    if ($('.thought-form textarea').length > 0) {
      var h = $(window).height() - ($('header').outerHeight() + $('.thought-form textarea').offset().top + $('.thought-form .controls').outerHeight() + $('.thought-form input[type=submit]').outerHeight());
      $('.thought-form textarea').css('height',h + 'px');
    }
  }

  $(document).ready(function() {
    setTextareaSize();
    $(window).resize(setTextareaSize);

    $('.thought-form.new').submit(function(event) {
      try {event.preventDefault()} catch(e) {}
      var $form = $(this);
      $.ajax({
        'url': $form.attr('action'),
        'type': $form.attr('method'),
        'data': $form.serialize(),
        'cache': false
      }).done(function(obj) {
        if (obj) {
          $form
            .find('textarea')
            .attr('placeholder',obj.quote)
            .val('');
          var html = obj.thought;
          var $thoughts = $('.thoughts');
          var $html = $(html);
          $html.hide();
          var $rows = $thoughts.find('.thought');
          if ($rows.length > 0) {
            $rows.first().before($html);
          } else {
            $thoughts.append($html);
          }
          $html.slideDown();
        }
      });
      return false;
    });

    $('.thought-form.new textarea').keyup(function(event) {
      if (event.keyCode == 13 && event.shiftKey) {
        event.stopPropagation();
        $(this).parents('form').submit();
      }
    });

  });
})(jQuery);