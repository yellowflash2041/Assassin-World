import RestrictedUserRoute from "discourse/routes/restricted-user";

export default RestrictedUserRoute.extend({
  showFooter: true,

  redirect() {
    this.transitionTo('preferences.account');
  }
});
