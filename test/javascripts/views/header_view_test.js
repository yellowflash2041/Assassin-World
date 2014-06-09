module("Discourse.HeaderView");

import HeaderView from 'discourse/views/header';

test("showNotifications", function() {
  var controllerSpy = {
    send: sinon.spy()
  };
  var view = HeaderView.create({
    controller: controllerSpy
  });

  view.showNotifications();

  ok(controllerSpy.send.calledWith("showNotifications", view), "sends showNotifications message to the controller, passing header view as a param");
});
