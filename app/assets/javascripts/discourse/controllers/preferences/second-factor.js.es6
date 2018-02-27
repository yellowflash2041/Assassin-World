import { default as computed } from 'ember-addons/ember-computed-decorators';
import { default as DiscourseURL, userPath } from 'discourse/lib/url';
import { popupAjaxError } from 'discourse/lib/ajax-error';

export default Ember.Controller.extend({
  loading: false,
  resetPasswordLoading: false,
  resetPasswordProgress: '',
  password: null,
  secondFactorImage: null,
  secondFactorKey: null,
  showSecondFactorKey: false,
  errorMessage: null,
  newUsername: null,

  loaded: Ember.computed.and('secondFactorImage', 'secondFactorKey'),

  @computed('loading')
  submitButtonText(loading) {
    return loading ? 'loading' : 'submit';
  },

  toggleSecondFactor(enable) {
    if (!this.get('secondFactorToken')) return;
    this.set('loading', true);

    this.get('content').toggleSecondFactor(this.get('secondFactorToken'), enable)
      .then(response => {
        if (response.error) {
          this.set('errorMessage', response.error);
          this.set('loading', false);
          return;
        }

        this.set('errorMessage',null);
        DiscourseURL.redirectTo(userPath(`${this.get('content').username.toLowerCase()}/preferences`));
      })
      .catch(error => {
        this.set('loading', false);
        popupAjaxError(error);
      });
  },

  actions: {
    confirmPassword() {
      if (!this.get('password')) return;
      this.set('loading', true);

      this.get('content').loadSecondFactorCodes(this.get('password'))
        .then(response => {
          if(response.error) {
            this.set('errorMessage', response.error);
            return;
          }

          this.setProperties({
            errorMessage: null,
            secondFactorKey: response.key,
            secondFactorImage: response.qr,
          });
        })
        .catch(popupAjaxError)
        .finally(() => this.set('loading', false));
    },

    resetPassword() {
      this.setProperties({
        resetPasswordLoading: true,
        resetPasswordProgress: ''
      });

      return this.get('model').changePassword().then(() => {
        this.set('resetPasswordProgress', I18n.t('user.change_password.success'));
      })
      .catch(popupAjaxError)
      .finally(() => this.set('resetPasswordLoading', false));
    },

    showSecondFactorKey() {
      this.set('showSecondFactorKey', true);
    },

    enableSecondFactor() {
      this.toggleSecondFactor(true);
    },

    disableSecondFactor() {
      this.toggleSecondFactor(false);
    }
  }
});
