/**
 * utility.js - PetroData Leave Calculation Utility
 * Handles working days calculation (Mon-Fri only, excludes weekends)
 */

const Utils = {
  /**
   * Calculate working days between two dates
   * @param {string} startDate - Start date (YYYY-MM-DD format)
   * @param {string} endDate - End date (YYYY-MM-DD format)
   * @returns {number} Number of working days (0 if invalid)
   */
  calculateLeaveDays: function (startDate, endDate) {
    console.log(`[UTILS] calculateLeaveDays("${startDate}", "${endDate}")`);

    // Validate inputs
    if (!startDate || !endDate) {
      console.warn("[UTILS] Missing dates");
      return 0;
    }

    try {
      // Parse YYYY-MM-DD format properly as local dates (avoid timezone issues)
      const [startYear, startMonth, startDay] = startDate
        .split("-")
        .map(Number);
      const [endYear, endMonth, endDay] = endDate.split("-").map(Number);

      // Create dates in local time (month is 0-indexed in JavaScript)
      const start = new Date(startYear, startMonth - 1, startDay);
      const end = new Date(endYear, endMonth - 1, endDay);

      // Validate date objects
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        console.error("[UTILS] Invalid date format");
        return 0;
      }

      // Ensure end date is after start date
      if (end <= start) {
        console.warn("[UTILS] End date must be after start date");
        return 0;
      }

      let workingDays = 0;
      const currentDate = new Date(start);

      // Loop through each day
      while (currentDate < end) {
        const dayOfWeek = currentDate.getDay();

        // 0 = Sunday, 6 = Saturday (skip these)
        // 1 = Monday, 2 = Tuesday, ... 5 = Friday (count these)
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          workingDays++;
          console.log(
            `[UTILS] Day ${currentDate.toISOString().split("T")[0]} is working day #${workingDays}`,
          );
        }

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }

      console.log(
        `[UTILS] Total working days: ${workingDays} (from ${startDate} to ${endDate})`,
      );
      return workingDays;
    } catch (error) {
      console.error("[UTILS] Calculation error:", error);
      return 0;
    }
  },

  /**
   * Format working days for display
   * @param {number} days - Number of days
   * @returns {string} Formatted text
   */
  formatDaysText: function (days) {
    if (!days || days <= 0) {
      return "";
    }
    return days === 1 ? "1 Working Day" : `${days} Working Days`;
  },

  /**
   * Convert DD/MM/YYYY to YYYY-MM-DD
   * @param {string} dateStr - Date string in DD/MM/YYYY format
   * @returns {string} Date string in YYYY-MM-DD format
   */
  convertDateFormat: function (dateStr) {
    if (!dateStr) return "";

    try {
      const [day, month, year] = dateStr.split("/");
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.warn("[UTILS] Date format conversion failed:", error);
      return "";
    }
  },
};

console.log("[UTILS] Utility module loaded successfully");
