window.Discourse.EmbeddedPostView = Ember.View.extend
  templateName: 'embedded_post'
  classNames: ['reply']

  didInsertElement: ->
    postView = @get('postView') || @get('parentView.postView')
    postView.get('screenTrack').track(@get('elementId'), @get('post.post_number'))
