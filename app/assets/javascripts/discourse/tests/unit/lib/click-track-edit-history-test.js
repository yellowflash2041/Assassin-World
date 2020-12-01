import { fixture, logIn } from "discourse/tests/helpers/qunit-helpers";
import { module, skip } from "qunit";
import ClickTrack from "discourse/lib/click-track";
import DiscourseURL from "discourse/lib/url";
import User from "discourse/models/user";
import pretender from "discourse/tests/helpers/create-pretender";
import sinon from "sinon";

const track = ClickTrack.trackClick;

function generateClickEventOn(selector) {
  return $.Event("click", { currentTarget: fixture(selector).first() });
}

module("Unit | Utility | click-track-edit-history", function (hooks) {
  hooks.beforeEach(function () {
    logIn();

    let win = { focus: function () {} };
    sinon.stub(window, "open").returns(win);
    sinon.stub(win, "focus");

    sinon.stub(DiscourseURL, "routeTo");
    sinon.stub(DiscourseURL, "redirectTo");

    sessionStorage.clear();

    fixture().html(
      `<div id="topic" data-topic-id="1337">
       </div>
       <div id="revisions" data-post-id="42" class="">
         <div class="row">
           <div>
             <a href="http://www.google.com">google.com</a>
             <a class="lightbox back" href="http://www.google.com">google.com</a>
             <div class="onebox-result">
               <a id="inside-onebox" href="http://www.google.com">google.com<span class="badge">1</span></a>
               <a id="inside-onebox-forced" class="track-link" href="http://www.google.com">google.com<span class="badge">1</span></a>
             </div>
             <a class="no-track-link" href="http://www.google.com">google.com</a>
             <a id="same-site" href="http://discuss.domain.com">forum</a>
             <a class="attachment" href="http://discuss.domain.com/uploads/default/1234/1532357280.txt">log.txt</a>
             <a class="hashtag" href="http://discuss.domain.com">#hashtag</a>
           </div>
           <div>
             <a href="http://www.google.com">google.com</a>
             <a class="lightbox back" href="http://www.google.com">google.com</a>
             <div class="onebox-result">
               <a id="inside-onebox" href="http://www.google.com">google.com<span class="badge">1</span></a>
               <a id="inside-onebox-forced" class="track-link" href="http://www.google.com">google.com<span class="badge">1</span></a>
             </div>
             <a class="no-track-link" href="http://www.google.com">google.com</a>
             <a id="same-site" href="http://discuss.domain.com">forum</a>
             <a class="attachment" href="http://discuss.domain.com/uploads/default/1234/1532357280.txt">log.txt</a>
             <a class="hashtag" href="http://discuss.domain.com">#hashtag</a>
           </div>
         </div>
       </div>`
    );
  });

  skip("tracks internal URLs", async function (assert) {
    assert.expect(2);
    sinon.stub(DiscourseURL, "origin").returns("http://discuss.domain.com");

    const done = assert.async();
    pretender.post("/clicks/track", (request) => {
      assert.equal(
        request.requestBody,
        "url=http%3A%2F%2Fdiscuss.domain.com&post_id=42&topic_id=1337"
      );
      done();
    });

    assert.notOk(track(generateClickEventOn("#same-site")));
  });

  skip("tracks external URLs", async function (assert) {
    assert.expect(2);

    const done = assert.async();
    pretender.post("/clicks/track", (request) => {
      assert.equal(
        request.requestBody,
        "url=http%3A%2F%2Fwww.google.com&post_id=42&topic_id=1337"
      );
      done();
    });

    assert.notOk(track(generateClickEventOn("a")));
  });

  skip("tracks external URLs when opening in another window", async function (assert) {
    assert.expect(3);
    User.currentProp("external_links_in_new_tab", true);

    const done = assert.async();
    pretender.post("/clicks/track", (request) => {
      assert.equal(
        request.requestBody,
        "url=http%3A%2F%2Fwww.google.com&post_id=42&topic_id=1337"
      );
      done();
    });

    assert.notOk(track(generateClickEventOn("a")));
    assert.ok(window.open.calledWith("http://www.google.com", "_blank"));
  });
});
