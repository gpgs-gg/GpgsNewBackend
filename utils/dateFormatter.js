const convertStringFormatDateTime = (date) => {
  if (!date) return "";

  const d = new Date(date);

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");

  const ampm = hours >= 12 ? "PM" : "AM";

  hours = hours % 12;
  hours = hours === 0 ? 12 : hours;

  hours = String(hours).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes} ${ampm}`;
};

const convertStringToDateTime = (dateString) => {
  if (!dateString) return null;

  if (dateString instanceof Date) {
    return dateString;
  }

  const [datePart, timePart, ampm] = dateString.split(" ");

  const [year, month, day] = datePart.split("-").map(Number);

  let [hours, minutes] = timePart.split(":").map(Number);

  if (ampm === "PM" && hours !== 12) {
    hours += 12;
  }

  if (ampm === "AM" && hours === 12) {
    hours = 0;
  }

  return new Date(year, month - 1, day, hours, minutes);
};

module.exports = {
  convertStringFormatDateTime,
  convertStringToDateTime,
};