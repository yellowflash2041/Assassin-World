import {
  currentUser,
  discourseModule,
} from "discourse/tests/helpers/qunit-helpers";
import { test } from "qunit";

discourseModule("Unit | Service | document-title", function (hooks) {
  hooks.beforeEach(function () {
    this.documentTitle = this.container.lookup("service:document-title");
    this.documentTitle.currentUser = null;
    this.container.lookup("session:main").hasFocus = true;
  });

  hooks.afterEach(function () {
    this.documentTitle.reset();
  });

  test("it updates the document title", function (assert) {
    this.documentTitle.setTitle("Test Title");
    assert.equal(document.title, "Test Title", "title is correct");
  });

  test("it doesn't display notification counts for anonymous users", function (assert) {
    this.documentTitle.setTitle("test notifications");
    this.documentTitle.updateNotificationCount(5);
    assert.equal(document.title, "test notifications");
    this.documentTitle.setFocus(false);
    this.documentTitle.updateNotificationCount(6);
    assert.equal(document.title, "test notifications");
  });

  test("it displays notification counts for logged in users", function (assert) {
    this.documentTitle.currentUser = currentUser();
    this.documentTitle.currentUser.dynamic_favicon = false;
    this.documentTitle.setTitle("test notifications");
    this.documentTitle.updateNotificationCount(5);
    assert.equal(document.title, "test notifications");
    this.documentTitle.setFocus(false);
    this.documentTitle.updateNotificationCount(6);
    assert.equal(document.title, "(6) test notifications");
    this.documentTitle.setFocus(true);
    assert.equal(document.title, "test notifications");
  });

  test("it doesn't increment background context counts when focused", function (assert) {
    this.documentTitle.setTitle("background context");
    this.documentTitle.setFocus(true);
    this.documentTitle.incrementBackgroundContextCount();
    assert.equal(document.title, "background context");
  });

  test("it increments background context counts when not focused", function (assert) {
    this.documentTitle.setTitle("background context");
    this.documentTitle.setFocus(false);
    this.documentTitle.incrementBackgroundContextCount();
    assert.equal(document.title, "(1) background context");
    this.documentTitle.setFocus(true);
    assert.equal(document.title, "background context");
  });
});
