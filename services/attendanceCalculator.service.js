const calculateAttendance = ({ inTime, outTime, requiredMinutes = 540 }) => {
  if (!inTime || !outTime) {
    return {
      totalMinutes: 0,
      overtimeMinutes: 0,
      deficitMinutes: 0,
    };
  }

  const totalMinutes = Math.floor(
    (new Date(outTime) - new Date(inTime)) / 60000,
  );

  const overtimeMinutes = Math.max(totalMinutes - requiredMinutes, 0);

  const deficitMinutes = Math.max(requiredMinutes - totalMinutes, 0);

  return {
    totalMinutes,
    overtimeMinutes,
    deficitMinutes,
  };
};

module.exports = {
  calculateAttendance,
};