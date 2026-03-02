const Utils = {
  calculateLeaveDays: function (start, resumption) {
    if (!start || !resumption) return 0;
    let d = new Date(start + "T00:00:00");
    let end = new Date(resumption + "T00:00:00");
    let count = 0;
    while (d < end) {
      if (d.getDay() !== 0 && d.getDay() !== 6) count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  },
  formatDaysText: function (days) {
    return days > 0 ? `${days} Working Day${days > 1 ? "s" : ""}` : "";
  },
};
