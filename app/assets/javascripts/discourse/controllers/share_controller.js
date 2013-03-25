/**
  This controller supports the "share" link controls

  @class ShareController
  @extends Discourse.Controller
  @namespace Discourse
  @module Discourse
**/
Discourse.ShareController = Discourse.Controller.extend({

  // When the user clicks the post number, we pop up a share box
  shareLink: function(e, url) {
    var x;
    x = e.pageX - 150;
    if (x < 25) {
      x = 25;
    }
    $('#share-link').css({
      left: "" + x + "px",
      top: "" + (e.pageY - 100) + "px"
    });
    this.set('link', url);
    return false;
  },

  // Close the share controller
  close: function() {
    this.set('link', '');
    return false;
  },

  popupHeights: {
    twitter: 265,
    facebook: 315,
    googlePlus: 600
  },

  sharePopup: function(target, url) {
    window.open(url, '', 'menubar=no,toolbar=no,resizable=yes,scrollbars=yes,width=600,height=' + this.popupHeights[target]);
    return false;
  }
});


