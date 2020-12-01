import { module, test } from "qunit";
import PreloadStore from "discourse/lib/preload-store";
import { Promise } from "rsvp";

module("Unit | Utility | preload-store", function (hooks) {
  hooks.beforeEach(function () {
    PreloadStore.store("bane", "evil");
  });

  test("get", function (assert) {
    assert.blank(PreloadStore.get("joker"), "returns blank for a missing key");
    assert.equal(
      PreloadStore.get("bane"),
      "evil",
      "returns the value for that key"
    );
  });

  test("remove", function (assert) {
    PreloadStore.remove("bane");
    assert.blank(
      PreloadStore.get("bane"),
      "removes the value if the key exists"
    );
  });

  test("getAndRemove returns a promise that resolves to null", async function (assert) {
    assert.blank(await PreloadStore.getAndRemove("joker"));
  });

  test("getAndRemove returns a promise that resolves to the result of the finder", async function (assert) {
    const finder = () => "batdance";
    const result = await PreloadStore.getAndRemove("joker", finder);

    assert.equal(result, "batdance");
  });

  test("getAndRemove returns a promise that resolves to the result of the finder's promise", async function (assert) {
    const finder = () => Promise.resolve("hahahah");
    const result = await PreloadStore.getAndRemove("joker", finder);

    assert.equal(result, "hahahah");
  });

  test("returns a promise that rejects with the result of the finder's rejected promise", async function (assert) {
    const finder = () => Promise.reject("error");

    await PreloadStore.getAndRemove("joker", finder).catch((result) => {
      assert.equal(result, "error");
    });
  });

  test("returns a promise that resolves to 'evil'", async function (assert) {
    const result = await PreloadStore.getAndRemove("bane");
    assert.equal(result, "evil");
  });
});
