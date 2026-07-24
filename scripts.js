// Put everything inside its own function, then run it right away.
// This keeps these variables from getting mixed up with other scripts.
(() => {
  // Make JavaScript point out more possible mistakes.
  "use strict";
  // The five workdays this calculator tracks.
  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  // A helper for getting the current date and time.
  const now = () => new Date();
  // Find the Monday belonging to any date.
  const monday = (date) => {
    // Copy the date so the original is not changed.
    const result = new Date(date);
    // JavaScript numbers Sunday as 0 through Saturday as 6.
    const day = result.getDay();
    // Move backward to Monday (Sunday must move back six days).
    result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
    // Set the time to midnight so only the date matters.
    result.setHours(0, 0, 0, 0);
    return result;
  };
  // Find the Monday at the beginning of this week.
  const weekStart = monday(now());
  // Give this week its own save name based on its date.
  const weekKey = `fieldWeek:${weekStart.getFullYear()}-${weekStart.getMonth() + 1}-${weekStart.getDate()}`;
  // Save settings separately so they carry into later weeks.
  const settingsKey = "fieldWeek:settings";
  // Make a fresh blank entry for one day.
  const emptyDay = () => ({ start: "", end: "", dayOff: false });
  // Load this week and the settings saved in this browser.
  const savedWeek = read(weekKey, {});
  const savedSettings = read(settingsKey, {});
  // This holds all information the page is currently using.
  const state = {
    // Use the saved minimum, an older saved value, or seven hours.
    minimum: Number.isFinite(Number(savedSettings.minimum))
      ? Number(savedSettings.minimum)
      : Number(savedWeek.minimum) || 7,
    // Build one time entry for every weekday.
    times: Object.fromEntries(
      DAYS.map((day) => {
        // Get this day's saved entry, if one exists.
        const saved = savedWeek.times?.[day] || {};
        return [
          day,
          {
            // Start blank, then put saved values over the blanks.
            ...emptyDay(),
            ...saved,
            // This also understands older names for a day off.
            dayOff:
              saved.dayOff ??
              ["off", "holiday", "vacation", "sick"].includes(saved.type),
          },
        ];
      }),
    ),
  };
  // A shorter way to find an item on the page.
  const $ = (selector) => document.querySelector(selector);
  // Read something saved in this browser.
  function read(key, fallback) {
    try {
      // Turn saved text back into usable information.
      return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch {
      // If the save is missing or broken, use the backup.
      return fallback;
    }
  }
  // Find today's position in the weekday list.
  function todayIndex() {
    const day = now().getDay();
    // Monday is 0 through Friday at 4; weekends use -1.
    return day > 0 && day < 6 ? day - 1 : -1;
  }
  // Find the calendar date for a weekday row.
  function dayDate(index) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    return date;
  }
  // Change a time like 08:30 into minutes after midnight.
  function toMinutes(value) {
    // A blank time has no useful number.
    if (!value) return null;
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  }
  // Calculate the minutes worked for one day.
  function worked(entry, live = false) {
    const start = toMinutes(entry.start);
    let end = toMinutes(entry.end);
    // No start or a day off means no worked time.
    if (start === null || entry.dayOff) return 0;
    // For today, use now when the end time is blank.
    if (end === null && live) {
      const current = now();
      end = current.getHours() * 60 + current.getMinutes();
    }
    // Ignore unfinished entries and backwards times.
    if (end === null || end < start) return 0;
    return end - start;
  }
  // Turn minutes into friendly text such as 7h 05m.
  function duration(value) {
    const minutes = Math.max(0, Math.round(value));
    return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
  }
  // Turn minutes after midnight into a regular clock time.
  function clock(value) {
    const minutes = Math.max(0, Math.round(value));
    return new Date(
      2000,
      0,
      1,
      Math.floor(minutes / 60),
      minutes % 60,
    ).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  // Get now in the format required by a time input.
  function currentTimeValue() {
    const current = now();
    return `${String(current.getHours()).padStart(2, "0")}:${String(current.getMinutes()).padStart(2, "0")}`;
  }
  // Find the required minutes for one day.
  function targetFor(entry) {
    return entry.dayOff ? 0 : state.minimum * 60;
  }
  // Save the current information in this browser.
  function save() {
    localStorage.setItem(
      settingsKey,
      JSON.stringify({ minimum: state.minimum }),
    );
    localStorage.setItem(weekKey, JSON.stringify({ times: state.times }));
    // Briefly confirm that the change was saved.
    $("#saved").textContent = "Saved just now";
    clearTimeout(save.timer);
    save.timer = setTimeout(
      () => ($("#saved").textContent = "Saved on this device"),
      1200,
    );
  }
  // Check whether a day needs a warning.
  function issueFor(entry, index, today) {
    if (entry.dayOff) return "";
    if (index < today && (!entry.start || !entry.end)) return "Missing time";
    if (
      entry.start &&
      entry.end &&
      toMinutes(entry.end) < toMinutes(entry.start)
    )
      return "Check times";
    return "";
  }
  // Redraw everything visible using the newest information.
  function render() {
    const today = todayIndex();
    // Calculate each day; today can keep counting live.
    const values = DAYS.map((day, index) =>
      worked(state.times[day], index === today),
    );
    // Update the five weekday rows one at a time.
    DAYS.forEach((day, index) => {
      const entry = state.times[day];
      const row = $(`[data-row-day="${day}"]`);
      const isToday = index === today;
      const value = values[index];
      const issue = issueFor(entry, index, today);
      // Give today its special styling.
      row.classList.toggle("today", isToday);
      row.querySelector(".day i").hidden = !isToday;
      row.querySelector("[data-date]").textContent =
        dayDate(index).toLocaleDateString([], {
          month: "short",
          day: "numeric",
        }) + (isToday ? " - Today" : "");
      // Show or hide this row's warning.
      const issueElement = row.querySelector("[data-issue]");
      issueElement.textContent = issue;
      issueElement.hidden = !issue;
      // Make the form boxes match the stored information.
      row.querySelector("[data-field=dayOff]").checked = entry.dayOff;
      row.querySelector("[data-field=start]").value = entry.start;
      row.querySelector("[data-field=end]").value = entry.end;
      // Only show Now buttons on today when it is a workday.
      row.querySelectorAll(".now-button").forEach((button) => {
        button.hidden = !isToday || entry.dayOff;
      });
      // Show this day's total, or dashes if it has none.
      const total = row.querySelector("[data-total]");
      total.textContent = value ? duration(value) : "--";
      total.classList.toggle("empty", !value);
    });
    // Update the averages after the weekday rows.
    renderAverage();
    // Add every day together for the weekly total.
    const weekTotal = values.reduce((sum, value) => sum + value, 0);
    const todayTotal = today >= 0 ? values[today] : 0;
    $("#todayTotal").textContent = duration(todayTotal);
    $("#weekTotal").textContent = duration(weekTotal);
    // Find today's entry, or nothing on a weekend.
    const todayEntry = today >= 0 ? state.times[DAYS[today]] : null;
    // Choose the note that matches today's situation.
    $("#todayNote").textContent =
      today < 0
        ? "The workweek resumes Monday"
        : todayEntry.dayOff
          ? "Day off"
          : !todayEntry.start
            ? "Add today's start time"
            : !todayEntry.end
              ? "Live since your first visit"
              : "Today is complete";
    // Decide what the needed-until section should show.
    if (today < 0) showNeeded("--", "Available Monday through Friday");
    else if (targetFor(todayEntry) === 0) showNeeded("Not needed", "Day off");
    else if (!todayEntry.start) showNeeded("--", "Enter today's start time");
    else {
      // Add required time from Monday through today.
      const targetSoFar = DAYS.slice(0, today + 1).reduce(
        (sum, day) => sum + targetFor(state.times[day]),
        0,
      );
      // Add the time actually worked before today.
      const priorWorked = values
        .slice(0, today)
        .reduce((sum, value) => sum + value, 0);
      // Today makes up any difference between the two.
      const neededToday = Math.max(0, targetSoFar - priorWorked);
      showNeeded(
        neededToday === 0
          ? "Target met"
          : clock(toMinutes(todayEntry.start) + neededToday),
        neededToday === 0
          ? "Week-to-date minimum reached"
          : `${duration(neededToday)} needed today`,
      );
    }
    // Update the live date and clock.
    $("#clock").textContent = now().toLocaleString([], {
      weekday: "long",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
  // Update the answer and its smaller explanation.
  function showNeeded(value, note) {
    $("#needed").textContent = value;
    $("#neededNote").textContent = note;
  }
  // Average only valid, fully completed workdays.
  function renderAverage() {
    const completed = DAYS.map((day) => state.times[day]).filter(
      (entry) =>
        !entry.dayOff &&
        entry.start &&
        entry.end &&
        toMinutes(entry.end) >= toMinutes(entry.start),
    );
    const row = $("#averageRow");
    // Hide the average row when nothing can be averaged.
    row.hidden = !completed.length;
    if (!completed.length) return;
    // Average either the start or end times.
    const avg = (field) =>
      completed.reduce((sum, entry) => sum + toMinutes(entry[field]), 0) /
      completed.length;
    const total =
      completed.reduce((sum, entry) => sum + worked(entry), 0) /
      completed.length;
    $("#averageNote").textContent =
      `${completed.length} completed day${completed.length === 1 ? "" : "s"}`;
    $("#averageStart").textContent = clock(avg("start"));
    $("#averageEnd").textContent = clock(avg("end"));
    $("#averageTotal").textContent = duration(total);
  }
  // Friday is four days after Monday.
  const weekEnd = dayDate(4);
  // Show this workweek's calendar range.
  $("#weekRange").textContent =
    weekStart.toLocaleDateString([], { month: "long", day: "numeric" }) +
    " - " +
    weekEnd.toLocaleDateString([], {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  // Put the saved minimum in its input box.
  $("#minimum").value = state.minimum;
  // Recalculate whenever the minimum changes.
  $("#minimum").addEventListener("input", (event) => {
    state.minimum = Math.max(0, Number(event.target.value) || 0);
    save();
    // Draw the page once as soon as the script loads.
    render();
  });
  // Listen for changes in any weekday input.
  $("#rows").addEventListener("input", (event) => {
    const input = event.target;
    if (!input.dataset.day) return;
    state.times[input.dataset.day][input.dataset.field] =
      input.type === "checkbox" ? input.checked : input.value;
    save();
    render();
  });
  // Listen for clicks on any Now button.
  $("#rows").addEventListener("click", (event) => {
    const button = event.target.closest("[data-now-day]");
    if (!button) return;
    state.times[button.dataset.nowDay][button.dataset.nowField] =
      currentTimeValue();
    save();
    render();
  });
  render();
  // Refresh live totals and the clock every 30 seconds.
  setInterval(() => {
    // Do not refresh while somebody is typing.
    if (!document.activeElement?.matches("input, select")) render();
  }, 30000);
})();
