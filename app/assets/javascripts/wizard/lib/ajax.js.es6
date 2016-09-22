
let token;

export function getToken() {
  if (!token) {
    token = $('meta[name="csrf-token"]').attr('content');
  }

  return token;
}

export function ajax(args) {
  return new Ember.RSVP.Promise((resolve, reject) => {
    args.headers = { 'X-CSRF-Token': getToken() };
    args.success = data => Ember.run(null, resolve, data);
    args.error = xhr => Ember.run(null, reject, xhr);
    Ember.$.ajax(args);
  });
}
