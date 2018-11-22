(function($) {
  $.fn.applyLocalDates = function(repeat) {
    function _formatTimezone(timezone) {
      return timezone.replace("_", " ").split("/");
    }

    function processElement($element, options) {
      repeat = repeat || true;

      if (this.timeout) {
        clearTimeout(this.timeout);
      }

      var relativeTime;

      var dateAndTime = options.date;
      if (options.time) {
        dateAndTime = dateAndTime + " " + options.time;
      }

      if (options.timezone) {
        relativeTime = moment.tz(dateAndTime, options.timezone).utc();
      } else {
        relativeTime = moment.utc(dateAndTime);
      }

      if (relativeTime < moment().utc()) {
        if (options.recurring) {
          var parts = options.recurring.split(".");
          var count = parseInt(parts[0], 10);
          var type = parts[1];
          var diff = moment().diff(relativeTime, type);
          var add = Math.ceil(diff + count);

          relativeTime = relativeTime.add(add, type);
        } else {
          $element.addClass("past");
        }
      }

      var previews = options.timezones.split("|").map(function(timezone) {
        var dateTime = relativeTime.tz(timezone).format(options.format);

        var timezoneParts = _formatTimezone(timezone);

        if (dateTime.match(/TZ/)) {
          return dateTime.replace("TZ", timezoneParts.join(": "));
        } else {
          var output = timezoneParts[0];
          if (timezoneParts[1]) {
            output += " (" + timezoneParts[1] + ")";
          }
          output += " " + dateTime;
          return output;
        }
      });

      var relativeTime = relativeTime.tz(options.displayedZone);

      var d = function(key) {
        var translated = I18n.t("discourse_local_dates.relative_dates." + key, {
          time: "LT"
        });

        if (options.time) {
          return translated
            .split("LT")
            .map(function(w) {
              return "[" + w + "]";
            })
            .join("LT");
        } else {
          return "[" + translated.replace(" LT", "") + "]";
        }
      };

      var relativeFormat = {
        sameDay: d("today"),
        nextDay: d("tomorrow"),
        lastDay: d("yesterday"),
        sameElse: "L"
      };

      if (
        options.calendar &&
        relativeTime.isBetween(
          moment().subtract(1, "day"),
          moment().add(2, "day")
        )
      ) {
        relativeTime = relativeTime.calendar(null, relativeFormat);
      } else {
        relativeTime = relativeTime.format(options.format);
      }

      var html = "<span>";
      html += "<i class='fa fa-globe d-icon d-icon-globe'></i>";
      html += "<span class='relative-time'></span>";
      html += "</span>";

      var joinedPreviews = previews.join("\n");

      var displayedTime = relativeTime.replace(
        "TZ",
        _formatTimezone(options.displayedZone).join(": ")
      );

      $element
        .html(html)
        .attr("title", joinedPreviews)
        .attr("data-tooltip", joinedPreviews)
        .addClass("cooked-date")
        .find(".relative-time")
        .text(displayedTime);

      if (repeat) {
        this.timeout = setTimeout(function() {
          processElement($element, options);
        }, 10000);
      }
    }

    return this.each(function() {
      var $this = $(this);

      var options = {};
      options.time = $this.attr("data-time");
      options.format =
        $this.attr("data-format") || (options.time ? "LLL" : "LL");
      options.date = $this.attr("data-date");
      options.recurring = $this.attr("data-recurring");
      options.timezones = $this.attr("data-timezones") || "Etc/UTC";
      options.timezone = $this.attr("data-timezone");
      options.calendar = ($this.attr("data-calendar") || "on") === "on";
      options.displayedZone =
        $this.attr("data-displayed-zone") || moment.tz.guess();

      processElement($this, options);
    });
  };
})(jQuery);
