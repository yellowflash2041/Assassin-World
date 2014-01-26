/**
  Sets up the PageTracking hook.
**/
Discourse.addInitializer(function() {
  var pageTracker = Discourse.PageTracker.current();
  pageTracker.start();

  // Out of the box, Discourse tries to track google analytics
  // if it is present
  if (typeof window._gaq !== 'undefined') { 
    pageTracker.on('change', function() {
      window._gaq.push(['_trackPageview']);
    });
  }

  // Also use Universal Analytics if it is present
  if (typeof window.ga !== 'undefined') { 
    pageTracker.on('change', function() {
      window.ga('send', 'pageview');
    });
  }
});
