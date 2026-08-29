const express = require('express');
const router = express.Router();
const {
  getVacationByMonth,
  getAllVacationsByClient,
  getAllVacations,
  createVacation,
  updateVacation,
  upsertVacation,
  deleteVacation,
  deleteAllVacationsByClient,
  getCurrentMonthVacation,
  getVacationForEB,
} = require('../controllers/clientVacationController');

// ✅ Public routes (no auth middleware - add if needed)

// GET all vacations (with filters)
router.get('/', getAllVacations);

// GET current month vacation for a client
router.get('/current/:clientId', getCurrentMonthVacation);

// GET vacation for EB calculation
router.get('/eb/:clientId', getVacationForEB);

// GET all vacation history for a client
router.get('/client/:clientId', getAllVacationsByClient);

// GET vacation by specific month/year
router.get('/client/:clientId/month', getVacationByMonth);

// CREATE new vacation record
router.post('/', createVacation);

// UPSERT (Create or Update) vacation record
router.put('/client/:clientId/month/:month/year/:year', upsertVacation);

// UPDATE specific vacation record by ID
router.put('/:id', updateVacation);

// DELETE specific vacation record by ID
router.delete('/:id', deleteVacation);

// DELETE all vacation records for a client
router.delete('/client/:clientId', deleteAllVacationsByClient);

module.exports = router;