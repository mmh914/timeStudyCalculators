(() => {
  "use strict";
  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const now = () => new Date();
  const monday = (date) => {
    const result = new Date(date);
    const day = result.getDay();
    result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
    result.setHours(0, 0, 0, 0);
    return result;
  };
  const weekStart = monday(now());
  const weekKey = `fieldWeek:${weekStart.getFullYear()}-${weekStart.getMonth() + 1}-${weekStart.getDate()}`;
  const settingsKey = "fieldWeek:settings";
  const emptyDay = () => ({ start: "", end: "", dayOff: false });
  const savedWeek = read(weekKey, {});
  const savedSettings = read(settingsKey, {});
  const state = {
    minimum: Number.isFinite(Number(savedSettings.minimum))
      ? Number(savedSettings.minimum)
      : Number(savedWeek.minimum) || 7,
    times: Object.fromEntries(
      DAYS.map((day) => {
        const saved = savedWeek.times?.[day] || {};
        return [
          day,
          {
            ...emptyDay(),
            ...saved,
            dayOff:
              saved.dayOff ??
              ["off", "holiday", "vacation", "sick"].includes(saved.type),
          },
        ];
      }),
    ),
  };
  const $ = (selector) => document.querySelector(selector);
  function read(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch {
      return fallback;
    }
  }
  function todayIndex() {
    const day = now().getDay();
    return day > 0 && day < 6 ? day - 1 : -1;
  }
  function dayDate(index) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    return date;
  }
  function toMinutes(value) {
    if (!value) return null;
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  }
  function worked(entry, live = false) {
    const start = toMinutes(entry.start);
    let end = toMinutes(entry.end);
    if (start === null || entry.dayOff) return 0;
    if (end === null && live) {
      const current = now();
      end = current.getHours() * 60 + current.getMinutes();
    }
    if (end === null || end < start) return 0;
    return end - start;
  }
  function duration(value) {
    const minutes = Math.max(0, Math.round(value));
    return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
  }
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
  function currentTimeValue() {
    const current = now();
    return `${String(current.getHours()).padStart(2, "0")}:${String(current.getMinutes()).padStart(2, "0")}`;
  }
  function targetFor(entry) {
    return entry.dayOff ? 0 : state.minimum * 60;
  }
  function save() {
    localStorage.setItem(
      settingsKey,
      JSON.stringify({ minimum: state.minimum }),
    );
    localStorage.setItem(weekKey, JSON.stringify({ times: state.times }));
    $("#saved").textContent = "Ã¢Å“â€œ Saved just now";
    clearTimeout(save.timer);
    save.timer = setTimeout(
      () => ($("#saved").textContent = "Ã¢Å“â€œ Saved on this device"),
      1200,
    );
  }
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
  function offControl(day, entry) {
    return `<label class="off-control"><input aria-label="${day} is a day off" type="checkbox" data-day="${day}" data-field="dayOff" ${entry.dayOff ? "checked" : ""}><span>Off</span></label>`;
  }
  function timeControl(day, field, value, isToday) {
    return `<div class="time-control ${field}"><input aria-label="${day} ${field === "start" ? "first" : "last"} visit" type="time" data-day="${day}" data-field="${field}" value="${value}">${isToday ? `<button class="now-button" type="button" data-now-day="${day}" data-now-field="${field}">Now</button>` : ""}</div>`;
  }
  function render() {
    const today = todayIndex();
    const values = DAYS.map((day, index) =>
      worked(state.times[day], index === today),
    );
    $("#rows").innerHTML =
      DAYS.map((day, index) => {
        const entry = state.times[day];
        const date = dayDate(index);
        const isToday = index === today;
        const value = values[index];
        const issue = issueFor(entry, index, today);
        return `<div class="row ${isToday ? "today" : ""}"><div class="day">${isToday ? "<i></i>" : ""}${day}<small>${date.toLocaleDateString([], { month: "short", day: "numeric" })}${isToday ? " Â· Today" : ""}</small>${issue ? `<span class="missing">${issue}</span>` : ""}</div>${offControl(day, entry)}${timeControl(day, "start", entry.start, isToday && !entry.dayOff)}${timeControl(day, "end", entry.end, isToday && !entry.dayOff)}<span class="total ${value ? "" : "empty"}">${value ? duration(value) : "â€”"}</span></div>`;
      }).join("") + averageRow();
    const weekTotal = values.reduce((sum, value) => sum + value, 0);
    const todayTotal = today >= 0 ? values[today] : 0;
    $("#todayTotal").textContent = duration(todayTotal);
    $("#weekTotal").textContent = duration(weekTotal);
    const todayEntry = today >= 0 ? state.times[DAYS[today]] : null;
    $("#todayNote").textContent =
      today < 0
        ? "The workweek resumes Monday"
        : todayEntry.dayOff
          ? "Day off"
          : !todayEntry.start
            ? "Add todayâ€™s start time"
            : !todayEntry.end
              ? "Live since your first visit"
              : "Today is complete";
    if (today < 0) showNeeded("â€”", "Available Monday through Friday");
    else if (targetFor(todayEntry) === 0) showNeeded("Not needed", "Day off");
    else if (!todayEntry.start) showNeeded("â€”", "Enter todayâ€™s start time");
    else {
      const targetSoFar = DAYS.slice(0, today + 1).reduce(
        (sum, day) => sum + targetFor(state.times[day]),
        0,
      );
      const priorWorked = values
        .slice(0, today)
        .reduce((sum, value) => sum + value, 0);
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
    $("#clock").textContent = now().toLocaleString([], {
      weekday: "long",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
  function showNeeded(value, note) {
    $("#needed").textContent = value;
    $("#neededNote").textContent = note;
  }
  function averageRow() {
    const completed = DAYS.map((day) => state.times[day]).filter(
      (entry) =>
        !entry.dayOff &&
        entry.start &&
        entry.end &&
        toMinutes(entry.end) >= toMinutes(entry.start),
    );
    if (!completed.length) return "";
    const avg = (field) =>
      completed.reduce((sum, entry) => sum + toMinutes(entry[field]), 0) /
      completed.length;
    const total =
      completed.reduce((sum, entry) => sum + worked(entry), 0) /
      completed.length;
    return `<div class="row average-row"><div class="day">Averages<small>${completed.length} completed day${completed.length === 1 ? "" : "s"}</small></div><span></span><span>${clock(avg("start"))}</span><span>${clock(avg("end"))}</span><span class="total">${duration(total)}</span></div>`;
  }
  const weekEnd = dayDate(4);
  $("#weekRange").textContent =
    weekStart.toLocaleDateString([], { month: "long", day: "numeric" }) +
    " - " +
    weekEnd.toLocaleDateString([], {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  $("#minimum").value = state.minimum;
  $("#minimum").addEventListener("input", (event) => {
    state.minimum = Math.max(0, Number(event.target.value) || 0);
    save();
    render();
  });
  $("#rows").addEventListener("input", (event) => {
    const input = event.target;
    if (!input.dataset.day) return;
    state.times[input.dataset.day][input.dataset.field] =
      input.type === "checkbox" ? input.checked : input.value;
    save();
    render();
  });
  $("#rows").addEventListener("click", (event) => {
    const button = event.target.closest("[data-now-day]");
    if (!button) return;
    state.times[button.dataset.nowDay][button.dataset.nowField] =
      currentTimeValue();
    save();
    render();
  });
  render();
  setInterval(() => {
    if (!document.activeElement?.matches("input, select")) render();
  }, 30000);
})();
