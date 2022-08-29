import Service from "@ember/service";
import A11yDialog from "a11y-dialog";
import { bind } from "discourse-common/utils/decorators";

export default Service.extend({
  message: null,
  type: null,
  dialogInstance: null,

  title: null,
  titleElementId: null,

  confirmButtonIcon: null,
  confirmButtonLabel: null,
  cancelButtonLabel: null,
  shouldDisplayCancel: null,

  didConfirm: null,
  didCancel: null,
  buttons: null,
  class: null,
  _confirming: false,

  dialog(params) {
    const {
      message,
      type,
      title,

      confirmButtonIcon,
      confirmButtonLabel = "ok_value",
      cancelButtonLabel = "cancel_value",
      shouldDisplayCancel,

      didConfirm,
      didCancel,
      buttons,
    } = params;

    const element = document.getElementById("dialog-holder");

    this.setProperties({
      message,
      type,
      dialogInstance: new A11yDialog(element),

      title,
      titleElementId: title !== null ? "dialog-title" : null,

      confirmButtonLabel,
      confirmButtonIcon,
      cancelButtonLabel,
      shouldDisplayCancel,

      didConfirm,
      didCancel,
      buttons,
      class: params.class,
    });

    this.dialogInstance.show();

    this.dialogInstance.on("hide", () => {
      if (!this._confirming && this.didCancel) {
        this.didCancel();
      }

      this.reset();
    });
  },

  alert(params) {
    // support string param for easier porting of bootbox.alert
    if (typeof params === "string") {
      return this.dialog({
        message: params,
        type: "alert",
      });
    }

    return this.dialog({
      ...params,
      type: "alert",
    });
  },

  confirm(params) {
    return this.dialog({
      ...params,
      shouldDisplayCancel: true,
      buttons: null,
      type: "confirm",
    });
  },

  notice(message) {
    return this.dialog({
      message,
      type: "notice",
    });
  },

  yesNoConfirm(params) {
    return this.confirm({
      ...params,
      confirmButtonLabel: "yes_value",
      cancelButtonLabel: "no_value",
    });
  },

  reset() {
    this.setProperties({
      message: null,
      type: null,
      dialogInstance: null,

      title: null,
      titleElementId: null,

      confirmButtonLabel: null,
      confirmButtonIcon: null,
      cancelButtonLabel: null,
      shouldDisplayCancel: null,

      didConfirm: null,
      didCancel: null,
      buttons: null,
      class: null,

      _confirming: false,
    });
  },

  willDestroy() {
    this.dialogInstance?.destroy();
    this.reset();
  },

  @bind
  didConfirmWrapped() {
    if (this.didConfirm) {
      this.didConfirm();
    }
    this._confirming = true;
    this.dialogInstance.hide();
  },

  @bind
  cancel() {
    this.dialogInstance.hide();
  },
});
