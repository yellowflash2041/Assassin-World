import AppEvents from 'discourse/lib/app-events';

export default {
  name: "inject-app-events",
  initialize: function(container, application) {
    application.register('app-events:main', AppEvents, { singleton: true });

    application.inject('controller', 'appEvents', 'app-events:main');
    application.inject('route', 'appEvents', 'app-events:main');
    application.inject('view', 'appEvents', 'app-events:main');
    application.inject('model', 'appEvents', 'app-events:main');
  }
};
