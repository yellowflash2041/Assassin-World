import {
  acceptance,
  count,
  exists,
  queryAll,
} from "discourse/tests/helpers/qunit-helpers";
import {
  click,
  currentURL,
  fillIn,
  triggerKeyEvent,
  visit,
} from "@ember/test-helpers";
import siteSettingFixture from "discourse/tests/fixtures/site-settings";
import { test } from "qunit";

acceptance("Admin - Site Settings", function (needs) {
  let updatedTitle;

  needs.user();
  needs.pretender((server, helper) => {
    server.put("/admin/site_settings/title", (body) => {
      updatedTitle = body.requestBody.split("=")[1];
      return helper.response({ success: "OK" });
    });
    server.get("/admin/site_settings", () => {
      const fixtures = siteSettingFixture["/admin/site_settings"].site_settings;
      const titleSetting = Object.assign({}, fixtures[0]);

      if (updatedTitle) {
        titleSetting.value = updatedTitle;
      }
      const response = {
        site_settings: [titleSetting, ...fixtures.slice(1)],
      };
      return helper.response(response);
    });
  });
  needs.hooks.beforeEach(() => {
    updatedTitle = null;
  });

  test("upload site setting", async function (assert) {
    await visit("/admin/site_settings");

    assert.ok(
      exists(".row.setting.upload .image-uploader"),
      "image uploader is present"
    );

    assert.ok(exists(".row.setting.upload .undo"), "undo button is present");
  });

  test("links to staff action log", async function (assert) {
    await visit("/admin/site_settings");

    assert.equal(
      queryAll(".row.setting .setting-label h3 a").attr("href"),
      "/admin/logs/staff_action_logs?filters=%7B%22subject%22%3A%22title%22%2C%22action_name%22%3A%22change_site_setting%22%7D",
      "it links to the staff action log"
    );
  });

  test("changing value updates dirty state", async function (assert) {
    await visit("/admin/site_settings");
    await fillIn("#setting-filter", " title ");
    assert.equal(count(".row.setting"), 1, "filter returns 1 site setting");
    assert.ok(!exists(".row.setting.overridden"), "setting isn't overriden");

    await fillIn(".input-setting-string", "Test");
    await click("button.cancel");
    assert.ok(
      !exists(".row.setting.overridden"),
      "canceling doesn't mark setting as overriden"
    );

    await fillIn(".input-setting-string", "Test");
    await click("button.ok");
    assert.ok(
      exists(".row.setting.overridden"),
      "saving marks setting as overriden"
    );

    await click("button.undo");
    assert.ok(
      !exists(".row.setting.overridden"),
      "setting isn't marked as overriden after undo"
    );

    await click("button.cancel");
    assert.ok(
      exists(".row.setting.overridden"),
      "setting is marked as overriden after cancel"
    );

    await click("button.undo");
    await click("button.ok");
    assert.ok(
      !exists(".row.setting.overridden"),
      "setting isn't marked as overriden after undo"
    );

    await fillIn(".input-setting-string", "Test");
    await triggerKeyEvent(".input-setting-string", "keydown", 13); // enter
    assert.ok(
      exists(".row.setting.overridden"),
      "saving via Enter key marks setting as overriden"
    );
  });

  test("always shows filtered site settings if a filter is set", async function (assert) {
    await visit("/admin/site_settings");
    await fillIn("#setting-filter", "title");
    assert.equal(count(".row.setting"), 1);

    // navigate away to the "Dashboard" page
    await click(".nav.nav-pills li:nth-child(1) a");
    assert.equal(count(".row.setting"), 0);

    // navigate back to the "Settings" page
    await click(".nav.nav-pills li:nth-child(2) a");
    assert.equal(count(".row.setting"), 1);
  });

  test("filter settings by plugin name", async function (assert) {
    await visit("/admin/site_settings");

    await fillIn("#setting-filter", "plugin:discourse-logo");
    assert.equal(count(".row.setting"), 1);

    // inexistent plugin
    await fillIn("#setting-filter", "plugin:discourse-plugin");
    assert.equal(count(".row.setting"), 0);
  });

  test("category name is preserved", async function (assert) {
    await visit("admin/site_settings/category/basic?filter=menu");
    assert.equal(
      currentURL(),
      "admin/site_settings/category/basic?filter=menu"
    );
  });

  test("shows all_results if current category has none", async function (assert) {
    await visit("admin/site_settings");

    await click(".admin-nav .basic a");
    assert.equal(currentURL(), "/admin/site_settings/category/basic");

    await fillIn("#setting-filter", "menu");
    assert.equal(
      currentURL(),
      "/admin/site_settings/category/basic?filter=menu"
    );

    await fillIn("#setting-filter", "contact");
    assert.equal(
      currentURL(),
      "/admin/site_settings/category/all_results?filter=contact"
    );
  });
});
