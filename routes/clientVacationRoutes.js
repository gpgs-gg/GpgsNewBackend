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
const {verifyJWT} = require("../middleware/verifyJWT");

// ✅ Public routes (no auth middleware - add if needed)

// GET all vacations (with filters)
router.get('/',verifyJWT, getAllVacations);

// GET current month vacation for a client
router.get('/current/:clientId', verifyJWT, getCurrentMonthVacation);

// GET vacation for EB calculation
router.get('/eb/:clientId',verifyJWT, getVacationForEB);

// GET all vacation history for a client
router.get('/client/:clientId',verifyJWT, getAllVacationsByClient);

// GET vacation by specific month/year
router.get('/client/:clientId/month',verifyJWT, getVacationByMonth);

// CREATE new vacation record
router.post('/',verifyJWT, createVacation);

// UPSERT (Create or Update) vacation record
router.put('/client/:clientId/month/:month/year/:year',verifyJWT, upsertVacation);

// UPDATE specific vacation record by ID
router.put('/:id',verifyJWT, updateVacation);

// DELETE specific vacation record by ID
router.delete('/:id',verifyJWT, deleteVacation);

// DELETE all vacation records for a client
router.delete('/client/:clientId',verifyJWT, deleteAllVacationsByClient);

module.exports = router;