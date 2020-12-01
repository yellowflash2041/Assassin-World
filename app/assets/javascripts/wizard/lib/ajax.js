import { Promise } from "rsvp";
import getUrl from "discourse-common/lib/get-url";
import jQuery from "jquery";
import { run } from "@ember/runloop";

let token;

export function getToken() {
  if (!token) {
    token = $('meta[name="csrf-token"]').attr("content");
  }

  return token;
}

export function ajax(args) {
  return new Promise((resolve, reject) => {
    args.headers = { "X-CSRF-Token": getToken() };
    args.success = (data) => run(null, resolve, data);
    args.error = (xhr) => run(null, reject, xhr);
    args.url = getUrl(args.url);
    jQuery.ajax(args);
  });
}
