import { acceptance } from "helpers/qunit-helpers";
acceptance("Admin - Flagging", { loggedIn: true });

QUnit.test("flagged posts", assert => {
  visit("/admin/flags/active");
  andThen(() => {
    assert.equal(find('.flagged-posts .flagged-post').length, 1);
    assert.equal(find('.flagged-post .flag-user').length, 1, 'shows who flagged it');
    assert.equal(find('.flagged-post-response').length, 2);
    assert.equal(find('.flagged-post-response:eq(0) img.avatar').length, 1);
    assert.equal(find('.flagged-post-user-details .username').length, 1, 'shows the flagged username');
  });
});

QUnit.test("flagged posts - agree", assert => {
  visit("/admin/flags/active");

  andThen(() => {
    expandSelectBoxKit('.agree-flag');
  });

  andThen(() => {
    selectBoxKitSelectRow('confirm-agree-keep', { selector: '.agree-flag'});
  });

  andThen(() => {
    assert.equal(find('.admin-flags .flagged-post').length, 0, 'post was removed');
  });
});

QUnit.test("flagged posts - agree + hide", assert => {
  visit("/admin/flags/active");

  andThen(() => {
    expandSelectBoxKit('.agree-flag');
  });

  andThen(() => {
    selectBoxKitSelectRow('confirm-agree-hide', { selector: '.agree-flag'});
  });

  andThen(() => {
    assert.equal(find('.admin-flags .flagged-post').length, 0, 'post was removed');
  });
});

QUnit.test("flagged posts - agree + deleteSpammer", assert => {
  visit("/admin/flags/active");

  andThen(() => {
    expandSelectBoxKit('.agree-flag');
  });

  andThen(() => {
    selectBoxKitSelectRow('delete-spammer', { selector: '.agree-flag'});
  });

  click('.confirm-delete');

  andThen(() => {
    assert.equal(find('.admin-flags .flagged-post').length, 0, 'post was removed');
  });
});

QUnit.test("flagged posts - disagree", assert => {
  visit("/admin/flags/active");
  click('.disagree-flag');
  andThen(() => {
    assert.equal(find('.admin-flags .flagged-post').length, 0);
  });
});

QUnit.test("flagged posts - defer", assert => {
  visit("/admin/flags/active");
  click('.defer-flag');
  andThen(() => {
    assert.equal(find('.admin-flags .flagged-post').length, 0);
  });
});

QUnit.test("flagged posts - delete + defer", assert => {
  visit("/admin/flags/active");

  andThen(() => {
    expandSelectBoxKit('.delete-flag');
  });

  andThen(() => {
    selectBoxKitSelectRow('delete-defer', { selector: '.delete-flag'});
  });

  andThen(() => {
    assert.equal(find('.admin-flags .flagged-post').length, 0);
  });
});

QUnit.test("flagged posts - delete + agree", assert => {
  visit("/admin/flags/active");

  andThen(() => {
    expandSelectBoxKit('.delete-flag');
  });

  andThen(() => {
    selectBoxKitSelectRow('delete-agree', { selector: '.delete-flag'});
  });

  andThen(() => {
    assert.equal(find('.admin-flags .flagged-post').length, 0);
  });
});

QUnit.test("flagged posts - delete + deleteSpammer", assert => {
  visit("/admin/flags/active");

  andThen(() => {
    expandSelectBoxKit('.delete-flag');
  });

  andThen(() => {
    selectBoxKitSelectRow('delete-spammer', { selector: '.delete-flag'});
  });

  click('.confirm-delete');

  andThen(() => {
    assert.equal(find('.admin-flags .flagged-post').length, 0);
  });
});

QUnit.test("flagged posts - suspend", assert => {
  visit("/admin/flags/active");
  click('.suspend-user');
  andThen(() => {
    assert.equal(find('.suspend-user-modal:visible').length, 1);
    assert.equal(find('.suspend-user-modal .cant-suspend').length, 1);
  });
});

QUnit.test("topics with flags", assert => {
  visit("/admin/flags/topics");
  andThen(() => {
    assert.equal(find('.flagged-topics .flagged-topic').length, 1);
    assert.equal(find('.flagged-topic .flagged-topic-user').length, 2);
    assert.equal(find('.flagged-topic .flag-counts').length, 3);
  });

  click('.flagged-topic .show-details');
  andThen(() => {
    assert.equal(currentURL(), '/admin/flags/topics/280');
  });
});
