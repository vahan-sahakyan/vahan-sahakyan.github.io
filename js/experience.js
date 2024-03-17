// experience.js

document.addEventListener("DOMContentLoaded", function () {
  const startDate = new Date("2023-10-01");
  const currentDate = new Date();
  const diffInMonths =
    (currentDate.getFullYear() - startDate.getFullYear()) * 12 + (currentDate.getMonth() - startDate.getMonth()) + 1;
  const currentExpTimeElement = document.getElementById("current-exp-time");
  if (currentExpTimeElement) currentExpTimeElement.textContent = formatExperienceTime(diffInMonths);
});

// Function to format the experience time
function formatExperienceTime(months) {
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (years === 0 && remainingMonths === 0) return "1 mo";
  const yearsString = years > 0 ? `${years} ${years === 1 ? "yr" : "yrs"}` : "";
  const monthsString = remainingMonths > 0 ? `${remainingMonths} ${remainingMonths === 1 ? "mo" : "mos"}` : "";
  if (years > 0 && remainingMonths === 0) return yearsString;
  else if (years === 0 && remainingMonths > 0) return monthsString;
  return `${yearsString} ${monthsString}`;
}
