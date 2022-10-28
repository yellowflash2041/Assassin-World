import I18n from "I18n";
import { getOwner } from "discourse-common/lib/get-owner";

export function extractError(error, defaultMessage) {
  if (error instanceof Error) {
    // eslint-disable-next-line no-console
    console.error(error.stack);
  }

  if (typeof error === "string") {
    // eslint-disable-next-line no-console
    console.error(error);
  }

  if (error.jqXHR) {
    error = error.jqXHR;
  }

  let parsedError, parsedJSON;

  if (error.responseJSON) {
    parsedJSON = error.responseJSON;
  }

  if (!parsedJSON && error.responseText) {
    try {
      parsedJSON = $.parseJSON(error.responseText);
    } catch (ex) {
      // in case the JSON doesn't parse
      // eslint-disable-next-line no-console
      console.error(ex.stack);
    }
  }

  if (parsedJSON) {
    if (parsedJSON.errors?.length > 1) {
      parsedError = I18n.t("multiple_errors", {
        errors: parsedJSON.errors.map((e, i) => `${i + 1}) ${e}`).join(" "),
      });
    } else if (parsedJSON.errors?.length > 0) {
      parsedError = I18n.t("generic_error_with_reason", {
        error: parsedJSON.errors[0],
      });
    } else if (parsedJSON.error) {
      parsedError = parsedJSON.error;
    } else if (parsedJSON.message) {
      parsedError = parsedJSON.message;
    } else if (parsedJSON.failed) {
      parsedError = parsedJSON.failed;
    }
  }

  if (!parsedError) {
    if (error.status && error.status >= 400) {
      parsedError = error.status + " " + error.statusText;
    }
  }

  return parsedError || defaultMessage || I18n.t("generic_error");
}

export function throwAjaxError(undoCallback) {
  return function (error) {
    // If we provided an `undo` callback
    if (undoCallback) {
      undoCallback(error);
    }
    throw extractError(error);
  };
}

export function popupAjaxError(error) {
  const dialog = getOwner(this).lookup("service:dialog");
  dialog.alert(extractError(error));
}
