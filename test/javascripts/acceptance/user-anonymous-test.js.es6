import { acceptance } from "helpers/qunit-helpers";
acceptance("User Anonymous");

export function hasStream() {
  andThen(() => {
    ok(exists('.user-main .about'), 'it has the about section');
    ok(count('.user-stream .item') > 0, 'it has stream items');
  });
}

// function hasTopicList() {
//   andThen(() => {
//     equal(count('.user-stream .item'), 0, "has no stream displayed");
//     ok(count('.topic-list tr') > 0, 'it has a topic list');
//   });
// }

// test("Filters", () => {
//   visit("/users/eviltrout");
//   hasStream();
//
//   visit("/users/eviltrout/activity/topics");
//   hasTopicList();
//
//   visit("/users/eviltrout/activity/posts");
//   hasStream();
//
// });
//
// test("Restricted Routes", () => {
//   visit("/users/eviltrout/preferences");
//
//   andThen(() => {
//     equal(currentURL(), '/users/eviltrout/activity', "it redirects from preferences");
//   });
// });
