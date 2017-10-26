import { default as computed, observes } from "ember-addons/ember-computed-decorators";
import ComboBoxComponent from "select-box-kit/components/combo-box";
import { CLOSE_STATUS_TYPE } from "discourse/controllers/edit-topic-timer";
import DatetimeMixin from "select-box-kit/components/future-date-input-selector/mixin";

const TIMEFRAME_BASE = {
  enabled: () => true,
  when: () => null,
  icon: 'briefcase',
  displayWhen: true,
};

function buildTimeframe(opts) {
  return jQuery.extend({}, TIMEFRAME_BASE, opts);
}

export const TIMEFRAMES = [
  buildTimeframe({
    id: 'later_today',
    format: "h a",
    enabled: opts => opts.canScheduleToday,
    when: (time) => time.hour(18).minute(0),
    icon: 'moon-o'
  }),
  buildTimeframe({
    id: "tomorrow",
    format: "ddd, h a",
    when: (time, timeOfDay) => time.add(1, 'day').hour(timeOfDay).minute(0),
    icon: 'sun-o'
  }),
  buildTimeframe({
    id: "later_this_week",
    format: "ddd, h a",
    enabled: opts => !opts.canScheduleToday && opts.day < 4,
    when: (time, timeOfDay) => time.add(2, 'day').hour(timeOfDay).minute(0),
  }),
  buildTimeframe({
    id: "this_weekend",
    format: "ddd, h a",
    enabled: opts => opts.day < 5 && opts.includeWeekend,
    when: (time, timeOfDay) => time.day(6).hour(timeOfDay).minute(0),
    icon: 'bed'
  }),
  buildTimeframe({
    id: "next_week",
    format: "ddd, h a",
    enabled: opts => opts.day !== 7,
    when: (time, timeOfDay) => time.add(1, 'week').day(1).hour(timeOfDay).minute(0),
    icon: 'briefcase'
  }),
  buildTimeframe({
    id: "two_weeks",
    format: "MMM D",
    when: (time, timeOfDay) => time.add(2, 'week').hour(timeOfDay).minute(0),
    icon: 'briefcase'
  }),
  buildTimeframe({
    id: "next_month",
    format: "MMM D",
    enabled: opts => opts.now.date() !== moment().endOf("month").date(),
    when: (time, timeOfDay) => time.add(1, 'month').startOf('month').hour(timeOfDay).minute(0),
    icon: 'briefcase'
  }),
  buildTimeframe({
    id: "three_months",
    format: "MMM D",
    enabled: opts => opts.includeFarFuture,
    when: (time, timeOfDay) => time.add(3, 'month').startOf('month').hour(timeOfDay).minute(0),
    icon: 'briefcase'
  }),
  buildTimeframe({
    id: "six_months",
    format: "MMM D",
    enabled: opts => opts.includeFarFuture,
    when: (time, timeOfDay) => time.add(6, 'month').startOf('month').hour(timeOfDay).minute(0),
    icon: 'briefcase'
  }),
  buildTimeframe({
    id: "one_year",
    format: "MMM D",
    enabled: opts => opts.includeFarFuture,
    when: (time, timeOfDay) => time.add(1, 'year').startOf('day').hour(timeOfDay).minute(0),
    icon: 'briefcase'
  }),
  buildTimeframe({
    id: "forever",
    enabled: opts => opts.includeFarFuture,
    when: (time, timeOfDay) => time.add(1000, 'year').hour(timeOfDay).minute(0),
    icon: 'gavel',
    displayWhen: false
  }),
  buildTimeframe({
    id: "pick_date_and_time",
    icon: 'calendar-plus-o'
  }),
  buildTimeframe({
    id: "set_based_on_last_post",
    enabled: opts => opts.includeBasedOnLastPost,
    icon: 'clock-o'
  }),
];

let _timeframeById = null;
export function timeframeDetails(id) {
  if (!_timeframeById) {
    _timeframeById = {};
    TIMEFRAMES.forEach(t => _timeframeById[t.id] = t);
  }
  return _timeframeById[id];
}

export const FORMAT = "YYYY-MM-DD HH:mm";

export default ComboBoxComponent.extend(DatetimeMixin, {
  classNames: ["future-date-input-selector"],
  isCustom: Ember.computed.equal("value", "pick_date_and_time"),
  clearable: true,
  rowComponent: "future-date-input-selector/future-date-input-selector-row",
  headerComponent: "future-date-input-selector/future-date-input-selector-header",

  @computed
  content() {
    let now = moment();
    let opts = {
      now,
      day: now.day(),
      includeWeekend: this.get('includeWeekend'),
      includeFarFuture: this.get('includeFarFuture'),
      includeBasedOnLastPost: this.get("statusType") === CLOSE_STATUS_TYPE,
      canScheduleToday: (24 - now.hour()) > 6,
    };

    return TIMEFRAMES.filter(tf => tf.enabled(opts)).map(tf => {
      return {
        id: tf.id,
        name: I18n.t(`topic.auto_update_input.${tf.id}`)
      };
    });
  },

  @observes("value")
  _updateInput() {
    if (this.get("isCustom")) return;
    let input = null;
    const { time } = this.get("updateAt");

    if (time && !Ember.isEmpty(this.get("value"))) {
      input = time.format(FORMAT);
    }

    this.set("input", input);
  },

  @computed("value")
  updateAt(value) {
    return this._updateAt(value);
  }
});
