// experience.js

document.addEventListener("DOMContentLoaded", function () {
  const startDate = new Date("Oct 2023");

  // Get the current date
  const currentDate = new Date();

  // Calculate the difference in months
  const diffInMonths =
    (currentDate.getFullYear() - startDate.getFullYear()) * 12 + (currentDate.getMonth() - startDate.getMonth()) + 1;

  // Display the experience time in months
  const currentExpTimeElement = document.getElementById("current-exp-time");
  if (currentExpTimeElement) {
    currentExpTimeElement.textContent = formatExperienceTime(diffInMonths);
  }
});

// Function to format the experience time
function formatExperienceTime(months) {
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  if (years === 0 && remainingMonths === 0) {
    return "Less than a month";
  }

  const yearsString = years > 0 ? `${years} ${years === 1 ? "yr" : "yrs"}` : "";
  const monthsString = remainingMonths > 0 ? `${remainingMonths} ${remainingMonths === 1 ? "mo" : "mos"}` : "";

  // Handle the case where only years or only months are present
  if (years > 0 && remainingMonths === 0) {
    return yearsString;
  } else if (years === 0 && remainingMonths > 0) {
    return monthsString;
  }

  // Handle the case where both years and months are present
  return `${yearsString} ${monthsString}`;
}
