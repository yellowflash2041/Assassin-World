(function($) {
  $.fn.applyLocalDates = function(repeat) {
    const processElement = ($element, options = {}) => {
      if (this.timeout) clearTimeout(this.timeout);

      repeat = repeat || true;
      const utc = moment().utc();
      const dateTime = options.time
        ? `${options.date} ${options.time}`
        : options.date;
      let utcDateTime;

      let displayedTimezone;
      if (options.time) {
        displayedTimezone = options.displayedTimezone || moment.tz.guess();
      } else {
        displayedTimezone =
          options.displayedTimezone || options.timezone || moment.tz.guess();
      }

      // if timezone given we convert date and time from given zone to Etc/UTC
      if (options.timezone) {
        utcDateTime = _applyZoneToDateTime(dateTime, options.timezone);
      } else {
        utcDateTime = moment.utc(dateTime);
      }

      if (utcDateTime < utc) {
        // if event is in the past we want to bump it no next occurrence when
        // recurring is set
        if (options.recurring) {
          utcDateTime = _applyRecurrence(utcDateTime, options.recurring);
        } else {
          $element.addClass("past");
        }
      }

      // once we have the correct UTC date we want
      // we adjust it to watching user timezone
      const adjustedDateTime = utcDateTime.tz(displayedTimezone);

      const previews = _generatePreviews(
        adjustedDateTime.clone(),
        displayedTimezone,
        options
      );
      const textPreview = _generateTextPreview(previews);
      const htmlPreview = _generateHtmlPreview(previews);

      const formatedDateTime = _applyFormatting(
        adjustedDateTime,
        displayedTimezone,
        options
      );

      const $dateTemplate = `
        <span>
          <i class="fa fa-globe d-icon d-icon-globe"></i>
          <span class="relative-time"></span>
        </span>
      `;

      $element
        .html($dateTemplate)
        .attr("title", textPreview)
        .attr("data-html-tooltip", `<div class="previews">${htmlPreview}</div>`)
        .addClass("cooked-date")
        .find(".relative-time")
        .text(formatedDateTime);

      if (repeat) {
        this.timeout = setTimeout(
          () => processElement($element, options),
          10000
        );
      }
    };

    const _formatTimezone = timezone =>
      timezone
        .replace("_", " ")
        .replace("Etc/", "")
        .split("/");

    const _applyZoneToDateTime = (dateTime, timezone) => {
      return moment.tz(dateTime, timezone).utc();
    };

    const _calendarFormats = time => {
      const _translate = key => {
        const translated = I18n.t(
          `discourse_local_dates.relative_dates.${key}`,
          {
            time: "LT"
          }
        );

        if (time) {
          return translated
            .split("LT")
            .map(w => `[${w}]`)
            .join("LT");
        } else {
          return `[${translated.replace(" LT", "")}]`;
        }
      };

      return {
        sameDay: _translate("today"),
        nextDay: _translate("tomorrow"),
        lastDay: _translate("yesterday"),
        sameElse: "L"
      };
    };

    const _applyFormatting = (dateTime, displayedTimezone, options) => {
      const sameTimezone = displayedTimezone === moment.tz.guess();
      const inCalendarRange = dateTime.isBetween(
        moment().subtract(2, "days"),
        moment().add(2, "days")
      );

      if (options.calendar && inCalendarRange) {
        if (sameTimezone) {
          if (options.time) {
            dateTime = dateTime.calendar(null, _calendarFormats(options.time));
          } else {
            dateTime = dateTime.calendar(null, _calendarFormats(null));
          }
        } else {
          dateTime = dateTime.format(options.format);
          dateTime = dateTime.replace("TZ", "");
          dateTime = `${dateTime} (${_formatTimezone(displayedTimezone).join(
            ": "
          )})`;
        }
      } else {
        if (options.time) {
          dateTime = dateTime.format(options.format);

          if (options.displayedTimezone && !sameTimezone) {
            dateTime = dateTime.replace("TZ", "");
            dateTime = `${dateTime} (${_formatTimezone(displayedTimezone).join(
              ": "
            )})`;
          } else {
            dateTime = dateTime.replace(
              "TZ",
              _formatTimezone(displayedTimezone).join(": ")
            );
          }
        } else {
          dateTime = dateTime.format(options.format);

          if (!sameTimezone) {
            dateTime = dateTime.replace("TZ", "");
            dateTime = `${dateTime} (${_formatTimezone(displayedTimezone).join(
              ": "
            )})`;
          } else {
            dateTime = dateTime.replace(
              "TZ",
              _formatTimezone(displayedTimezone).join(": ")
            );
          }
        }
      }

      return dateTime;
    };

    const _applyRecurrence = (dateTime, recurring) => {
      const parts = recurring.split(".");
      const count = parseInt(parts[0], 10);
      const type = parts[1];
      const diff = moment().diff(dateTime, type);
      const add = Math.ceil(diff + count);

      return dateTime.add(add, type);
    };

    const createDateTimeRange = (dateTime, timezone) => {
      const startRange = dateTime.tz(timezone).format("LLL");
      const separator = "→";
      const endRange = dateTime
        .add(24, "hours")
        .tz(timezone)
        .format("LLL");

      return `${startRange} ${separator} ${endRange}`;
    };

    const _generatePreviews = (dateTime, displayedTimezone, options) => {
      const previewedTimezones = [];
      const watchingUserTimezone = moment.tz.guess();

      if (displayedTimezone !== watchingUserTimezone) {
        previewedTimezones.push({
          timezone: watchingUserTimezone,
          current: true,
          dateTime: options.time
            ? dateTime.tz(watchingUserTimezone).format("LLL")
            : createDateTimeRange(dateTime, watchingUserTimezone)
        });
      }

      options.timezones
        .filter(x => x !== watchingUserTimezone)
        .forEach(timezone => {
          previewedTimezones.push({
            timezone,
            dateTime: options.time
              ? dateTime.tz(timezone).format("LLL")
              : createDateTimeRange(dateTime, timezone)
          });
        });

      return previewedTimezones;
    };

    const _generateTextPreview = previews => {
      return previews
        .map(preview => {
          const timezoneParts = _formatTimezone(preview.timezone);

          if (preview.dateTime.match(/TZ/)) {
            return preview.dateTime.replace(/TZ/, timezoneParts.join(": "));
          } else {
            let output = timezoneParts[0];
            if (timezoneParts[1]) output += ` (${timezoneParts[1]})`;
            return (output += ` ${preview.dateTime}`);
          }
        })
        .join(", ");
    };

    const _generateHtmlPreview = previews => {
      const $htmlTooltip = $("<div></div>");

      const $previewTemplate = $(`
        <div class='preview'>
          <span class='timezone'></span>
          <span class='date-time'></span>
        </div>
      `);

      previews.forEach(preview => {
        const $template = $previewTemplate.clone();

        if (preview.current) $template.addClass("current");

        $template
          .find(".timezone")
          .text(_formatTimezone(preview.timezone).join(": "));
        $template.find(".date-time").text(preview.dateTime);
        $htmlTooltip.append($template);
      });

      return $htmlTooltip.html();
    };

    return this.each(function() {
      const $element = $(this);

      const options = {};
      options.time = $element.attr("data-time");
      options.date = $element.attr("data-date");
      options.recurring = $element.attr("data-recurring");
      options.timezones = (
        $element.attr("data-timezones") ||
        Discourse.SiteSettings.discourse_local_dates_default_timezones ||
        "Etc/UTC"
      ).split("|");
      options.timezone = $element.attr("data-timezone");
      options.calendar = ($element.attr("data-calendar") || "on") === "on";
      options.displayedTimezone = $element.attr("data-displayed-timezone");
      options.format =
        $element.attr("data-format") || (options.time ? "LLL" : "LL");

      processElement($element, options);
    });
  };
})(jQuery);
