import { default as computed, observes } from "ember-addons/ember-computed-decorators";
import ModalFunctionality from 'discourse/mixins/modal-functionality';
import TopicTimer from 'discourse/models/topic-timer';
import { popupAjaxError } from 'discourse/lib/ajax-error';

export const CLOSE_STATUS_TYPE = 'close';
const OPEN_STATUS_TYPE = 'open';
const PUBLISH_TO_CATEGORY_STATUS_TYPE = 'publish_to_category';
const DELETE_STATUS_TYPE = 'delete';

export default Ember.Controller.extend(ModalFunctionality, {
  loading: false,
  updateTime: null,
  topicTimer: Ember.computed.alias("model.topic_timer"),
  selection: Ember.computed.alias('model.topic_timer.status_type'),
  autoOpen: Ember.computed.equal('selection', OPEN_STATUS_TYPE),
  autoClose: Ember.computed.equal('selection', CLOSE_STATUS_TYPE),
  autoDelete: Ember.computed.equal('selection', DELETE_STATUS_TYPE),
  publishToCategory: Ember.computed.equal('selection', PUBLISH_TO_CATEGORY_STATUS_TYPE),

  showTimeOnly: Ember.computed.or('autoOpen', 'autoDelete'),

  @computed("model.closed")
  timerTypes(closed) {
    return [
      { id: CLOSE_STATUS_TYPE, name: I18n.t(closed ? 'topic.temp_open.title' : 'topic.auto_close.title'), },
      { id: OPEN_STATUS_TYPE, name: I18n.t(closed ? 'topic.auto_reopen.title' : 'topic.temp_close.title') },
      { id: PUBLISH_TO_CATEGORY_STATUS_TYPE, name: I18n.t('topic.publish_to_category.title') },
      { id: DELETE_STATUS_TYPE, name: I18n.t('topic.auto_delete.title') }
    ];
  },

  @computed('updateTime', 'loading')
  saveDisabled(updateTime, loading) {
    return Ember.isEmpty(updateTime) || loading;
  },

  @computed("model.visible")
  excludeCategoryId(visible) {
    if (visible) return this.get('model.category_id');
  },

  @observes("topicTimer.execute_at", "topicTimer.duration")
  _setUpdateTime() {
    if (!this.get('topicTimer.execute_at')) return;

    let time = null;

    if (this.get("topicTimer.based_on_last_post")) {
      time = this.get("topicTimer.duration");
    } else if (this.get("topicTimer.execute_at")) {
      const closeTime = moment(this.get('topicTimer.execute_at'));

      if (closeTime > moment()) {
        time = closeTime.format("YYYY-MM-DD HH:mm");
      }
    }

    this.set("updateTime", time);
  },

  _setTimer(time, statusType) {
    this.set('loading', true);

    TopicTimer.updateStatus(
      this.get('model.id'),
      time,
      this.get('topicTimer.based_on_last_post'),
      statusType,
      this.get('categoryId')
    ).then(result => {
      if (time) {
        this.send('closeModal');

        this.get("topicTimer").setProperties({
          execute_at: result.execute_at,
          duration: result.duration,
          category_id: result.category_id
        });

        this.set('model.closed', result.closed);
      } else {
        this.setProperties({
          topicTimer: Ember.Object.create({}),
          selection: null,
          updateTime: null
        });
      }
    }).catch(error => {
      popupAjaxError(error);
    }).finally(() => this.set('loading', false));
  },

  actions: {
    saveTimer() {
      this._setTimer(this.get("updateTime"), this.get('selection'));
    },

    removeTimer() {
      this._setTimer(null, this.get('selection'));
    }
  }
});
