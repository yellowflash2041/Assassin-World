import ModalFunctionality from 'discourse/mixins/modal-functionality';

import ObjectController from 'discourse/controllers/object';

/**
  This controller handles displaying of history

  @class HistoryController
  @extends ObjectController
  @namespace Discourse
  @uses ModalFunctionality
  @module Discourse
**/
export default ObjectController.extend(ModalFunctionality, {
  loading: false,
  viewMode: "side_by_side",
  revisionsTextKey: "post.revisions.controls.comparing_previous_to_current_out_of_total",

  refresh: function(postId, postVersion) {
    this.set("loading", true);

    var self = this;
    Discourse.Post.loadRevision(postId, postVersion).then(function (result) {
      self.setProperties({ loading: false, model: result });
    });
  },

  hide: function(postId, postVersion) {
    var self = this;
    Discourse.Post.hideRevision(postId, postVersion).then(function (result) {
      self.refresh(postId, postVersion);
    });
  },

  show: function(postId, postVersion) {
    var self = this;
    Discourse.Post.showRevision(postId, postVersion).then(function (result) {
      self.refresh(postId, postVersion);
    });
  },

  createdAtDate: function() { return moment(this.get("created_at")).format("LLLL"); }.property("created_at"),

  previousVersion: function() { return this.get("version") - 1; }.property("version"),

  displayGoToFirst: Em.computed.gt("version", 3),
  displayGoToPrevious: Em.computed.gt("version", 2),
  displayRevisions: Em.computed.gt("revisions_count", 2),
  displayGoToNext: function() { return this.get("version") < this.get("revisions_count"); }.property("version", "revisions_count"),
  displayGoToLast: function() { return this.get("version") < this.get("revisions_count") - 1; }.property("version", "revisions_count"),

  displayShow: function() { return this.get("hidden") && Discourse.User.currentProp('staff'); }.property("hidden"),
  displayHide: function() { return !this.get("hidden") && Discourse.User.currentProp('staff'); }.property("hidden"),

  displayingInline: Em.computed.equal("viewMode", "inline"),
  displayingSideBySide: Em.computed.equal("viewMode", "side_by_side"),
  displayingSideBySideMarkdown: Em.computed.equal("viewMode", "side_by_side_markdown"),

  category_diff: function() {
    var viewMode = this.get("viewMode");
    var changes = this.get("category_changes");

    if (changes === null) { return; }

    var prevCategory = Discourse.Category.findById(changes.previous_category_id);
    var curCategory = Discourse.Category.findById(changes.current_category_id);

    var raw = "";
    var opts = { allowUncategorized: true };
    prevCategory = Discourse.HTML.categoryBadge(prevCategory, opts);
    curCategory = Discourse.HTML.categoryBadge(curCategory, opts);

    if(viewMode === "side_by_side_markdown" || viewMode === "side_by_side") {
      raw = "<div class='span8'>" + prevCategory +  "</div> <div class='span8 offset1'>" + curCategory +  "</div>";
    } else {
      var diff = "<del>" + prevCategory + "</del> " + "<ins>" + curCategory + "</ins>";
      raw = "<div class='inline-diff'>" + diff +  "</div>";
    }

    return raw;

  }.property("viewMode", "category_changes"),

  wiki_diff: function() {
    var viewMode = this.get("viewMode");
    var changes = this.get("wiki_changes");
    if (changes === null) { return; }

    if (viewMode === "inline") {
      var diff = changes["current_wiki"] ? '<i class="fa fa-pencil-square-o fa-2x"></i>' : '<span class="fa-stack"><i class="fa fa-pencil-square-o fa-stack-2x"></i><i class="fa fa-ban fa-stack-2x"></i></span>';
      return "<div class='inline-diff'>" + diff + "</div>";
    } else {
      var prev = changes["previous_wiki"] ? '<i class="fa fa-pencil-square-o fa-2x"></i>' : "&nbsp;";
      var curr = changes["current_wiki"] ? '<i class="fa fa-pencil-square-o fa-2x"></i>' : '<span class="fa-stack"><i class="fa fa-pencil-square-o fa-stack-2x"></i><i class="fa fa-ban fa-stack-2x"></i></span>';
      return "<div class='span8'>" + prev + "</div><div class='span8 offset1'>" + curr + "</div>";
    }
  }.property("viewMode", "wiki_changes"),

  post_type_diff: function () {
    var viewMode = this.get("viewMode");
    var changes = this.get("post_type_changes");
    if (changes === null) { return; }

    var moderator = Discourse.Site.currentProp('post_types.moderator_action');

    if (viewMode === "inline") {
      var diff = changes["current_post_type"] === moderator ?
                 '<i class="fa fa-shield fa-2x"></i>' :
                 '<span class="fa-stack"><i class="fa fa-shield fa-stack-2x"></i><i class="fa fa-ban fa-stack-2x"></i></span>';
      return "<div class='inline-diff'>" + diff + "</div>";
    } else {
      var prev = changes["previous_post_type"] === moderator ? '<i class="fa fa-shield fa-2x"></i>' : "&nbsp;";
      var curr = changes["current_post_type"] === moderator ?
                 '<i class="fa fa-shield fa-2x"></i>' :
                 '<span class="fa-stack"><i class="fa fa-shield fa-stack-2x"></i><i class="fa fa-ban fa-stack-2x"></i></span>';
      return "<div class='span8'>" + prev + "</div><div class='span8 offset1'>" + curr + "</div>";
    }
  }.property("viewMode", "post_type_changes"),

  title_diff: function() {
    var viewMode = this.get("viewMode");
    if(viewMode === "side_by_side_markdown") {
      viewMode = "side_by_side";
    }
    return this.get("title_changes." + viewMode);
  }.property("viewMode", "title_changes"),

  body_diff: function() {
    return this.get("body_changes." + this.get("viewMode"));
  }.property("viewMode", "body_changes"),

  actions: {
    loadFirstVersion: function() { this.refresh(this.get("post_id"), 2); },
    loadPreviousVersion: function() { this.refresh(this.get("post_id"), this.get("version") - 1); },
    loadNextVersion: function() { this.refresh(this.get("post_id"), this.get("version") + 1); },
    loadLastVersion: function() { this.refresh(this.get("post_id"), this.get("revisions_count")); },

    hideVersion: function() { this.hide(this.get("post_id"), this.get("version")); },
    showVersion: function() { this.show(this.get("post_id"), this.get("version")); },

    displayInline: function() { this.set("viewMode", "inline"); },
    displaySideBySide: function() { this.set("viewMode", "side_by_side"); },
    displaySideBySideMarkdown: function() { this.set("viewMode", "side_by_side_markdown"); }
  }
});
