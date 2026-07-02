const getDaysCount = (
  clientDoj,
  noticeLastDate,
  billMonth,
  billYear
) => {

 if (!clientDoj) {
  
  if (noticeLastDate) {
    const lastDate = new Date(noticeLastDate);

    const lastMonth = lastDate.getMonth() + 1;
    const lastYear = lastDate.getFullYear();
    const lastDay = Math.min(lastDate.getDate(), 30);

    // Client purane month se hai aur is month vacate hua
    if (
      lastMonth === billMonth &&
      lastYear === billYear
    ) {
      return lastDay;
    }
  }

  // Client purane month se continue hai
  return 30;
}

  const doj = new Date(clientDoj);

  const dojDay = Math.min(doj.getDate(), 30);
  const dojMonth = doj.getMonth() + 1;
  const dojYear = doj.getFullYear();

  let lastDate = null;
  let lastDay = null;
  let lastMonth = null;
  let lastYear = null;

  if (noticeLastDate) {
    lastDate = new Date(noticeLastDate);

    lastDay = Math.min(lastDate.getDate(), 30);
    lastMonth = lastDate.getMonth() + 1;
    lastYear = lastDate.getFullYear();
  }

  // ---------------------------------------
  // Case 1
  // DOJ & Last Date both in Billing Month
  // Example:
  // DOJ = 22 Jun
  // Last = 28 Jun
  // => 7 Days
  // ---------------------------------------
  if (
    dojMonth === billMonth &&
    dojYear === billYear &&
    lastDate &&
    lastMonth === billMonth &&
    lastYear === billYear
  ) {
    return lastDay - dojDay + 1;
  }

  // ---------------------------------------
  // Case 2
  // DOJ in Billing Month
  // No Last Date
  // Example:
  // DOJ = 22 Jun
  // => 9 Days
  // ---------------------------------------
  if (
    dojMonth === billMonth &&
    dojYear === billYear
  ) {
    return 30 - dojDay + 1;
  }

  // ---------------------------------------
  // Case 3
  // Client joined before this month
  // Vacated this month
  // Example:
  // DOJ = May
  // Last = 10 Jun
  // => 10 Days
  // ---------------------------------------
  if (
    lastDate &&
    lastMonth === billMonth &&
    lastYear === billYear
  ) {
    return lastDay;
  }

  // ---------------------------------------
  // Case 4
  // Full Month Stay
  // ---------------------------------------
  return 30;
};

module.exports = getDaysCount;