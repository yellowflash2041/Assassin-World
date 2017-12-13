import { acceptance } from "helpers/qunit-helpers";
import { displayPollBuilderButton } from "discourse/plugins/poll/helpers/display-poll-builder-button";
import { replaceCurrentUser } from "discourse/plugins/poll/helpers/replace-current-user";

acceptance("Poll Builder - polls are disabled", {
  loggedIn: true,
  settings: {
    poll_enabled: false,
    poll_minimum_trust_level_to_create: 2
  }
});

test("regular user - sufficient trust level", (assert) => {
  replaceCurrentUser({ staff: false, trust_level: 3 });

  displayPollBuilderButton();

  andThen(() => {
    assert.ok(!exists(".select-kit-row[title='Build Poll']"), "it hides the builder button");
  });
});

test("regular user - insufficient trust level", (assert) => {
  replaceCurrentUser({ staff: false, trust_level: 1 });

  displayPollBuilderButton();

  andThen(() => {
    assert.ok(!exists(".select-kit-row[title='Build Poll']"), "it hides the builder button");
  });
});

test("staff", (assert) => {
  replaceCurrentUser({ staff: true });

  displayPollBuilderButton();

  andThen(() => {
    assert.ok(!exists(".select-kit-row[title='Build Poll']"), "it hides the builder button");
  });
});
