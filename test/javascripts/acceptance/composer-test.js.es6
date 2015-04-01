import { acceptance } from "helpers/qunit-helpers";

acceptance("Composer", { loggedIn: true });

test("Tests the Composer controls", () => {
  visit("/");
  andThen(() => {
    ok(exists('#create-topic'), 'the create button is visible');
  });

  click('#create-topic');
  andThen(() => {
    ok(exists('#wmd-input'), 'the composer input is visible');
    ok(exists('.title-input .popup-tip.bad.hide'), 'title errors are hidden by default');
    ok(exists('.textarea-wrapper .popup-tip.bad.hide'), 'body errors are hidden by default');
  });

  click('a.toggle-preview');
  andThen(() => {
    ok(!exists('#wmd-preview:visible'), "clicking the toggle hides the preview");
  });

  click('a.toggle-preview');
  andThen(() => {
    ok(exists('#wmd-preview:visible'), "clicking the toggle shows the preview again");
  });

  click('#reply-control button.create');
  andThen(() => {
    ok(!exists('.title-input .popup-tip.bad.hide'), 'it shows the empty title error');
    ok(!exists('.textarea-wrapper .popup-tip.bad.hide'), 'it shows the empty body error');
  });

  fillIn('#reply-title', "this is my new topic title");
  andThen(() => {
    ok(exists('.title-input .popup-tip.good'), 'the title is now good');
  });

  fillIn('#wmd-input', "this is the *content* of a post");
  andThen(() => {
    equal(find('#wmd-preview').html(), "<p>this is the <em>content</em> of a post</p>", "it previews content");
    ok(exists('.textarea-wrapper .popup-tip.good'), 'the body is now good');
  });

  click('#reply-control a.cancel');
  andThen(() => {
    ok(exists('.bootbox.modal'), 'it pops up a confirmation dialog');
  });

  click('.modal-footer a:eq(1)');
  andThen(() => {
    ok(!exists('.bootbox.modal'), 'the confirmation can be cancelled');
  });

});

test("Create a topic with server side errors", () => {
  visit("/");
  click('#create-topic');
  fillIn('#reply-title', "this title triggers an error");
  fillIn('#wmd-input', "this is the *content* of a post");
  click('#reply-control button.create');
  andThen(() => {
    ok(exists('.bootbox.modal'), 'it pops up an error message');
  });
  click('.bootbox.modal a.btn-primary');
  andThen(() => {
    ok(!exists('.bootbox.modal'), 'it dismisses the error');
    ok(exists('#wmd-input'), 'the composer input is visible');
  });
});

test("Create a Topic", () => {
  visit("/");
  click('#create-topic');
  fillIn('#reply-title', "Internationalization Localization");
  fillIn('#wmd-input', "this is the *content* of a new topic post");
  click('#reply-control button.create');
  andThen(() => {
    equal(currentURL(), "/t/internationalization-localization/280", "it transitions to the newly created topic URL");
  });
});

test("Create a Reply", () => {
  visit("/t/internationalization-localization/280");

  click('#topic-footer-buttons .btn.create');
  andThen(() => {
    ok(exists('#wmd-input'), 'the composer input is visible');
    ok(!exists('#reply-title'), 'there is no title since this is a reply');
  });

  fillIn('#wmd-input', 'this is the content of my reply');
  click('#reply-control button.create');
  andThen(() => {
    exists('#post_12345', 'it inserts the post into the document');
  });
});

test("Edit the first post", () => {
  visit("/t/internationalization-localization/280");

  click('.topic-post:eq(0) button[data-action=showMoreActions]');
  click('.topic-post:eq(0) button[data-action=edit]');
  andThen(() => {
    equal(find('#wmd-input').val().indexOf('Any plans to support'), 0, 'it populates the input with the post text');
  });

  fillIn('#wmd-input', "This is the new text for the post");
  fillIn('#reply-title', "This is the new text for the title");
  click('#reply-control button.create');
  andThen(() => {
    ok(!exists('#wmd-input'), 'it closes the composer');
    ok(find('#topic-title h1').text().indexOf('This is the new text for the title') !== -1, 'it shows the new title');
    ok(find('.topic-post:eq(0) .cooked').text().indexOf('This is the new text for the post') !== -1, 'it updates the post');
  });
});
